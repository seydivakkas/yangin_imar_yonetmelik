import copy
from typing import Dict, List, Set, Tuple, Optional, Any
import networkx as nx
from networkx.algorithms import isomorphism
import torch

from diagram_yonetmelik.schemas import (
    DiscoveredArchitecturalMotif,
    BuildingProgramSummary,
    MacroNodeRecord,
    CoarsenedBuildingResult,
)
from diagram_yonetmelik.gnn_order import (
    SpatialOrderGNN,
    nx_subgraph_to_pyg_data,
    violation_energy,
)


class ArchitecturalSPMiner:
    """
    Şablonsuz Sık Altgraf Madenciliği Motoru.
    GNN Order Embedding uzayında açgözlü büyümeyle (Greedy Growth)
    bina içindeki standart daire tiplerini, çekirdek modüllerini keşfeder ve tekilleştirir.
    """
    def __init__(
        self,
        gnn_model: Optional[SpatialOrderGNN] = None,
        min_support: int = 2,
        max_motif_nodes: int = 8,
        energy_threshold: float = 0.20
    ):
        self.gnn = gnn_model or SpatialOrderGNN()
        self.gnn.eval()
        self.min_support = min_support
        self.max_motif_nodes = max_motif_nodes
        self.threshold = energy_threshold

    def discover_frequent_modules(
        self,
        building_graph: nx.Graph,
        target_seed_types: Optional[List[str]] = None
    ) -> Tuple[List[DiscoveredArchitecturalMotif], BuildingProgramSummary]:
        if target_seed_types is None:
            target_seed_types = ["daire_antresi", "kat_koridoru", "yangin_holu"]

        candidate_seeds = [
            n for n, d in building_graph.nodes(data=True)
            if d.get("room_type") in target_seed_types
        ]

        motifs_by_hash: Dict[str, DiscoveredArchitecturalMotif] = {}
        motif_counter = 1

        for seed in candidate_seeds:
            # Açgözlü Büyütme (Greedy Growth)
            current_nodes = [seed]
            current_graph = building_graph.subgraph(current_nodes).copy()

            for _ in range(self.max_motif_nodes - 1):
                # Sınır komşularını topla (hub sızıntısını önle: koridordan yan daireye atlama)
                boundary_neighbors = set()
                for u in current_nodes:
                    for v in building_graph.neighbors(u):
                        if v not in current_nodes:
                            v_type = building_graph.nodes[v].get("room_type")
                            # Daire içi büyümede kat koridoruna geri sızma
                            if building_graph.nodes[seed].get("room_type") == "daire_antresi" and v_type in ("kat_koridoru", "dis_cikis"):
                                continue
                            boundary_neighbors.add(v)

                if not boundary_neighbors:
                    break

                # En iyi komşuyu seç (O(1) Order Embedding karşılaştırması veya derece)
                best_neighbor = None
                best_area = -1.0
                for cand in boundary_neighbors:
                    area = building_graph.nodes[cand].get("area_m2", 0.0)
                    if area > best_area:
                        best_area = area
                        best_neighbor = cand

                if best_neighbor is not None:
                    current_nodes.append(best_neighbor)
                    current_graph = building_graph.subgraph(current_nodes).copy()

            if len(current_graph) >= 3:
                # WL-Hash ile topolojik tekilleştirme
                wl_hash = nx.weisfeiler_lehman_graph_hash(current_graph, node_attr="room_type")
                if wl_hash not in motifs_by_hash:
                    # VF2 ile binadaki kesin desteği say
                    matches = self._find_exact_matches(current_graph, building_graph, seed)
                    if len(matches) >= self.min_support:
                        motifs_by_hash[wl_hash] = DiscoveredArchitecturalMotif(
                            motif_id=motif_counter,
                            motif_graph=current_graph,
                            support=len(matches),
                            root_room_type=building_graph.nodes[seed].get("room_type", "antre"),
                            wl_hash=wl_hash,
                            matched_anchor_nodes=matches,
                            total_nodes=len(current_graph)
                        )
                        motif_counter += 1

        discovered_motifs = list(motifs_by_hash.values())

        # Bina Programı Özetini Hesapla
        program = self._compute_building_program(building_graph, discovered_motifs)
        return discovered_motifs, program

    def _find_exact_matches(self, pattern: nx.Graph, target: nx.Graph, pattern_anchor: int) -> List[int]:
        def node_match(n1, n2):
            return n1.get("room_type") == n2.get("room_type")

        matcher = isomorphism.GraphMatcher(target, pattern, node_match=node_match)
        anchors_found = set()
        for iso in matcher.subgraph_isomorphisms_iter():
            # Ters sözlük: pattern_node -> target_node
            rev = {v: k for k, v in iso.items()}
            if pattern_anchor in rev:
                anchors_found.add(rev[pattern_anchor])
        return list(anchors_found)

    def _compute_building_program(
        self,
        G: nx.Graph,
        motifs: List[DiscoveredArchitecturalMotif]
    ) -> BuildingProgramSummary:
        total_apt = 0
        apt_types = {}
        for m in motifs:
            if m.root_room_type == "daire_antresi":
                total_apt += m.support
                t_name = f"{m.total_nodes - 1}+1 Modülü"
                apt_types[t_name] = m.support

        # Eğer motif bulunamadıysa doğrudan daire antrelerini say
        if total_apt == 0:
            antre_nodes = [n for n, d in G.nodes(data=True) if d.get("room_type") == "daire_antresi"]
            total_apt = len(antre_nodes)
            apt_types["Tipik Daire"] = total_apt

        res_area = sum([d.get("area_m2", 0.0) for _, d in G.nodes(data=True) if d.get("room_type") in ("salon", "oda", "mutfak", "banyo_wc", "daire_antresi")])
        circ_area = sum([d.get("area_m2", 0.0) for _, d in G.nodes(data=True) if d.get("room_type") in ("kat_koridoru", "yangin_holu", "yangin_merdiveni")])
        shelter_area = sum([d.get("area_m2", 0.0) for _, d in G.nodes(data=True) if "siginak" in str(d.get("room_type"))])
        parking_count = sum([1 for _, d in G.nodes(data=True) if "otopark" in str(d.get("room_type"))])

        # Sığınak Yönetmeliği kuralı: 1 kişi / 1 m², daire başı ortalama 4 kişi
        est_persons = total_apt * 4
        req_shelter = max(12.0, est_persons * 1.0) if total_apt >= 12 or res_area >= 1500.0 else 0.0
        # Otopark Yönetmeliği kuralı: Daire başı ortalama ~0.75 araç
        req_parking = int(total_apt * 0.75) if total_apt > 0 else 0

        return BuildingProgramSummary(
            total_apartments=total_apt,
            apartment_types_breakdown=apt_types,
            total_residential_area_m2=res_area,
            common_circulation_area_m2=circ_area,
            total_shelter_area_m2=shelter_area,
            total_parking_capacity=parking_count,
            required_shelter_area_m2=req_shelter,
            required_parking_stalls=req_parking,
            estimated_occupancy_persons=est_persons
        )


