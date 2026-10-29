export interface RoomPolygonInput {
  room_id: string;
  name: string;
  floor_level: number;
  area_m2: number;
  polygon_coords: [number, number][];
  category: string;
}

export interface DoorGeometryInput {
  door_id: string;
  from_room: string;
  to_room: string;
  width_m: number;
  center_xy: [number, number];
  is_exit: boolean;
  is_stair: boolean;
  swing_direction: string;
}

export interface RuleViolationItem {
  rule_id?: string;
  code?: string;
  category?: string;
  severity: 'CRITICAL' | 'MAJOR' | 'WARNING' | 'critical' | 'major' | 'minor' | 'info';
  description?: string;
  description_tr?: string;
  target_id?: string;
  target_node?: number;
  target_edge?: [number, number];
  target_type?: string;
  legal_basis?: string;
  regulation?: string;
  floor_level?: number;
  suggested_fix?: string;
  remedy?: string;
  actual_value?: any;
  expected_value?: any;
  spatial_coords?: [number, number] | [number, number, number];
}

export interface CandidateDiagnosticReport {
  query_name: string;
  is_compliant: boolean;
  violation_energy: number;
  candidate_subgraph_nodes: string[];
  monomorphism_relaxation_stage: number;
  floor_level?: number;
  root_cause_category?: string;
  violated_constraints: string[];
}

export interface BuildingProgramSummary {
  total_area_m2?: number;
  room_count_by_type?: Record<string, number>;
  floor_count?: number;
  vertical_core_count?: number;
  total_apartments?: number;
  estimated_occupancy_persons?: number;
  total_residential_area_m2?: number;
  common_circulation_area_m2?: number;
  required_shelter_area_m2?: number;
  total_shelter_area_m2?: number;
  required_parking_stalls?: number;
  total_parking_capacity?: number;
}

export interface MacroNodeRecord {
  macro_id: string;
  floor_level: number;
  member_rooms: string[];
  internal_exit_depth_m: number;
  boundary_portals: string[];
  total_area_m2?: number;
  module_type?: string;
  member_count?: number;
  motif_id?: number;
}

export interface EdgeBottleneckRecord {
  door_id?: string;
  edge?: [number, number];
  flow_capacity_pers_s?: number;
  peak_queue_length?: number;
  max_queue_persons?: number;
  total_waiting_time_s?: number;
  spillback_blocked_sec?: number;
  is_spillback_trigger?: boolean;
  severity_score?: number;
  is_critical?: boolean;
}

export interface SmokeZoneState {
  time_s?: number;
  smoke_layer_height_m?: number;
  upper_layer_temp_c?: number;
  optical_density_od_m?: number;
  soot_density?: number;
  is_tenable?: boolean;
  aset_threshold_exceeded?: boolean;
  aset_sec?: number;
  rset_sec?: number;
}

export interface BuildingEvacuationReport {
  total_evacuation_time_s?: number;
  total_evacuation_time_sec?: number;
  max_flow_rate_pers_s?: number;
  total_occupants?: number;
  bottleneck_doors?: EdgeBottleneckRecord[];
  bottlenecks_ranked?: EdgeBottleneckRecord[];
  smoke_hazard_timeline?: SmokeZoneState[];
  smoke_zone_states?: Record<string, SmokeZoneState>;
  aset_vs_rset_margin_s?: number;
}

export interface DesignInterventionStep {
  step_id: string;
  action_type: string;
  target_element_id?: string;
  target?: string;
  parameter_name?: string;
  delta_value?: number;
  original_metric_value?: any;
  new_metric_value?: any;
  cost_index?: number;
  estimated_cost_try?: number;
  delta_evacuation_time_s?: number;
  marginal_benefit_score?: number;
  description_tr?: string;
  floor_level?: number;
}

export interface CounterfactualOptimizationResult {
  original_evacuation_time_s?: number;
  baseline_evacuation_time_sec?: number;
  optimized_evacuation_time_s?: number;
  optimized_evacuation_time_sec?: number;
  time_saved_s?: number;
  time_savings_sec?: number;
  total_remodeling_cost?: number;
  applied_interventions?: DesignInterventionStep[];
  intervention_steps?: DesignInterventionStep[];
  remaining_violations?: string[];
}

export interface DiagramYonetmelikPipelineOutput {
  metadata?: {
    title: string;
    total_floors: number;
    total_rooms: number;
    total_doors: number;
    verified_cores: number;
    latency: Record<string, number>;
  };
  program?: {
    total_apartments: number;
    est_persons: number;
    residential_area_m2: number;
    circulation_area_m2: number;
    required_shelter_m2: number;
    required_parking: number;
  };
  nodes?: any[];
  edges?: any[];
  violations?: any[];
  evacuation?: any;
  optimization?: any;
  report_markdown?: string;
  evidence_json?: any;
  dxf_export_info?: {
    filename: string;
    active_pafta_name: string;
    total_entities: number;
    dxf_version: string;
    unit_scale: string;
    compliance_status: 'UYGUN' | 'IHLAL_VAR';
    total_violations: number;
    total_interventions: number;
    layers: Array<{
      name: string;
      aci_color: number;
      color_name: string;
      color_hex: string;
      lineweight: number;
      entity_count: number;
      description: string;
      status_text: string;
    }>;
    cad_table?: {
      title: string;
      stamp: string;
      is_compliant: boolean;
      author: string;
      license: string;
    };
  };

