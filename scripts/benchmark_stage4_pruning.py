import os
import sys
import json
import time
import networkx as nx
from typing import Dict, Any, List

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from diagram_yonetmelik.schemas import PipelineConfig
from diagram_yonetmelik.orchestrator import DiagramYonetmelikPipeline

def generate_synthetic_building(num_floors: int, apartments_per_floor: int = 2) -> nx.Graph:
    G = nx.Graph()
    node_id = 1
    
    stair_nodes = []
    for floor in range(num_floors):
        # Kat koridoru
        hall = node_id
        G.add_node(hall, room_type="kat_koridoru", floor_level=floor, area_m2=25.0)
        node_id += 1

        # Yangin holu
        y_hol = node_id
        G.add_node(y_hol, room_type="yangin_holu", floor_level=floor, area_m2=4.5)
        node_id += 1

        # Yangin merdiveni
        y_merd = node_id
        G.add_node(y_merd, room_type="yangin_merdiveni", floor_level=floor, area_m2=12.0)
        node_id += 1
        stair_nodes.append((floor, y_merd))

        # Baglantilar
        G.add_edge(hall, y_hol, door_width_cm=100.0, is_fire_resistant=True, distance_m=5.0)
        G.add_edge(y_hol, y_merd, door_width_cm=100.0, is_fire_resistant=True, distance_m=3.0)

        # Zemin katta dis cikis
        if floor == 0:
            ex = node_id
            G.add_node(ex, room_type="dis_cikis", floor_level=0, area_m2=10.0)
            node_id += 1
            G.add_edge(y_merd, ex, door_width_cm=120.0, is_fire_resistant=True, distance_m=6.0)

        # Daireler
        for apt_idx in range(apartments_per_floor):
            antre = node_id
            G.add_node(antre, room_type="daire_antresi", floor_level=floor, area_m2=8.0)
            node_id += 1
            G.add_edge(hall, antre, door_width_cm=90.0, distance_m=4.0)

            salon = node_id
            G.add_node(salon, room_type="salon", floor_level=floor, area_m2=28.0)
            node_id += 1
            G.add_edge(antre, salon, door_width_cm=90.0, distance_m=3.0)

            oda = node_id
            G.add_node(oda, room_type="oda", floor_level=floor, area_m2=14.0)
            node_id += 1
            G.add_edge(antre, oda, door_width_cm=90.0, distance_m=3.0)

            banyo = node_id
            G.add_node(banyo, room_type="banyo_wc", floor_level=floor, area_m2=5.0)
            node_id += 1
            G.add_edge(antre, banyo, door_width_cm=80.0, distance_m=2.0)

    # Dusey merdiven baglantilari
    for i in range(len(stair_nodes) - 1):
        f_low, n_low = stair_nodes[i]
        f_up, n_up = stair_nodes[i+1]
        G.add_edge(n_low, n_up, is_vertical=True, door_width_cm=120.0, distance_m=4.5)

    return G

def run_benchmark() -> Dict[str, Any]:
    building_configs = [
        ("Kucuk Bina (1 Kat, 8 Düğüm)", generate_synthetic_building(num_floors=1, apartments_per_floor=1)),
        ("Orta Bina (4 Kat, 44 Düğüm)", generate_synthetic_building(num_floors=4, apartments_per_floor=2)),
        ("Buyuk Bina (10 Kat, 110 Düğüm)", generate_synthetic_building(num_floors=10, apartments_per_floor=2)),
    ]

    results = []

    for name, G in building_configs:
        # 1. Budamasız (Doğrudan VF2)
        cfg_unpruned = PipelineConfig(
            enable_hybrid_pruning=False,
            record_gnn_energy=False
        )
        pipe_unpruned = DiagramYonetmelikPipeline(cfg_unpruned)
        metrics_unpruned = {}
        t0 = time.perf_counter()
        v_unp, d_unp = pipe_unpruned._review_fire_candidates(G, metrics_unpruned)
        time_unpruned_ms = round((time.perf_counter() - t0) * 1000.0, 2)

        # 2. Budamalı (GNN Enerji Filtreli)
        cfg_pruned = PipelineConfig(
            enable_hybrid_pruning=True,
            record_gnn_energy=True
        )
        pipe_pruned = DiagramYonetmelikPipeline(cfg_pruned)
        metrics_pruned = {}
        t0 = time.perf_counter()
        v_p, d_p = pipe_pruned._review_fire_candidates(G, metrics_pruned)
        time_pruned_ms = round((time.perf_counter() - t0) * 1000.0, 2)

        results.append({
            "building_scale": name,
            "total_nodes": G.number_of_nodes(),
            "total_edges": G.number_of_edges(),
            "unpruned": {
                "time_ms": time_unpruned_ms,
                "candidates_evaluated": len(v_unp) + len(d_unp),
                "verified_cores": len(v_unp)
            },
            "pruned": {
                "time_ms": time_pruned_ms,
                "candidates_evaluated": len(v_p) + len(d_p),
                "pruned_candidates": metrics_pruned.get("pruned_candidates", 0),
                "verified_cores": len(v_p)
            },
            "speedup_ratio": round(time_unpruned_ms / max(1e-3, time_pruned_ms), 2)
        })

    output = {
        "benchmark": "Aşama 4 VF2 Yangın Çekirdeği Denetimi Süre Ölçümü",
        "description": "3 farklı bina boyutunda (küçük, orta, büyük) budamalı ve budamasız gerçek çalışma süreleri.",
        "results": results
    }

    out_path = os.path.join("data", "benchmarks", "stage4_pruning.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Benchmark tamamlandi: {out_path}")
    return output

if __name__ == "__main__":
    run_benchmark()

