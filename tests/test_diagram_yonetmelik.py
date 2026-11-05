import copy
import math
import os
import pytest
import torch
import networkx as nx
import ezdxf
from shapely.geometry import Polygon, LineString, Point

from diagram_yonetmelik.schemas import (
    RoomPolygonInput,
    DoorGeometryInput,
    RuleViolationItem,
    CandidateDiagnosticReport,
    BuildingProgramSummary,
    PipelineConfig,
)
from diagram_yonetmelik.cad_ingest import (
    TurkishArchitecturalLabelClassifier,
    WallLinePolygonizer,
    DXFFloorplanParser,
)
from diagram_yonetmelik.cv_analyzer import FloorplanImageAnalyzer
from diagram_yonetmelik.spatial_rag import (
    FloorplanToRAGExtractor,
    MultiFloor3DRAGBuilder,
)
from diagram_yonetmelik.gnn_order import (
    compute_rwpe,
    violation_energy,
    OrderEmbeddingLoss,
    SpatialOrderGNN,
    nx_subgraph_to_pyg_data,
)
from diagram_yonetmelik.spminer import (
    ArchitecturalSPMiner,
    ArchitecturalGraphCoarsener,
)
from diagram_yonetmelik.vf2_diagnostics import ExplainableVF2Analyzer
from diagram_yonetmelik.basement_audit import BasementComplianceAuditor
from diagram_yonetmelik.multi_floor_auditor import MultiFloorComprehensiveAuditor
from diagram_yonetmelik.evacuation import (
    Building3DEvacuationSimulator,
    CounterfactualEvacuationOptimizer,
)
from diagram_yonetmelik.regulatory_rag import (
    build_turkish_building_regulations_corpus,
    HybridRegulatoryRetriever,
    LocalMimarLLMReportGenerator,
)
from diagram_yonetmelik.orchestrator import DiagramYonetmelikPipeline
from diagram_yonetmelik.sample_generator import (
    generate_sample_building_dxf,
    generate_high_rise_12_story_building_dxf,
    generate_sample_floorplan_image,
)


class TestGNNAndOrderEmbeddingMath:
    def test_1wl_rwpe_distinguishes_c6_from_two_c3_triangles(self):
        # 1-WL kısıtını test et: 6'lı ring koridor (C6) ile 2 ayrık üçgen oda (2 x C3)
        # Standart MPNN ikisinde de aynı komşu sayısını görür, ancak RWPE 3. adımda ayrışır!
        c6_edges = torch.tensor([[0, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 0],
                                 [1, 2, 3, 4, 5, 0, 0, 1, 2, 3, 4, 5]], dtype=torch.long)
        two_c3_edges = torch.tensor([[0, 1, 2, 1, 2, 0, 3, 4, 5, 4, 5, 3],
                                     [1, 2, 0, 0, 1, 2, 4, 5, 3, 3, 4, 5]], dtype=torch.long)

        rwpe_c6 = compute_rwpe(c6_edges, num_nodes=6, walk_steps=6)
        rwpe_two_c3 = compute_rwpe(two_c3_edges, num_nodes=6, walk_steps=6)

        # 3. adımda üçgende dönüş olasılığı > 0 iken 6'lı ringde 0'dır
        step3_c6 = rwpe_c6[:, 2]
        step3_two_c3 = rwpe_two_c3[:, 2]
        assert not torch.allclose(step3_c6, step3_two_c3, atol=1e-3)

    def test_order_embedding_partial_order_and_loss(self):
        # G_q <= G_u <==> E(z_q, z_u) == 0
        z_q = torch.tensor([[1.0, 2.0, 3.0]])
        z_pos = torch.tensor([[2.0, 3.0, 4.0]])   # z_q <= z_pos (Tüm boyutlarda büyük veya eşit)
        z_neg = torch.tensor([[0.5, 1.0, 2.0]])   # z_q > z_neg (İhlal)

        e_pos = violation_energy(z_q, z_pos)
        e_neg = violation_energy(z_q, z_neg)

        assert e_pos.item() == 0.0
        assert e_neg.item() > 0.0

        loss_fn = OrderEmbeddingLoss(margin=1.0)
        loss_val = loss_fn(z_q, z_pos, z_neg)
        assert loss_val.item() >= 0.0


class TestCADAndSpatialGeometry:
    def test_line_soup_polygonizer(self):
        polygonizer = WallLinePolygonizer(snap_tolerance_cm=5.0, wall_thickness_cm=20.0)
        # 4m x 4m bir oda sınır çizgileri (cm cinsinden)
        lines = [
            LineString([(0, 0), (400, 0)]),
            LineString([(400, 0), (400, 400)]),
            LineString([(400, 400), (0, 400)]),
            LineString([(0, 400), (0, 0)]),
        ]
        # Kapı eşiği
        door = DoorGeometryInput(
            door_id=1,
            geometry=LineString([(150, 0), (250, 0)]),
            width_cm=100.0
        )
        polys = polygonizer.polygonize_rooms_from_lines(lines, [door], unit_scale=0.01)
        assert len(polys) >= 1
        assert polys[0].area >= 10.0  # 16 m²

    def test_concave_l_corridor_walking_distance(self):
        extractor = FloorplanToRAGExtractor()
        # L tipi içbükey koridor poligonu
        poly = Polygon([
            (0, 0), (10, 0), (10, 3), (3, 3), (3, 10), (0, 10)
        ])
        start_pt = Point(1, 8)
        portal_pt = Point(8, 1)

        # Düz çizgi duvarın içinden geçeceği için görünürlük mesafesi Öklid'den büyük olmalı
        geodesic_dist = extractor._compute_geodesic_walking_distance(poly, start_pt, portal_pt)
        euclidean_dist = start_pt.distance(portal_pt)
        assert geodesic_dist >= euclidean_dist


