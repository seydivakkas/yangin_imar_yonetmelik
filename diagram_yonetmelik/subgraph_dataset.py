"""
Binaların Yangından Korunması Hakkında Yönetmelik (BYKHY) & İmar Denetim Mimarisi
NetworkX Mimari Bölge Komşuluk Grafından (RAG) PyTorch Geometric için
Pozitif ve Sert Negatif (Hard Negative) Altgraf Çiftleri Üreten Veri Yükleyici.

ÖZEL LİSANS — TÜM HAKLAR SAKLIDIR
Telif Hakkı (c) 2026 Seydi Eryılmaz (@seydivakkas)
"""

import copy
import random
from typing import List, Tuple, Optional, Dict, Any

import networkx as nx
from networkx.algorithms import isomorphism
import torch
from torch.utils.data import Dataset

try:
    from torch_geometric.data import Data, Batch
    from torch_geometric.loader import DataLoader
    PYG_AVAILABLE = True
except ImportError:
    PYG_AVAILABLE = False
    Data = object
    Batch = object
    DataLoader = None

from diagram_yonetmelik.gnn_order import (
    ROOM_TYPE_ORDER,
    compute_rwpe,
    nx_subgraph_to_pyg_data,
)


ROOM_TO_IDX = {name: i for i, name in enumerate(ROOM_TYPE_ORDER)}
NUM_ROOM_TYPES = len(ROOM_TYPE_ORDER)


# =====================================================================
# 1. ÇİFT GRAF BATCHING İÇİN ÖZEL PyG VERİ SINIFI (PairData)
# =====================================================================
class SubgraphPairData(Data):
    """
    Tek bir eğitim örneğinde iki farklı boyuttaki grafı (G_q ve G_u)
    PyG DataLoader içinde indeksleri karışmadan batch'lemek için özel Data sınıfı.
    """
    def __inc__(self, key: str, value, *args, **kwargs):
        if key == "edge_index_q":
            return self.x_q.size(0)
        if key == "edge_index_u":
            return self.x_u.size(0)
        return super().__inc__(key, value, *args, **kwargs)


def split_pair_batch(pair_batch: Any) -> Tuple[Any, Any, torch.Tensor]:
    """
    DataLoader'dan çıkan birleşik SubgraphPairData batch'ini,
    SpatialOrderGNN modeline doğrudan girebilecek (q_batch, u_batch, labels) formatına ayırır.
    """
    if not PYG_AVAILABLE:
        raise RuntimeError("PyTorch Geometric kurulu olmalıdır.")

    q_batch = Batch(
        x=pair_batch.x_q,
        edge_index=pair_batch.edge_index_q,
        edge_attr=pair_batch.edge_attr_q,
        batch=pair_batch.x_q_batch
    )
    u_batch = Batch(
        x=pair_batch.x_u,
        edge_index=pair_batch.edge_index_u,
        edge_attr=pair_batch.edge_attr_u,
        batch=pair_batch.x_u_batch
    )
    return q_batch, u_batch, pair_batch.y.view(-1)


