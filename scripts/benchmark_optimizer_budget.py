import os
import sys
import json
import time
import copy
import networkx as nx
from typing import Dict, Any, List

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from diagram_yonetmelik.evacuation import CounterfactualEvacuationOptimizer, Building3DEvacuationSimulator

def generate_bottleneck_building(num_bottlenecks: int) -> nx.Graph:
    G = nx.Graph()
    # Zemin çıkışı
    G.add_node(100, room_type="dis_cikis", floor_level=0, area_m2=20.0)
    # Yangın merdiveni
    G.add_node(101, room_type="yangin_merdiveni", floor_level=0, area_m2=15.0)
    G.add_edge(101, 100, door_width_cm=120.0, is_fire_resistant=True, distance_m=5.0)

    # Koridor
    G.add_node(102, room_type="kat_koridoru", floor_level=0, area_m2=30.0)
    G.add_edge(102, 101, door_width_cm=100.0, is_fire_resistant=True, distance_m=4.0)

    # Darboğaz odaları ekle
    # Her darboğaz için yüksek doluluklu bir oda ve dar bir kapı (65-70cm)
    for i in range(1, num_bottlenecks + 1):
        room_id = i
        rtype = "salon" if i % 2 == 0 else "oda"
        G.add_node(room_id, room_type=rtype, floor_level=0, area_m2=25.0)
        # Dar kapı (darboğaz oluşturur)
        G.add_edge(room_id, 102, door_width_cm=70.0, distance_m=6.0)

    # İlave normal odalar (genel kalabalık oluşturması için)
    for i in range(num_bottlenecks + 1, num_bottlenecks + 4):
        G.add_node(i, room_type="oda", floor_level=0, area_m2=14.0)
        G.add_edge(i, 102, door_width_cm=90.0, distance_m=5.0)

    return G

def run_benchmark() -> Dict[str, Any]:
    test_cases = [
        ("1 Darboğazlı Bina", generate_bottleneck_building(1)),
        ("3 Darboğazlı Bina", generate_bottleneck_building(3)),
        ("6 Darboğazlı Bina", generate_bottleneck_building(6)),
    ]

    results = []

    for name, G in test_cases:
        # 1. Önce: Bütçesiz ve Önbelleksiz (Klasik açgözlü arama)
        opt_legacy = CounterfactualEvacuationOptimizer(
            max_iterations=15,
            max_candidates=50,
            max_simulations=999
        )
        t0 = time.perf_counter()
        res_before = opt_legacy.optimize_building_design(G)
        time_before_sec = round(time.perf_counter() - t0, 3)
        sims_before = opt_legacy._sim_count

        # 2. Sonra: Bütçeli (max_simulations=8), Marjinal Oran Sıralamalı, Önbellekli
        opt_budgeted = CounterfactualEvacuationOptimizer(
            max_iterations=8,
            max_candidates=15,
            max_simulations=8
        )
        t0 = time.perf_counter()
        res_after = opt_budgeted.optimize_building_design(G)
        time_after_sec = round(time.perf_counter() - t0, 3)
        sims_after = opt_budgeted._sim_count

        results.append({
            "case": name,
            "before_unbudgeted": {
                "simulations_count": sims_before,
                "execution_time_sec": time_before_sec,
                "time_savings_sec": res_before.time_savings_sec,
                "steps_prescribed": len(res_before.intervention_steps)
            },
            "after_budgeted_cached": {
                "simulations_count": sims_after,
                "execution_time_sec": time_after_sec,
                "cache_hits": opt_budgeted._cache_hits,
                "budget_exhausted": res_after.budget_exhausted,
                "warning_message": res_after.warning_message,
                "time_savings_sec": res_after.time_savings_sec,
                "steps_prescribed": len(res_after.intervention_steps)
            },
            "speedup_ratio": round(time_before_sec / max(1e-4, time_after_sec), 2)
        })

    output = {
        "benchmark": "Karşı-Olgusal Optimizör Simülasyon Bütçesi ve Önbellek Ölçümü",
        "description": "1, 3 ve 6 darboğazlı binalarda bütçesiz duruma karşı bütçeli + önbellekli simülasyon sayısı ve süre ölçümleri.",
        "results": results
    }

    out_path = os.path.join("data", "benchmarks", "optimizer_budget.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Benchmark tamamlandi: {out_path}")
    return output

if __name__ == "__main__":
    run_benchmark()

