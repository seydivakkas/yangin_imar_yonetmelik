"""
python -m diagram_yonetmelik.evaluate_gnn

GNN, NeuroMatch, nöral SPMiner, RWPE ve graf sıkıştırma için geçiş kapılarını ölçer.
Sonuçlar data/gnn_eval_metrics.json ve data/gnn_gates.json dosyalarına yazılır.
Yangın uygunluk kararı bu ölçümlerden bağımsızdır: orada her aday VF2'den geçer.
"""
import hashlib
import json
import random
from time import perf_counter

import networkx as nx
import numpy as np
import torch
from sklearn.metrics import roc_auc_score

from .gnn_order import violation_energy
from .neuromatch import NeuroMatchIndex
from .spminer import ArchitecturalGraphCoarsener, ArchitecturalSPMiner
from .train_gnn import (DXF_GENERATORS, EVAL_PAIRS, K_HOPS, ROOT, SEEDS, TRAIN_PAIRS, building_graph,
                        building_splits, embed_side, loader, pairs, train)
from .subgraph_dataset import split_pair_batch

MIN_PRUNED_RATE = 0.30
MIN_RWPE_AUROC_GAIN = 0.01
SEARCH_QUERIES = 60


@torch.no_grad()
def scores(model, examples, use_rwpe=True):
    rows = []
    for batch in loader(examples):
        queries, targets, labels = split_pair_batch(batch)
        energies = violation_energy(embed_side(model, queries, use_rwpe), embed_side(model, targets, use_rwpe))
        rows.extend(zip(labels.tolist(), energies.tolist()))
    return np.array(rows)


def calibrate(validation):
    """Doğrulamada hiçbir gerçek altgrafı elemeyen en küçük eşik."""
    return float(validation[validation[:, 0] == 1, 1].max())


def summarize(values, tau):
    positive = values[values[:, 0] == 1, 1]
    negative = values[values[:, 0] == 0, 1]
    return {
        "auroc": float(roc_auc_score(values[:, 0], -values[:, 1])),
        "positive": int(len(positive)), "negative": int(len(negative)),
        "positive_pruned": int((positive > tau).sum()), "negative_pruned": int((negative > tau).sum()),
        "positive_pruned_rate": float((positive > tau).mean()), "negative_pruned_rate": float((negative > tau).mean()),
        "positive_energy_median": float(np.median(positive)), "negative_energy_median": float(np.median(negative)),
    }


def sample_queries(graphs, count, seed):
    """Sorgunun yarısı gerçek altgraf, yarısı oda tipi değiştirilmiş altgraf olur."""
    rng = random.Random(seed)
    ids = list(graphs)
    queries = []
    while len(queries) < count:
        graph = graphs[rng.choice(ids)]
        anchor = rng.choice(list(graph.nodes()))
        nodes = {anchor}
        frontier = list(graph.neighbors(anchor))
        size = rng.randint(5, 8)
        while len(nodes) < size and frontier:
            node = frontier.pop(rng.randrange(len(frontier)))
            if node not in nodes:
                nodes.add(node)
                frontier.extend(n for n in graph.neighbors(node) if n not in nodes)
        if len(nodes) < 5:
            continue
        query = graph.subgraph(nodes).copy()
        if len(queries) % 2:
            victim = rng.choice([n for n in nodes if n != anchor])
            query.nodes[victim]["room_type"] = rng.choice(["dis_cikis", "yangin_holu", "siginak", "teknik_saft"])
        queries.append((query, anchor))
    return queries


