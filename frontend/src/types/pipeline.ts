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
  rule_id: string;
  category: string;
  severity: 'critical' | 'major' | 'minor' | 'info';
  description: string;
  target_id: string;
  target_type: string;
  legal_basis: string;
  floor_level?: number;
  suggested_fix?: string;
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
  total_area_m2: number;
  room_count_by_type: Record<string, number>;
  floor_count: number;
  vertical_core_count: number;
}

export interface MacroNodeRecord {
  macro_id: string;
  floor_level: number;
  member_rooms: string[];
  internal_exit_depth_m: number;
  boundary_portals: string[];
}

export interface EdgeBottleneckRecord {
  door_id: string;
  flow_capacity_pers_s: number;
  peak_queue_length: number;
  total_waiting_time_s: number;
  is_spillback_trigger: boolean;
}

export interface SmokeZoneState {
  time_s: number;
  smoke_layer_height_m: number;
  upper_layer_temp_c: number;
  optical_density_od_m: number;
  aset_threshold_exceeded: boolean;
}

export interface BuildingEvacuationReport {
  total_evacuation_time_s: number;
  max_flow_rate_pers_s: number;
  total_occupants: number;
  bottleneck_doors: EdgeBottleneckRecord[];
  smoke_hazard_timeline: SmokeZoneState[];
  aset_vs_rset_margin_s: number;
}

export interface DesignInterventionStep {
  step_id: string;
  action_type: string;
  target_element_id: string;
  parameter_name: string;
  delta_value: number;
  estimated_cost_try: number;
  delta_evacuation_time_s: number;
}

export interface CounterfactualOptimizationResult {
  original_evacuation_time_s: number;
  optimized_evacuation_time_s: number;
  time_saved_s: number;
  applied_interventions: DesignInterventionStep[];
  remaining_violations: string[];
}

export interface RegulatoryClauseChunk {
  clause_id: string;
  regulation_name: string;
  article_number: string;
  full_text: string;
  keywords: string[];
}

export interface DiagramYonetmelikPipelineOutput {
  pipeline_id: string;
  timestamp: string;
  building_name: string;
  floors_analyzed: number[];
  rooms_analyzed: number;
  doors_analyzed: number;
  graph_3d_summary: {
    node_count: number;
    edge_count: number;
    floors: number[];
    vertical_shafts: number;
    fire_elevators_excluded: boolean;
  };
  building_program: BuildingProgramSummary;
  spminer_macro_nodes: MacroNodeRecord[];
  vf2_diagnostics: CandidateDiagnosticReport[];
  basement_compliance: RuleViolationItem[];
  evacuation_report: BuildingEvacuationReport;
  counterfactual_optimization: CounterfactualOptimizationResult;
  dxf_annotated_path?: string;
  regulatory_official_report: string;
  cv_image_analysis?: {
    image_shape: [number, number];
    detected_rooms_count: number;
    detected_doors_count: number;
    heatmap_generated: boolean;
  };
}

export type ActiveTab =
  | 'overview'
  | 'cad_polygon'
  | 'building_graph'
  | 'spminer'
  | 'fire_audit'
  | 'basement_audit'
  | 'evacuation'
  | 'optimization'
  | 'dxf_preview'
  | 'regulatory_report'
  | 'cv_image';

export type CameraPreset = 'isometric' | 'top_down' | 'side_elevation' | 'first_person';
export type WallHeightMode = 'full' | 'cut' | 'slab';