class Test3DRAGAndGraphCoarsening:
    def test_3d_multifloor_core_registration(self):
        builder = MultiFloor3DRAGBuilder()
        rooms = [
            # Zemin
            RoomPolygonInput(room_id=1, room_type="dis_cikis", polygon=Polygon([(0,0),(2,0),(2,2),(0,2)]), floor_level=0),
            RoomPolygonInput(room_id=2, room_type="yangin_merdiveni", polygon=Polygon([(2,0),(5,0),(5,4),(2,4)]), floor_level=0),
            # 1. Kat
            RoomPolygonInput(room_id=102, room_type="yangin_merdiveni", polygon=Polygon([(2,0),(5,0),(5,4),(2,4)]), floor_level=1),
            RoomPolygonInput(room_id=103, room_type="yangin_holu", polygon=Polygon([(5,0),(8,0),(8,3),(5,3)]), floor_level=1),
        ]
        doors = [
            DoorGeometryInput(door_id=1, geometry=LineString([(2,1),(2,2)]), floor_level=0),
            DoorGeometryInput(door_id=2, geometry=LineString([(5,1),(5,2)]), floor_level=1),
        ]
        res = builder.build_3d_building_rag(rooms, doors, unit_scale_to_meters=1.0)
        assert res.total_floors >= 1
        assert res.G_3d.number_of_nodes() >= 3

        # Kaçış rotası testi
        path, dist = builder.compute_3d_fire_escape_route(res.G_3d, start_node_id=103)
        assert len(path) >= 2
        assert dist > 0.0

    def test_spminer_and_coarsening(self):
        G = nx.Graph()
        # Daire 1
        G.add_node(1, room_type="daire_antresi", area_m2=6.0, floor_level=0)
        G.add_node(2, room_type="salon", area_m2=25.0, floor_level=0)
        G.add_node(3, room_type="oda", area_m2=12.0, floor_level=0)
        G.add_edge(1, 2, door_width_cm=90.0, distance_m=3.0)
        G.add_edge(1, 3, door_width_cm=90.0, distance_m=4.0)
        # Koridor
        G.add_node(10, room_type="kat_koridoru", area_m2=15.0, floor_level=0)
        G.add_edge(10, 1, door_width_cm=90.0, distance_m=2.0)

        spminer = ArchitecturalSPMiner(min_support=1)
        motifs, prog = spminer.discover_frequent_modules(G)
        assert prog.total_apartments >= 1

        coarsened = ArchitecturalGraphCoarsener.coarsen_building_graph(G, motifs)
        assert coarsened.coarsened_node_count < coarsened.original_node_count


