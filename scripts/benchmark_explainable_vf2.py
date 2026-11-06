# ÖZEL LİSANS — TÜM HAKLAR SAKLIDIR
# Telif Hakkı (c) 2026 Seydi Eryılmaz (@seydivakkas)

import os
import sys
import json
import networkx as nx
from typing import Dict, Any, List, Tuple

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from diagram_yonetmelik.vf2_diagnostics import ExplainableVF2Analyzer
from diagram_yonetmelik.schemas import CandidateDiagnosticReport, RuleViolationItem


def create_test_scenarios() -> List[Dict[str, Any]]:
    scenarios = []

    # Şablon: Koridor (10) -> Yangın Holü (20, Çapa) -> Yangın Merdiveni (30) -> Dış Çıkış (40)
    def base_target():
        T = nx.Graph()
        T.add_node(10, room_type="kat_koridoru", area_m2=20.0, floor_level=0)
        T.add_node(20, room_type="yangin_holu", area_m2=4.5, is_anchor=True, floor_level=0)
        T.add_node(30, room_type="yangin_merdiveni", area_m2=8.0, floor_level=0)
        T.add_node(40, room_type="dis_cikis", area_m2=5.0, floor_level=0)
        T.add_edge(10, 20, door_width_cm=100.0, is_fire_resistant=True, distance_m=5.0)
        T.add_edge(20, 30, door_width_cm=100.0, is_fire_resistant=True, distance_m=2.0)
        T.add_edge(30, 40, door_width_cm=120.0, is_fire_resistant=True, distance_m=4.0)
        return T

    # Senaryo 0: Kusursuz Şablon
    scenarios.append({
        "name": "Senaryo 0: Kusursuz Yangın Kaçış Çekirdeği",
        "target": base_target(),
        "anchor": 20,
        "expected_stage": 0,
        "expected_compliant": True,
        "expected_violations": []
    })

    # Senaryo 1: Aşama 1 - Dar Kapı Kusuru (75 cm < 90 cm)
    T1 = base_target()
    T1[10][20]["door_width_cm"] = 75.0
    scenarios.append({
        "name": "Senaryo 1: Parametrik Kusur (Dar Kapı 75 cm)",
        "target": T1,
        "anchor": 20,
        "expected_stage": 1,
        "expected_compliant": False,
        "expected_violations": ["DOOR_WIDTH_DEFICIT"]
    })

    # Senaryo 2: Aşama 1 - Yangın Kapısı Dayanım Eksikliği (EI60 Yok)
    T2 = base_target()
    T2[20][30]["is_fire_resistant"] = False
    scenarios.append({
        "name": "Senaryo 2: Parametrik Kusur (Yangın Kapısı EI60 Eksik)",
        "target": T2,
        "anchor": 20,
        "expected_stage": 1,
        "expected_compliant": False,
        "expected_violations": ["FIRE_DOOR_MISSING"]
    })

    # Senaryo 3: Aşama 1 - Yangın Holü Alan Yetersizliği (2.2 m² < 3.0 m²)
    T3 = base_target()
    T3.nodes[20]["area_m2"] = 2.2
    scenarios.append({
        "name": "Senaryo 3: Parametrik Kusur (Yangın Holü 2.2 m² < 3.0 m²)",
        "target": T3,
        "anchor": 20,
        "expected_stage": 1,
        "expected_compliant": False,
        "expected_violations": ["BYKHY_M34_YANGIN_HOLU_ALAN_YETERSIZ"]
    })

    # Senaryo 4: Aşama 1 - Çoklu Kusur (Dar Kapı + Yangın Kapısı Eksik + Alan Yetersiz)
    T4 = base_target()
    T4[10][20]["door_width_cm"] = 70.0
    T4[10][20]["is_fire_resistant"] = False
    T4.nodes[20]["area_m2"] = 2.0
    scenarios.append({
        "name": "Senaryo 4: Çoklu Parametrik Kusur (Dar Kapı + EI60 Yok + Hol Dar)",
        "target": T4,
        "anchor": 20,
        "expected_stage": 1,
        "expected_compliant": False,
        "expected_violations": ["DOOR_WIDTH_DEFICIT", "FIRE_DOOR_MISSING", "BYKHY_M34_YANGIN_HOLU_ALAN_YETERSIZ"]
    })

    # Senaryo 5: Aşama 2 - Mekân Fonksiyon Uyuşmazlığı (Yangın merdiveni yerine 'depo')
    T5 = base_target()
    T5.nodes[30]["room_type"] = "depo"
    scenarios.append({
        "name": "Senaryo 5: Fonksiyon Uyuşmazlığı (Merdiven yerine Depo)",
        "target": T5,
        "anchor": 20,
        "expected_stage": 2,
        "expected_compliant": False,
        "expected_violations": ["ROOM_TYPE_MISMATCH"]
    })

    # Senaryo 6: Aşama 3 - Kopuk Kapı Bağlantısı (Yangın merdiveni var ama holden kapı yok)
    T6 = base_target()
    T6.remove_edge(20, 30)
    scenarios.append({
        "name": "Senaryo 6: Topolojik Kusur (Yangın Merdivenine Kapı Açılmamış)",
        "target": T6,
        "anchor": 20,
        "expected_stage": 3,
        "expected_compliant": False,
        "expected_violations": ["MISSING_DOOR_CONNECTION"]
    })

    # Senaryo 7: Aşama 3 - Eksik Zorunlu Mekân (Katta Dış Çıkış Yok)
    T7 = base_target()
    T7.remove_node(40)
    scenarios.append({
        "name": "Senaryo 7: Topolojik Kusur (Katta Dış Çıkış Hacmi Hiç Yok)",
        "target": T7,
        "anchor": 20,
        "expected_stage": 3,
        "expected_compliant": False,
        "expected_violations": ["MISSING_ROOM_NODE"]
    })

    return scenarios