  // Legacy fields
  pipeline_id?: string;
  timestamp?: string;
  building_name?: string;
  floors_analyzed?: number[];
  rooms_analyzed?: number;
  doors_analyzed?: number;
  graph_3d_summary?: {
    node_count: number;
    edge_count: number;
    floors: number[];
    total_floors?: number;
    vertical_shafts: number;
    vertical_links?: Array<{
      shaft_type: string;
      lower_node: number | string;
      upper_node: number | string;
      lower_floor: number;
      upper_floor: number;
      walking_distance_m: number;
      usable_in_fire: boolean;
    }>;
    vertical_edges?: number;
    horizontal_edges?: number;
    exit_nodes_count?: number;
    stair_nodes_count?: number;
    hall_nodes_count?: number;
    fire_elevators_count?: number;
    fire_elevators_excluded: boolean;
    stair_walking_factor?: number;
    floor_height_m?: number;
  };
  building_program?: BuildingProgramSummary;
  spminer_macro_nodes?: MacroNodeRecord[];
  vf2_diagnostics?: CandidateDiagnosticReport[];
  basement_compliance?: RuleViolationItem[];
  evacuation_report?: BuildingEvacuationReport;
  counterfactual_optimization?: CounterfactualOptimizationResult;
  dxf_annotated_path?: string;
  regulatory_official_report?: string;
  cv_image_analysis?: {
    image_shape: [number, number];
    detected_rooms_count: number;
    detected_doors_count: number;
    heatmap_generated: boolean;
  };
}

export interface RegulationMetadata {
  code: string;
  name: string;
  short_desc: string;
  enacted_date: string;
  official_gazette_no: string;
  decree_no: string;
  official_url: string;
  color: string;
  total_articles?: number;
  articles_list?: {
    article_id: string;
    article_number: string;
    article_title: string;
    chapter: string;
  }[];
}

export interface RegulationArticleDetail {
  article_id: string;
  regulation_code: string;
  regulation_name: string;
  article_number: string;
  article_title: string;
  chapter: string;
  official_gazette: string;
  official_url: string;
  full_text_tr: string;
  mandatory_status: string;
  numerical_parameters: Record<string, any>;
  architectural_checklist: string[];
  design_guidance_tr: string;
  associated_violation_codes: string[];
  tags: string[];
  official_iframe_url?: string;
  official_page_url?: string;
  fallback_search_url?: string;
  sha256_hash?: string;
  last_synced_at?: string;
  official_text?: string;
  mandatory_threshold_summary?: {
    thresholds_found?: string[];
    count?: number;
    summary?: string;
  };
}

export type BuildingOccupancyClass =
  | 'konut'
  | 'hastane_saglik'
  | 'egitim_okul'
  | 'otel_konaklama'
  | 'toplanma_ticari'
  | 'endustri_depo';

export interface ChecklistVerificationItem {
  item_id: string;
  category_id: string;
  title_tr: string;
  legal_basis: string;
  mandatory_rule: string;
  target_value_str: string;
  actual_value_str: string;
  is_compliant: boolean;
  severity: 'CRITICAL' | 'MAJOR' | 'WARNING' | 'INFO';
  design_remedy_tr: string;
  details?: Record<string, any>;
}

export interface ComprehensiveBuildingChecklistReport {
  building_occupancy: BuildingOccupancyClass;
  occupancy_title: string;
  sprinkler_enabled: boolean;
  building_height_m: number;
  total_floors: number;
  is_high_rise: boolean;
  total_checks: number;
  passed_checks: number;
  failed_checks: number;
  compliance_score_percent: number;
  categories: Record<string, ChecklistVerificationItem[]>;
  critical_violations: {
    item_id: string;
    title_tr: string;
    legal_basis: string;
    actual_value_str: string;
    target_value_str: string;
    severity: string;
    design_remedy_tr: string;
  }[];
}

export type ActiveTab =
  | 'overview'
  | 'cad_polygon'
  | 'building_graph'
  | 'spminer'
  | 'fire_audit'
  | 'fire_checklist'
  | 'basement_audit'
  | 'evacuation'
  | 'optimization'
  | 'dxf_preview'
  | 'regulatory_report'
  | 'regulatory_library'
  | 'cv_image';

export type CameraPreset = 'isometric' | 'top_down' | 'side_elevation' | 'first_person';
export type WallHeightMode = 'full' | 'cut' | 'slab';

