import os
import sys
import json
import networkx as nx
from typing import Dict, Any, List

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from diagram_yonetmelik.spminer import ArchitecturalSPMiner, ArchitecturalGraphCoarsener

def generate_test_building(num_floors: int, apartments_per_floor: int, rooms_per_apt: int = 5) -> nx.Graph:
    G = nx.Graph()
    node_id = 1
    stair_nodes = []

    for floor in range(num_floors):
        hall = node_id
        G.add_node(hall, room_type="kat_koridoru", floor_level=floor, area_m2=20.0)
        node_id += 1

        y_hol = node_id
        G.add_node(y_hol, room_type="yangin_holu", floor_level=floor, area_m2=4.0)
        node_id += 1

        y_merd = node_id
        G.add_node(y_merd, room_type="yangin_merdiveni", floor_level=floor, area_m2=10.0)
        node_id += 1
        stair_nodes.append((floor, y_merd))

        G.add_edge(hall, y_hol, door_width_cm=100.0, is_fire_resistant=True, distance_m=4.0)
        G.add_edge(y_hol, y_merd, door_width_cm=100.0, is_fire_resistant=True, distance_m=2.0)

        if floor == 0:
            ex = node_id
            G.add_node(ex, room_type="dis_cikis", floor_level=0, area_m2=8.0)
            node_id += 1
            G.add_edge(y_merd, ex, door_width_cm=120.0, is_fire_resistant=True, distance_m=5.0)

        for _ in range(apartments_per_floor):
            antre = node_id
            G.add_node(antre, room_type="daire_antresi", floor_level=floor, area_m2=7.0)
            node_id += 1
            G.add_edge(hall, antre, door_width_cm=90.0, distance_m=3.0)

            salon = node_id
            G.add_node(salon, room_type="salon", floor_level=floor, area_m2=26.0)
            node_id += 1
            G.add_edge(antre, salon, door_width_cm=90.0, distance_m=2.5)

            mutfak = node_id
            G.add_node(mutfak, room_type="mutfak", floor_level=floor, area_m2=11.0)
            node_id += 1
            G.add_edge(antre, mutfak, door_width_cm=90.0, distance_m=2.0)

            oda1 = node_id
            G.add_node(oda1, room_type="oda", floor_level=floor, area_m2=13.0)
            node_id += 1
            G.add_edge(antre, oda1, door_width_cm=90.0, distance_m=3.0)

            banyo = node_id
            G.add_node(banyo, room_type="banyo_wc", floor_level=floor, area_m2=5.0)
            node_id += 1
            G.add_edge(antre, banyo, door_width_cm=80.0, distance_m=1.5)

    for i in range(len(stair_nodes) - 1):
        f_low, n_low = stair_nodes[i]
        f_up, n_up = stair_nodes[i+1]
        G.add_edge(n_low, n_up, is_vertical=True, door_width_cm=120.0, distance_m=3.0)

    return G

def run_benchmark() -> Dict[str, Any]:
    buildings = [
        ("Bina 1: 1 Kat, 2 Daire (Villa / Az Katlı)", generate_test_building(1, 2)),
        ("Bina 2: 2 Kat, 4 Daire (Az Katlı Konut)", generate_test_building(2, 2)),
        ("Bina 3: 4 Kat, 8 Daire (Orta Yükseklikli)", generate_test_building(4, 2)),
        ("Bina 4: 8 Kat, 16 Daire (Çok Katlı Blok)", generate_test_building(8, 2)),
        ("Bina 5: 12 Kat, 24 Daire (Yüksek Yapı)", generate_test_building(12, 2)),
    ]

    spminer = ArchitecturalSPMiner(min_support=2)
    results = []

    for name, G in buildings:
        motifs, program = spminer.discover_frequent_modules(G)
        coarse_res = ArchitecturalGraphCoarsener.coarsen_building_graph(G, motifs)

        orig_nodes = G.number_of_nodes()
        coarse_nodes = coarse_res.coarsened_node_count
        node_reduction_pct = round(((orig_nodes - coarse_nodes) / orig_nodes) * 100.0, 1)

        orig_edges = G.number_of_edges()
        coarse_edges = coarse_res.G_coarsened.number_of_edges()
        edge_reduction_pct = round(((orig_edges - coarse_edges) / max(1, orig_edges)) * 100.0, 1)

        results.append({
            "building_name": name,
            "original_nodes": orig_nodes,
            "coarsened_nodes": coarse_nodes,
            "node_reduction_pct": node_reduction_pct,
            "original_edges": orig_edges,
            "coarsened_edges": coarse_edges,
            "edge_reduction_pct": edge_reduction_pct,
            "macro_nodes_created": len(coarse_res.macro_node_registry),
            "compression_ratio": round(coarse_res.compression_ratio, 3)
        })

    avg_node_reduction = round(sum(r["node_reduction_pct"] for r in results) / len(results), 1)
    avg_edge_reduction = round(sum(r["edge_reduction_pct"] for r in results) / len(results), 1)

    output = {
        "benchmark": "SPMiner Makro Düğüm Sıkıştırma Oranı Ölçümü",
        "description": "5 farklı test binasında gerçek düğüm ve kenar sıkıştırma oranları.",
        "measured_mean_node_reduction_pct": avg_node_reduction,
        "measured_mean_edge_reduction_pct": avg_edge_reduction,
        "documented_claim_replacement": f"Dokümandaki tahmini '%40-60' ifadesi yerine ölçülen gerçek ortalama: Düğüm bazında %{avg_node_reduction}, Kenar bazında %{avg_edge_reduction}",
        "results": results
    }

    out_path = os.path.join("data", "benchmarks", "spminer_coarsening.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Benchmark tamamlandi: {out_path}")
    return output

if __name__ == "__main__":
    run_benchmark()