def neuromatch_benchmark(model, tau, graphs, seed):
    index = NeuroMatchIndex(model, tau, k_hops=K_HOPS)
    start = perf_counter()
    index.add_graphs(graphs)
    build_sec = perf_counter() - start
    queries = sample_queries(graphs, SEARCH_QUERIES, seed)
    exact_sec = filtered_sec = 0.0
    candidates = verified = missed = expected = 0
    for query, anchor in queries:
        exact = index.search(query, anchor, use_filter=False)
        filtered = index.search(query, anchor, use_filter=True)
        exact_sec += exact["elapsed_sec"]
        filtered_sec += filtered["elapsed_sec"]
        candidates += exact["candidates"]
        verified += filtered["verified"]
        expected += len(exact["matches"])
        missed += len(set(exact["matches"]) - set(filtered["matches"]))
    return {
        "queries": len(queries), "indexed_targets": sum(len(v) for v in index.entries.values()),
        "index_build_sec": build_sec, "exact_query_sec": exact_sec, "filtered_query_sec": filtered_sec,
        "speedup_with_ready_index": exact_sec / max(filtered_sec, 1e-9),
        "speedup_including_index_build": exact_sec / max(filtered_sec + build_sec, 1e-9),
        "candidate_pruned_rate": 1.0 - verified / max(candidates, 1),
        "true_matches": expected, "missed_matches": missed,
    }


def spminer_comparison(model, graphs):
    rows = {"same_result_buildings": 0, "buildings": len(graphs), "wl_sec": 0.0, "neural_sec": 0.0, "neural_motifs": 0, "wl_motifs": 0}
    def signature(motifs):
        return sorted((m.wl_hash, m.support) for m in motifs)
    for graph in graphs.values():
        start = perf_counter()
        wl, _ = ArchitecturalSPMiner().discover_frequent_modules(graph)
        rows["wl_sec"] += perf_counter() - start
        start = perf_counter()
        neural, _ = ArchitecturalSPMiner(model, use_neural_clustering=True).discover_frequent_modules(graph)
        rows["neural_sec"] += perf_counter() - start
        rows["wl_motifs"] += len(wl)
        rows["neural_motifs"] += len(neural)
        rows["same_result_buildings"] += signature(wl) == signature(neural)
    return rows


def coarsening_check(graphs):
    worst = float("inf")
    checked = 0
    ratios = []
    for graph in graphs.values():
        motifs, _ = ArchitecturalSPMiner().discover_frequent_modules(graph)
        result = ArchitecturalGraphCoarsener.coarsen_building_graph(graph, motifs)
        ratios.append(result.compression_ratio)
        exits = [n for n, d in graph.nodes(data=True) if d.get("room_type") == "dis_cikis"]
        if not exits or not result.macro_node_registry:
            continue
        usable = lambda g: nx.subgraph_view(g, filter_edge=lambda u, v: g[u][v].get("usable_in_fire", True))
        full = nx.multi_source_dijkstra_path_length(usable(graph), exits, weight="distance_m")
        coarse_graph = result.G_coarsened
        coarse = nx.multi_source_dijkstra_path_length(usable(coarse_graph), [e for e in exits if e in coarse_graph], weight="distance_m")
        for macro, record in result.macro_node_registry.items():
            real = [full[n] for n in record.contained_original_nodes if n in full]
            if macro in coarse and real:
                worst = min(worst, coarse[macro] + record.internal_max_escape_m - max(real))
                checked += 1
    return {"macro_nodes_checked": checked, "worst_distance_error_m": None if not checked else worst,
            "mean_compression_ratio": float(np.mean(ratios))}


