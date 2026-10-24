import math
from typing import Dict, List, Tuple, Optional, Any
import networkx as nx
from shapely.geometry import Polygon, LineString, Point, MultiPolygon
from shapely.strtree import STRtree
from shapely.ops import nearest_points, unary_union

from diagram_yonetmelik.schemas import (
    RoomPolygonInput,
    DoorGeometryInput,
    FloorClusterInfo,
    VerticalShaftLink,
    Building3DRAGResult,
)


class FloorplanToRAGExtractor:
    """
    2B oda poligonları ve kapı çizgilerinden Bölge Komşuluk Grafı (RAG) çıkarır.
    L-tipi koridorlarda duvar kesmeyen iç görünürlük yolu hesaplar.
    """
    def __init__(
        self,
        unit_scale_to_meters: float = 1.0,
        max_wall_thickness_m: float = 0.35,
        open_passage_gap_tol_m: float = 0.05,
        min_open_passage_width_m: float = 0.80
    ):
        self.scale = unit_scale_to_meters
        self.wall_tol_m = max_wall_thickness_m
        self.passage_tol_m = open_passage_gap_tol_m
        self.min_passage_w_m = min_open_passage_width_m

    def _scale_polygon(self, poly: Polygon) -> Polygon:
        if self.scale == 1.0:
            return poly
        coords = [(x * self.scale, y * self.scale) for x, y in poly.exterior.coords]
        holes = [
            [(x * self.scale, y * self.scale) for x, y in interior.coords]
            for interior in poly.interiors
        ]
        return Polygon(coords, holes)

    def _scale_linestring(self, line: LineString) -> LineString:
        if self.scale == 1.0:
            return line
        return LineString([(x * self.scale, y * self.scale) for x, y in line.coords])

    def _compute_safe_anchor_point(self, poly: Polygon) -> Point:
        centroid = poly.centroid
        if poly.contains(centroid):
            return centroid
        return poly.representative_point()

    def _compute_geodesic_walking_distance(
        self,
        poly: Polygon,
        start_pt: Point,
        portal_pt: Point
    ) -> float:
        boundary_portal = nearest_points(poly, portal_pt)[0]
        direct_line = LineString([start_pt, boundary_portal])
        if poly.buffer(0.05).contains(direct_line):
            return float(start_pt.distance(boundary_portal))

        # L veya U koridorda görünürlük grafı (Visibility Graph)
        shrunk = poly.buffer(-0.15)
        waypoints: List[Point] = [start_pt, boundary_portal]
        if not shrunk.is_empty:
            geoms = [shrunk] if isinstance(shrunk, Polygon) else list(shrunk.geoms)
            for g in geoms:
                for x, y in list(g.exterior.coords)[:-1]:
                    waypoints.append(Point(x, y))
        else:
            for x, y in list(poly.exterior.coords)[:-1]:
                waypoints.append(Point(x, y))

        vis_G = nx.Graph()
        buffered_poly = poly.buffer(0.05)
        for i in range(len(waypoints)):
            for j in range(i + 1, len(waypoints)):
                seg = LineString([waypoints[i], waypoints[j]])
                if buffered_poly.contains(seg):
                    vis_G.add_edge(i, j, weight=float(waypoints[i].distance(waypoints[j])))

        try:
            return float(nx.shortest_path_length(vis_G, source=0, target=1, weight='weight'))
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return float(start_pt.distance(boundary_portal)) * 1.414

    def build_rag(
        self,
        rooms: List[RoomPolygonInput],
        doors: List[DoorGeometryInput],
        detect_open_passages: bool = True
    ) -> nx.Graph:
        G = nx.Graph()
        scaled_rooms: Dict[int, Polygon] = {}
        room_anchors: Dict[int, Point] = {}

        for r in rooms:
            spoly = self._scale_polygon(r.polygon)
            scaled_rooms[r.room_id] = spoly
            anchor = self._compute_safe_anchor_point(spoly)
            room_anchors[r.room_id] = anchor
            area_m2 = float(spoly.area)

            G.add_node(
                r.room_id,
                room_type=r.room_type,
                name_label=r.name_label,
                area_m2=area_m2,
                polygon=spoly,
                anchor_point=(anchor.x, anchor.y),
                floor_level=r.floor_level,
                global_dxf_pos=r.global_dxf_pos
            )

        # STRtree ile Kapı Eşleşmesi
        room_ids = list(scaled_rooms.keys())
        room_poly_list = [scaled_rooms[rid] for rid in room_ids]
        room_tree = STRtree(room_poly_list)

        for d in doors:
            sdoor = self._scale_linestring(d.geometry)
            door_buf = sdoor.buffer(self.wall_tol_m)
            matched_indices = room_tree.query(door_buf)

            # Eşik merkezine en yakın 2 odayı seç (köşede 3. odaya sızmayı önler)
            door_mid = Point(sdoor.coords[len(sdoor.coords) // 2])
            candidates: List[Tuple[float, int]] = []
            for idx in matched_indices:
                rid = room_ids[idx]
                dist = scaled_rooms[rid].distance(door_mid)
                candidates.append((dist, rid))
            candidates.sort(key=lambda x: x[0])

            if len(candidates) >= 2:
                u, v = candidates[0][1], candidates[1][1]
                w_cm = d.width_cm or (float(sdoor.length) * 100.0)
                d_u = self._compute_geodesic_walking_distance(scaled_rooms[u], room_anchors[u], door_mid)
                d_v = self._compute_geodesic_walking_distance(scaled_rooms[v], room_anchors[v], door_mid)
                total_walking_dist = d_u + d_v

                G.add_edge(
                    u, v,
                    door_id=d.door_id,
                    door_width_cm=float(w_cm),
                    is_fire_resistant=bool(d.is_fire_resistant),
                    distance_m=float(total_walking_dist),
                    connection_type="door",
                    portal_xy=(door_mid.x, door_mid.y),
                    usable_in_fire=True
                )

        # Açık Geçiş Tespiti (Örn: Salon - Açık Mutfak)
        if detect_open_passages:
            for i in range(len(room_ids)):
                for j in range(i + 1, len(room_ids)):
                    u, v = room_ids[i], room_ids[j]
                    if G.has_edge(u, v):
                        continue
                    p_u, p_v = scaled_rooms[u], scaled_rooms[v]
                    if p_u.distance(p_v) <= self.passage_tol_m:
                        inter = p_u.buffer(self.passage_tol_m).intersection(p_v.buffer(self.passage_tol_m))
                        passage_w = float(inter.length / 2.0) if not inter.is_empty else 0.0
                        if passage_w >= self.min_passage_w_m:
                            dist = float(room_anchors[u].distance(room_anchors[v]))
                            G.add_edge(
                                u, v,
                                door_id=-1,
                                door_width_cm=passage_w * 100.0,
                                is_fire_resistant=False,
                                distance_m=dist,
                                connection_type="open_passage",
                                usable_in_fire=True
                            )
        return G


class MultiFloor3DRAGBuilder:
    """
    Yan yana çizilmiş kat planlarını otomatik adalar halinde ayrıştırır,
    düşey çekirdekleri (yangın merdiveni/asansör) hizalayarak 3B Bina RAG'ı inşa eder.
    """
    def __init__(
        self,
        floor_cluster_buffer_m: float = 2.5,
        default_floor_height_m: float = 3.0,
        stair_walking_multiplier: float = 2.2
    ):
        self.cluster_buf = floor_cluster_buffer_m
        self.floor_h = default_floor_height_m
        self.stair_factor = stair_walking_multiplier
        self.extractor = FloorplanToRAGExtractor()

    def build_3d_building_rag(
        self,
        rooms: List[RoomPolygonInput],
        doors: List[DoorGeometryInput],
        unit_scale_to_meters: float = 1.0,
        floor_height_m: Optional[float] = None
    ) -> Building3DRAGResult:
        h_floor = floor_height_m or self.floor_h
        self.extractor.scale = unit_scale_to_meters

        # 1. Kat Adalarını Morfolojik Genişleme ile Kümele
        polys_scaled = [self.extractor._scale_polygon(r.polygon) for r in rooms]
        combined = unary_union([p.buffer(self.cluster_buf) for p in polys_scaled])
        islands = [combined] if isinstance(combined, Polygon) else list(combined.geoms)

        # Katları X/Y pozisyonuna veya etiketlerine göre sırala
        island_boxes = []
        for isl in islands:
            minx, miny, maxx, maxy = isl.bounds
            island_boxes.append((miny, minx, isl))
        island_boxes.sort(key=lambda b: (-b[0], b[1]))  # Yukarıdan aşağıya, soldan sağa

        # 2. Her Odayı Kat Adasına Ata
        floor_rooms: Dict[int, List[RoomPolygonInput]] = {i: [] for i in range(len(island_boxes))}
        for r, spoly in zip(rooms, polys_scaled):
            assigned = False
            for f_idx, (_, _, isl) in enumerate(island_boxes):
                if isl.contains(spoly.centroid):
                    r_copy = RoomPolygonInput(
                        room_id=r.room_id,
                        room_type=r.room_type,
                        polygon=r.polygon,
                        name_label=r.name_label,
                        floor_level=f_idx - 1 if len(island_boxes) > 2 else f_idx,  # Bodrum desteği
                        global_dxf_pos=r.global_dxf_pos
                    )
                    floor_rooms[f_idx].append(r_copy)
                    assigned = True
                    break
            if not assigned:
                floor_rooms[0].append(r)

        # 3. Her Katın 2B RAG'ını Kur ve 3B Grafa Ekle
        G_3d = nx.Graph()
        floor_clusters: List[FloorClusterInfo] = []
        floor_core_anchors: Dict[int, Tuple[float, float]] = {}

        for f_idx, r_list in floor_rooms.items():
            if not r_list:
                continue
            actual_level = r_list[0].floor_level
            d_list = [d for d in doors if d.floor_level == actual_level or d.floor_level == 0]
            G_2d = self.extractor.build_rag(r_list, d_list, detect_open_passages=True)

            # Çekirdek Hizalama Referansı (Yangın merdiveni veya merkez)
            core_pt = (0.0, 0.0)
            for n, d in G_2d.nodes(data=True):
                if d.get("room_type") in ("yangin_merdiveni", "yangin_holu"):
                    core_pt = d.get("anchor_point", (0.0, 0.0))
                    break
            floor_core_anchors[actual_level] = core_pt

            elevation_z = float(actual_level * h_floor)
            for n, d in G_2d.nodes(data=True):
                ax, ay = d.get("anchor_point", (0.0, 0.0))
                # Çekirdeğe göre yerel koordinat
                lx = ax - core_pt[0]
                ly = ay - core_pt[1]
                node_attrs = dict(d)
                node_attrs.update({
                    "pos_3d": (lx, ly, elevation_z),
                    "pos_2d": (ax, ay),
                    "floor_level": actual_level,
                    "elevation_z": elevation_z
                })
                G_3d.add_node(n, **node_attrs)

            for u, v, ed in G_2d.edges(data=True):
                G_3d.add_edge(u, v, **ed, is_vertical=False)

            floor_clusters.append(FloorClusterInfo(
                floor_index=f_idx,
                floor_level=actual_level,
                title_label=f"KAT_{actual_level}",
                elevation_z_m=elevation_z,
                boundary_box=(0.0, 0.0, 0.0, 0.0),
                core_anchor_xy=core_pt,
                rooms_count=len(r_list),
                doors_count=G_2d.number_of_edges()
            ))

        # 4. Düşey Şaft Kenarlarını Bağla (Yangın Merdiveni ve Asansör)
        vertical_links: List[VerticalShaftLink] = []
        floors_sorted = sorted(list(set([d.get("floor_level", 0) for _, d in G_3d.nodes(data=True)])))

        for idx in range(len(floors_sorted) - 1):
            lower_f = floors_sorted[idx]
            upper_f = floors_sorted[idx + 1]

            for shaft_type in ["yangin_merdiveni", "asansor"]:
                low_nodes = [n for n, d in G_3d.nodes(data=True) if d.get("floor_level") == lower_f and d.get("room_type") == shaft_type]
                up_nodes = [n for n, d in G_3d.nodes(data=True) if d.get("floor_level") == upper_f and d.get("room_type") == shaft_type]

                for ln in low_nodes:
                    for un in up_nodes:
                        usable_fire = (shaft_type == "yangin_merdiveni")
                        dz = abs(G_3d.nodes[un]["elevation_z"] - G_3d.nodes[ln]["elevation_z"])
                        eff_dist = dz * (self.stair_factor if usable_fire else 1.0)

                        G_3d.add_edge(
                            ln, un,
                            connection_type="vertical_shaft",
                            shaft_type=shaft_type,
                            distance_m=float(eff_dist),
                            door_width_cm=120.0 if usable_fire else 90.0,
                            is_fire_resistant=usable_fire,
                            usable_in_fire=usable_fire,
                            is_vertical=True
                        )
                        vertical_links.append(VerticalShaftLink(
                            shaft_type=shaft_type,
                            lower_node_id=ln,
                            upper_node_id=un,
                            lower_floor_level=lower_f,
                            upper_floor_level=upper_f,
                            effective_walking_distance_m=float(eff_dist),
                            usable_in_fire=usable_fire
                        ))

        return Building3DRAGResult(
            G_3d=G_3d,
            floor_clusters=floor_clusters,
            vertical_shaft_links=vertical_links,
            total_floors=len(floors_sorted),
            total_rooms=G_3d.number_of_nodes(),
            total_doors=G_3d.number_of_edges(),
            total_vertical_links=len(vertical_links)
        )

    def compute_3d_fire_escape_route(
        self,
        G_3d: nx.Graph,
        start_node_id: int
    ) -> Tuple[List[int], float]:
        """
        Yangında asansörleri dışlayarak en yakın dış çıkışa 3B Dijkstra rotası bulur.
        """
        def fire_safe_weight(u, v, d):
            if not d.get("usable_in_fire", True):
                return None
            return d.get("distance_m", 1.0)

        subgraph_view = nx.subgraph_view(
            G_3d,
            filter_edge=lambda u, v: G_3d[u][v].get("usable_in_fire", True)
        )

        exit_nodes = [n for n, d in G_3d.nodes(data=True) if d.get("room_type") == "dis_cikis"]
        if not exit_nodes:
            # Dış çıkış bulunamazsa zemin yangın merdivenini hedefle
            exit_nodes = [n for n, d in G_3d.nodes(data=True) if d.get("floor_level") == 0 and d.get("room_type") == "yangin_merdiveni"]

        best_path: List[int] = []
        best_dist = float("inf")

        for ex in exit_nodes:
            try:
                path = nx.shortest_path(subgraph_view, source=start_node_id, target=ex, weight="distance_m")
                dist = nx.shortest_path_length(subgraph_view, source=start_node_id, target=ex, weight="distance_m")
                if dist < best_dist:
                    best_dist = dist
                    best_path = path
            except (nx.NetworkXNoPath, nx.NodeNotFound):
                continue

        return best_path, (best_dist if best_dist != float("inf") else -1.0)