class TestExplainableVF2AndBasementCompliance:
    def test_explainable_vf2_parametric_violation(self):
        analyzer = ExplainableVF2Analyzer()
        Q = analyzer.build_standard_fire_core_query()

        # Hedef grafikte kapı genişliği 70cm olan kusurlu yangın holü
        T = nx.Graph()
        T.add_node(10, room_type="kat_koridoru", area_m2=20.0)
        T.add_node(20, room_type="yangin_holu", area_m2=4.0, is_anchor=True)
        T.add_node(30, room_type="yangin_merdiveni", area_m2=8.0)
        T.add_node(40, room_type="dis_cikis", area_m2=5.0)

        T.add_edge(10, 20, door_width_cm=70.0, is_fire_resistant=False, distance_m=5.0)  # KUSUR!
        T.add_edge(20, 30, door_width_cm=90.0, is_fire_resistant=True, distance_m=2.0)
        T.add_edge(30, 40, door_width_cm=100.0, is_fire_resistant=True, distance_m=5.0)

        report = analyzer.explain_candidate(Q, T, anchor_node_id=20)
        assert not report.is_fully_compliant
        assert report.diagnostic_stage_reached == 1
        codes = [v.violation_code for v in report.violations]
        assert "DOOR_WIDTH_DEFICIT" in codes

    @staticmethod
    def _fire_core(hall_area=5.0, corridor_id=2, door_width=100.0):
        T = nx.Graph()
        T.add_node(corridor_id, room_type="kat_koridoru", area_m2=20.0, floor_level=3)
        T.add_node(1, room_type="yangin_holu", area_m2=hall_area, floor_level=3)
        T.add_node(3, room_type="yangin_merdiveni", area_m2=12.0, floor_level=3)
        T.add_edge(corridor_id, 1, door_width_cm=door_width, distance_m=5.0, is_fire_resistant=True)
        T.add_edge(1, 3, door_width_cm=100.0, distance_m=2.0, is_fire_resistant=True)
        return T

    @pytest.mark.parametrize("hall_area,expected_code", [
        (5.0, None),
        (3.0, None),
        (6.0, None),
        (1.0, "BYKHY_M34_YANGIN_HOLU_ALAN_YETERSIZ"),
        (40.0, "BYKHY_M34_YANGIN_HOLU_ALAN_FAZLA"),
    ])
    def test_vf2_enforces_general_fire_hall_area_limits(self, hall_area, expected_code):
        analyzer = ExplainableVF2Analyzer()
        Q = analyzer.build_standard_fire_core_query(include_exit=False)
        report = analyzer.explain_candidate(Q, self._fire_core(hall_area=hall_area), 1)

        assert report.is_fully_compliant is (expected_code is None)
        codes = [v.violation_code for v in report.violations]
        assert codes == ([] if expected_code is None else [expected_code])

    @pytest.mark.parametrize("hall_area,is_compliant", [(8.0, True), (5.0, False), (11.0, False)])
    def test_vf2_uses_emergency_elevator_hall_limits(self, hall_area, is_compliant):
        analyzer = ExplainableVF2Analyzer()
        T = self._fire_core(hall_area=hall_area)
        T.add_node(9, room_type="yangin_asansoru", area_m2=9.0, floor_level=3)
        T.add_edge(1, 9, door_width_cm=120.0, distance_m=1.0, is_fire_resistant=True)
        Q = analyzer.build_standard_fire_core_query(include_exit=False)
        assert analyzer.explain_candidate(Q, T, 1).is_fully_compliant is is_compliant

    def test_vf2_stair_anchor_cannot_pass_as_fire_hall(self):
        analyzer = ExplainableVF2Analyzer()
        T = nx.Graph()
        T.add_node(1, room_type="kat_koridoru", area_m2=20.0)
        T.add_node(2, room_type="yangin_merdiveni", area_m2=8.0)
        T.add_node(3, room_type="yangin_merdiveni", area_m2=8.0)
        T.add_edge(1, 2, door_width_cm=100.0, distance_m=5.0, is_fire_resistant=True)
        T.add_edge(2, 3, door_width_cm=100.0, distance_m=2.0, is_fire_resistant=True)
        Q = analyzer.build_standard_fire_core_query(include_exit=False)
        assert analyzer.explain_candidate(Q, T, 2).is_fully_compliant is False

    def test_vf2_reports_door_violation_for_node_id_zero(self):
        analyzer = ExplainableVF2Analyzer()
        Q = analyzer.build_standard_fire_core_query(include_exit=False)
        report = analyzer.explain_candidate(Q, self._fire_core(corridor_id=0, door_width=50.0), 1)
        assert "DOOR_WIDTH_DEFICIT" in [v.violation_code for v in report.violations]

    @pytest.mark.parametrize("label,expected", [
        ("Z-04 ASANSOR", "asansor"),
        ("B-05 SEDYE ASANSORU", "asansor"),
        ("Z-05 ITFAIYE ASANSORU", "yangin_asansoru"),
        ("K-01 ASANSOR HOLU", "kat_koridoru"),
        ("Z-02 YANGIN GUVENLIK HOLU", "yangin_holu"),
    ])
    def test_classifier_recognizes_elevators(self, label, expected):
        assert TurkishArchitecturalLabelClassifier.classify_room_type(label, area_m2=9.0) == expected

    def test_basement_auditor_violations(self):
        auditor = BasementComplianceAuditor()
        prog = BuildingProgramSummary(
            total_apartments=16,
            required_shelter_area_m2=64.0
        )
        G = nx.Graph()
        # Sığınak alanı 40m² < 64m² (Kusur!) ve Airlock yok
        G.add_node(1, room_type="siginak", area_m2=40.0, floor_level=-1)
        G.add_node(2, room_type="kat_koridoru", area_m2=15.0, floor_level=-1)
        G.add_edge(1, 2)

        # Kapalı otoparktan doğrudan yangın merdivenine yasaklı kapı (Kusur!)
        G.add_node(3, room_type="kapali_otopark", area_m2=200.0, floor_level=-1)
        G.add_node(4, room_type="yangin_merdiveni", area_m2=10.0, floor_level=-1)
        G.add_edge(3, 4)

        viols = auditor.audit_basement_graph(G, prog)
        codes = [v.violation_code for v in viols]
        assert "SHELTER_AREA_DEFICIT" in codes
        assert "PARKING_DIRECT_EXIT_PROHIBITED" in codes


