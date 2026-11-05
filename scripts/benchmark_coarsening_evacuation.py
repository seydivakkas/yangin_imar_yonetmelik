import os
import sys
import json
import networkx as nx
from typing import Dict, Any, List

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from diagram_yonetmelik.spminer import ArchitecturalSPMiner, ArchitecturalGraphCoarsener
from diagram_yonetmelik.evacuation import Building3DEvacuationSimulator
from scripts.benchmark_spminer_coarsening import generate_test_building

def run_benchmark() -> Dict[str, Any]:
    buildings = [
        ("Bina 1 (1 Kat, 2 Daire)", generate_test_building(1, 2)),
        ("Bina 2 (2 Kat, 4 Daire)", generate_test_building(2, 2)),
        ("Bina 3 (4 Kat, 8 Daire)", generate_test_building(4, 2)),
        ("Bina 4 (8 Kat, 16 Daire)", generate_test_building(8, 2)),
        ("Bina 5 (12 Kat, 24 Daire)", generate_test_building(12, 2)),
    ]

    spminer = ArchitecturalSPMiner(min_support=2)
    sim = Building3DEvacuationSimulator()
    results = []

    for name, G in buildings:
        motifs, _ = spminer.discover_frequent_modules(G)
        coarse_res = ArchitecturalGraphCoarsener.coarsen_building_graph(
            G,
            motifs,
            walking_speed_mps=1.2,
            reaction_time_sec=15.0
        )

        verified_res = ArchitecturalGraphCoarsener.verify_and_validate_coarsening(
            building_graph=G,
            coarsened_result=coarse_res,
            simulator=sim,
            threshold_pct=10.0
        )

        results.append({
            "building_name": name,
            "full_graph_time_sec": verified_res.evacuation_time_full_sec,
            "coarsened_graph_time_sec": verified_res.evacuation_time_coarsened_sec,
            "difference_pct": verified_res.evacuation_diff_pct,
            "threshold_pct": 10.0,
            "is_simulation_blocked": verified_res.is_simulation_blocked,
            "warning_message": verified_res.warning_message
        })

    avg_diff = round(sum(r["difference_pct"] for r in results) / len(results), 2)

    output = {
        "benchmark": "Makro Düğüm Varış Profilli Tahliye Doğrulama Testi",
        "description": "Tam graf ile sıkıştırılmış graf + zamana yayılmış varış profili tahliye sürelerinin karşılaştırılması.",
        "mean_difference_pct": avg_diff,
        "results": results
    }

    out_path = os.path.join("data", "benchmarks", "coarsening_evacuation.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Benchmark tamamlandi: {out_path}")
    return output

if __name__ == "__main__":
    run_benchmark()