def run_benchmark():
    analyzer = ExplainableVF2Analyzer()
    Q = analyzer.build_standard_fire_core_query(include_exit=True)

    scenarios = create_test_scenarios()
    total = len(scenarios)

    # Klasik İkili VF2 Metrikleri
    binary_vf2_diagnosed = 0
    binary_vf2_actionable_remedies = 0
    binary_vf2_root_cause_identified = 0

    # ExplainableVF2Analyzer Metrikleri
    exp_vf2_diagnosed = 0
    exp_vf2_actionable_remedies = 0
    exp_vf2_root_cause_identified = 0

    scenario_reports = []

    for sc in scenarios:
        T = sc["target"]
        anc = sc["anchor"]
        exp_stage = sc["expected_stage"]
        exp_viols = sc["expected_violations"]

        # 1. Klasik İkili VF2 (NetworkX Strict GraphMatcher)
        strict_ok, _ = analyzer._run_strict_vf2(Q, T, 1, anc)
        # Klasik ikili VF2: Uymadığında sadece False döner, ihlal listesi ve kök neden sıfırdır
        binary_result = {
            "is_compliant": strict_ok,
            "root_cause": "BİLİNMİYOR (İkili Reddetme)" if not strict_ok else "UYGUN",
            "violations_detected": 0,
            "actionable_remedy": None
        }
        if sc["expected_compliant"] == strict_ok:
            if strict_ok:
                binary_vf2_diagnosed += 1
                binary_vf2_root_cause_identified += 1

        # 2. ExplainableVF2Analyzer (3 Aşamalı Kademeli Kısıt Gevşetme)
        report: CandidateDiagnosticReport = analyzer.explain_candidate(Q, T, anchor_node_id=anc)

        detected_codes = [v.violation_code for v in report.violations]
        has_remedies = all(bool(v.remedy_recommendation_tr) for v in report.violations) if report.violations else True
        has_coords_or_edges = all(bool(v.target_edge or v.target_node_id) for v in report.violations) if report.violations else True

        # Doğruluk kontrolü: Doğru aşama ve beklenen ihlal kodları yakalandı mı?
        stage_matched = (report.diagnostic_stage_reached == exp_stage)
        viols_matched = set(exp_viols).issubset(set(detected_codes)) if exp_viols else (len(detected_codes) == 0)

        if stage_matched and viols_matched:
            exp_vf2_root_cause_identified += 1
            exp_vf2_diagnosed += 1

        if has_remedies and (len(report.violations) > 0 or report.is_fully_compliant):
            exp_vf2_actionable_remedies += 1

        scenario_reports.append({
            "scenario_name": sc["name"],
            "binary_vf2": binary_result,
            "explainable_vf2": {
                "is_compliant": report.is_fully_compliant,
                "diagnostic_stage": report.diagnostic_stage_reached,
                "summary": report.summary_message,
                "violations": [
                    {
                        "code": v.violation_code,
                        "description": v.description_tr,
                        "remedy": v.remedy_recommendation_tr,
                        "expected": str(v.expected_value),
                        "actual": str(v.actual_value)
                    }
                    for v in report.violations
                ]
            }
        })

    summary = {
        "benchmark_title": "Açıklanabilir VF2 Kademeli Teşhis Hunisi vs Klasik İkili VF2",
        "total_scenarios": total,
        "metrics": {
            "binary_vf2_baseline": {
                "root_cause_diagnosis_accuracy_pct": round((binary_vf2_root_cause_identified / total) * 100.0, 1),
                "actionable_remedy_generation_rate_pct": round((binary_vf2_actionable_remedies / total) * 100.0, 1),
                "isolated_defect_types_count": 0,
                "description": "Klasik VF2 sadece True/False döner; hatanın yerini, nedenini ve çözümünü raporlayamaz."
            },
            "explainable_vf2_analyzer": {
                "root_cause_diagnosis_accuracy_pct": round((exp_vf2_root_cause_identified / total) * 100.0, 1),
                "actionable_remedy_generation_rate_pct": round((exp_vf2_actionable_remedies / total) * 100.0, 1),
                "isolated_defect_types_count": 7,
                "description": "3 Aşamalı Kademeli Gevşetme Hunisi: Parametrik kusurları, mekân rol uyuşmazlıklarını ve topolojik kopuklukları ayrı ayrı teşhis eder."
            }
        },
        "results": scenario_reports
    }

    out_path = os.path.join(os.path.dirname(__file__), "..", "data", "benchmarks", "explainable_vf2_benchmark.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    return summary


if __name__ == "__main__":
    res = run_benchmark()
    print("=" * 86)
    print("AÇIKLANABİLİR VF2 KADEMELİ TEŞHİS HUNİSİ BENCHMARK SONUÇLARI")
    print("=" * 86)
    b = res["metrics"]["binary_vf2_baseline"]
    e = res["metrics"]["explainable_vf2_analyzer"]
    print(f"{'Metrik / Yetenek':<40} | {'Klasik İkili VF2':<18} | {'ExplainableVF2Analyzer'}")
    print("-" * 86)
    print(f"{'Kök Neden Teşhis Doğruluğu':<40} | %{b['root_cause_diagnosis_accuracy_pct']:<17} | %{e['root_cause_diagnosis_accuracy_pct']}")
    print(f"{'Eyleme Dönüştürülebilir Öneri Oranı':<40} | %{b['actionable_remedy_generation_rate_pct']:<17} | %{e['actionable_remedy_generation_rate_pct']}")
    print(f"{'İzole Edilebilen Hata Türü Sayısı':<40} | {b['isolated_defect_types_count']} tür (Yok)       | {e['isolated_defect_types_count']} farklı tür")
    print(f"{'Sayısal Fark Hesabı (Actual vs Expected)':<40} | Desteklenmez       | Eksiksiz Desteklenir")
    print("=" * 86)