def main():
    torch.set_num_threads(max(1, torch.get_num_threads()))
    data = ROOT / "data"
    runs = []
    for seed in SEEDS:
        split = building_splits(seed)
        training = pairs(split["train"], TRAIN_PAIRS, seed)
        validation_pairs = pairs(split["validation"], EVAL_PAIRS, seed + 1)
        test_pairs = pairs(split["test"], EVAL_PAIRS, seed + 2)
        run = {"seed": seed, "buildings": {k: [str(v) for v in values] for k, values in split.items()}}
        for label, use_rwpe in (("with_rwpe", True), ("without_rwpe", False)):
            start = perf_counter()
            model, losses = train(seed, training, use_rwpe=use_rwpe)
            validation = scores(model, validation_pairs, use_rwpe)
            tau = calibrate(validation)
            run[label] = {"train_sec": perf_counter() - start, "loss_by_epoch": losses, "tau": tau,
                          "validation": summarize(validation, tau), "test": summarize(scores(model, test_pairs, use_rwpe), tau)}
            if use_rwpe:
                best_model = model
            print(seed, label, "test_auroc", round(run[label]["test"]["auroc"], 3), "fn", run[label]["test"]["positive_pruned"], flush=True)
        graphs = {b: building_graph(b) for b in split["test"]}
        run["neuromatch_search"] = neuromatch_benchmark(best_model, run["with_rwpe"]["tau"], graphs, seed + 3)
        run["spminer"] = spminer_comparison(best_model, graphs)
        run["coarsening"] = coarsening_check(graphs)
        runs.append(run)
        print(seed, json.dumps(run["neuromatch_search"]), flush=True)
        if seed == SEEDS[0]:  # Sabit dağıtım tohumu, test sonuçlarından önce seçilir.
            path = data / "spatial_order_gnn.pt"
            best_model.save_weights(str(path))
            calibration = {"model_version": hashlib.sha256(path.read_bytes()).hexdigest(), "tau": run["with_rwpe"]["tau"], "seed": seed, "k_hops": K_HOPS}
            (data / "gnn_calibration.json").write_text(json.dumps(calibration, indent=2), encoding="utf8")

    (data / "gnn_eval_metrics.json").write_text(json.dumps(runs, ensure_ascii=False, indent=2), encoding="utf8")

    searches = [r["neuromatch_search"] for r in runs]
    rwpe_gain = float(np.mean([r["with_rwpe"]["test"]["auroc"] - r["without_rwpe"]["test"]["auroc"] for r in runs]))
    worst_errors = [r["coarsening"]["worst_distance_error_m"] for r in runs if r["coarsening"]["worst_distance_error_m"] is not None]
    gates = {
        "note": "Olcumler sentetik binalar ve uretilmis ornek paftalarla yapildi; gercek proje verisiyle yinelenmelidir.",
        "fire_core_pruning": {"enabled": False, "reason": "Uygunluk karari her zaman VF2 ile verilir."},
        "neuromatch_search": {
            "passed": all(s["missed_matches"] == 0 and s["candidate_pruned_rate"] >= MIN_PRUNED_RATE and s["speedup_with_ready_index"] > 1.0 for s in searches),
            "missed_matches": [s["missed_matches"] for s in searches],
            "candidate_pruned_rate": [s["candidate_pruned_rate"] for s in searches],
            "speedup_with_ready_index": [s["speedup_with_ready_index"] for s in searches],
            "speedup_including_index_build": [s["speedup_including_index_build"] for s in searches],
            "test_positive_pruned_rate": [r["with_rwpe"]["test"]["positive_pruned_rate"] for r in runs],
        },
        "neural_spminer": {
            "passed": False,
            "reason": "Son karar WL ve izomorfizmde oldugu icin noral kumeleme dogruluk ustunlugu saglayamaz.",
            "same_result_buildings": [r["spminer"]["same_result_buildings"] for r in runs],
            "buildings": [r["spminer"]["buildings"] for r in runs],
        },
        "rwpe": {"passed": rwpe_gain >= MIN_RWPE_AUROC_GAIN, "mean_test_auroc_gain": rwpe_gain},
        "coarsening": {"passed": bool(worst_errors) and min(worst_errors) >= -1e-6, "worst_distance_error_m": worst_errors},
        "model_quality": {"test_auroc": [r["with_rwpe"]["test"]["auroc"] for r in runs]},
    }
    (data / "gnn_gates.json").write_text(json.dumps(gates, ensure_ascii=False, indent=2), encoding="utf8")
    print(json.dumps(gates, ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
    main()