class TestEvacuationAndComputerVision:
    def test_evacuation_simulation_and_optimization(self):
        G = nx.Graph()
        G.add_node(1, room_type="salon", area_m2=20.0, floor_level=1)
        G.add_node(2, room_type="yangin_holu", area_m2=3.5, floor_level=1)
        G.add_node(3, room_type="yangin_merdiveni", area_m2=6.0, floor_level=1)
        G.add_node(4, room_type="yangin_merdiveni", area_m2=6.0, floor_level=0)
        G.add_node(5, room_type="dis_cikis", area_m2=10.0, floor_level=0)

        G.add_edge(1, 2, door_width_cm=70.0, distance_m=6.0, usable_in_fire=True)
        G.add_edge(2, 3, door_width_cm=70.0, distance_m=3.0, usable_in_fire=True)
        G.add_edge(3, 4, door_width_cm=90.0, distance_m=6.6, is_vertical=True, usable_in_fire=True)
        G.add_edge(4, 5, door_width_cm=90.0, distance_m=4.0, usable_in_fire=True)

        sim = Building3DEvacuationSimulator(target_evacuation_threshold_sec=50.0)
        rep = sim.simulate_evacuation(G)
        assert rep.total_evacuation_time_sec > 0.0

        opt = CounterfactualEvacuationOptimizer()
        opt_res = opt.optimize_building_design(G, target_time_sec=50.0)
        assert opt_res.optimized_evacuation_time_sec <= rep.total_evacuation_time_sec

    @staticmethod
    def _simple_building(distance_m=5.0, with_exit=True, with_island=False, is_vertical=False):
        G = nx.Graph()
        G.add_node(1, room_type="salon", area_m2=30.0, floor_level=0)
        G.add_node(2, room_type="kat_koridoru", area_m2=20.0, floor_level=0)
        G.add_edge(1, 2, door_width_cm=100.0, distance_m=distance_m, is_vertical=is_vertical)
        if with_exit:
            G.add_node(3, room_type="dis_cikis", area_m2=10.0, floor_level=0)
            G.add_edge(2, 3, door_width_cm=120.0, distance_m=distance_m, is_vertical=is_vertical)
        if with_island:
            G.add_node(10, room_type="salon", area_m2=50.0, floor_level=0)
            G.add_node(11, room_type="salon", area_m2=50.0, floor_level=0)
            G.add_edge(10, 11, door_width_cm=90.0, distance_m=3.0)
        return G

    def test_evacuation_time_includes_walking_distance(self):
        sim = Building3DEvacuationSimulator()
        near = sim.simulate_evacuation(self._simple_building(distance_m=5.0))
        far = sim.simulate_evacuation(self._simple_building(distance_m=50.0))

        assert near.is_compliance_achieved is True
        assert near.total_persons_evacuated == 3
        # 100 m toplam yürüyüş, 1.19 m/sn ile en az 84 sn sürer ve 65 sn hedefini aşar.
        assert far.total_evacuation_time_sec >= 100.0 / 1.19
        assert far.evacuation_completed is True
        assert far.is_compliance_achieved is False

    def test_stairs_are_slower_than_corridors(self):
        sim = Building3DEvacuationSimulator()
        flat = sim.simulate_evacuation(self._simple_building(distance_m=20.0))
        stairs = sim.simulate_evacuation(self._simple_building(distance_m=20.0, is_vertical=True))
        assert stairs.total_evacuation_time_sec > flat.total_evacuation_time_sec

    def test_building_without_exit_is_not_compliant(self):
        rep = Building3DEvacuationSimulator().simulate_evacuation(self._simple_building(with_exit=False))
        assert rep.has_exit is False
        assert rep.trapped_persons == 3
        assert rep.total_persons_evacuated == 0
        assert rep.evacuation_completed is False
        assert rep.is_compliance_achieved is False

    def test_occupants_without_route_are_reported_as_trapped(self):
        sim = Building3DEvacuationSimulator()
        rep = sim.simulate_evacuation(self._simple_building(with_island=True))
        assert rep.total_persons == 9
        assert rep.total_persons_evacuated == 3
        assert rep.trapped_persons == 6
        assert set(rep.unreachable_occupied_nodes) == {10, 11}
        assert rep.evacuation_completed is False
        assert rep.total_evacuation_time_sec == sim.max_t
        assert rep.is_compliance_achieved is False

    def test_evacuation_exceeding_simulation_limit_is_not_compliant(self):
        sim = Building3DEvacuationSimulator(max_simulation_sec=180.0, target_evacuation_threshold_sec=1000.0)
        rep = sim.simulate_evacuation(self._simple_building(), initial_occupancy={1: 1000})
        assert rep.evacuation_completed is False
        assert rep.trapped_persons == 0
        assert rep.total_persons_evacuated < rep.total_persons
        assert rep.is_compliance_achieved is False

    def test_unoccupied_technical_spaces_are_not_trapped(self):
        for room_type in ("teknik_saft", "asansor"):
            G = self._simple_building()
            G.add_node(20, room_type=room_type, area_m2=5.0, floor_level=0)
            rep = Building3DEvacuationSimulator().simulate_evacuation(G)
            assert rep.trapped_persons == 0
            assert rep.evacuation_completed is True

    def test_vent_shaft_label_is_classified_as_technical_space(self):
        classify = TurkishArchitecturalLabelClassifier.classify_room_type
        assert classify("B-10 BODRUM ACIL KACIS MENFEZI VE BACASI", area_m2=5.0) == "teknik_saft"
        assert classify("Z-23 YATAK ODASI", area_m2=14.0) == "oda"

    def test_optimizer_does_not_prescribe_doors_for_trapped_occupants(self):
        result = CounterfactualEvacuationOptimizer().optimize_building_design(self._simple_building(with_island=True))
        assert result.baseline_trapped_persons == 6
        assert result.intervention_steps == []
        assert result.time_savings_sec == 0.0

    def test_opencv_floorplan_image_analyzer(self):
        img_path = "test_plan.png"
        generate_sample_floorplan_image(img_path)
        try:
            cv_engine = FloorplanImageAnalyzer(pixels_per_meter=50.0)
            rooms, doors, debug_img = cv_engine.analyze_image_file(img_path)
            assert len(rooms) >= 2
            assert debug_img is not None
        finally:
            if os.path.exists(img_path):
                os.remove(img_path)