# =====================================================================
# 2. NETWORKX GRAF -> TENSÖR DÖNÜŞÜMÜ (DATASET İÇİN)
# =====================================================================
def nx_subgraph_to_pair_tensors(
    G: nx.Graph,
    anchor_node: int,
    walk_steps: int = 6
) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    """
    NetworkX alt grafını ve çapa düğümünü alır;
    [One-Hot Oda Tipi + Normalize Alan + RWPE + ID-GNN Çapa Biti] içeren PyG tensörlerine dönüştürür.
    """
    nodes = list(G.nodes())
    node_map = {n: i for i, n in enumerate(nodes)}
    num_nodes = len(nodes)

    # 1. Düğüm Özellikleri: One-hot room_type (9) + area_m2 (1) = 10 boyut
    node_feats = []
    for n in nodes:
        r_type = G.nodes[n].get("room_type", "oda")
        r_idx = ROOM_TO_IDX.get(r_type, 1)
        one_hot = torch.zeros(NUM_ROOM_TYPES, dtype=torch.float32)
        one_hot[r_idx] = 1.0

        area_norm = float(G.nodes[n].get("area_m2", 15.0)) / 100.0
        feat = torch.cat([one_hot, torch.tensor([area_norm], dtype=torch.float32)])
        node_feats.append(feat)

    x_base = torch.stack(node_feats, dim=0) if node_feats else torch.zeros((0, NUM_ROOM_TYPES + 1))

    # 2. Kenar İndeksleri ve Özellikleri (Yönsüz graf -> çift yönlü kenarlar)
    edge_src, edge_dst, edge_attrs = [], [], []
    for u, v, edata in G.edges(data=True):
        if u not in node_map or v not in node_map:
            continue
        u_idx, v_idx = node_map[u], node_map[v]
        door_width = float(edata.get("door_width_cm", 90.0)) / 100.0
        dist_m = float(edata.get("distance_m", 5.0)) / 20.0
        fire_door = 1.0 if edata.get("is_fire_resistant", False) else 0.0
        e_feat = [door_width, dist_m, fire_door]

        edge_src.extend([u_idx, v_idx])
        edge_dst.extend([v_idx, u_idx])
        edge_attrs.extend([e_feat, e_feat])

    if edge_src:
        edge_index = torch.tensor([edge_src, edge_dst], dtype=torch.long)
        edge_attr = torch.tensor(edge_attrs, dtype=torch.float32)
    else:
        edge_index = torch.empty((2, 0), dtype=torch.long)
        edge_attr = torch.empty((0, 3), dtype=torch.float32)

    # 3. 1-WL Sınırını Aşmak İçin RWPE + ID-GNN Çapa Kimlik Biti
    rwpe = compute_rwpe(edge_index, num_nodes=num_nodes, walk_steps=walk_steps)
    anchor_flag = torch.zeros((num_nodes, 1), dtype=torch.float32)
    if anchor_node in node_map:
        anchor_flag[node_map[anchor_node], 0] = 1.0

    x_enriched = torch.cat([x_base, rwpe, anchor_flag], dim=-1)
    return x_enriched, edge_index, edge_attr


