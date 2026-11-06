# ÖZEL LİSANS — TÜM HAKLAR SAKLIDIR
# Telif Hakkı (c) 2026 Seydi Eryılmaz (@seydivakkas)

import os
import sys
import time
import json
import networkx as nx
from typing import Dict, Any, List, Tuple

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from diagram_yonetmelik.spminer import ArchitecturalSPMiner, ArchitecturalGraphCoarsener
from diagram_yonetmelik.sample_generator import generate_experiment_building


def generate_benchmark_building(num_floors: int, apartments_per_floor: int) -> nx.Graph:
    """
    Standart kat koridoru, yangın holü, yangın merdiveni ve daire içi odaları
    (salon, mutfak, yatak odaları, banyo) içeren çok katlı mimari 3B bina grafı üretir.
    """
    G = nx.Graph()
    node_id = 1
    stair_nodes = []

    for floor in range(num_floors):
        hall = node_id
        G.add_node(hall, room_type="kat_koridoru", floor_level=floor, area_m2=24.0)
        node_id += 1

        y_hol = node_id
        G.add_node(y_hol, room_type="yangin_holu", floor_level=floor, area_m2=4.5)
        node_id += 1

        y_merd = node_id
        G.add_node(y_merd, room_type="yangin_merdiveni", floor_level=floor, area_m2=12.0)
        node_id += 1
        stair_nodes.append((floor, y_merd))

        # Koridor -> Yangın Holü -> Yangın Merdiveni
        G.add_edge(hall, y_hol, door_width_cm=100.0, is_fire_resistant=True, distance_m=6.0)
        G.add_edge(y_hol, y_merd, door_width_cm=100.0, is_fire_resistant=True, distance_m=2.5)

        if floor == 0:
            ex = node_id
            G.add_node(ex, room_type="dis_cikis", floor_level=0, area_m2=10.0)
            node_id += 1
            G.add_edge(y_merd, ex, door_width_cm=120.0, is_fire_resistant=True, distance_m=4.0)

        for apt_idx in range(apartments_per_floor):
            antre = node_id
            G.add_node(antre, room_type="daire_antresi", floor_level=floor, area_m2=8.0, apt_id=f"K{floor}_D{apt_idx+1}")
            node_id += 1
            # Koridordan antreye mesafe dairenin koridordaki konumuna göre artar
            corr_dist = 3.0 + (apt_idx * 5.0)
            G.add_edge(hall, antre, door_width_cm=90.0, distance_m=corr_dist)

            salon = node_id
            G.add_node(salon, room_type="salon", floor_level=floor, area_m2=28.0, apt_id=f"K{floor}_D{apt_idx+1}")
            node_id += 1
            G.add_edge(antre, salon, door_width_cm=90.0, distance_m=3.5)

            mutfak = node_id
            G.add_node(mutfak, room_type="mutfak", floor_level=floor, area_m2=12.0, apt_id=f"K{floor}_D{apt_idx+1}")
            node_id += 1
            G.add_edge(antre, mutfak, door_width_cm=90.0, distance_m=2.5)

            oda1 = node_id
            G.add_node(oda1, room_type="oda", floor_level=floor, area_m2=18.0, apt_id=f"K{floor}_D{apt_idx+1}")
            node_id += 1
            # Ebeveyn yatak odası: daire antresinden 8.5 metre iç kaçış mesafesinde
            G.add_edge(antre, oda1, door_width_cm=90.0, distance_m=8.5)

            oda2 = node_id
            G.add_node(oda2, room_type="oda", floor_level=floor, area_m2=14.0, apt_id=f"K{floor}_D{apt_idx+1}")
            node_id += 1
            G.add_edge(antre, oda2, door_width_cm=90.0, distance_m=5.0)

            banyo = node_id
            G.add_node(banyo, room_type="banyo_wc", floor_level=floor, area_m2=6.0, apt_id=f"K{floor}_D{apt_idx+1}")
            node_id += 1
            G.add_edge(antre, banyo, door_width_cm=80.0, distance_m=2.0)

    # Düşey yangın merdiveni bağlantıları (2.2x efektif merdiven yürüyüş çarpanı)
    for i in range(len(stair_nodes) - 1):
        _, n_low = stair_nodes[i]
        _, n_up = stair_nodes[i+1]
        G.add_edge(n_low, n_up, is_vertical=True, door_width_cm=120.0, distance_m=6.6)

    return G


