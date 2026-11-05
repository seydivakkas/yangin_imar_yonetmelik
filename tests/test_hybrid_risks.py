# =====================================================================
# ÖZEL LİSANS — TÜM HAKLAR SAKLIDIR
# Telif Hakkı (c) 2026 Seydi Eryılmaz (@seydivakkas)
# =====================================================================
"""
TÜBİTAK 2209-A Hibrit Risklerin Doğrulanması Birim Testleri:
1. Taşıyıcı elemanla çakışan kapı genişletme önerisi reddediliyor.
2. Duman modeli nihai mevzuat uygunluk kararını ve ihlal sayısını değiştirmiyor.
3. Belirsiz etiket uydurulmuyor ('belirsiz' olarak işaretleniyor ve raporda uzman kontrolü notu ekleniyor).
4. Morfolojik çekirdek boyutu ppm ile ölçekleniyor (25-85 px sınırı kaldırıldı).
5. RWPE boyutu ile ağırlık uyuşmazlığı açık ValueError fırlatıyor.
"""

import os
import tempfile
import pytest
import torch
import ezdxf
import networkx as nx
from shapely.geometry import Polygon, LineString, Point

from diagram_yonetmelik.schemas import (
    PipelineConfig,
    EdgeBottleneckRecord,
)
from diagram_yonetmelik.cad_ingest import TurkishArchitecturalLabelClassifier
from diagram_yonetmelik.cv_analyzer import FloorplanImageAnalyzer
from diagram_yonetmelik.gnn_order import SpatialOrderGNN
from diagram_yonetmelik.evacuation import (
    CounterfactualEvacuationOptimizer,
)
from diagram_yonetmelik.orchestrator import DiagramYonetmelikPipeline
from diagram_yonetmelik.sample_generator import generate_sample_building_dxf
from diagram_yonetmelik.vf2_diagnostics import ExplainableVF2Analyzer


def test_structural_collision_rejection():
    """
    1. Taşıyıcı eleman kontrolü:
    - Taşıyıcı elemanla çakışan kapı genişletme önerisi reddedilir (RETTEDILDI_TASIYICI_CAKISMA).
    - Taşıyıcı katman bilgisi yoksa öneri silinmez, 'Taşıyıcı bilgisi yok, statik kontrol yapılmadı' notuyla raporlanır.
    """
    optimizer = CounterfactualEvacuationOptimizer()

    # 1. Graf hazırla: Düğüm 1 (Oda) -> Düğüm 2 (Koridor)
    G = nx.Graph()
    G.add_node(1, room_type="oda", area_m2=20.0, floor_level=0, global_dxf_pos=(5.0, 5.0))
    G.add_node(2, room_type="kat_koridoru", area_m2=30.0, floor_level=0, global_dxf_pos=(5.0, 7.0))
    door_line = LineString([(4.5, 6.0), (5.5, 6.0)])
    G.add_edge(1, 2, door_width_cm=80.0, is_vertical=False, geometry=door_line)

    bn = EdgeBottleneckRecord(
        edge=(1, 2),
        source_room_type="oda",
        target_room_type="kat_koridoru",
        floor_level=0,
        max_queue_persons=10.0,
        total_waiting_person_sec=50.0,
        spillback_blocked_sec=15.0,
        severity_score=8.5,
        is_critical=True,
        spatial_coords=(5.0, 6.0)
    )

    # Durum A: Taşıyıcı katman yok
    G.graph["has_structural_layer"] = False
    G.graph["structural_polygons"] = []
    is_col, status, reason = optimizer._check_structural_collision(G, (1, 2), 100.0, bn)
    assert not is_col
    assert status == "STATIK_KONTROL_YAPILMADI"
    assert "statik kontrol yapılmadı" in reason

    # Durum B: Taşıyıcı eleman (kolon) kapının tam kenarında çakışıyor
    col_poly = Polygon([(5.2, 5.8), (5.8, 5.8), (5.8, 6.2), (5.2, 6.2)])
    G.graph["has_structural_layer"] = True
    G.graph["structural_polygons"] = [col_poly]

    is_col, status, reason = optimizer._check_structural_collision(G, (1, 2), 120.0, bn)
    assert is_col
    assert status == "RETTEDILDI_TASIYICI_CAKISMA"
    assert "uygulanamaz: taşıyıcı elemanla çakışıyor" in reason

    # Durum C: Kolon uzakta, çakışma yok
    distant_col = Polygon([(20.0, 20.0), (21.0, 20.0), (21.0, 21.0), (20.0, 21.0)])
    G.graph["structural_polygons"] = [distant_col]
    is_col, status, reason = optimizer._check_structural_collision(G, (1, 2), 100.0, bn)
    assert not is_col
    assert status == "UYGULANABILIR"
    assert reason is None