class TestEndToEndPipeline:
    def test_full_pipeline_on_sample_dxf(self):
        dxf_path = "test_sample_building.dxf"
        annotated_path = "test_annotated_building.dxf"
        generate_sample_building_dxf(dxf_path)

        try:
            doc = ezdxf.readfile(dxf_path)
            pipe = DiagramYonetmelikPipeline()
            output = pipe.run_full_pipeline(doc, output_annotated_dxf_path=annotated_path)

            assert output.building_3d_result.total_floors >= 1
            assert output.building_3d_result.total_rooms >= 5
            assert len(output.official_markdown_report) > 100
            assert os.path.exists(annotated_path)
        finally:
            for p in [dxf_path, annotated_path]:
                if os.path.exists(p):
                    try:
                        os.remove(p)
                    except Exception:
                        pass


class TestMultiFloorComprehensiveAuditor:
    def test_multi_floor_comprehensive_audit_rules(self):
        auditor = MultiFloorComprehensiveAuditor(high_rise_threshold_m=21.50)
        G = nx.Graph()

        # Kat 7 (Yüksek Kat): Sadece 1 merdiven, yangın holü alanı 2.0m² (< 3.0m²), koridor 0.90m (< 1.20m)
        G.add_node(101, room_type="oda", area_m2=25.0, floor_level=7, anchor_point=(2, 2))
        G.add_node(102, room_type="kat_koridoru", area_m2=15.0, floor_level=7, polygon=Polygon([(0, 0), (1.0, 0), (1.0, 15.0), (0, 15.0)]), anchor_point=(0.5, 7.5))
        G.add_node(103, room_type="yangin_holu", area_m2=2.0, floor_level=7, anchor_point=(1, 15))  # Kusur: 2m² < 3m²
        G.add_node(104, room_type="yangin_merdiveni", area_m2=8.0, floor_level=7, anchor_point=(1, 18))  # Kusur: Tek merdiven

        G.add_edge(101, 102, width_cm=80.0, weight=6.0)
        G.add_edge(102, 103, width_cm=90.0, weight=20.0)  # Kusur: 20m > 15m çıkmaz koridor
        G.add_edge(103, 104, width_cm=90.0, weight=2.0)

        # Kat 0 (Zemin Kat)
        G.add_node(1, room_type="kat_koridoru", area_m2=20.0, floor_level=0, polygon=Polygon([(0, 0), (1.5, 0), (1.5, 10.0), (0, 10.0)]), anchor_point=(0.75, 5))
        G.add_node(2, room_type="yangin_merdiveni", area_m2=8.0, floor_level=0, anchor_point=(0.75, 10))
        G.add_node(3, room_type="dis_cikis", area_m2=10.0, floor_level=0, anchor_point=(0.75, 12))
        G.add_edge(1, 2, width_cm=120.0, weight=3.0)
        G.add_edge(2, 3, width_cm=120.0, weight=2.0)

        reports = auditor.audit_entire_building(G, custom_building_height_m=36.0)
        assert len(reports) >= 2

        all_violation_codes = [v.violation_code for rep in reports for v in rep.violations]
        # Kat 7 kusurları
        assert "BYKHY_M31_KACIS_MERDIVEN_SAYISI_YETERSIZ" in all_violation_codes
        assert "BYKHY_M34_YANGIN_HOLU_ALAN_YETERSIZ" in all_violation_codes
        assert "PAIY_M29_KAT_KORIDORU_GENISLIK_YETERSIZ" in all_violation_codes
        assert "BYKHY_M52_CIKMAZ_KORIDOR_MESAFESI_ASILDI" in all_violation_codes

    def test_multi_floor_auditor_flags_oversized_fire_hall(self):
        G = nx.Graph()
        G.add_node(1, room_type="kat_koridoru", area_m2=20.0, floor_level=0, anchor_point=(0, 0))
        G.add_node(2, room_type="yangin_holu", area_m2=10.0, floor_level=0, anchor_point=(1, 0))
        G.add_edge(1, 2, width_cm=120.0, weight=3.0)

        reports = MultiFloorComprehensiveAuditor().audit_entire_building(G, custom_building_height_m=3.0)
        codes = [v.violation_code for rep in reports for v in rep.violations]
        assert "BYKHY_M34_YANGIN_HOLU_ALAN_FAZLA" in codes

    def test_high_rise_12_story_dxf_generation_and_audit(self):
        dxf_path = "test_sample_12_story.dxf"
        try:
            generate_high_rise_12_story_building_dxf(dxf_path)
            doc = ezdxf.readfile(dxf_path)
            pipe = DiagramYonetmelikPipeline()
            output = pipe.run_full_pipeline(doc)
            
            # 12 kat + zemin + bodrum = en az 13-14 kat seviyesi
            assert output.building_3d_result.total_floors >= 10
            assert output.building_3d_result.total_rooms >= 40
            assert len(output.diagnostic_reports) >= 10
            assert len(output.official_markdown_report) > 500
        finally:
            if os.path.exists(dxf_path):
                try:
                    os.remove(dxf_path)
                except Exception:
                    pass


