"""
Tel Ali 3B Tahliye ve Mekânsal Navigasyon Motoru (Deterministic Topological & Geometric Router)

Bu modül, Tel Ali'nin odadan başlayıp fiziksel kapı açıklıklarından (portal_xy),
kat koridorlarından ve yangın merdivenlerinden geçerek bina dışındaki güvenli toplanma alanına
(Muster Point) ulaşmasını sağlayan Dijkstra/A* navigasyon grafı, durum makinesi (State Machine)
ve takılma/ilerleme denetleyicisini (Stall Checker) içerir.

Telif Hakkı (c) 2026 Seydi Eryılmaz (@seydivakkas) - ÖZEL LİSANS — TÜM HAKLAR SAKLIDIR
"""

import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Set, Tuple, Any
import networkx as nx


class EvacuationState(str, Enum):
    IDLE = "IDLE"
    PLACED = "PLACED"
    ROUTE_READY = "ROUTE_READY"
    EVACUATING = "EVACUATING"
    BLOCKED = "BLOCKED"
    REROUTING = "REROUTING"
    EVACUATED = "EVACUATED"
    FAILED = "FAILED"


class EvacuationErrorCode(str, Enum):
    BLOCKED_BY_WALL = "BLOCKED_BY_WALL"
    DOOR_NOT_CONNECTED = "DOOR_NOT_CONNECTED"
    INVALID_WAYPOINT = "INVALID_WAYPOINT"
    ROUTE_NOT_FOUND = "ROUTE_NOT_FOUND"
    MOVEMENT_STALLED = "MOVEMENT_STALLED"
    INVALID_COORDINATE_TRANSFORM = "INVALID_COORDINATE_TRANSFORM"


class WaypointType(str, Enum):
    ROOM_CENTROID = "ROOM_CENTROID"
    DOOR_PORTAL = "DOOR_PORTAL"
    STAIR_STEP = "STAIR_STEP"
    EXIT_PORTAL = "EXIT_PORTAL"
    MUSTER_POINT = "MUSTER_POINT"


@dataclass
class NavRoom:
    id: str
    name: str
    room_type: str
    floor_level: int
    pos: Tuple[float, float, float]  # (X, Y, Z) 3B dünya koordinatı
    area_m2: float = 15.0
    polygon_2d: List[Tuple[float, float]] = field(default_factory=list)
    is_exit: bool = False


@dataclass
class NavDoor:
    id: str
    source: str
    target: str
    door_width_cm: float = 90.0
    portal_pos: Tuple[float, float, float] = (0.0, 0.0, 0.0)  # (X, Y, Z) Kapı eşiği orta noktası
    is_fire_resistant: bool = False
    usable_in_fire: bool = True
    is_vertical: bool = False


@dataclass
class NavWaypoint:
    pos: Tuple[float, float, float]
    wp_type: WaypointType
    room_id: Optional[str] = None
    room_name: Optional[str] = None
    door_id: Optional[str] = None
    floor_level: int = 0
    description_tr: str = ""


@dataclass
class RouteResult:
    success: bool
    state: EvacuationState
    error_code: Optional[EvacuationErrorCode] = None
    waypoints: List[NavWaypoint] = field(default_factory=list)
    path_nodes: List[str] = field(default_factory=list)
    total_distance_m: float = 0.0
    estimated_time_sec: float = 0.0
    failure_reason_tr: str = ""