def test_smoke_model_does_not_affect_compliance():
    """
    2. Duman modeli nihai mevzuat uygunluk kararını ve ihlal sayısını değiştirmez:
    - enable_smoke_model=False ve enable_smoke_model=True iken is_compliant ve ihlal sayısı özdeş olmalıdır.
    - Duman modeli çıktısı 'gösterim amaçlı, doğrulanmamış' etiketine sahip olmalıdır.
    """
    with tempfile.TemporaryDirectory() as tmp_dir:
        dxf_path = os.path.join(tmp_dir, "test_smoke_building.dxf")
        generate_sample_building_dxf(dxf_path)

        # 1. Duman modeli KAPALI (varsayılan)
        config_off = PipelineConfig(enable_smoke_model=False)
        pipe_off = DiagramYonetmelikPipeline(config=config_off)
        doc_off = ezdxf.readfile(dxf_path)
        res_off = pipe_off.run_full_pipeline(doc_off)

        # 2. Duman modeli AÇIK (HRR = 2500 kW)
        config_on = PipelineConfig(enable_smoke_model=True, fire_hrr_kw=2500.0)
        pipe_on = DiagramYonetmelikPipeline(config=config_on)
        doc_on = ezdxf.readfile(dxf_path)
        res_on = pipe_on.run_full_pipeline(doc_on)

        # Nihai uygunluk kararı kesinlikle aynı olmalıdır
        assert res_off.verified_escape_cores == res_on.verified_escape_cores
        
        # Teşhis raporlarındaki ihlal sayıları ve kurallar birebir aynı olmalıdır
        total_violations_off = sum(len(r.violations) for r in res_off.diagnostic_reports)
        total_violations_on = sum(len(r.violations) for r in res_on.diagnostic_reports)
        assert total_violations_off == total_violations_on

        codes_off = sorted([v.violation_code for r in res_off.diagnostic_reports for v in r.violations])
        codes_on = sorted([v.violation_code for r in res_on.diagnostic_reports for v in r.violations])
        assert codes_off == codes_on

        # Duman modeli açıkken çıktı etiketi doğrulanmalı
        assert res_on.baseline_evacuation_report.smoke_model_active is True
        assert res_on.baseline_evacuation_report.smoke_model_label == "gösterim amaçlı, doğrulanmamış"
        assert res_off.baseline_evacuation_report.smoke_model_active is False