class TestCanonicalRegulationsAndLiveSync:
    """
    Doğrulanmış Resmi Mevzuat Kayıt Defteri ve LiveMevzuatSyncService Birim Testleri.
    """
    def test_canonical_urls_contain_exact_three_parameters(self):
        from diagram_yonetmelik.regulations_library import (
            REGULATIONS_METADATA,
            build_canonical_mevzuat_urls,
        )

        expected_params = {
            "BYKHY": ("200712937", "3", "5"),
            "PAIY": ("23722", "7", "5"),
            "OTOPARK": ("24363", "7", "5"),
            "SIGINAK": ("9930", "7", "5"),
        }

        for reg_code, (exp_no, exp_tur, exp_tertip) in expected_params.items():
            meta = REGULATIONS_METADATA[reg_code]
            assert meta["mevzuat_no"] == exp_no
            assert meta["mevzuat_tur"] == exp_tur
            assert meta["mevzuat_tertip"] == exp_tertip

            iframe_url, page_url, fallback_url = build_canonical_mevzuat_urls(reg_code, "Madde 30")

            # MevzuatNo, MevzuatTur ve MevzuatTertip parametrelerinin eksiksiz varlığı
            for p in [f"MevzuatNo={exp_no}", f"MevzuatTur={exp_tur}", f"MevzuatTertip={exp_tertip}"]:
                assert p in iframe_url, f"{reg_code} iframe url eksik parametre: {p}"
                assert p in page_url, f"{reg_code} page url eksik parametre: {p}"

            # Google yedek arama linki garantisi
            assert "site%3Amevzuat.gov.tr" in fallback_url or "site:mevzuat.gov.tr" in fallback_url
            assert "Madde+30" in fallback_url or "Madde" in fallback_url

    def test_regulatory_corpus_chunks_have_canonical_fields(self):
        from diagram_yonetmelik.regulatory_rag import build_turkish_building_regulations_corpus

        corpus = build_turkish_building_regulations_corpus()
        assert len(corpus) >= 10

        for chunk in corpus:
            assert chunk.article_number.startswith("Madde ")
            assert chunk.official_source_url.startswith("https://www.mevzuat.gov.tr/anasayfa/MevzuatFihristDetayIframe?")
            assert "MevzuatNo=" in chunk.official_source_url
            assert "MevzuatTur=" in chunk.official_source_url
            assert "MevzuatTertip=5" in chunk.official_source_url
            assert "site:mevzuat.gov.tr" in chunk.fallback_search_url or "site%3Amevzuat.gov.tr" in chunk.fallback_search_url
            assert len(chunk.sha256_hash) == 64
            assert isinstance(chunk.mandatory_threshold_summary, dict)

    def test_live_sync_service_threshold_extractor_and_parser(self):
        from diagram_yonetmelik.regulatory_rag import LiveMevzuatSyncService

        svc = LiveMevzuatSyncService()
        
        # 1. Sayısal Eşik Çıkarımı
        sample_text = (
            "Kaçış koridoru temiz genişliği en az 1.20 m, rıht yüksekliği 17.5 cm, "
            "yangın kapısı en az 60 dakika dayanıklı olmalı, pozitif basınçlandırma 50 Pa sağlanmalıdır. "
            "Kullanıcı yükü 500 kişi üzerinde olan yapılarda hol alanı en az 3.0 m² olmalıdır."
        )
        thresholds = svc.extract_numerical_thresholds(sample_text)
        assert thresholds["count"] >= 5
        found = thresholds["thresholds_found"]
        assert any("1.20 m" in t for t in found)
        assert any("17.5 cm" in t for t in found)
        assert any("60 dakika" in t for t in found)
        assert any("50 Pa" in t for t in found)
        assert any("3.0 m²" in t or "3.0 m2" in t for t in found)

        # 2. Madde Ayrıştırıcı (Article Parser)
        mock_html = """
        <html><body>
        <h1>BİNALARIN YANGINDAN KORUNMASI HAKKINDA YÖNETMELİK</h1>
        <p>MADDE 30 - Kaçış yolları engellenmemiş ve kesintisiz olmalıdır.</p>
        <p>MADDE 31 - Yüksek binalarda en az 2 adet kaçış merdiveni yapılması zorunludur.</p>
        <p>MADDE 34 - Yangın güvenlik holü taban alanı en az 3.0 m² olmalıdır.</p>
        </body></html>
        """
        parsed = svc.parse_regulation_articles(mock_html, "BYKHY")
        assert len(parsed) == 3
        assert "30" in parsed
        assert "31" in parsed
        assert "34" in parsed
        assert parsed["30"]["article_number"] == "Madde 30"
        assert len(parsed["30"]["sha256_hash"]) == 64
        assert "MevzuatNo=200712937" in parsed["30"]["official_source_url"]

    def test_live_sync_offline_fallback_and_cache_integrity(self):
        from diagram_yonetmelik.regulatory_rag import get_mevzuat_sync_service
        import os

        svc = get_mevzuat_sync_service()
        assert os.path.exists(svc.cache_path)
        assert "regulations" in svc.cache_data
        
        # 4 Yönetmeliğin de önbellekte doğrulanmış maddeleri bulunmalıdır
        for code in ["BYKHY", "PAIY", "SIGINAK", "OTOPARK"]:
            assert code in svc.cache_data["regulations"]
            articles = svc.cache_data["regulations"][code]["articles"]
            assert len(articles) > 0

        # get_article sorgusu
        art = svc.get_article("BYKHY", "31")
        assert art is not None
        assert "MevzuatNo=200712937" in art["official_source_url"]
        assert len(art["sha256_hash"]) == 64


