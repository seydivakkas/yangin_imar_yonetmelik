from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Set, Tuple, Optional, Any
from shapely.geometry import Polygon, LineString, Point
import networkx as nx

# =====================================================================
# 1. CAD VE GEOMETRİK GİRDİ VERİ YAPILARI
# =====================================================================

@dataclass
class RoomPolygonInput:
    room_id: int
    room_type: str                  # 'salon', 'oda', 'kat_koridoru', 'yangin_holu', 'siginak', vb.
    polygon: Polygon                # Oda iç net sınır poligonu
    name_label: str = ""            # Metin etiketi (Örn: "Z-04 YANGIN HOLÜ")
    floor_level: int = 0            # Kat kotu / numarası (-1: Bodrum, 0: Zemin, 1+: Normal Kat)
    global_dxf_pos: Tuple[float, float] = (0.0, 0.0)  # Orijinal DXF dünya koordinatı


@dataclass
class DoorGeometryInput:
    door_id: int
    geometry: LineString            # Kapı eşik çizgisi
    width_cm: Optional[float] = None # None ise doğrudan LineString uzunluğundan hesaplanır
    is_fire_resistant: bool = False  # DXF katmanı/blok adı 'YANGIN_KAPISI' / 'EI60' ise True
    door_layer: str = "A-DOOR"
    floor_level: int = 0
    connected_rooms: Tuple[int, int] = (-1, -1)
    global_portal_xy: Tuple[float, float] = (0.0, 0.0)


# =====================================================================
# 2. 3B BİNA VE TOPOLOJİ SONUÇ YAPILARI
# =====================================================================

@dataclass
class FloorClusterInfo:
    floor_index: int
    floor_level: int
    title_label: str
    elevation_z_m: float
    boundary_box: Tuple[float, float, float, float]
    core_anchor_xy: Tuple[float, float]
    rooms_count: int
    doors_count: int


@dataclass
class VerticalShaftLink:
    shaft_type: str                 # 'yangin_merdiveni' veya 'asansor'
    lower_node_id: int
    upper_node_id: int
    lower_floor_level: int
    upper_floor_level: int
    effective_walking_distance_m: float
    usable_in_fire: bool = True


@dataclass
class Building3DRAGResult:
    G_3d: nx.Graph
    floor_clusters: List[FloorClusterInfo]
    vertical_shaft_links: List[VerticalShaftLink]
    total_floors: int
    total_rooms: int
    total_doors: int
    total_vertical_links: int


# =====================================================================
# 3. YÖNETMELİK İHLAL VE TEŞHİS YAPILARI
# =====================================================================

@dataclass
class RuleViolationItem:
    violation_code: str             # 'DOOR_WIDTH_DEFICIT', 'ROOM_TYPE_MISMATCH', vb.
    target_node_id: Optional[int] = None
    target_edge: Optional[Tuple[int, int]] = None
    expected_value: Any = None
    actual_value: Any = None
    diagnostic_stage: int = 1       # 1: Parametrik, 2: Oda Rolü, 3: Topolojik Kopukluk
    severity: str = "CRITICAL"      # 'CRITICAL', 'WARNING', 'INFO'
    description_tr: str = ""
    remedy_recommendation_tr: str = ""
    regulation_reference: str = ""  # 'BYKHY Madde 34', 'Planlı Alanlar Madde 29', vb.
    floor_level: int = 0
    spatial_coords: Optional[Tuple[float, float]] = None


@dataclass
class CandidateDiagnosticReport:
    anchor_node_id: int
    target_subgraph_nodes: List[int]
    is_fully_compliant: bool
    diagnostic_stage_reached: int
    violations: List[RuleViolationItem] = field(default_factory=list)
    partial_node_mapping: Dict[int, int] = field(default_factory=dict)
    summary_message: str = ""
    gnn_energy: Optional[float] = None


# =====================================================================
# 4. SPMINER VE HİYERARŞİK GRAF SIKIŞTIRMA YAPILARI
# =====================================================================

@dataclass
class DiscoveredArchitecturalMotif:
    motif_id: int
    motif_graph: nx.Graph
    support: int
    root_room_type: str
    wl_hash: str
    matched_anchor_nodes: List[int]
    total_nodes: int


@dataclass
class BuildingProgramSummary:
    total_apartments: int = 0
    apartment_types_breakdown: Dict[str, int] = field(default_factory=dict)
    total_residential_area_m2: float = 0.0
    common_circulation_area_m2: float = 0.0
    total_shelter_area_m2: float = 0.0
    total_parking_capacity: int = 0
    required_shelter_area_m2: float = 0.0
    required_parking_stalls: int = 0
    estimated_occupancy_persons: int = 0


@dataclass
class MacroNodeRecord:
    macro_node_id: int
    motif_id: int
    contained_original_nodes: List[int]
    internal_subgraph_snapshot: nx.Graph
    portal_boundary_doors: List[Tuple[int, int, Dict]]
    total_macro_area_m2: float
    internal_max_escape_m: float
    floor_level: int


@dataclass
class CoarsenedBuildingResult:
    G_coarsened: nx.Graph
    macro_node_registry: Dict[int, MacroNodeRecord]
    original_node_count: int
    coarsened_node_count: int
    compression_ratio: float


# =====================================================================
# 5. TAHLİYE SİMÜLASYONU VE KARŞI-OLGUSAL OPTİMİZASYON
# =====================================================================

