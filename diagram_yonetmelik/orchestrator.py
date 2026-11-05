import copy
import hashlib
import json
import math
from pathlib import Path
import time
from typing import Dict, List, Tuple, Optional, Any
import ezdxf
from ezdxf.document import Drawing
import networkx as nx

from diagram_yonetmelik.schemas import (
    PipelineConfig,
    DiagramYonetmelikPipelineOutput,
    RoomPolygonInput,
    DoorGeometryInput,
    CandidateDiagnosticReport,
    BuildingProgramSummary,
)
from diagram_yonetmelik.cad_ingest import DXFFloorplanParser
from diagram_yonetmelik.cv_analyzer import FloorplanImageAnalyzer
from diagram_yonetmelik.spatial_rag import MultiFloor3DRAGBuilder
from diagram_yonetmelik.gnn_order import (
    SpatialOrderGNN,
    nx_subgraph_to_pyg_data,
    violation_energy,
    extract_anchored_k_hop,
)
from diagram_yonetmelik.spminer import ArchitecturalSPMiner, ArchitecturalGraphCoarsener
from diagram_yonetmelik.vf2_diagnostics import ExplainableVF2Analyzer, fire_candidates
from diagram_yonetmelik.basement_audit import BasementComplianceAuditor
from diagram_yonetmelik.multi_floor_auditor import MultiFloorComprehensiveAuditor
from diagram_yonetmelik.evacuation import (
    Building3DEvacuationSimulator,
    CounterfactualEvacuationOptimizer,
)
from diagram_yonetmelik.dxf_annotator import (
    DXFViolationAnnotator,
    DXFOptimizationAnnotator,
    DXFAuditTableAnnotator,
)
from diagram_yonetmelik.regulatory_rag import (
    HybridRegulatoryRetriever,
    LocalMimarLLMReportGenerator,
)