class TestSubgraphDatasetAndDataLoader:
    def test_spatial_rag_subgraph_dataset_and_pair_batching(self):
        from diagram_yonetmelik.subgraph_dataset import (
            build_sample_architectural_rag,
            SpatialRAGSubgraphDataset,
            SubgraphPairData,
            split_pair_batch,
        )
        from torch_geometric.loader import DataLoader

        rag = build_sample_architectural_rag()
        assert rag.number_of_nodes() >= 10
        assert rag.number_of_edges() >= 10

        dataset = SpatialRAGSubgraphDataset(
            floorplan_graphs=[rag],
            num_samples=8,
            k_hops=2,
            min_query_nodes=3,
            max_query_nodes=5,
            pos_ratio=0.5
        )
        assert len(dataset) == 8
        item = dataset[0]
        assert hasattr(item, "x_q")
        assert hasattr(item, "x_u")
        assert hasattr(item, "y")
        assert item.y.item() in (0.0, 1.0)

        loader = DataLoader(dataset, batch_size=4, shuffle=False, follow_batch=["x_q", "x_u"])
        batch = next(iter(loader))
        assert hasattr(batch, "x_q_batch")
        assert hasattr(batch, "x_u_batch")

        q_b, u_b, labels = split_pair_batch(batch)
        assert labels.shape[0] == 4
        assert q_b.x.shape[1] == 17  # 10 feat + 6 rwpe + 1 anchor
        assert u_b.x.shape[1] == 17


class TestLearnedAIAndNeuroSymbolicDualMode:
    def test_gnn_model_checkpoint_and_embedding_inference(self):
        import os
        import torch
        from diagram_yonetmelik.gnn_order import SpatialOrderGNN
        from diagram_yonetmelik.subgraph_dataset import build_sample_architectural_rag

        checkpoint_path = "data/spatial_order_gnn.pt"
        assert os.path.exists(checkpoint_path), "GNN model ağırlık dosyası bulunamadı!"

        model = SpatialOrderGNN(node_in_dim=10, edge_in_dim=3, rwpe_dim=6, hidden_dim=64)
        loaded = model.load_weights(checkpoint_path)
        assert loaded is True, "Model ağırlıkları başarıyla yüklenmeli!"

        rag = build_sample_architectural_rag()
        z_sub = model.embed_subgraph(rag, anchor_node=1)

        z_list = z_sub.tolist() if hasattr(z_sub, "tolist") else list(z_sub)
        assert len(z_list) == 64
        # Order embedding Softplus kısıtı: Tüm boyutlar non-negative olmalıdır
        assert all(val >= 0.0 for val in z_list)

        # Violation energy testi: Subgraph kendine karşı sıfır enerji vermeli
        t_z = z_sub.unsqueeze(0) if z_sub.dim() == 1 else z_sub
        assert violation_energy(t_z, t_z).item() == 0.0

    def test_spminer_neural_clustering_vs_wl_hash_fallback(self):
        import os
        from diagram_yonetmelik.gnn_order import SpatialOrderGNN
        from diagram_yonetmelik.spminer import ArchitecturalSPMiner
        from diagram_yonetmelik.subgraph_dataset import build_sample_architectural_rag

        rag = build_sample_architectural_rag()

        # 1. Learned AI Mode (GNN Order Embedding)
        gnn = SpatialOrderGNN(node_in_dim=10, edge_in_dim=3, rwpe_dim=6, hidden_dim=64)
        if os.path.exists("data/spatial_order_gnn.pt"):
            gnn.load_weights("data/spatial_order_gnn.pt")

        miner_ai = ArchitecturalSPMiner(
            gnn_model=gnn,
            min_support=1,
            max_motif_nodes=5,
            use_neural_clustering=True,
            neural_similarity_threshold=0.75
        )
        motifs_ai, _ = miner_ai.discover_frequent_modules(rag)
        assert len(motifs_ai) > 0
        for m in motifs_ai:
            assert m.clustering_method == "gnn_order_embedding"
            assert m.neural_confidence > 0.0
            assert m.embedding_vector is not None
            assert len(m.embedding_vector) == 64

        # 2. Deterministic Fallback Mode (WL-Hash)
        miner_det = ArchitecturalSPMiner(
            gnn_model=None,
            min_support=1,
            max_motif_nodes=5,
            use_neural_clustering=False
        )
        motifs_det, _ = miner_det.discover_frequent_modules(rag)
        assert len(motifs_det) > 0
        for m in motifs_det:
            assert m.clustering_method == "wl_hash"

    def test_pruning_does_not_change_evacuation_regression(self, tmp_path):
        """Tahliye simülasyonu Aşama 4 çıktısını kullanmadığı için bu bir regresyon testidir, güvenlik kanıtı değildir."""
        from diagram_yonetmelik.orchestrator import DiagramYonetmelikPipeline
        from diagram_yonetmelik.schemas import PipelineConfig

        doc_ai = generate_sample_building_dxf(str(tmp_path / "ai.dxf"))
        doc_det = generate_sample_building_dxf(str(tmp_path / "det.dxf"))

        # Mode A: Neural AI Pruning + Neural Clustering
        cfg_ai = PipelineConfig(
            enable_hybrid_pruning=True,
            spminer_use_neural_clustering=True,
            target_evacuation_time_sec=180.0
        )
        orch_ai = DiagramYonetmelikPipeline(cfg_ai)
        out_ai = orch_ai.run_full_pipeline(doc_ai)

        # Mode B: Deterministic Fallback (GNN Off, 100% Exact VF2 + WL-Hash)
        cfg_det = PipelineConfig(
            enable_hybrid_pruning=False,
            spminer_use_neural_clustering=False,
            target_evacuation_time_sec=180.0
        )
        orch_det = DiagramYonetmelikPipeline(cfg_det)
        out_det = orch_det.run_full_pipeline(doc_det)

        # Budanan aday hiçbir zaman "doğrulandı" sayılamaz; budanmayan adayların teşhisleri birebir aynı kalmalıdır.
        pruned_anchors = {rep.anchor_node_id for rep in out_ai.pruned_candidates}
        assert all(rep.review_status == "pruned_unverified" for rep in out_ai.pruned_candidates)
        assert not pruned_anchors & set(out_ai.verified_escape_cores)

        # Tahliye simülatörü GNN çıktısı almaz; bu kontrol yalnızca aynı grafın kullanıldığını gösterir.
        assert out_ai.baseline_evacuation_report.total_evacuation_time_sec == \
               out_det.baseline_evacuation_report.total_evacuation_time_sec
        assert out_ai.baseline_evacuation_report.is_compliance_achieved == \
               out_det.baseline_evacuation_report.is_compliance_achieved
        assert out_ai.baseline_evacuation_report.critical_bottleneck_count == \
               out_det.baseline_evacuation_report.critical_bottleneck_count
        assert set(out_ai.verified_escape_cores) == set(out_det.verified_escape_cores) - pruned_anchors

        # AI modunda Stage 4 execution metric teyidi
        assert "gnn_hybrid_pruning_enabled" in out_ai.execution_metrics
        assert bool(out_ai.execution_metrics["gnn_hybrid_pruning_enabled"]) is True
        assert bool(out_det.execution_metrics["gnn_hybrid_pruning_enabled"]) is False


