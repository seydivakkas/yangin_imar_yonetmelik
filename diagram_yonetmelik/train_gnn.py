"""
Bina düzeyinde tekrarlanabilir GNN eğitimi. Deney için evaluate_gnn çalıştırılır.

Görev: bir sorgu altgrafının, çapası korunarak hedefte yapı ve oda tipi bakımından bulunup
bulunmadığı. Kapı genişliği gibi sayısal mevzuat eşikleri kural katmanına aittir, burada öğrenilmez.
"""
import random
from pathlib import Path
from tempfile import TemporaryDirectory

import ezdxf
import torch
from torch_geometric.loader import DataLoader

from .cad_ingest import DXFFloorplanParser
from .gnn_order import NUM_ROOM_TYPES, RWPE_DIM, OrderEmbeddingLoss, SpatialOrderGNN
from .sample_generator import (
    generate_compliant_8_story_building_dxf,
    generate_experiment_building,
    generate_high_rise_12_story_building_dxf,
    generate_sample_building_dxf,
)
from .spatial_rag import MultiFloor3DRAGBuilder
from .subgraph_dataset import SpatialRAGSubgraphDataset, split_pair_batch

ROOT = Path(__file__).resolve().parents[1]
SEEDS = (17, 41, 73)
SAMPLE = "sample_building.dxf"
HIGH_RISE = "high_rise_12_story.dxf"
EIGHT_STORY = "compliant_8_story.dxf"
DXF_GENERATORS = {
    SAMPLE: generate_sample_building_dxf,
    HIGH_RISE: generate_high_rise_12_story_building_dxf,
    EIGHT_STORY: generate_compliant_8_story_building_dxf,
}
K_HOPS = 3
TRAIN_PAIRS = 4000
EVAL_PAIRS = 1000
EPOCHS = 10
BATCH_SIZE = 32


def building_splits(seed):
    """Aynı bina iki kümede bulunmaz; örnek DXF paftaları yalnızca testte kullanılır."""
    ids = list(range(60))
    random.Random(seed).shuffle(ids)
    return {"train": ids[:36], "validation": ids[36:48], "test": ids[48:] + list(DXF_GENERATORS)}


def building_graph(building_id):
    if building_id not in DXF_GENERATORS:
        return generate_experiment_building(building_id)
    with TemporaryDirectory() as tmp:
        doc = DXF_GENERATORS[building_id](str(Path(tmp) / building_id))
    rooms, doors, scale = DXFFloorplanParser().parse_dxf_document(doc)
    return MultiFloor3DRAGBuilder().build_3d_building_rag(rooms, doors, unit_scale_to_meters=scale).G_3d


def pairs(ids, count, seed):
    """Verilen binalardan tekrarlanabilir, dengeli altgraf çiftleri üretir."""
    random.seed(seed)
    dataset = SpatialRAGSubgraphDataset(
        [building_graph(building_id) for building_id in ids],
        num_samples=count, k_hops=K_HOPS, min_query_nodes=3, max_query_nodes=8, walk_steps=RWPE_DIM,
    )
    return [dataset[i] for i in range(count)]


def embed_side(model, batch, use_rwpe=True):
    x = batch.x
    if not use_rwpe:
        x = x.clone()
        x[:, NUM_ROOM_TYPES:NUM_ROOM_TYPES + RWPE_DIM] = 0.0
    return model(x, batch.edge_index, batch.edge_attr, x[:, -1].bool(), batch.batch)


def loader(examples, shuffle=False, seed=0):
    generator = torch.Generator().manual_seed(seed)
    return DataLoader(examples, batch_size=BATCH_SIZE, shuffle=shuffle, generator=generator,
                      follow_batch=["x_q", "x_u"])


def train(seed, examples, use_rwpe=True, epochs=EPOCHS):
    torch.manual_seed(seed)
    model = SpatialOrderGNN()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001, weight_decay=1e-5)
    criterion = OrderEmbeddingLoss()
    losses = []
    data_loader = loader(examples, shuffle=True, seed=seed)
    for _ in range(epochs):
        model.train()
        total = 0.0
        for batch in data_loader:
            queries, targets, labels = split_pair_batch(batch)
            optimizer.zero_grad()
            loss = criterion(embed_side(model, queries, use_rwpe), embed_side(model, targets, use_rwpe), y=labels)
            loss.backward()
            optimizer.step()
            total += loss.item()
        losses.append(total / len(data_loader))
    return model.eval(), losses


if __name__ == "__main__":
    from .evaluate_gnn import main
    main()
