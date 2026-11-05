"""Dağıtımdaki modelin ayrılmış test binaları üzerinde bina içi kümeleme karşılaştırması."""
import json
from time import perf_counter
import torch
from .gnn_order import SpatialOrderGNN
from .spminer import ArchitecturalSPMiner
from .train_gnn import ROOT, building_graph, building_splits


def main():
    torch.set_num_threads(1)
    calibration = json.loads((ROOT / "data/gnn_calibration.json").read_text())
    model = SpatialOrderGNN()
    if not model.load_weights(str(ROOT / "data/spatial_order_gnn.pt")):
        raise RuntimeError("Deney ağırlıkları okunamadı")
    graphs = [building_graph(i) for i in building_splits(calibration["seed"])["test"]]
    for neural in (False, True):
        miner = ArchitecturalSPMiner(model, min_support=1, use_neural_clustering=neural)
        clusters = rejected = 0
        start = perf_counter()
        for graph in graphs:
            motifs, _ = miner.discover_frequent_modules(graph)
            clusters += len(motifs)
            rejected += miner.rejected_candidates
        print("GNN" if neural else "WL", clusters, rejected, round(perf_counter() - start, 3))


if __name__ == "__main__":
    main()
