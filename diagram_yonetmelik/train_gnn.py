"""Bina düzeyinde tekrarlanabilir GNN eğitimi. Deney için evaluate_gnn çalıştırılır."""
import random
from pathlib import Path
from tempfile import TemporaryDirectory

import ezdxf
import torch

from .cad_ingest import DXFFloorplanParser
from .gnn_order import SpatialOrderGNN, OrderEmbeddingLoss, nx_subgraph_to_pyg_data
from .sample_generator import generate_experiment_building, generate_sample_building_dxf
from .spatial_rag import MultiFloor3DRAGBuilder
from .vf2_diagnostics import ExplainableVF2Analyzer, fire_candidates

ROOT = Path(__file__).resolve().parents[1]
SEEDS = (17, 41, 73)
SAMPLE = "sample_building.dxf"


def building_splits(seed):
    ids = list(range(30))
    random.Random(seed).shuffle(ids)
    return {"train": ids[:18], "validation": ids[18:24], "test": ids[24:] + [SAMPLE]}


def building_graph(building_id):
    if building_id != SAMPLE:
        return generate_experiment_building(building_id)
    with TemporaryDirectory() as tmp:
        path = ROOT / SAMPLE
        doc = ezdxf.readfile(path) if path.exists() else generate_sample_building_dxf(str(Path(tmp) / SAMPLE))
    rooms, doors, scale = DXFFloorplanParser().parse_dxf_document(doc)
    return MultiFloor3DRAGBuilder().build_3d_building_rag(rooms, doors, unit_scale_to_meters=scale).G_3d


def pairs(ids):
    analyzer = ExplainableVF2Analyzer()
    result = []
    for building_id in ids:
        for query, target, anchor in fire_candidates(building_graph(building_id), analyzer, 2):
            match, _ = analyzer._run_strict_vf2(query, target, 1, anchor)
            result.append((nx_subgraph_to_pyg_data(query, 1), nx_subgraph_to_pyg_data(target, anchor), float(match)))
    return result


def embed(model, data):
    return model(data["x"], data["edge_index"], data["edge_attr"], data["anchor_mask"])


def train(seed, examples, epochs=4):
    torch.manual_seed(seed)
    rng = random.Random(seed)
    model = SpatialOrderGNN()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
    criterion = OrderEmbeddingLoss()
    losses = []
    for _ in range(epochs):
        rng.shuffle(examples)
        total = 0.
        for query, target, label in examples:
            optimizer.zero_grad()
            loss = criterion(embed(model, query), embed(model, target), y=torch.tensor([label]))
            loss.backward()
            optimizer.step()
            total += loss.item()
        losses.append(total / len(examples))
    return model.eval(), losses


if __name__ == "__main__":
    from .evaluate_gnn import main
    main()
