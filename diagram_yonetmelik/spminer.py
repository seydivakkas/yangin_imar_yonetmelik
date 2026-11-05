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
    Sezgisel komşu seçimi ve yapısal doğrulamayla
    bina içindeki standart daire tiplerini, çekirdek modüllerini keşfeder ve tekilleştirir.
    """
    def __init__(
        self,
        gnn_model: Optional[SpatialOrderGNN] = None,
        min_support: int = 2,
        max_motif_nodes: int = 8,
        energy_threshold: float = 0.20,
        use_neural_clustering: bool = False,
        neural_similarity_threshold: float = 0.80,
        use_neural_growth: bool = False
    ):
        if (use_neural_clustering or use_neural_growth) and gnn_model is None:
            raise ValueError("Nöral SPMiner seçenekleri için GNN modeli verilmelidir.")
        self.gnn = gnn_model
        if self.gnn is not None:
            self.gnn.eval()
        self.min_support = min_support
        self.max_motif_nodes = max_motif_nodes
        self.threshold = energy_threshold
        self.use_neural_clustering = use_neural_clustering
        self.neural_similarity_threshold = neural_similarity_threshold
        self.use_heuristic_neighbor_selection = use_neural_growth

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

        clusters = []
        self.rejected_candidates = 0

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
                if self.use_heuristic_neighbor_selection and self.gnn is not None:
                    # Sezgisel komşu seçimi: gömme normu ve alan
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
                    # Deterministik seçim: en büyük alan, eşitlikte düğüm kimliği
                    best_neighbor = max(
                        boundary_neighbors,
                        key=lambda cand: (building_graph.nodes[cand].get("area_m2", 0.0), str(cand))
                    )

                if best_neighbor is not None:
                    current_nodes.append(best_neighbor)
                    current_graph = building_graph.subgraph(current_nodes).copy()

            if len(current_graph) < 3:
                continue
            for n, attrs in current_graph.nodes(data=True):
                attrs["motif_label"] = (attrs["room_type"] + ("@anchor" if n == seed else ""))
            wl_hash = nx.weisfeiler_lehman_graph_hash(current_graph, node_attr="motif_label")
            embedding = None
            proposal = None
            if self.use_neural_clustering:
                embedding = self.gnn.embed_subgraph(current_graph, anchor_node=seed)
                ranked = [(self._compute_embedding_similarity(embedding, c["center"]), c) for c in clusters]
                if ranked:
                    similarity, candidate = max(ranked, key=lambda item: item[0])
                    if similarity >= self.neural_similarity_threshold:
                        proposal = candidate
            else:
                proposal = next((c for c in clusters if c["hash"] == wl_hash and nx.is_isomorphic(
                    current_graph, c["graph"], node_match=isomorphism.categorical_node_match("motif_label", "")
                )), None)

            if proposal is not None and self.use_neural_clustering:
                if proposal["hash"] != wl_hash or not nx.is_isomorphic(
                    current_graph, proposal["graph"], node_match=isomorphism.categorical_node_match("motif_label", "")
                ):
                    self.rejected_candidates += 1
                    proposal = None
            if proposal is None:
                proposal = {"hash": wl_hash, "graph": current_graph, "anchors": [], "members": [], "vectors": []}
                clusters.append(proposal)
            proposal["anchors"].append(seed)
            proposal["members"].append(list(current_graph))
            if embedding is not None:
                proposal["vectors"].append(embedding)
                proposal["center"] = torch.stack(proposal["vectors"]).mean(0)

        discovered_motifs = []
        for cluster in clusters:
            anchors = cluster["anchors"]
            if len(anchors) < self.min_support:
                continue
            graph = cluster["graph"]
            center = cluster.get("center")
            similarity = None if center is None else torch.nn.functional.cosine_similarity(
                torch.stack(cluster["vectors"]), center.unsqueeze(0)
            ).mean().item()
            discovered_motifs.append(DiscoveredArchitecturalMotif(
                motif_id=len(discovered_motifs) + 1, motif_graph=graph, support=len(anchors),
                root_room_type=graph.nodes[anchors[0]]["room_type"], wl_hash=cluster["hash"],
                matched_anchor_nodes=anchors, member_node_sets=cluster["members"], total_nodes=len(graph),
                clustering_method="gnn_order_embedding" if self.use_neural_clustering else "wl_hash",
                embedding_vector=None if center is None else center.tolist(), neural_confidence=similarity
            ))

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
        # Daire sayısı motiflerden değil, doğrudan antre düğümlerinden gelir.
        antre_nodes = [n for n, d in G.nodes(data=True) if d.get("room_type") == "daire_antresi"]
        total_apt = len(antre_nodes)
        apt_types = {}
        classified = set()
        for m in motifs:
            if m.root_room_type == "daire_antresi":
                t_name = f"{m.total_nodes - 1}+1 Modülü"
                apt_types[t_name] = apt_types.get(t_name, 0) + m.support
                classified.update(m.matched_anchor_nodes)
        unclassified = sum(1 for n in antre_nodes if n not in classified)
        if unclassified:
            apt_types["Sınıflandırılmamış Daire"] = unclassified

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

                portal_edges = []
                for n in sub_nodes:
                    for ext in building_graph.neighbors(n):
                        if ext not in sub_nodes:
                            portal_edges.append((ext, n, building_graph[n][ext]))

                # Tutucu iç mesafe: herhangi bir dış kapıdan en uzak odaya en kötü yol.
                # Makro yol hangi kapıyı seçerse seçsin, gerçek kaçış mesafesini olduğundan kısa göstermez.
                max_escape = 0.0
                for source in {internal_n for _, internal_n, _ in portal_edges} or {anchor}:
                    dists = nx.single_source_dijkstra_path_length(sub_G, source, weight="distance_m")
                    max_escape = max(max_escape, max(dists.values(), default=0.0))

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