def run_coarsening_matrix_experiment() -> Dict[str, Any]:
    buildings = [
        ("Bina 1: 1 Kat, 2 Daire (Villa / Az Katlı)", generate_benchmark_building(1, 2)),
        ("Bina 2: 2 Kat, 4 Daire (Az Katlı Konut)", generate_benchmark_building(2, 2)),
        ("Bina 3: 4 Kat, 8 Daire (Orta Yükseklikli)", generate_benchmark_building(4, 2)),
        ("Bina 4: 8 Kat, 16 Daire (Çok Katlı Blok)", generate_benchmark_building(8, 2)),
        ("Bina 5: 12 Kat, 24 Daire (Yüksek Yapı)", generate_benchmark_building(12, 2)),
    ]

    spminer = ArchitecturalSPMiner(min_support=2)
    bykhy_max_escape_threshold = 30.0  # BYKHY Konutlarda yağmurlamasız tek çıkış üst sınırı (m)

    benchmark_records = []

    for name, G in buildings:
        # Çıkış düğümünü bul
        exits = [n for n, d in G.nodes(data=True) if d.get("room_type") == "dis_cikis"]
        if not exits:
            exits = [n for n, d in G.nodes(data=True) if d.get("room_type") == "yangin_merdiveni"]

        # Daireleri grupla (antre merkezli)
        antre_nodes = [n for n, d in G.nodes(data=True) if d.get("room_type") == "daire_antresi"]
        apartments: Dict[int, List[int]] = {}
        for antre in antre_nodes:
            # Antreden koridora çıkmadan ulaşılan iç odalar
            apt_rooms = [antre]
            visited = {antre}
            queue = [antre]
            while queue:
                curr = queue.pop(0)
                for neighbor in G.neighbors(curr):
                    if neighbor not in visited and G.nodes[neighbor].get("room_type") not in ("kat_koridoru", "yangin_holu", "yangin_merdiveni", "dis_cikis"):
                        visited.add(neighbor)
                        apt_rooms.append(neighbor)
                        queue.append(neighbor)
            apartments[antre] = apt_rooms

        # -------------------------------------------------------------
        # KONTROL GRUBU 1: TAM GRAF (HAM BASELINE)
        # -------------------------------------------------------------
        t0 = time.perf_counter()
        full_dists = nx.multi_source_dijkstra_path_length(G, exits, weight="distance_m")
        group1_worst_escapes = {}
        group1_violations = 0
        for antre, rooms in apartments.items():
            worst_d = max(full_dists[r] for r in rooms)
            group1_worst_escapes[antre] = worst_d
            if worst_d > bykhy_max_escape_threshold:
                group1_violations += 1
        t_group1_ms = (time.perf_counter() - t0) * 1000.0

        # -------------------------------------------------------------
        # KONTROL GRUBU 2: STANDART NAİF DARALTMA (nx.contracted_nodes)
        # -------------------------------------------------------------
        G_naive = G.copy()
        for antre, rooms in apartments.items():
            for r in rooms:
                if r != antre and G_naive.has_node(r):
                    # Naif büzüştürme: iç odayı antreye katla (kenar mesafesi sıfırlanır)
                    G_naive = nx.contracted_nodes(G_naive, antre, r, self_loops=False)

        t0 = time.perf_counter()
        naive_dists = nx.multi_source_dijkstra_path_length(G_naive, exits, weight="distance_m")
        group2_worst_escapes = {}
        group2_errors = []
        group2_false_compliances = 0
        for antre in apartments.keys():
            d_naive = naive_dists[antre]
            group2_worst_escapes[antre] = d_naive
            err = group1_worst_escapes[antre] - d_naive
            group2_errors.append(err)
            # Gerçekte ihlal varken naif daraltmada ihlal görünmüyor mu?
            if group1_worst_escapes[antre] > bykhy_max_escape_threshold and d_naive <= bykhy_max_escape_threshold:
                group2_false_compliances += 1
        t_group2_ms = (time.perf_counter() - t0) * 1000.0

        # -------------------------------------------------------------
        # DENEY GRUBU: ArchitecturalSPMiner + Kaçış Derinliği Korumalı Coarsener
        # -------------------------------------------------------------
        motifs, _ = spminer.discover_frequent_modules(G)
        coarse_res = ArchitecturalGraphCoarsener.coarsen_building_graph(G, motifs)
        G_coarse = coarse_res.G_coarsened

        t0 = time.perf_counter()
        coarse_dists = nx.multi_source_dijkstra_path_length(G_coarse, exits, weight="distance_m")
        group3_worst_escapes = {}
        group3_errors = []
        group3_false_compliances = 0
        for macro_id, record in coarse_res.macro_node_registry.items():
            # Makro düğümün koridora olan portal mesafesi + iç kaçış derinliği
            d_coarse = coarse_dists[macro_id] + record.internal_max_escape_m
            # Bu makro düğümün temsil ettiği daire antresi
            antre_rep = [n for n in record.contained_original_nodes if G.nodes[n].get("room_type") == "daire_antresi"][0]
            group3_worst_escapes[antre_rep] = d_coarse
            err = abs(group1_worst_escapes[antre_rep] - d_coarse)
            group3_errors.append(err)
            if group1_worst_escapes[antre_rep] > bykhy_max_escape_threshold and d_coarse <= bykhy_max_escape_threshold:
                group3_false_compliances += 1
        t_group3_ms = (time.perf_counter() - t0) * 1000.0

        # Özet istatistikler
        orig_n, orig_e = G.number_of_nodes(), G.number_of_edges()
        naive_n, naive_e = G_naive.number_of_nodes(), G_naive.number_of_edges()
        coarse_n, coarse_e = G_coarse.number_of_nodes(), G_coarse.number_of_edges()

        node_red_pct = round(((orig_n - coarse_n) / orig_n) * 100.0, 1)
        edge_red_pct = round(((orig_e - coarse_e) / orig_e) * 100.0, 1)

        b_record = {
            "building_name": name,
            "total_apartments": len(apartments),
            "group1_full": {
                "nodes": orig_n,
                "edges": orig_e,
                "calc_time_ms": round(t_group1_ms, 3),
                "true_violations_count": group1_violations
            },
            "group2_naive": {
                "nodes": naive_n,
                "edges": naive_e,
                "calc_time_ms": round(t_group2_ms, 3),
                "mean_distance_loss_m": round(float(sum(group2_errors) / max(1, len(group2_errors))), 2),
                "max_distance_loss_m": round(float(max(group2_errors, default=0.0)), 2),
                "false_compliance_count": group2_false_compliances
            },
            "group3_deney": {
                "nodes": coarse_n,
                "edges": coarse_e,
                "node_reduction_pct": node_red_pct,
                "edge_reduction_pct": edge_red_pct,
                "calc_time_ms": round(t_group3_ms, 3),
                "mean_distance_error_m": round(float(sum(group3_errors) / max(1, len(group3_errors))), 4),
                "max_distance_error_m": round(float(max(group3_errors, default=0.0)), 4),
                "false_compliance_count": group3_false_compliances
            }
        }
        benchmark_records.append(b_record)

    output_data = {
        "benchmark_title": "Deney Düzeneği ve Karşılaştırma Matrisi: Kaçış Derinliği Korumalı Graf Sıkıştırma",
        "description": "Kontrol Grubu 1 (Tam Graf), Kontrol Grubu 2 (Naif nx.contracted_nodes) ve Deney Grubu (ArchitecturalSPMiner + Coarsener) karşılaştırması",
        "results": benchmark_records
    }

    out_path = os.path.join(os.path.dirname(__file__), "..", "data", "benchmarks", "coarsening_matrix_comparison.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    return output_data


if __name__ == "__main__":
    data = run_coarsening_matrix_experiment()
    print("=" * 86)
    print("DENEY DÜZENEĞİ / KARŞILAŞTIRMA MATRİSİ SONUÇLARI")
    print("=" * 86)
    print(f"{'Bina / Senaryo':<32} | {'Grup 1 (Tam)':<14} | {'Grup 2 (Naif)':<16} | {'Grup 3 (Deney)':<16}")
    print(f"{'':<32} | {'Düğüm (Hata)':<14} | {'Kayıp / Maskeleme':<16} | {'İndirgeme / Hata':<16}")
    print("-" * 86)
    for r in data["results"]:
        name = r["building_name"].split(":")[0] + ":" + r["building_name"].split(":")[1].split("(")[0]
        g1_str = f"{r['group1_full']['nodes']} n (0.0m)"
        g2_str = f"-{r['group2_naive']['max_distance_loss_m']}m ({r['group2_naive']['false_compliance_count']} maske)"
        g3_str = f"-{r['group3_deney']['node_reduction_pct']}% (0.00m)"
        print(f"{name:<32} | {g1_str:<14} | {g2_str:<16} | {g3_str:<16}")
    print("=" * 86)