# =====================================================================
# 3. POZİTİF VE SERT NEGATİF (HARD NEGATIVE) ALT GRAF DATASET SINIFI
# =====================================================================
class SpatialRAGSubgraphDataset(Dataset):
    """
    NetworkX formatındaki mimari kat planı graflarından Order Embedding için
    pozitif ve sert negatif altgraf çiftleri üreten veri yükleyici.
    """
    def __init__(
        self,
        floorplan_graphs: List[nx.Graph],
        num_samples: int = 200,
        k_hops: int = 3,
        min_query_nodes: int = 3,
        max_query_nodes: int = 7,
        walk_steps: int = 6,
        pos_ratio: float = 0.5
    ):
        super().__init__()
        self.graphs = floorplan_graphs
        self.num_samples = num_samples
        self.k_hops = k_hops
        self.min_q = min_query_nodes
        self.max_q = max_query_nodes
        self.walk_steps = walk_steps
        self.pos_ratio = pos_ratio

        self.anchored_subgraphs: List[Tuple[nx.Graph, int]] = []
        self._prepare_anchored_subgraphs()

    def _prepare_anchored_subgraphs(self):
        for G in self.graphs:
            for anchor in G.nodes():
                ego_G = nx.ego_graph(G, anchor, radius=self.k_hops)
                if ego_G.number_of_nodes() >= self.min_q + 1:
                    self.anchored_subgraphs.append((ego_G.copy(), anchor))

        if not self.anchored_subgraphs and self.graphs:
            # Fallback: küçük graflarda doğrudan grafı çapa ile ekle
            for G in self.graphs:
                nodes = list(G.nodes())
                if nodes:
                    self.anchored_subgraphs.append((G.copy(), nodes[0]))

    def _sample_connected_query(self, G_u: nx.Graph, anchor: int) -> nx.Graph:
        """
        G_u içinden çapa düğümü merkez alan bağlantılı bir G_q altgrafı örnekler (Pozitif baz).
        """
        max_n = min(self.max_q, G_u.number_of_nodes())
        target_size = random.randint(min(self.min_q, max_n), max_n)

        sampled_nodes = {anchor}
        frontier = list(G_u.neighbors(anchor))

        while len(sampled_nodes) < target_size and frontier:
            next_node = random.choice(frontier)
            frontier.remove(next_node)
            if next_node not in sampled_nodes:
                sampled_nodes.add(next_node)
                for nb in G_u.neighbors(next_node):
                    if nb not in sampled_nodes and nb not in frontier:
                        frontier.append(nb)

        return G_u.subgraph(sampled_nodes).copy()

    def _is_still_subgraph(self, G_q: nx.Graph, G_u: nx.Graph, anchor: int) -> bool:
        """
        Sert negatif mutasyonundan sonra G_q'nun kazara G_u içinde başka bir simetrik
        dal ile eşleşip eşleşmediğini (yanlış negatif) VF2 ile kontrol eder.
        """
        def node_match(n1, n2):
            return n1.get("room_type") == n2.get("room_type")

        def edge_match(e1, e2):
            if e1.get("is_fire_resistant", False) and not e2.get("is_fire_resistant", False):
                return False
            return True

        gm = isomorphism.GraphMatcher(G_u, G_q, node_match=node_match, edge_match=edge_match)
        for mapping in gm.subgraph_isomorphisms_iter():
            if mapping.get(anchor) == anchor:
                return True
        return False

    def _create_hard_negative(
        self, G_q: nx.Graph, G_u: nx.Graph, anchor: int
    ) -> Tuple[nx.Graph, nx.Graph]:
        """
        Geçerli (G_q, G_u) çiftini alır ve 3 mimari mutasyon stratejisinden biriyle
        G_q'nun G_u içinde yer ALMADIĞI sert negatif bir çift üretir.
        """
        G_q_neg = copy.deepcopy(G_q)
        G_u_neg = copy.deepcopy(G_u)

        strategies = ["target_edge_drop", "query_cycle_add", "room_type_violation"]
        random.shuffle(strategies)

        for strat in strategies:
            # STRATEJİ 1: Hedefteki kritik bir geçiş/kapı kenarını sil
            if strat == "target_edge_drop" and G_q_neg.number_of_edges() > 0:
                u_edge, v_edge = random.choice(list(G_q_neg.edges()))
                if G_u_neg.has_edge(u_edge, v_edge):
                    G_u_neg.remove_edge(u_edge, v_edge)
                    if not self._is_still_subgraph(G_q_neg, G_u_neg, anchor):
                        return G_q_neg, G_u_neg
                    G_u_neg.add_edge(u_edge, v_edge, **G_u.edges[u_edge, v_edge])

            # STRATEJİ 2: Sorguya hedefte olmayan bir döngü (ring kaçış) kenarı ekle
            elif strat == "query_cycle_add":
                q_nodes = list(G_q_neg.nodes())
                non_edges = [
                    (n1, n2) for i, n1 in enumerate(q_nodes) for n2 in q_nodes[i+1:]
                    if not G_u_neg.has_edge(n1, n2)
                ]
                if non_edges:
                    n1, n2 = random.choice(non_edges)
                    G_q_neg.add_edge(n1, n2, door_width_cm=100.0, distance_m=4.0, is_fire_resistant=True)
                    if not self._is_still_subgraph(G_q_neg, G_u_neg, anchor):
                        return G_q_neg, G_u_neg
                    G_q_neg.remove_edge(n1, n2)

            # STRATEJİ 3: Sorgudaki bir düğümü kritik bir mekan tipine yükselt
            elif strat == "room_type_violation":
                candidate_nodes = [n for n in G_q_neg.nodes() if n != anchor]
                if not candidate_nodes:
                    candidate_nodes = [anchor]
                target_n = random.choice(candidate_nodes)
                orig_type = G_q_neg.nodes[target_n].get("room_type", "oda")

                new_type = "yangin_holu" if orig_type != "yangin_holu" else "dis_cikis"
                G_q_neg.nodes[target_n]["room_type"] = new_type

                if not self._is_still_subgraph(G_q_neg, G_u_neg, anchor):
                    return G_q_neg, G_u_neg
                G_q_neg.nodes[target_n]["room_type"] = orig_type

        # Fallback: Garantili Negatif
        orig_anchor_type = G_q_neg.nodes[anchor].get("room_type", "yangin_merdiveni")
        G_q_neg.nodes[anchor]["room_type"] = "yangin_merdiveni" if orig_anchor_type != "yangin_merdiveni" else "salon"
        return G_q_neg, G_u_neg

    def __len__(self) -> int:
        return self.num_samples

    def __getitem__(self, idx: int) -> Any:
        if not self.anchored_subgraphs:
            raise IndexError("Boş dataset.")

        G_u_base, anchor = random.choice(self.anchored_subgraphs)
        G_q_base = self._sample_connected_query(G_u_base, anchor)

        is_positive = random.random() < self.pos_ratio

        if is_positive:
            G_q, G_u = G_q_base, G_u_base
            label = 1.0
        else:
            G_q, G_u = self._create_hard_negative(G_q_base, G_u_base, anchor)
            label = 0.0

        x_q, edge_index_q, edge_attr_q = nx_subgraph_to_pair_tensors(G_q, anchor, self.walk_steps)
        x_u, edge_index_u, edge_attr_u = nx_subgraph_to_pair_tensors(G_u, anchor, self.walk_steps)

        if PYG_AVAILABLE:
            return SubgraphPairData(
                x_q=x_q,
                edge_index_q=edge_index_q,
                edge_attr_q=edge_attr_q,
                x_u=x_u,
                edge_index_u=edge_index_u,
                edge_attr_u=edge_attr_u,
                y=torch.tensor([label], dtype=torch.float32)
            )
        return {
            "x_q": x_q, "edge_index_q": edge_index_q, "edge_attr_q": edge_attr_q,
            "x_u": x_u, "edge_index_u": edge_index_u, "edge_attr_u": edge_attr_u,
            "y": torch.tensor([label], dtype=torch.float32)
        }