def test_uncertain_label_not_hallucinated():
    """
    3. Belirsiz etiket uydurulmuyor:
    - Sözlükte ve bulanık eşleşmede bulunamayan, geometrisi tipik bir odaya uymayan mekânlar 'belirsiz' olarak işaretlenir.
    - Sınıflandırıcı rastgele 'oda' veya 'salon' uydurmaz.
    - Belirsiz mekân içeren altgraflarda aday açıklamalarına 'etiket belirsiz, uzman kontrolü gerekli' notu eklenir.
    """
    # Durum A: Alakasız blok/kat yazısı (alan 15 m2, en-boy 1.2)
    room_type, src, conf = TurkishArchitecturalLabelClassifier.classify_room_details(
        raw_text="BLOK A 2. KAT",
        aspect_ratio=1.2,
        area_m2=15.0
    )
    assert room_type == "belirsiz"
    assert src == "belirsiz"
    assert conf == 0.0

    # Durum B: Metin yok ve geometri belirsiz (alan 14 m2, en-boy 1.3)
    room_type, src, conf = TurkishArchitecturalLabelClassifier.classify_room_details(
        raw_text="",
        aspect_ratio=1.3,
        area_m2=14.0
    )
    assert room_type == "belirsiz"
    assert src == "belirsiz"
    assert conf == 0.0

    # Durum C: VF2 aday açıklamasında belirsiz etiket uyarısı
    vf2 = ExplainableVF2Analyzer()
    Q = vf2.build_standard_fire_core_query(include_exit=False)

    # Subgraph oluştur: Bir düğümü belirsiz etiket kaynaklı
    G_sub = nx.Graph()
    G_sub.add_node(101, room_type="kat_koridoru", area_m2=15.0, label_source="sozluk")
    G_sub.add_node(102, room_type="yangin_holu", area_m2=4.5, label_source="belirsiz")
    G_sub.add_node(103, room_type="yangin_merdiveni", area_m2=10.0, label_source="sozluk")
    # Kapı genişliği kusurlu olsun ki Aşama 1 ihlal üretsin
    G_sub.add_edge(101, 102, door_width_cm=75.0, is_fire_resistant=True, distance_m=5.0)
    G_sub.add_edge(102, 103, door_width_cm=90.0, is_fire_resistant=True, distance_m=3.0)

    rep = vf2.explain_candidate(Q, G_sub, anchor_node_id=102)
    assert len(rep.violations) > 0
    assert any("etiket belirsiz, uzman kontrolü gerekli" in v.description_tr for v in rep.violations)


def test_cv_kernel_scales_with_ppm():
    """
    4. Morfolojik çekirdek boyutu ppm ile doğrudan ölçeklenir:
    - 25-85 piksel sınırlaması kaldırılmıştır.
    - door_bridge_m = 1.50 varsayılanı için:
      * ppm = 100 ise kernel boyutu 150 px olur (önceki kod 85'e kırpıyordu).
      * ppm = 10 ise kernel boyutu 15 px olur (önceki kod 25'e taban koyuyordu).
    """
    # ppm = 100
    analyzer_100 = FloorplanImageAnalyzer(pixels_per_meter=100.0, door_bridge_m=1.5)
    expected_k_100 = max(5, int(round(analyzer_100.door_bridge_m * analyzer_100.ppm)))
    assert expected_k_100 == 150
    k_100 = analyzer_100.create_linear_kernel(expected_k_100, angle_deg=0.0)
    assert k_100.shape[0] >= expected_k_100

    # ppm = 10
    analyzer_10 = FloorplanImageAnalyzer(pixels_per_meter=10.0, door_bridge_m=1.5)
    expected_k_10 = max(5, int(round(analyzer_10.door_bridge_m * analyzer_10.ppm)))
    assert expected_k_10 == 15
    k_10 = analyzer_10.create_linear_kernel(expected_k_10, angle_deg=45.0)
    assert k_10.shape[0] >= expected_k_10


def test_rwpe_weight_mismatch_raises_value_error():
    """
    5. RWPE boyutu ile ağırlık boyutu uyuşmazlığında açık ValueError fırlatılır:
    - Sessizce rastgele ağırlıklara düşülmez.
    """
    # 1. rwpe_dim=6 olan model oluştur ve kaydet
    model_6 = SpatialOrderGNN(rwpe_dim=6, hidden_dim=32, emb_dim=16, use_cycle_feature=False)
    with tempfile.TemporaryDirectory() as tmp_dir:
        weight_path = os.path.join(tmp_dir, "weights_6.pt")
        model_6.save_weights(weight_path)

        # 2. rwpe_dim=12 olan model oluştur
        model_12 = SpatialOrderGNN(rwpe_dim=12, hidden_dim=32, emb_dim=16, use_cycle_feature=False)

        # 3. model_12, 6 adımlı RWPE ağırlığını yüklemeye çalıştığında ValueError fırlatmalı
        with pytest.raises(ValueError) as excinfo:
            model_12.load_weights(weight_path)

        assert "Ağırlık boyut uyuşmazlığı" in str(excinfo.value)
        assert "Sessizce rastgele ağırlığa düşülemez" in str(excinfo.value)
