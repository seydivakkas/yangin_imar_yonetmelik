# -*- coding: utf-8 -*-
"""
DiagramYönetmelik — SpatialOrderGNN Eğitim ve Ağırlık Kayıt Modülü
Mimari RAG graflarından pozitif ve sert negatif çiftler üzerinde
OrderEmbeddingLoss ile SpatialOrderGNN modelini eğitir ve ağırlıklarını kaydeder.

ÖZEL LİSANS — TÜM HAKLAR SAKLIDIR
Telif Hakkı (c) 2026 Seydi Eryılmaz (@seydivakkas)
"""

import os
import sys
import time
from typing import List, Tuple, Optional, Dict, Any
import networkx as nx
import torch
import torch.nn as nn
import torch.optim as optim

from diagram_yonetmelik.gnn_order import (
    SpatialOrderGNN,
    OrderEmbeddingLoss,
    violation_energy,
)
from diagram_yonetmelik.subgraph_dataset import (
    build_sample_architectural_rag,
    SpatialRAGSubgraphDataset,
    split_pair_batch,
    PYG_AVAILABLE,
)
from diagram_yonetmelik.sample_generator import (
    generate_sample_building_dxf,
    generate_compliant_8_story_building_dxf,
)
from diagram_yonetmelik.cad_ingest import DXFFloorplanParser
from diagram_yonetmelik.spatial_rag import MultiFloor3DRAGBuilder


def get_training_architectural_graphs() -> List[nx.Graph]:
    """Eğitim için zengin ve çeşitli mimari RAG grafları toplar."""
    graphs: List[nx.Graph] = []

    # 1. Kanonik Sentetik RAG
    g_sample = build_sample_architectural_rag()
    graphs.append(g_sample)

    # 2. 3 Katlı Konut Paftası RAG
    try:
        parser = DXFFloorplanParser()
        rag_builder = MultiFloor3DRAGBuilder()
        dxf_3f = generate_sample_building_dxf()
        rooms_3f, doors_3f, scale_3f = parser.parse_dxf_document(dxf_3f)
        rag_3f = rag_builder.build_3d_building_rag(rooms_3f, doors_3f, unit_scale_to_meters=scale_3f)
        graphs.append(rag_3f.G_3d)
    except Exception as e:
        print(f"[TrainGNN] 3 katlı bina RAG oluşturma atlandı: {e}")

    # 3. 8 Katlı Yönetmeliğe Uygun Pafta RAG
    try:
        dxf_8f = generate_compliant_8_story_building_dxf()
        rooms_8f, doors_8f, scale_8f = parser.parse_dxf_document(dxf_8f)
        rag_8f = rag_builder.build_3d_building_rag(rooms_8f, doors_8f, unit_scale_to_meters=scale_8f)
        graphs.append(rag_8f.G_3d)
    except Exception as e:
        print(f"[TrainGNN] 8 katlı bina RAG oluşturma atlandı: {e}")

    return graphs


def train_spatial_order_gnn(
    output_weights_path: str = "data/spatial_order_gnn.pt",
    epochs: int = 15,
    num_samples: int = 120,
    lr: float = 0.001,
    margin: float = 1.0,
    device: Optional[str] = None
) -> Dict[str, Any]:
    """
    SpatialOrderGNN modelini mimari altgraf çiftleri üzerinde eğitir
    ve ağırlıkları diske kaydeder.
    """
    t_start = time.time()
    dev = device or ("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[TrainGNN] GNN Eğitimi Başlatılıyor (Cihaz: {dev}, Epochs: {epochs}, Örnekler: {num_samples})...")

    # 1. Eğitim Graflarını Topla
    graphs = get_training_architectural_graphs()
    print(f"[TrainGNN] Toplam {len(graphs)} mimari bina grafı üzerinde dataset oluşturuluyor...")

    # 2. Dataset Oluştur
    dataset = SpatialRAGSubgraphDataset(
        floorplan_graphs=graphs,
        num_samples=num_samples,
        k_hops=3,
        min_query_nodes=3,
        max_query_nodes=7,
        walk_steps=6,
        pos_ratio=0.5
    )

    # 3. Model ve Kayıp Fonksiyonu
    model = SpatialOrderGNN().to(dev)
    criterion = OrderEmbeddingLoss(margin=margin)
    optimizer = optim.Adam(model.parameters(), lr=lr, weight_decay=1e-5)

    history = []

    # 4. Eğitim Döngüsü
    model.train()
    for epoch in range(1, epochs + 1):
        epoch_loss = 0.0
        pos_energies = []
        neg_energies = []
        correct_count = 0
        total_count = len(dataset)

        for i in range(total_count):
            item = dataset[i]
            optimizer.zero_grad()

            if hasattr(item, 'x_q'):
                x_q = item.x_q.to(dev)
                ei_q = item.edge_index_q.to(dev)
                ea_q = item.edge_attr_q.to(dev)
                anc_q = item.x_q[:, -1].bool().to(dev)

                x_u = item.x_u.to(dev)
                ei_u = item.edge_index_u.to(dev)
                ea_u = item.edge_attr_u.to(dev)
                anc_u = item.x_u[:, -1].bool().to(dev)

                y = item.y.to(dev)
            else:
                x_q = item['x_q'].to(dev)
                ei_q = item['edge_index_q'].to(dev)
                ea_q = item['edge_attr_q'].to(dev)
                anc_q = item['x_q'][:, -1].bool().to(dev)

                x_u = item['x_u'].to(dev)
                ei_u = item['edge_index_u'].to(dev)
                ea_u = item['edge_attr_u'].to(dev)
                anc_u = item['x_u'][:, -1].bool().to(dev)

                y = item['y'].to(dev)

            z_q = model(x_q, ei_q, ea_q, anc_q)
            z_u = model(x_u, ei_u, ea_u, anc_u)

            loss = criterion(z_q, z_u, y=y)
            loss.backward()
            optimizer.step()

            epoch_loss += loss.item()
            with torch.no_grad():
                energy = float(violation_energy(z_q, z_u).item())
                if y.item() == 1.0:
                    pos_energies.append(energy)
                    if energy < 0.25:
                        correct_count += 1
                else:
                    neg_energies.append(energy)
                    if energy >= 0.25:
                        correct_count += 1

        avg_loss = epoch_loss / max(1, total_count)
        avg_pos_e = sum(pos_energies) / max(1, len(pos_energies))
        avg_neg_e = sum(neg_energies) / max(1, len(neg_energies))
        acc = correct_count / max(1, total_count) * 100.0

        history.append({
            "epoch": epoch,
            "loss": round(avg_loss, 4),
            "pos_energy": round(avg_pos_e, 4),
            "neg_energy": round(avg_neg_e, 4),
            "accuracy": round(acc, 1)
        })

        if epoch % 5 == 0 or epoch == epochs:
            print(f"[TrainGNN] Epoch {epoch:2d}/{epochs} - Loss: {avg_loss:.4f} | Pos E: {avg_pos_e:.4f} | Neg E: {avg_neg_e:.4f} | Acc: {acc:.1f}%")

    # 5. Ağırlıkları Kaydet
    model.save_weights(output_weights_path)
    elapsed = round(time.time() - t_start, 2)
    print(f"[TrainGNN] Model başarıyla eğitildi ve kaydedildi: {output_weights_path} ({elapsed} sn)")

    return {
        "output_weights_path": output_weights_path,
        "elapsed_sec": elapsed,
        "final_loss": history[-1]["loss"] if history else 0.0,
        "final_accuracy": history[-1]["accuracy"] if history else 0.0,
        "history": history
    }


if __name__ == "__main__":
    train_spatial_order_gnn()