def test_pruned_candidates_have_no_regulatory_finding(tmp_path):
    import json
    from pathlib import Path
    from diagram_yonetmelik.orchestrator import DiagramYonetmelikPipeline
    from diagram_yonetmelik.schemas import PipelineConfig
    config = PipelineConfig(enable_hybrid_pruning=True)
    calibration = json.loads(Path(config.gnn_calibration_path).read_text())
    calibration["tau"] = 0
    path = tmp_path / "calibration.json"
    path.write_text(json.dumps(calibration))
    config.gnn_calibration_path = str(path)
    out = DiagramYonetmelikPipeline(config).run_full_pipeline(generate_sample_building_dxf(str(tmp_path / "sample.dxf")))
    assert out.pruned_candidates
    for candidate in out.pruned_candidates:
        assert candidate.review_status == "pruned_unverified"
        assert candidate.violations == []
        assert candidate.is_fully_compliant is None
        assert candidate not in out.diagnostic_reports
    assert out.execution_metrics["pruned_candidates"] == len(out.pruned_candidates)
    assert "GNN tarafından elendi, VF2 ile doğrulanmadı" in out.official_markdown_report


def test_missing_calibration_disables_pruning(tmp_path):
    from diagram_yonetmelik.orchestrator import DiagramYonetmelikPipeline
    from diagram_yonetmelik.schemas import PipelineConfig
    cfg = PipelineConfig(enable_hybrid_pruning=True, gnn_calibration_path=str(tmp_path / "missing"))
    out = DiagramYonetmelikPipeline(cfg).run_full_pipeline(generate_sample_building_dxf(str(tmp_path / "input.dxf")))
    assert out.execution_metrics["pruning_status"] == "missing_calibration"
    assert out.execution_metrics["vf2_candidates"] > 0
    assert not out.pruned_candidates


def test_cluster_members_match_representative_structure():
    from diagram_yonetmelik.sample_generator import generate_experiment_building
    from diagram_yonetmelik.spminer import ArchitecturalSPMiner
    graph = generate_experiment_building(3)
    miner = ArchitecturalSPMiner(min_support=1, neural_similarity_threshold=-1)
    motifs, _ = miner.discover_frequent_modules(graph)
    assert miner.rejected_candidates > 0
    for motif in motifs:
        assert motif.support == len(motif.member_node_sets) == len(motif.matched_anchor_nodes)
        for anchor, nodes in zip(motif.matched_anchor_nodes, motif.member_node_sets):
            member = graph.subgraph(nodes).copy()
            for n in member:
                member.nodes[n]["motif_label"] = member.nodes[n]["room_type"] + ("@anchor" if n == anchor else "")
            assert nx.is_isomorphic(member, motif.motif_graph,
                                    node_match=nx.isomorphism.categorical_node_match("motif_label", ""))


def test_all_splits_are_building_disjoint():
    from diagram_yonetmelik.train_gnn import SEEDS, SAMPLE, building_splits
    for seed in SEEDS:
        split = building_splits(seed)
        a, b, c = (set(split[k]) for k in ("train", "validation", "test"))
        assert not (a & b or b & c or a & c)
        assert SAMPLE in c and len(a | b | c) == 31


def test_capacity_subtracts_boundary_layer_on_both_sides():
    sim = Building3DEvacuationSimulator()
    for vertical, layer, flow in [(False, sim.door_bl, sim.flow_horiz), (True, sim.stair_bl, sim.flow_stair)]:
        rate = sim._compute_edge_capacity_rate({"door_width_cm": 100, "is_vertical": vertical})
        assert rate == (1 - 2 * layer) * flow
