import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import List, Dict, Tuple, Optional, Any
import networkx as nx

try:
    from torch_geometric.data import Data, Batch
    from torch_geometric.nn import GINEConv, global_add_pool
    from torch_geometric.utils import to_dense_adj, k_hop_subgraph
    PYG_AVAILABLE = True
except ImportError:
    PYG_AVAILABLE = False


# =====================================================================
# 1. 1-WL SINIRINI AŞAN RANDOM WALK POSITIONAL ENCODING (RWPE)
# =====================================================================
def compute_rwpe(edge_index: torch.Tensor, num_nodes: int, walk_steps: int = 6) -> torch.Tensor:
    """
    Her düğüm için m-adımlı rastgele yürüyüş dönüş olasılıklarını [R^1_vv, ..., R^m_vv] hesaplar.
    Simetrik koridorları ve 3/4/5'li oda döngülerini (cycles) doğrudan kodlar.
    """
    if num_nodes == 0:
        return torch.zeros((0, walk_steps), dtype=torch.float32)

    # Yoğun komşuluk matrisi oluştur
    adj = torch.zeros((num_nodes, num_nodes), dtype=torch.float32)
    if edge_index.numel() > 0:
        src = edge_index[0].clamp(0, num_nodes - 1)
        dst = edge_index[1].clamp(0, num_nodes - 1)
        adj[src, dst] = 1.0

    deg = adj.sum(dim=1, keepdim=True).clamp(min=1.0)
    rw_matrix = adj / deg  # R = A * D^{-1}

    rwpe_list = []
    curr_rw = rw_matrix.clone()
    for _ in range(walk_steps):
        rwpe_list.append(torch.diagonal(curr_rw).unsqueeze(1))
        curr_rw = torch.matmul(curr_rw, rw_matrix)

    return torch.cat(rwpe_list, dim=1)  # [num_nodes, walk_steps]


# =====================================================================
# 2. İHLAL ENERJİSİ (VIOLATION ENERGY) VE MAX-MARGIN LOSS
# =====================================================================
def violation_energy(z_q: torch.Tensor, z_u: torch.Tensor) -> torch.Tensor:
    """
    Order Embedding ihlal enerjisi:
    E(z_q, z_u) = || max(0, z_q - z_u) ||_2^2
    Sorgu hedefte kapsanıyorsa enerji 0, aksi halde pozitif ceza.
    """
    diff = torch.clamp(z_q - z_u, min=0.0)
    return torch.sum(diff ** 2, dim=-1)


class OrderEmbeddingLoss(nn.Module):
    """
    Max-margin order embedding kaybı:
    L = E(z_q, z_pos) + max(0, margin - E(z_q, z_neg))
    """
    def __init__(self, margin: float = 1.0):
        super().__init__()
        self.margin = margin

    def forward(self, z_q: torch.Tensor, z_pos: torch.Tensor, z_neg: torch.Tensor) -> torch.Tensor:
        loss_pos = violation_energy(z_q, z_pos)
        loss_neg = torch.clamp(self.margin - violation_energy(z_q, z_neg), min=0.0)
        return torch.mean(loss_pos + loss_neg)


# =====================================================================
# 3. SPATIAL ORDER GNN MODELİ
# =====================================================================
ROOM_TYPE_ORDER = [
    "salon", "oda", "kat_koridoru", "yangin_holu",
    "yangin_merdiveni", "dis_cikis", "siginak", "kapali_otopark", "banyo_wc"
]