class TelAliNavigationEngine:
    """
    Fiziksel mimari geometrisi ve kapı geçişlerine dayalı deterministik tahliye navigasyon motoru.
    """

    def __init__(self, run_speed_mps: float = 3.8, stall_timeout_sec: float = 3.5):
        self.run_speed = run_speed_mps
        self.stall_timeout = stall_timeout_sec
        self.rooms: Dict[str, NavRoom] = {}
        self.doors: List[NavDoor] = []
        self.graph = nx.Graph()

    def build_graph(self, rooms: List[NavRoom], doors: List[NavDoor], auto_link_stairs: bool = True):
        self.rooms = {str(r.id): r for r in rooms}
        self.doors = doors
        self.graph.clear()

        # Düğümleri ekle
        for r_id, r in self.rooms.items():
            self.graph.add_node(
                r_id,
                room_type=r.room_type,
                name=r.name,
                floor_level=r.floor_level,
                pos=r.pos,
                is_exit=bool(
                    r.is_exit
                    or r.room_type in ("dis_cikis", "exit")
                    or any(w in r.name.lower() for w in ["çıkış", "cikis", "exit"])
                    or any(w in str(r.id).lower() for w in ["cikis", "exit"])
                )
            )

        # Kapı kenarlarını ekle
        for d in doors:
            src = str(d.source)
            tgt = str(d.target)
            if src in self.rooms and tgt in self.rooms:
                pos_src = self.rooms[src].pos
                pos_tgt = self.rooms[tgt].pos
                dist = math.dist(pos_src, pos_tgt)
                self.graph.add_edge(
                    src,
                    tgt,
                    door_id=d.id,
                    door_width_cm=d.door_width_cm,
                    portal_pos=d.portal_pos,
                    is_fire_resistant=d.is_fire_resistant,
                    usable_in_fire=d.usable_in_fire,
                    is_vertical=d.is_vertical,
                    weight=max(0.5, dist)
                )

        # Katlar arası yangın merdivenlerini otomatik bağla (eğer açık bir dikey kapı kenarı yoksa)
        if auto_link_stairs:
            stair_rooms = [r for r in self.rooms.values() if r.room_type == "yangin_merdiveni"]
            floors = sorted(list(set(r.floor_level for r in stair_rooms)))
            for i in range(len(floors) - 1):
                fl1 = floors[i]
                fl2 = floors[i + 1]
                stairs_fl1 = [r for r in stair_rooms if r.floor_level == fl1]
                stairs_fl2 = [r for r in stair_rooms if r.floor_level == fl2]
                for s1 in stairs_fl1:
                    for s2 in stairs_fl2:
                        horiz_dist = math.hypot(s1.pos[0] - s2.pos[0], s1.pos[2] - s2.pos[2])
                        # Çapraz bina içi atlamalarını engelle (yalnızca aynı şaft kovanı: <= 3.5m)
                        if horiz_dist > 3.5:
                            continue
                        if not self.graph.has_edge(s1.id, s2.id):
                            dist = abs(s1.pos[1] - s2.pos[1])
                            mid_portal = ((s1.pos[0] + s2.pos[0]) / 2, (s1.pos[1] + s2.pos[1]) / 2, (s1.pos[2] + s2.pos[2]) / 2)
                            self.graph.add_edge(
                                s1.id,
                                s2.id,
                                door_id=f"stair_{s1.id}_{s2.id}",
                                door_width_cm=120.0,
                                portal_pos=mid_portal,
                                is_fire_resistant=True,
                                usable_in_fire=True,
                                is_vertical=True,
                                weight=max(1.0, dist * 1.5)
                            )

    def compute_route(
        self,
        start_room_id: str,
        blocked_door_ids: Optional[Set[str]] = None
    ) -> RouteResult:
        start_id = str(start_room_id)
        if start_id not in self.rooms:
            return RouteResult(
                success=False,
                state=EvacuationState.FAILED,
                error_code=EvacuationErrorCode.INVALID_WAYPOINT,
                failure_reason_tr=f"Başlangıç odası '{start_id}' binada bulunamadı."
            )

        start_room = self.rooms[start_id]

        # Çıkış düğümlerini bul
        exit_nodes = [
            n for n, d in self.graph.nodes(data=True)
            if d.get("is_exit")
            or d.get("room_type") in ("dis_cikis", "exit")
            or any(w in str(d.get("name", "")).lower() for w in ["çıkış", "cikis", "exit"])
            or any(w in str(n).lower() for w in ["cikis", "exit"])
        ]

        if not exit_nodes:
            # Zemin kattaki yangın merdivenini çıkış yedeği olarak değerlendir
            exit_nodes = [
                n for n, d in self.graph.nodes(data=True)
                if d.get("floor_level") == 0 and d.get("room_type") in ("yangin_merdiveni", "kat_koridoru")
            ]

        if not exit_nodes:
            return RouteResult(
                success=False,
                state=EvacuationState.FAILED,
                error_code=EvacuationErrorCode.ROUTE_NOT_FOUND,
                failure_reason_tr="Binada tanımlı geçerli bir dış tahliye çıkışı bulunamadı."
            )

        # Filtrelenmiş yangın alt-grafı (usable_in_fire == True ve blocked_door_ids harici)
        blocked_doors = blocked_door_ids or set()
        active_subgraph = nx.Graph()
        for u, v, d in self.graph.edges(data=True):
            if not d.get("usable_in_fire", True):
                continue
            if d.get("door_id") in blocked_doors:
                continue
            active_subgraph.add_edge(u, v, **d)

        for n in self.graph.nodes():
            if n in active_subgraph or n == start_id:
                active_subgraph.add_node(n, **self.graph.nodes[n])

        # Başlangıç odası zaten bir çıkış ise
        is_start_exit = (
            start_room.is_exit
            or start_room.room_type in ("dis_cikis", "exit")
            or any(w in start_room.name.lower() for w in ["çıkış", "cikis", "exit"])
        )
        if is_start_exit:
            out_pos = (start_room.pos[0], start_room.pos[1], start_room.pos[2] - 3.0)
            wps = [
                NavWaypoint(
                    pos=start_room.pos,
                    wp_type=WaypointType.ROOM_CENTROID,
                    room_id=start_room.id,
                    room_name=start_room.name,
                    floor_level=start_room.floor_level,
                    description_tr=f"{start_room.name} Çıkış Noktasında Hazır"
                ),
                NavWaypoint(
                    pos=out_pos,
                    wp_type=WaypointType.MUSTER_POINT,
                    room_id=start_room.id,
                    room_name=start_room.name,
                    floor_level=start_room.floor_level,
                    description_tr="Güvenli Dış Toplanma Alanı"
                )
            ]
            dist = math.dist(start_room.pos, out_pos)
            return RouteResult(
                success=True,
                state=EvacuationState.ROUTE_READY,
                waypoints=wps,
                path_nodes=[start_room.id],
                total_distance_m=dist,
                estimated_time_sec=dist / self.run_speed
            )

        # En kısa Dijkstra yolu
        best_path: Optional[List[str]] = None
        best_cost = float("inf")

        for ex in exit_nodes:
            if ex == start_id:
                continue
            try:
                path = nx.shortest_path(active_subgraph, source=start_id, target=ex, weight="weight")
                cost = nx.shortest_path_length(active_subgraph, source=start_id, target=ex, weight="weight")
                if cost < best_cost:
                    best_cost = cost
                    best_path = path
            except (nx.NetworkXNoPath, nx.NodeNotFound):
                continue

        if not best_path:
            return RouteResult(
                success=False,
                state=EvacuationState.FAILED,
                error_code=EvacuationErrorCode.ROUTE_NOT_FOUND,
                failure_reason_tr=f"'{start_room.name}' odasından bina çıkışına kesintisiz bir kapı bağlantısı bulunamadı."
            )

        # Geometrik Rota Noktalarını (Waypoints) Genişlet (Oda -> Gerçek Kapı Eşiği -> Sonraki Oda)
        waypoints: List[NavWaypoint] = []
        total_dist = 0.0

        # Başlangıç odası merkezi
        waypoints.append(
            NavWaypoint(
                pos=start_room.pos,
                wp_type=WaypointType.ROOM_CENTROID,
                room_id=start_room.id,
                room_name=start_room.name,
                floor_level=start_room.floor_level,
                description_tr=f"{start_room.name} içinde hazırlandı"
            )
        )

        for i in range(len(best_path) - 1):
            curr_id = best_path[i]
            next_id = best_path[i + 1]
            edge_data = active_subgraph[curr_id][next_id]
            door_id = edge_data.get("door_id", "")
            portal = edge_data.get("portal_pos", self.rooms[curr_id].pos)
            is_vert = edge_data.get("is_vertical", False)

            curr_room = self.rooms[curr_id]
            next_room = self.rooms[next_id]

            if is_vert:
                # Merdivenden kat geçişi (ara basamak noktaları ekle)
                steps_count = 3
                for s in range(1, steps_count + 1):
                    t = s / (steps_count + 1)
                    step_x = curr_room.pos[0] * (1 - t) + next_room.pos[0] * t + 0.4 * math.sin(t * math.pi)
                    step_y = curr_room.pos[1] * (1 - t) + next_room.pos[1] * t
                    step_z = curr_room.pos[2] * (1 - t) + next_room.pos[2] * t + 0.4 * math.cos(t * math.pi)
                    step_pos = (round(step_x, 3), round(step_y, 3), round(step_z, 3))
                    waypoints.append(
                        NavWaypoint(
                            pos=step_pos,
                            wp_type=WaypointType.STAIR_STEP,
                            room_id=curr_id,
                            door_id=door_id,
                            floor_level=curr_room.floor_level if t < 0.5 else next_room.floor_level,
                            description_tr=f"Yangın Merdiveni ({curr_room.floor_level}. Kattan {next_room.floor_level}. Kata Geçiş)"
                        )
                    )
            else:
                # Gerçek kapı eşiği noktasından geçiş
                # Eşik Y kotu oda zemin kotu ile uyumlu olmalı
                pz = portal[2] if len(portal) > 2 else portal[1]
                is_dummy = abs(portal[0]) < 0.01 and abs(pz) < 0.01 and (math.dist(curr_room.pos, (0, 0, 0)) > 1.0 or math.dist(next_room.pos, (0, 0, 0)) > 1.0)
                if is_dummy:
                    portal_3d = (
                        round((curr_room.pos[0] + next_room.pos[0]) / 2.0, 3),
                        curr_room.pos[1],
                        round((curr_room.pos[2] + next_room.pos[2]) / 2.0, 3)
                    )
                else:
                    portal_3d = (portal[0], curr_room.pos[1], pz)
                waypoints.append(
                    NavWaypoint(
                        pos=portal_3d,
                        wp_type=WaypointType.DOOR_PORTAL,
                        room_id=curr_id,
                        door_id=door_id,
                        floor_level=curr_room.floor_level,
                        description_tr=f"{curr_room.name} ➔ {next_room.name} Kapı Açıklığından Geçiş"
                    )
                )

            # Sonraki odanın merkezine ulaşım
            waypoints.append(
                NavWaypoint(
                    pos=next_room.pos,
                    wp_type=WaypointType.ROOM_CENTROID,
                    room_id=next_id,
                    room_name=next_room.name,
                    floor_level=next_room.floor_level,
                    description_tr=f"{next_room.name} Alanına Ulaşıldı"
                )
            )

        # Son çıkış kapısından güvenli dış bölgeye (Muster Point) uzatma
        final_room = self.rooms[best_path[-1]]
        prev_pos = waypoints[-2].pos if len(waypoints) >= 2 else final_room.pos

        # Dışarı yön vektörü
        out_dx = final_room.pos[0] - prev_pos[0]
        out_dz = final_room.pos[2] - prev_pos[2]
        len_dir = math.hypot(out_dx, out_dz)
        if len_dir > 0.05:
            norm_dx = out_dx / len_dir
            norm_dz = out_dz / len_dir
        else:
            norm_dx = 0.0
            norm_dz = -1.0

        muster_pos = (
            round(final_room.pos[0] + norm_dx * 3.2, 3),
            final_room.pos[1],
            round(final_room.pos[2] + norm_dz * 3.2, 3)
        )

        waypoints.append(
            NavWaypoint(
                pos=muster_pos,
                wp_type=WaypointType.MUSTER_POINT,
                room_id=final_room.id,
                room_name=final_room.name,
                floor_level=final_room.floor_level,
                description_tr="Bina Dışı Güvenli Toplanma Alanına Ulaşıldı"
            )
        )

        # Toplam mesafe hesabı
        for w in range(len(waypoints) - 1):
            total_dist += math.dist(waypoints[w].pos, waypoints[w + 1].pos)

        return RouteResult(
            success=True,
            state=EvacuationState.ROUTE_READY,
            waypoints=waypoints,
            path_nodes=best_path,
            total_distance_m=round(total_dist, 2),
            estimated_time_sec=round(total_dist / self.run_speed, 2)
        )