class ArchitecturalGraphCoarsener:
    """
    SPMiner modüllerini tekil makro-düğümlere sıkıştırır.
    Yangın kaçış derinliğini (internal_max_escape_m) korur,
    kayıpsız geri-açma (expand_macro_node) sağlar.
    """
    @staticmethod
    def coarsen_building_graph(
        building_graph: nx.Graph,
        discovered_motifs: List[DiscoveredArchitecturalMotif]
    ) -> CoarsenedBuildingResult:
        G_coarse = building_graph.copy()
        macro_registry: Dict[int, MacroNodeRecord] = {}
        macro_id_counter = 10000

        used_nodes: Set[int] = set()

        for motif in discovered_motifs:
            if motif.root_room_type != "daire_antresi":
                continue

            for anchor in motif.matched_anchor_nodes:
                if anchor in used_nodes:
                    continue

                # Antre etrafındaki modül düğümlerini bul
                sub_nodes = [anchor]
                for n in building_graph.neighbors(anchor):
                    if n not in used_nodes and building_graph.nodes[n].get("room_type") not in ("kat_koridoru", "dis_cikis", "yangin_holu"):
                        sub_nodes.append(n)

                if len(sub_nodes) < 2:
                    continue

                sub_G = building_graph.subgraph(sub_nodes).copy()
                total_area = sum([building_graph.nodes[n].get("area_m2", 0.0) for n in sub_nodes])

                # Daire içi en derin kaçış mesafesi (Antre -> En uzak oda)
                dists = nx.single_source_dijkstra_path_length(sub_G, anchor, weight="distance_m")
                max_escape = max(dists.values()) if dists else 0.0

                portal_edges = []
                for n in sub_nodes:
                    for ext in building_graph.neighbors(n):
                        if ext not in sub_nodes:
                            portal_edges.append((ext, n, building_graph[n][ext]))

                floor = building_graph.nodes[anchor].get("floor_level", 0)
                record = MacroNodeRecord(
                    macro_node_id=macro_id_counter,
                    motif_id=motif.motif_id,
                    contained_original_nodes=sub_nodes,
                    internal_subgraph_snapshot=sub_G,
                    portal_boundary_doors=portal_edges,
                    total_macro_area_m2=total_area,
                    internal_max_escape_m=max_escape,
                    floor_level=floor
                )
                macro_registry[macro_id_counter] = record

                # Grafa Makro Düğümü Ekle
                G_coarse.add_node(
                    macro_id_counter,
                    is_macro=True,
                    room_type="macro_apartment",
                    area_m2=total_area,
                    internal_max_escape_m=max_escape,
                    floor_level=floor,
                    contained_count=len(sub_nodes)
                )

                # Dış portal kenarlarını makro düğüme bağla
                for ext, internal_n, ed in portal_edges:
                    G_coarse.add_edge(
                        ext, macro_id_counter,
                        **ed,
                        effective_worst_case_distance_m=ed.get("distance_m", 1.0) + max_escape
                    )

                # Orijinal iç odaları grafikten çıkar
                G_coarse.remove_nodes_from(sub_nodes)
                used_nodes.update(sub_nodes)
                macro_id_counter += 1

        orig_cnt = building_graph.number_of_nodes()
        coarse_cnt = G_coarse.number_of_nodes()
        comp_ratio = (orig_cnt - coarse_cnt) / max(1, orig_cnt)

        return CoarsenedBuildingResult(
            G_coarsened=G_coarse,
            macro_node_registry=macro_registry,
            original_node_count=orig_cnt,
            coarsened_node_count=coarse_cnt,
            compression_ratio=comp_ratio
        )

    @staticmethod
    def expand_macro_node(
        coarsened_result: CoarsenedBuildingResult,
        macro_node_id: int
    ) -> nx.Graph:
        """Sıkıştırılmış makro düğümü açarak orijinal altgrafı yerine koyar."""
        G = coarsened_result.G_coarsened.copy()
        if macro_node_id not in coarsened_result.macro_node_registry:
            return G

        rec = coarsened_result.macro_node_registry[macro_node_id]
        G.remove_node(macro_node_id)
        G.add_nodes_from(rec.internal_subgraph_snapshot.nodes(data=True))
        G.add_edges_from(rec.internal_subgraph_snapshot.edges(data=True))

        for ext, internal_n, ed in rec.portal_boundary_doors:
            if G.has_node(ext) and G.has_node(internal_n):
                G.add_edge(ext, internal_n, **ed)

        return G