class SpatialOrderGNN(nn.Module):
    """
    Düğüm ve kenar öznitelikli, ID-GNN çapa duyarlı, pozitif reel ortanta
    gömen (Softplus) konvolüsyonel derin öğrenme modeli.
    """
    def __init__(
        self,
        node_in_dim: int = 10,     # 9 tip one-hot + 1 alan
        edge_in_dim: int = 3,      # kapı genişliği, mesafe, yangın dayanımı
        rwpe_dim: int = 6,
        hidden_dim: int = 64,
        emb_dim: int = 64,
        num_layers: int = 3
    ):
        super().__init__()
        # Girdi boyutu: [Node Feats (10) || RWPE (6) || Çapa Biti (1)] = 17
        total_in_dim = node_in_dim + rwpe_dim + 1

        self.node_proj = nn.Linear(total_in_dim, hidden_dim)
        self.edge_proj = nn.Linear(edge_in_dim, hidden_dim)

        self.convs = nn.ModuleList()
        for _ in range(num_layers):
            mlp = nn.Sequential(
                nn.Linear(hidden_dim, hidden_dim),
                nn.BatchNorm1d(hidden_dim),
                nn.ReLU(),
                nn.Linear(hidden_dim, hidden_dim)
            )
            if PYG_AVAILABLE:
                self.convs.append(GINEConv(nn=mlp, train_eps=True))
            else:
                self.convs.append(mlp)

        self.out_head = nn.Sequential(
            nn.Linear(hidden_dim * 2, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, emb_dim),
            nn.Softplus()  # R_+^d pozitif ortant garantisi
        )

    def forward(
        self,
        x: torch.Tensor,
        edge_index: torch.Tensor,
        edge_attr: torch.Tensor,
        anchor_mask: torch.Tensor,
        batch: Optional[torch.Tensor] = None
    ) -> torch.Tensor:
        if batch is None:
            batch = torch.zeros(x.size(0), dtype=torch.long, device=x.device)

        h = self.node_proj(x)
        e = self.edge_proj(edge_attr)

        for conv in self.convs:
            if PYG_AVAILABLE:
                h = h + F.relu(conv(h, edge_index, e))
            else:
                h = h + F.relu(conv(h))

        # Çapa düğüm gömmesi + Global Havuzlama
        if anchor_mask.any():
            h_anchor = h[anchor_mask]
            # Eğer batch'te çapa birden fazlaysa veya tekse hizala
            if h_anchor.size(0) != (batch.max().item() + 1):
                # Fallback: her batch elemanı için ortalama al
                h_anchor = h[:batch.max().item() + 1]
        else:
            h_anchor = h[:batch.max().item() + 1]

        if PYG_AVAILABLE:
            h_pool = global_add_pool(h, batch)
        else:
            h_pool = torch.zeros((batch.max().item() + 1, h.size(1)), device=h.device)
            for b_idx in range(batch.max().item() + 1):
                h_pool[b_idx] = h[batch == b_idx].sum(dim=0)

        combined = torch.cat([h_anchor, h_pool], dim=-1)
        z = self.out_head(combined)
        return z


# =====================================================================
# 4. NETWORKX GRAF -> PYG / TORCH TENSÖR DÖNÜŞTÜRÜCÜ
# =====================================================================
def nx_subgraph_to_pyg_data(
    subgraph: nx.Graph,
    anchor_node: int,
    walk_steps: int = 6
) -> Any:
    nodes = list(subgraph.nodes())
    node_to_idx = {n: i for i, n in enumerate(nodes)}
    num_nodes = len(nodes)

    # 1. Düğüm Özellikleri
    x_list = []
    anchor_mask = torch.zeros(num_nodes, dtype=torch.bool)

    for i, n in enumerate(nodes):
        d = subgraph.nodes[n]
        rtype = d.get("room_type", "oda")
        one_hot = [1.0 if rtype == rt else 0.0 for rt in ROOM_TYPE_ORDER]
        area_norm = float(d.get("area_m2", 15.0)) / 100.0
        is_anchor = 1.0 if n == anchor_node else 0.0
        if n == anchor_node:
            anchor_mask[i] = True
        x_list.append(one_hot + [area_norm, is_anchor])

    x_tensor = torch.tensor(x_list, dtype=torch.float32)

    # 2. Kenar Özellikleri
    edges = list(subgraph.edges())
    edge_index_list = []
    edge_attr_list = []

    for u, v in edges:
        ed = subgraph[u][v]
        ui, vi = node_to_idx[u], node_to_idx[v]
        w_norm = float(ed.get("door_width_cm", 90.0)) / 100.0
        dist_norm = float(ed.get("distance_m", 5.0)) / 20.0
        fire_val = 1.0 if ed.get("is_fire_resistant", False) else 0.0

        edge_index_list.append([ui, vi])
        edge_attr_list.append([w_norm, dist_norm, fire_val])
        # Çift yönlü kenar
        edge_index_list.append([vi, ui])
        edge_attr_list.append([w_norm, dist_norm, fire_val])

    if edge_index_list:
        edge_index = torch.tensor(edge_index_list, dtype=torch.long).t().contiguous()
        edge_attr = torch.tensor(edge_attr_list, dtype=torch.float32)
    else:
        edge_index = torch.empty((2, 0), dtype=torch.long)
        edge_attr = torch.empty((0, 3), dtype=torch.float32)

    # 3. RWPE Hesabı
    rwpe = compute_rwpe(edge_index, num_nodes, walk_steps=walk_steps)
    # [one-hot (9) + area (1) || RWPE (6) || anchor (1)]
    full_x = torch.cat([x_tensor[:, :10], rwpe, x_tensor[:, 10:11]], dim=-1)

    if PYG_AVAILABLE:
        return Data(
            x=full_x,
            edge_index=edge_index,
            edge_attr=edge_attr,
            anchor_mask=anchor_mask,
            num_nodes=num_nodes
        )
    return {
        "x": full_x,
        "edge_index": edge_index,
        "edge_attr": edge_attr,
        "anchor_mask": anchor_mask,
        "num_nodes": num_nodes
    }


def extract_anchored_k_hop(G: nx.Graph, anchor_node: int, k_hops: int = 2) -> nx.Graph:
    """Çapa düğüm etrafında k-hop ego altgrafı çıkarır."""
    sub_nodes = nx.single_source_shortest_path_length(G, anchor_node, cutoff=k_hops).keys()
    return G.subgraph(sub_nodes).copy()