@dataclass
class EdgeBottleneckRecord:
    edge: Tuple[int, int]
    source_room_type: str
    target_room_type: str
    floor_level: int
    max_queue_persons: float
    total_waiting_person_sec: float
    spillback_blocked_sec: float
    severity_score: float
    is_critical: bool
    spatial_coords: Optional[Tuple[float, float]] = None


@dataclass
class SmokeZoneState:
    node_id: int
    smoke_layer_height_m: float     # Tavandan aşağıya doğru alçalan duman tabakası (m)
    soot_density: float             # Duman optik yoğunluğu (0.0 - 1.0)
    is_tenable: bool                # Hayatta kalınabilir mi (Z_layer >= 2.00m)
    aset_sec: float                 # Available Safe Egress Time (sn)
    rset_sec: float                 # Required Safe Egress Time (sn)


@dataclass
class BuildingEvacuationReport:
    total_evacuation_time_sec: float
    target_threshold_sec: float
    is_compliance_achieved: bool
    bottlenecks_ranked: List[EdgeBottleneckRecord]
    critical_bottleneck_count: int
    total_persons_evacuated: int
    smoke_zone_states: Dict[int, SmokeZoneState] = field(default_factory=dict)
    time_series_evacuated: List[Tuple[float, int]] = field(default_factory=list)


@dataclass
class DesignInterventionStep:
    step_id: int
    action_type: str                # 'DOOR_WIDEN', 'SHAFT_COLUMN_WIDEN', 'HOLDING_AREA_EXPAND'
    target_element: Any             # edge Tuple veya node int
    original_metric_value: float
    new_metric_value: float
    cost_index: float
    marginal_benefit_score: float
    description_tr: str
    floor_level: int = 0
    spatial_coords: Optional[Tuple[float, float]] = None


@dataclass
class CounterfactualOptimizationResult:
    baseline_evacuation_time_sec: float
    optimized_evacuation_time_sec: float
    time_savings_sec: float
    baseline_critical_bottlenecks: int
    optimized_critical_bottlenecks: int
    total_remodeling_cost: float
    intervention_steps: List[DesignInterventionStep]
    optimized_building_graph: nx.Graph


# =====================================================================
# 6. MEVZUAT RAG VE RAPORLAMA YAPILARI
# =====================================================================

@dataclass
class RegulatoryClauseChunk:
    chunk_id: str
    regulation_code: str            # 'tr_yangin', 'tr_imar', 'tr_siginak', 'tr_otopark'
    article_title: str
    clause_hierarchy: str
    text_tr: str
    legal_mandatory_status: str     # 'ZORUNLU', 'TAVSIYE'
    numerical_limits: Dict[str, float] = field(default_factory=dict)
    relevant_room_types: List[str] = field(default_factory=list)
    relevant_violation_codes: List[str] = field(default_factory=list)
    # 404 Korumalı Kanonik URL ve Canlı Senkronizasyon Alanları
    article_number: str = ""
    official_text: str = ""
    mandatory_threshold_summary: Dict[str, Any] = field(default_factory=dict)
    official_source_url: str = ""
    official_page_url: str = ""
    fallback_search_url: str = ""
    sha256_hash: str = ""
    last_synced_at: Optional[str] = None


@dataclass
class RetrievedLegalEvidence:
    clause_chunk: RegulatoryClauseChunk
    lexical_bm25_score: float
    semantic_cosine_score: float
    hybrid_score: float
    applied_to_violation_code: str
    official_source_url: str = ""
    fallback_search_url: str = ""


# =====================================================================
# 7. ORKESTRATÖR VE PİPELİNE ÇIKTI YAPILARI
# =====================================================================

@dataclass
class PipelineConfig:
    project_title: str = "DiagramYönetmelik - Çok Katlı Mekânsal Denetim ve 3D Tahliye Motoru"
    k_hops_gnn: int = 2
    gnn_violation_threshold: float = 0.25
    spminer_min_support: int = 2
    max_escape_route_distance_m: float = 30.0
    target_evacuation_time_sec: float = 65.0
    prefer_local_llm: bool = False
    local_llm_endpoint: str = "http://localhost:11434/v1/chat/completions"
    local_llm_model: str = "qwen2.5:14b"
    max_wall_thickness_m: float = 0.35
    default_unit_scale_to_m: float = 0.01  # varsayılan cm -> m
    default_floor_height_m: float = 3.0
    high_rise_threshold_m: float = 21.50


@dataclass
class DiagramYonetmelikPipelineOutput:
    unit_scale_to_meters: float
    used_line_soup_fallback: bool
    building_3d_result: Building3DRAGResult
    discovered_apartment_motifs: List[DiscoveredArchitecturalMotif]
    building_program: BuildingProgramSummary
    verified_escape_cores: List[int]
    diagnostic_reports: List[CandidateDiagnosticReport]
    baseline_evacuation_report: BuildingEvacuationReport
    counterfactual_optimization: CounterfactualOptimizationResult
    annotated_dxf_document: Optional[Any]   # ezdxf.Drawing
    official_markdown_report: str
    grounded_evidence_json: dict
    execution_metrics: Dict[str, float]
    dxf_output_path: Optional[str] = None
    cv_debug_vis: Optional[Any] = None
    cv_heatmap_vis: Optional[Any] = None
    cv_image_path: Optional[str] = None
