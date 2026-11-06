"""
DiagramYönetmelik — Nöro-Sembolik Çok Katlı Mekânsal Denetim, 3B RAG ve Yangın/Tahliye Simülasyon Motoru
Telif Hakkı (c) 2026 Seydi Eryılmaz (@seydivakkas) — Tüm Hakları Saklıdır.
"""

from diagram_yonetmelik.schemas import (
    RoomPolygonInput,
    DoorGeometryInput,
    RuleViolationItem,
    CandidateDiagnosticReport,
    DiscoveredArchitecturalMotif,
    BuildingProgramSummary,
    MacroNodeRecord,
    CoarsenedBuildingResult,
    EdgeBottleneckRecord,
    SmokeZoneState,
    BuildingEvacuationReport,
    DesignInterventionStep,
    CounterfactualOptimizationResult,
    RegulatoryClauseChunk,
    RetrievedLegalEvidence,
    PipelineConfig,
    DiagramYonetmelikPipelineOutput,
    FloorClusterInfo,
    VerticalShaftLink,
    Building3DRAGResult,
)

from diagram_yonetmelik.cad_ingest import (
    TurkishArchitecturalLabelClassifier,
    WallLinePolygonizer,
    DXFFloorplanParser,
)

from diagram_yonetmelik.cv_analyzer import (
    FloorplanImageAnalyzer,
)

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
    extract_anchored_k_hop,
)

from diagram_yonetmelik.subgraph_dataset import (
    SubgraphPairData,
    split_pair_batch,
    SpatialRAGSubgraphDataset,
    build_sample_architectural_rag,
)

from diagram_yonetmelik.spminer import (
    ArchitecturalSPMiner,
    ArchitecturalGraphCoarsener,
)

from diagram_yonetmelik.vf2_diagnostics import (
    ExplainableVF2Analyzer,
)

from diagram_yonetmelik.basement_audit import (
    BasementComplianceAuditor,
)

from diagram_yonetmelik.multi_floor_auditor import (
    MultiFloorComprehensiveAuditor,
)

from diagram_yonetmelik.evacuation import (
    Building3DEvacuationSimulator,
    CounterfactualEvacuationOptimizer,
)

from diagram_yonetmelik.dxf_annotator import (
    DXFViolationAnnotator,
    DXFOptimizationAnnotator,
)

from diagram_yonetmelik.regulatory_rag import (
    build_turkish_building_regulations_corpus,
    build_siginak_and_otopark_corpus,
    HybridRegulatoryRetriever,
    RegulatoryComplianceReportGenerator,
    LocalRegulatoryReportGenerator,
)

from diagram_yonetmelik.orchestrator import (
    DiagramYonetmelikPipeline,
)

from diagram_yonetmelik.sample_generator import (
    generate_sample_building_dxf,
    generate_sample_floorplan_image,
)

__version__ = "2.0.0"
__author__ = "Seydi Eryılmaz (@seydivakkas)"
