"""
Çok binalı altgraf araması için önbellekli NeuroMatch dizini.

Yalnızca keşif amaçlıdır: yangın uygunluk kararında kullanılmaz. Eleme sonrası kalan her aday
tam VF2 ile doğrulanır; elenen aday hakkında uygunluk yargısı üretilmez.
"""
from time import perf_counter
from typing import Any, Dict, List, Tuple

import networkx as nx
from networkx.algorithms import isomorphism
import torch

from .gnn_order import SpatialOrderGNN, extract_anchored_k_hop, violation_energy


def contains_anchored(query: nx.Graph, query_anchor: Any, target: nx.Graph, target_anchor: Any) -> bool:
    """Sorgu, çapası korunarak hedefte yapı ve oda tipi bakımından bulunuyor mu?"""
    if query.nodes[query_anchor].get("room_type") != target.nodes[target_anchor].get("room_type"):
        return False
    matcher = isomorphism.GraphMatcher(
        target, query, node_match=lambda a, b: a.get("room_type") == b.get("room_type")
    )
    for mapping in matcher.subgraph_monomorphisms_iter():
        if mapping.get(target_anchor) == query_anchor:
            return True
    return False


class NeuroMatchIndex:
    """Hedef gömmelerini bir kez hesaplar; her sorguda oda tipine göre toplu eleme yapar."""

    def __init__(self, model: SpatialOrderGNN, tau: float, k_hops: int = 3):
        self.model = model.eval()
        self.tau = tau
        self.k_hops = k_hops
        self.entries: Dict[str, List[Tuple[Any, Any, nx.Graph]]] = {}
        self.vectors: Dict[str, torch.Tensor] = {}

    def add_graphs(self, graphs: Dict[Any, nx.Graph]) -> None:
        pending: Dict[str, List[torch.Tensor]] = {}
        for graph_id, graph in graphs.items():
            for node, data in graph.nodes(data=True):
                ego = extract_anchored_k_hop(graph, node, self.k_hops)
                room_type = data.get("room_type", "oda")
                self.entries.setdefault(room_type, []).append((graph_id, node, ego))
                pending.setdefault(room_type, []).append(self.model.embed_subgraph(ego, anchor_node=node))
        for room_type, embeddings in pending.items():
            self.vectors[room_type] = torch.stack(embeddings)

    def search(self, query: nx.Graph, query_anchor: Any, use_filter: bool = True) -> Dict[str, Any]:
        room_type = query.nodes[query_anchor].get("room_type", "oda")
        entries = self.entries.get(room_type, [])
        start = perf_counter()
        kept = list(range(len(entries)))
        if use_filter and entries:
            z_query = self.model.embed_subgraph(query, anchor_node=query_anchor).unsqueeze(0)
            energies = violation_energy(z_query, self.vectors[room_type])
            kept = torch.nonzero(energies <= self.tau).flatten().tolist()
        matches = [
            (entries[i][0], entries[i][1]) for i in kept
            if contains_anchored(query, query_anchor, entries[i][2], entries[i][1])
        ]
        return {
            "matches": matches,
            "candidates": len(entries),
            "verified": len(kept),
            "elapsed_sec": perf_counter() - start,
        }