class EvacuationSimulationController:
    """
    Zaman adımlı (dt) kare-hızından bağımsız karakter simülasyon kontrolcüsü.
    Durum makinesini, ilerleme ve takılma denetimini yürütür.
    """

    def __init__(self, route: RouteResult, run_speed_mps: float = 3.8, stall_timeout_sec: float = 3.5):
        self.route = route
        self.run_speed = run_speed_mps
        self.stall_timeout = stall_timeout_sec
        self.waypoints = route.waypoints
        self.current_wp_idx = 0
        self.current_pos = route.waypoints[0].pos if route.waypoints else (0.0, 0.0, 0.0)
        self.current_state = EvacuationState.PLACED if route.success else EvacuationState.FAILED
        self.error_code: Optional[EvacuationErrorCode] = route.error_code
        self.elapsed_time_sec = 0.0
        self.time_since_progress = 0.0
        self.traveled_distance_m = 0.0
        self.status_text_tr = self.waypoints[0].description_tr if self.waypoints else "Konumlandırma Bekleniyor"
        self.health = 100.0

    def start_evacuation(self):
        if self.route.success and len(self.waypoints) >= 2:
            self.current_state = EvacuationState.EVACUATING
            self.current_wp_idx = 1
            self.status_text_tr = self.waypoints[1].description_tr
            self.time_since_progress = 0.0
        else:
            self.current_state = EvacuationState.FAILED
            self.error_code = EvacuationErrorCode.ROUTE_NOT_FOUND
            self.status_text_tr = "Tahliye rotası bulunamadı."

    def step(self, dt: float, fire_origin: Optional[Tuple[float, float, float]] = None, smoke_layer_h: float = 2.8) -> EvacuationState:
        """
        dt süresi kadar karakteri hedefe doğru ilerletir (kare hızından bağımsız sabit hız entegrasyonu).
        """
        if self.current_state != EvacuationState.EVACUATING:
            return self.current_state

        self.elapsed_time_sec += dt
        target_wp = self.waypoints[self.current_wp_idx]
        target_pos = target_wp.pos

        dist_to_target = math.dist(self.current_pos, target_pos)
        step_move = self.run_speed * dt

        # İlerleme denetimi (Stall check)
        if dist_to_target <= step_move or step_move > 0.01:
            self.time_since_progress = 0.0
        else:
            self.time_since_progress += dt

        if self.time_since_progress > self.stall_timeout:
            self.current_state = EvacuationState.BLOCKED
            self.error_code = EvacuationErrorCode.MOVEMENT_STALLED
            self.status_text_tr = "İlerleme durdu: Karakter takıldı (MOVEMENT_STALLED)."
            return self.current_state

        # Karakteri hedefe yaklaştır
        if dist_to_target <= step_move:
            self.current_pos = target_pos
            self.traveled_distance_m += dist_to_target
            self.current_wp_idx += 1

            if self.current_wp_idx >= len(self.waypoints):
                # Son hedefe ulaşıldı: Güvenli Toplanma Alanı
                self.current_state = EvacuationState.EVACUATED
                self.status_text_tr = "✓ Tahliye Başarılı: Güvenli Dış Toplanma Alanına Ulaşıldı!"
                return self.current_state
            else:
                next_wp = self.waypoints[self.current_wp_idx]
                self.status_text_tr = next_wp.description_tr
        else:
            # Doğrusal vektörel hareket
            dx = (target_pos[0] - self.current_pos[0]) / dist_to_target
            dy = (target_pos[1] - self.current_pos[1]) / dist_to_target
            dz = (target_pos[2] - self.current_pos[2]) / dist_to_target

            new_x = self.current_pos[0] + dx * step_move
            new_y = self.current_pos[1] + dy * step_move
            new_z = self.current_pos[2] + dz * step_move

            self.current_pos = (round(new_x, 4), round(new_y, 4), round(new_z, 4))
            self.traveled_distance_m += step_move

        # Sağlık ve duman dozu hesabı (hareketten bağımsız fiziksel maruziyet)
        if fire_origin and smoke_layer_h < 1.8:
            dist_to_fire = math.dist(self.current_pos, fire_origin)
            if dist_to_fire < 6.0 and target_wp.wp_type != WaypointType.STAIR_STEP:
                dose = (1.8 - smoke_layer_h) * 1.5 * dt
                self.health = max(10.0, self.health - dose)

        return self.current_state