class DiagramYonetmelikPipeline:
    """
    DiagramYönetmelik Ana Boru Hattı Orkestratörü.
    DXF veya OpenCV görüntü planlarından başlayarak 9 aşamalı uçtan uca
    mekansal denetim, 3B RAG inşası, SPMiner modül keşfi, VF2 teşhis hunisi,
    3B tahliye simülasyonu, karşı-olgusal optimizasyon ve mevzuat raporlamasını yürütür.
    """
    def __init__(self, config: Optional[PipelineConfig] = None):
        self.config = config or PipelineConfig()
        self.cad_parser = DXFFloorplanParser()
        self.cv_analyzer = FloorplanImageAnalyzer()
        self.rag_3d_builder = MultiFloor3DRAGBuilder()
        self.gnn = SpatialOrderGNN()
        loaded = self.config.gnn_model_weights_path and self.gnn.load_weights(self.config.gnn_model_weights_path)
        tau, self.pruning_status = self._calibrated_threshold(loaded)
        self.gnn.eval()
        self.spminer = ArchitecturalSPMiner(
            gnn_model=self.gnn,
            min_support=self.config.spminer_min_support,
            use_neural_clustering=self.config.spminer_use_neural_clustering,
            neural_similarity_threshold=self.config.spminer_neural_similarity_threshold
        )
        self.vf2_analyzer = ExplainableVF2Analyzer(
            max_escape_distance_m=self.config.max_escape_route_distance_m,
            gnn_model=self.gnn,
            energy_threshold=tau,
            enable_hybrid_pruning=self.pruning_status == "enabled"
        )
        self.basement_auditor = BasementComplianceAuditor()
        self.multi_floor_auditor = MultiFloorComprehensiveAuditor(
            default_floor_height_m=self.config.default_floor_height_m,
            high_rise_threshold_m=self.config.high_rise_threshold_m
        )
        self.evac_sim = Building3DEvacuationSimulator(target_evacuation_threshold_sec=self.config.target_evacuation_time_sec)
        self.optimizer = CounterfactualEvacuationOptimizer()
        self.violation_annotator = DXFViolationAnnotator()
        self.opt_annotator = DXFOptimizationAnnotator()
        self.table_annotator = DXFAuditTableAnnotator()
        self.retriever = HybridRegulatoryRetriever()
        self.report_gen = LocalMimarLLMReportGenerator(
            retriever=self.retriever,
            prefer_local_llm=self.config.prefer_local_llm,
            llm_endpoint=self.config.local_llm_endpoint
        )

    def _calibrated_threshold(self, loaded):
        if self.config.enable_hybrid_pruning is not True:
            return math.inf, "disabled_by_config"
        try:
            calibration = json.loads(Path(self.config.gnn_calibration_path).read_text(encoding="utf8"))
            if not loaded:
                return math.inf, "weights_unavailable"
            digest = hashlib.sha256(Path(self.config.gnn_model_weights_path).read_bytes()).hexdigest()
            if (digest != calibration["model_version"] or calibration["k_hops"] != self.config.k_hops_gnn
                    or calibration["max_escape_distance_m"] != self.config.max_escape_route_distance_m):
                return math.inf, "calibration_mismatch"
            tau = calibration["tau"]
            if type(tau) not in (float, int) or not math.isfinite(tau) or tau < 0:
                return math.inf, "invalid_calibration"
            return tau, "enabled"
        except FileNotFoundError:
            return math.inf, "missing_calibration"
        except (OSError, ValueError, TypeError, KeyError):
            return math.inf, "invalid_calibration"

    def _review_fire_candidates(self, graph, metrics):
        start = time.perf_counter()
        verified, diagnostics, pruned = [], [], []
        for query, target, anchor in fire_candidates(graph, self.vf2_analyzer, self.config.k_hops_gnn):
            report = self.vf2_analyzer.explain_candidate(query, target, anchor)
            if report.review_status == "pruned_unverified":
                pruned.append(report)
            elif report.is_fully_compliant:
                verified.append(anchor)
            else:
                diagnostics.append(report)
        metrics.update(stage4_gnn_vf2_sec=time.perf_counter() - start,
                       vf2_candidates=len(verified) + len(diagnostics), pruned_candidates=len(pruned),
                       gnn_hybrid_pruning_enabled=self.vf2_analyzer.enable_hybrid_pruning,
                       pruning_status=self.pruning_status)
        return verified, diagnostics, pruned

    def run_full_pipeline(
        self,
        dxf_doc: Drawing,
        output_annotated_dxf_path: Optional[str] = None
    ) -> DiagramYonetmelikPipelineOutput:
        metrics: Dict[str, float] = {}
        t_total_start = time.perf_counter()

        # -------------------------------------------------------------
        # AŞAMA 1: DXF AYRIŞTIRMA VE GEOMETRİK KURTARMA
        # -------------------------------------------------------------
        t0 = time.perf_counter()
        rooms, doors, scale = self.cad_parser.parse_dxf_document(
            dxf_doc,
            default_scale_to_m=self.config.default_unit_scale_to_m
        )
        metrics["stage1_dxf_ingest_sec"] = round(time.perf_counter() - t0, 3)

        # -------------------------------------------------------------
        # AŞAMA 2: 3B BİNA TOPOLOJİ GRAFI (3D RAG)
        # -------------------------------------------------------------
        t0 = time.perf_counter()
        rag_3d_result = self.rag_3d_builder.build_3d_building_rag(rooms, doors, unit_scale_to_meters=scale)
        G_3d = rag_3d_result.G_3d
        metrics["stage2_3d_rag_sec"] = round(time.perf_counter() - t0, 3)

        # -------------------------------------------------------------
        # AŞAMA 3: SPMINER VE PROGRAM ÖZETİ
        # -------------------------------------------------------------
        t0 = time.perf_counter()
        motifs, program = self.spminer.discover_frequent_modules(G_3d)
        metrics["stage3_spminer_sec"] = round(time.perf_counter() - t0, 3)

        # -------------------------------------------------------------
        # AŞAMA 4: GNN + VF2 YANGIN KAÇIŞ DENETİMİ
        # -------------------------------------------------------------
        verified_cores, diagnostic_reports, pruned = self._review_fire_candidates(G_3d, metrics)
        metrics["spminer_neural_clustering_enabled"] = 1.0 if self.config.spminer_use_neural_clustering else 0.0

        # -------------------------------------------------------------
        # AŞAMA 5: HER KAT İÇİN VE BİNA GENELİ KAPSAMLI MEVZUAT DENETİMİ
        # (BYKHY M.31/33/34/40/48/52/53/60/62, PAİY M.5/29/30/34/36, Sığınak, Otopark)
        # -------------------------------------------------------------
        t0 = time.perf_counter()
        has_sprinkler_indicator = any("sprinkler" in str(d.get("name_label", "")).lower() for _, d in G_3d.nodes(data=True)) or getattr(self.config, "sprinkler_enabled", False)
        self.multi_floor_auditor.sprinkler = has_sprinkler_indicator
        existing_violation_keys: Set[Tuple[str, Any, Any, int]] = set()
        for rep in diagnostic_reports:
            for v in rep.violations:
                existing_violation_keys.add((v.violation_code, v.target_node_id, v.target_edge, v.floor_level))

        multi_floor_reports = self.multi_floor_auditor.audit_entire_building(G_3d, program)
        for rep in multi_floor_reports:
            filtered_violations = []
            for v in rep.violations:
                k = (v.violation_code, v.target_node_id, v.target_edge, v.floor_level)
                if k not in existing_violation_keys:
                    filtered_violations.append(v)
                    existing_violation_keys.add(k)
            if filtered_violations or rep.is_fully_compliant:
                rep.violations = filtered_violations
                diagnostic_reports.append(rep)

        metrics["stage5_comprehensive_multi_floor_audit_sec"] = round(time.perf_counter() - t0, 3)

        # -------------------------------------------------------------
        # AŞAMA 6: 3B HİDROLİK TAHLİYE SİMÜLASYONU
        # -------------------------------------------------------------
        t0 = time.perf_counter()
        baseline_evac = self.evac_sim.simulate_evacuation(G_3d)
        metrics["stage6_evacuation_sim_sec"] = round(time.perf_counter() - t0, 3)

        # -------------------------------------------------------------
        # AŞAMA 7: KARŞI-OLGUSAL OPTİMİZASYON (TADİLAT REÇETESİ)
        # -------------------------------------------------------------
        t0 = time.perf_counter()
        opt_result = self.optimizer.optimize_building_design(
            G_3d,
            target_time_sec=self.config.target_evacuation_time_sec
        )
        metrics["stage7_optimization_sec"] = round(time.perf_counter() - t0, 3)

        # -------------------------------------------------------------
        # AŞAMA 8: ÇİFT KATMANLI VE CAD TABLOLU AUTOCAD (.DXF) GERİ YAZIM
        # -------------------------------------------------------------
        t0 = time.perf_counter()
        annotated_doc = copy.deepcopy(dxf_doc)
        annotated_doc = self.violation_annotator.annotate_violations_on_dxf(annotated_doc, diagnostic_reports, rooms, scale)
        annotated_doc = self.opt_annotator.annotate_optimizations_on_dxf(annotated_doc, opt_result, scale)
        annotated_doc = self.table_annotator.annotate_audit_table_on_dxf(
            annotated_doc, diagnostic_reports, opt_result, rooms, doors, scale, project_title=self.config.project_title, pruned_count=len(pruned)
        )

        if output_annotated_dxf_path:
            annotated_doc.saveas(output_annotated_dxf_path)
        metrics["stage8_dxf_annotation_sec"] = round(time.perf_counter() - t0, 3)

        # -------------------------------------------------------------
        # AŞAMA 9: YEREL MEVZUAT RAG VE RESMİ RAPOR
        # -------------------------------------------------------------
        t0 = time.perf_counter()
        report_md, evidence_json = self.report_gen.generate_official_compliance_report(
            project_title=self.config.project_title,
            diagnostic_reports=diagnostic_reports,
            program=program,
            opt_result=opt_result,
            unit_scale=scale, pruned_candidates=pruned
        )
        metrics["stage9_regulatory_rag_sec"] = round(time.perf_counter() - t0, 3)

        metrics["total_pipeline_latency_sec"] = round(time.perf_counter() - t_total_start, 3)

        return DiagramYonetmelikPipelineOutput(
            unit_scale_to_meters=scale,
            used_line_soup_fallback=False,
            building_3d_result=rag_3d_result,
            discovered_apartment_motifs=motifs,
            building_program=program,
            verified_escape_cores=verified_cores,
            pruned_candidates=pruned,
            diagnostic_reports=diagnostic_reports,
            baseline_evacuation_report=baseline_evac,
            counterfactual_optimization=opt_result,
            annotated_dxf_document=annotated_doc,
            official_markdown_report=report_md,
            grounded_evidence_json=evidence_json,
            execution_metrics=metrics,
            dxf_output_path=output_annotated_dxf_path
        )

    def run_image_pipeline(
        self,
        image_path: str,
        floor_level: int = 0
    ) -> DiagramYonetmelikPipelineOutput:
        """
        OpenCV ile kat planı resminden (PNG/JPG) doğrudan 3B RAG, tahliye ve denetim yürütür.
        """
        rooms, doors, debug_vis = self.cv_analyzer.analyze_image_file(image_path, floor_level=floor_level)
        dummy_dxf = ezdxf.new('R2010')
        output = self.run_from_rooms_and_doors(rooms, doors, dummy_dxf)

        # Darboğaz koordinatlarını termal ısı haritasına dönüştür
        bottlenecks_for_heat = []
        if output.baseline_evacuation_report and output.baseline_evacuation_report.bottlenecks_ranked:
            for b in output.baseline_evacuation_report.bottlenecks_ranked:
                bottlenecks_for_heat.append({
                    "spatial_coords": b.spatial_coords,
                    "severity_score": b.severity_score
                })
        heat_vis = self.cv_analyzer.render_evacuation_heatmap(debug_vis, bottlenecks_for_heat, doors=doors, rooms=rooms)

        output.cv_debug_vis = debug_vis
        output.cv_heatmap_vis = heat_vis
        output.cv_image_path = image_path
        return output

    def run_from_rooms_and_doors(
        self,
        rooms: List[RoomPolygonInput],
        doors: List[DoorGeometryInput],
        base_dxf: Optional[Drawing] = None
    ) -> DiagramYonetmelikPipelineOutput:
        start = time.perf_counter()
        dxf_doc = base_dxf or ezdxf.new('R2010')
        scale = 1.0

        rag_3d = self.rag_3d_builder.build_3d_building_rag(rooms, doors, unit_scale_to_meters=scale)
        G_3d = rag_3d.G_3d
        motifs, program = self.spminer.discover_frequent_modules(G_3d)

        metrics = {}
        verified_cores, diagnostics, pruned = self._review_fire_candidates(G_3d, metrics)

        basement_viols = self.basement_auditor.audit_basement_graph(G_3d, program)
        if basement_viols:
            diagnostics.append(CandidateDiagnosticReport(
                anchor_node_id=0,
                target_subgraph_nodes=[],
                is_fully_compliant=False,
                diagnostic_stage_reached=2,
                violations=basement_viols
            ))

        baseline_evac = self.evac_sim.simulate_evacuation(G_3d)
        opt_res = self.optimizer.optimize_building_design(G_3d, target_time_sec=self.config.target_evacuation_time_sec)

        report_md, ev_json = self.report_gen.generate_official_compliance_report(
            project_title=self.config.project_title,
            diagnostic_reports=diagnostics,
            program=program,
            opt_result=opt_res,
            unit_scale=scale, pruned_candidates=pruned
        )

        # DXF Anotasyonları ve Denetim Tablosu
        annotated_doc = copy.deepcopy(dxf_doc)
        annotated_doc = self.violation_annotator.annotate_violations_on_dxf(annotated_doc, diagnostics, rooms, scale)
        annotated_doc = self.opt_annotator.annotate_optimizations_on_dxf(annotated_doc, opt_res, scale)
        annotated_doc = self.table_annotator.annotate_audit_table_on_dxf(
            annotated_doc, diagnostics, opt_res, rooms, doors, scale, project_title=self.config.project_title, pruned_count=len(pruned)
        )

        return DiagramYonetmelikPipelineOutput(
            unit_scale_to_meters=scale,
            used_line_soup_fallback=False,
            building_3d_result=rag_3d,
            discovered_apartment_motifs=motifs,
            building_program=program,
            verified_escape_cores=verified_cores,
            pruned_candidates=pruned,
            diagnostic_reports=diagnostics,
            baseline_evacuation_report=baseline_evac,
            counterfactual_optimization=opt_res,
            annotated_dxf_document=annotated_doc,
            official_markdown_report=report_md,
            grounded_evidence_json=ev_json,
            execution_metrics=dict(metrics, total_pipeline_latency_sec=time.perf_counter() - start)
        )