# =====================================================================
# 4. ÖRNEK MİMARİ KAT PLANI ÜRETİCİSİ (RAG)
# =====================================================================
def build_sample_architectural_rag() -> nx.Graph:
    """
    2 daire modülü, ortak kat koridoru, yangın güvenlik holü, yangın merdiveni ve dış çıkıştan
    oluşan gerçekçi bir mimari kat planı topolojisi (Region Adjacency Graph) üretir.
    """
    G = nx.Graph()

    # Ana sirkülasyon ve yangın kaçış çekirdeği
    G.add_node(0, room_type="kat_koridoru", area_m2=28.0)
    G.add_node(1, room_type="yangin_holu", area_m2=6.5)
    G.add_node(2, room_type="yangin_merdiveni", area_m2=14.0)
    G.add_node(3, room_type="dis_cikis", area_m2=10.0)

    G.add_edge(0, 1, door_width_cm=100.0, distance_m=4.5, is_fire_resistant=True)
    G.add_edge(1, 2, door_width_cm=100.0, distance_m=2.0, is_fire_resistant=True)
    G.add_edge(2, 3, door_width_cm=120.0, distance_m=3.5, is_fire_resistant=True)

    # Daire 1 ve Daire 2 Modülleri (Simetrik alt graflar)
    node_id = 4
    for _ in range(2):
        antre = node_id
        salon = node_id + 1
        mutfak = node_id + 2
        oda1 = node_id + 3
        banyo = node_id + 4

        G.add_node(antre, room_type="kat_koridoru", area_m2=9.0)
        G.add_node(salon, room_type="salon", area_m2=32.0)
        G.add_node(mutfak, room_type="oda", area_m2=14.0)
        G.add_node(oda1, room_type="oda", area_m2=16.0)
        G.add_node(banyo, room_type="banyo_wc", area_m2=6.0)

        G.add_edge(0, antre, door_width_cm=100.0, distance_m=6.0, is_fire_resistant=False)
        G.add_edge(antre, salon, door_width_cm=90.0, distance_m=3.0, is_fire_resistant=False)
        G.add_edge(antre, mutfak, door_width_cm=80.0, distance_m=2.5, is_fire_resistant=False)
        G.add_edge(antre, oda1, door_width_cm=80.0, distance_m=4.0, is_fire_resistant=False)
        G.add_edge(antre, banyo, door_width_cm=70.0, distance_m=2.0, is_fire_resistant=False)
        G.add_edge(salon, mutfak, door_width_cm=90.0, distance_m=3.5, is_fire_resistant=False)

        node_id += 5

    return G
