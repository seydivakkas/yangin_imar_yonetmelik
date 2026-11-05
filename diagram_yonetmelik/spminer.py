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
        energy_threshold: float = 0.20,
        use_neural_clustering: bool = True,
        neural_similarity_threshold: float = 0.80,
        use_neural_growth: bool = True
    ):
        self.gnn = gnn_model or SpatialOrderGNN()
        self.gnn.eval()
        self.min_support = min_support
        self.max_motif_nodes = max_motif_nodes
        self.threshold = energy_threshold
        self.use_neural_clustering = use_neural_clustering
        self.neural_similarity_threshold = neural_similarity_threshold
        self.use_neural_growth = use_neural_growth

    def _compute_embedding_similarity(self, z1: torch.Tensor, z2: torch.Tensor) -> float:
        """
        İki altgraf gömme vektörü arasındaki benzerliği hesaplar.
        Cosine similarity ve çift yönlü ihlal enerjisini (Order Violation Energy) harmanlar.
        """
        norm1 = torch.norm(z1, p=2)
        norm2 = torch.norm(z2, p=2)
        if norm1 > 1e-6 and norm2 > 1e-6:
            cos_sim = float(torch.dot(z1, z2) / (norm1 * norm2))
        else:
            cos_sim = 0.0

        e12 = float(violation_energy(z1.unsqueeze(0), z2.unsqueeze(0)).item())
        e21 = float(violation_energy(z2.unsqueeze(0), z1.unsqueeze(0)).item())
        bi_energy = (e12 + e21) / 2.0
        energy_score = max(0.0, 1.0 - bi_energy)
        return 0.65 * cos_sim + 0.35 * energy_score

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
        neural_clusters: List[Dict[str, Any]] = []
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

                best_neighbor = None
                if self.use_neural_growth and self.gnn is not None:
                    # GNN Order Embedding ile en uyumlu komşuyu seç
                    best_score = -999.0
                    for cand in boundary_neighbors:
                        test_nodes = current_nodes + [cand]
                        test_sub = building_graph.subgraph(test_nodes).copy()
                        z_cand = self.gnn.embed_subgraph(test_sub, anchor_node=seed)
                        area = building_graph.nodes[cand].get("area_m2", 0.0)
                        score = float(torch.norm(z_cand, p=1).item()) * 0.1 + (area / 100.0)
                        if score > best_score:
                            best_score = score
                            best_neighbor = cand
                else:
                    # Geometrik Fallback (Alan bazlı)
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
                wl_hash = nx.weisfeiler_lehman_graph_hash(current_graph, node_attr="room_type")

                if self.use_neural_clustering and self.gnn is not None:
                    # -------------------------------------------------------------
                    # ÖĞRENEN YAPAY ZEKA: GNN Order Embedding Kümeleme
                    # -------------------------------------------------------------
                    z_emb = self.gnn.embed_subgraph(current_graph, anchor_node=seed)
                    matched_cluster = None
                    best_sim = -1.0
                    for cluster in neural_clusters:
                        sim = self._compute_embedding_similarity(z_emb, cluster["centroid_embedding"])
                        if sim >= self.neural_similarity_threshold and sim > best_sim:
                            best_sim = sim
                            matched_cluster = cluster

                    if matched_cluster is not None:
                        n_prev = matched_cluster["member_count"]
                        matched_cluster["centroid_embedding"] = (matched_cluster["centroid_embedding"] * n_prev + z_emb) / (n_prev + 1)
                        matched_cluster["member_count"] += 1
                        matched_cluster["member_anchors"].append(seed)
                        matched_cluster["wl_hashes"].add(wl_hash)
                    else:
                        neural_clusters.append({
                            "cluster_id": len(neural_clusters) + 1,
                            "representative_graph": current_graph,
                            "centroid_embedding": z_emb,
                            "member_count": 1,
                            "member_anchors": [seed],
                            "root_room_type": building_graph.nodes[seed].get("room_type", "antre"),
                            "wl_hashes": {wl_hash}
                        })
                else:
                    # -------------------------------------------------------------
                    # DETERMINISTIK FALLBACK: Weisfeiler-Lehman Graph Hash
                    # -------------------------------------------------------------
                    if wl_hash not in motifs_by_hash:
                        matches = self._find_exact_matches(current_graph, building_graph, seed)
                        if len(matches) >= self.min_support:
                            motifs_by_hash[wl_hash] = DiscoveredArchitecturalMotif(
                                motif_id=motif_counter,
                                motif_graph=current_graph,
                                support=len(matches),
                                root_room_type=building_graph.nodes[seed].get("room_type", "antre"),
                                wl_hash=wl_hash,
                                matched_anchor_nodes=matches,
                                total_nodes=len(current_graph),
                                clustering_method="wl_hash",
                                embedding_vector=None,
                                neural_confidence=1.0
                            )
                            motif_counter += 1

        if self.use_neural_clustering and neural_clusters:
            discovered_motifs = []
            m_id = 1
            for cl in neural_clusters:
                exact_matches = self._find_exact_matches(cl["representative_graph"], building_graph, cl["member_anchors"][0])
                support_count = max(len(cl["member_anchors"]), len(exact_matches))
                if support_count >= self.min_support:
                    z_list = [round(float(v), 4) for v in cl["centroid_embedding"].cpu().numpy()]
                    rep_wl = sorted(list(cl["wl_hashes"]))[0]
                    discovered_motifs.append(DiscoveredArchitecturalMotif(
                        motif_id=m_id,
                        motif_graph=cl["representative_graph"],
                        support=support_count,
                        root_room_type=cl["root_room_type"],
                        wl_hash=rep_wl,
                        matched_anchor_nodes=cl["member_anchors"],
                        total_nodes=len(cl["representative_graph"]),
                        clustering_method="gnn_order_embedding",
                        embedding_vector=z_list,
                        neural_confidence=round(float(torch.sigmoid(torch.norm(cl["centroid_embedding"])).item()), 3)
                    ))
                    m_id += 1
        else:
            discovered_motifs = list(motifs_by_hash.values())

        # Bina Programı Özetini Hesapla
        program = self._compute_building_program(building_graph, discovered_motifs)
        return discovered_motifs, program

    def extract_frequent_motifs(
        self,
        building_graph: nx.Graph,
        min_support: Optional[int] = None
    ) -> List[DiscoveredArchitecturalMotif]:
        """Altgraf motiflerini doğrudan listeler."""
        if min_support is not None:
            self.min_support = min_support
        motifs, _ = self.discover_frequent_modules(building_graph)
        return motifs

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
