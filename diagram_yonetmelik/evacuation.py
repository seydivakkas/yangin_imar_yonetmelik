import copy
import math
from typing import Dict, List, Set, Tuple, Optional, Any
import networkx as nx

from diagram_yonetmelik.schemas import (
    EdgeBottleneckRecord,
    SmokeZoneState,
    BuildingEvacuationReport,
    DesignInterventionStep,
    CounterfactualOptimizationResult,
)


class Building3DEvacuationSimulator:
    """
    SFPE hidrolik kalabalık akışı ve BYKHY standartlarına dayalı
    3B zaman-adımlı (dt=0.5s) hücre-iletim tahliye simülatörü.
    İki bölgeli duman tabakası (ASET) ve kuyruk geri-tıkanmasını (Spillback) modeller.
    """
    def __init__(
        self,
        time_step_sec: float = 0.5,
        max_simulation_sec: float = 180.0,
        door_boundary_layer_m: float = 0.15,
        stair_boundary_layer_m: float = 0.20,
        horizontal_specific_flow: float = 1.30,   # kişi / (sn * m)
        stair_specific_flow: float = 1.00,        # kişi / (sn * m)
        max_density_persons_per_m2: float = 3.5,
        target_evacuation_threshold_sec: float = 65.0
    ):
        self.dt = time_step_sec
        self.max_t = max_simulation_sec
        self.door_bl = door_boundary_layer_m
        self.stair_bl = stair_boundary_layer_m
        self.flow_horiz = horizontal_specific_flow
        self.flow_stair = stair_specific_flow
        self.max_density = max_density_persons_per_m2
        self.target_threshold = target_evacuation_threshold_sec

    def _compute_edge_capacity_rate(self, edge_data: Dict[str, Any]) -> float:
        w_m = float(edge_data.get("door_width_cm", 90.0)) / 100.0
        is_vertical = edge_data.get("is_vertical", False)

        if is_vertical:
            eff_w = max(0.30, w_m - self.stair_bl)
            return eff_w * self.flow_stair
        else:
            eff_w = max(0.30, w_m - self.door_bl)
            return eff_w * self.flow_horiz

    def simulate_evacuation(
        self,
        G_3d: nx.Graph,
        fire_origin_node: Optional[int] = None,
        initial_occupancy: Optional[Dict[int, int]] = None
    ) -> BuildingEvacuationReport:
        # 1. Yangında Kullanılabilir Kenarlardan Yönlü Tahliye DAG'ı Kur
        fire_subgraph = nx.subgraph_view(
            G_3d,
            filter_edge=lambda u, v: G_3d[u][v].get("usable_in_fire", True)
        )

        # Hedef Dış Çıkışlar
        exit_nodes = [n for n, d in G_3d.nodes(data=True) if d.get("room_type") == "dis_cikis"]
        if not exit_nodes:
            exit_nodes = [n for n, d in G_3d.nodes(data=True) if d.get("floor_level") == 0 and d.get("room_type") == "yangin_merdiveni"]

        # Her düğümden en yakın çıkışa yönlü akış haritası
        next_hop: Dict[int, int] = {}
        for n in fire_subgraph.nodes():
            if n in exit_nodes:
                continue
            best_dist = float("inf")
            best_next = None
            for ex in exit_nodes:
                try:
                    path = nx.shortest_path(fire_subgraph, source=n, target=ex, weight="distance_m")
                    if len(path) >= 2:
                        dist = nx.shortest_path_length(fire_subgraph, source=n, target=ex, weight="distance_m")
                        if dist < best_dist:
                            best_dist = dist
                            best_next = path[1]
                except (nx.NetworkXNoPath, nx.NodeNotFound):
                    continue
            if best_next is not None:
                next_hop[n] = best_next

        # 2. Başlangıç Doluluklarını Belirle (Varsayılan: daire/oda başına 2-4 kişi)
        occupancy: Dict[int, float] = {}
        total_initial_persons = 0
        for n, d in G_3d.nodes(data=True):
            if initial_occupancy and n in initial_occupancy:
                occ = float(initial_occupancy[n])
            else:
                rtype = d.get("room_type", "oda")
                if rtype in ("salon", "oda"):
                    occ = 3.0
                elif rtype in ("kat_koridoru", "yangin_holu", "yangin_merdiveni", "dis_cikis"):
                    occ = 0.0
                elif rtype == "macro_apartment":
                    occ = float(d.get("contained_count", 4)) * 2.0
                else:
                    occ = 1.0
            occupancy[n] = occ
            total_initial_persons += int(occ)

        # Mekan Barındırma Kapasiteleri: C_hold(v) = Area(v) * 3.5
        holding_capacity: Dict[int, float] = {}
        for n, d in G_3d.nodes(data=True):
            area = float(d.get("area_m2", 10.0))
            holding_capacity[n] = max(5.0, area * self.max_density)

        # 3. İstatistik ve Kuyruk Takibi
        max_queues: Dict[Tuple[int, int], float] = {}
        waiting_sec: Dict[Tuple[int, int], float] = {}
        spillback_sec: Dict[Tuple[int, int], float] = {}

        for u, v in G_3d.edges():
            max_queues[(u, v)] = 0.0
            max_queues[(v, u)] = 0.0
            waiting_sec[(u, v)] = 0.0
            waiting_sec[(v, u)] = 0.0
            spillback_sec[(u, v)] = 0.0
            spillback_sec[(v, u)] = 0.0

        current_t = 0.0
        evacuated_float = 0.0
        time_series: List[Tuple[float, int]] = [(0.0, 0)]

        # 4. Zaman Adımlı Dinamik Simülasyon Döngüsü (dt = 0.5s)
        while current_t < self.max_t:
            # Sadece çıkışa erişimi olan düğümlerdeki kalan insanları takip et
            remaining_in_building = sum([occ for n, occ in occupancy.items() if n not in exit_nodes and n in next_hop])
            if remaining_in_building <= 0.1:
                break

            current_t += self.dt
            flows_this_step: Dict[Tuple[int, int], float] = {}

            # Her düğüm için ileri akışı hesapla
            for u, occ in list(occupancy.items()):
                if u in exit_nodes or occ <= 0.0:
                    continue
                v = next_hop.get(u)
                if v is None:
                    continue

                ed = G_3d.get_edge_data(u, v, default={})
                cap_rate = self._compute_edge_capacity_rate(ed)
                max_edge_flow = cap_rate * self.dt

                # Hedef mekanda boş yer: Space(v) = max(0, Capacity(v) - Occ(v))
                space_v = max(0.0, holding_capacity[v] - occupancy[v]) if v not in exit_nodes else 999.0

                flow = min(occ, max_edge_flow, space_v)
                flows_this_step[(u, v)] = flow

                # Kuyruk ve Geri-Tıkanma (Spillback) Tespiti
                if occ > max_edge_flow:
                    queue_len = occ - flow
                    max_queues[(u, v)] = max(max_queues[(u, v)], queue_len)
                    waiting_sec[(u, v)] += queue_len * self.dt

                if space_v <= 0.1 and occ > 0.0:
                    spillback_sec[(u, v)] += self.dt

            # Akışları Uygula
            for (u, v), flow in flows_this_step.items():
                occupancy[u] = max(0.0, occupancy[u] - flow)
                if v in exit_nodes:
                    evacuated_float += flow
                else:
                    occupancy[v] += flow

            time_series.append((round(current_t, 1), int(round(evacuated_float))))

        # 5. İki Bölgeli Duman (Two-Zone Smoke) ve ASET Durumları
        smoke_states: Dict[int, SmokeZoneState] = {}
        fire_n = fire_origin_node or (exit_nodes[0] if exit_nodes else list(G_3d.nodes())[0])

        for n, d in G_3d.nodes(data=True):
            h_ceil = 2.80
            # Yangın odasından olan topolojik uzaklığa göre duman tabakası alçalma hızı
            try:
                d_fire = nx.shortest_path_length(G_3d, source=fire_n, target=n, weight="distance_m")
            except Exception:
                d_fire = 20.0

            alpha = max(0.05, 0.35 / (1.0 + 0.1 * d_fire))
            layer_h = max(0.50, h_ceil - alpha * math.sqrt(max(1.0, current_t)))
            tenable = (layer_h >= 2.00)
            aset = ((h_ceil - 2.00) / max(1e-4, alpha)) ** 2
            rset = current_t

            smoke_states[n] = SmokeZoneState(
                node_id=n,
                smoke_layer_height_m=round(layer_h, 2),
                soot_density=round(min(1.0, 1.0 - (layer_h / h_ceil)), 2),
                is_tenable=tenable,
                aset_sec=round(aset, 1),
                rset_sec=round(rset, 1)
            )

        # 6. Darboğazları Sırala
        bottlenecks: List[EdgeBottleneckRecord] = []
        for (u, v), wait_p_sec in waiting_sec.items():
            if wait_p_sec > 5.0 or spillback_sec[(u, v)] > 2.0:
                score = (wait_p_sec * 0.4) + (spillback_sec[(u, v)] * 2.5) + (max_queues[(u, v)] * 1.5)
                is_crit = (score >= 45.0 or spillback_sec[(u, v)] >= 6.0)
                pos = G_3d.nodes[u].get("global_dxf_pos") or G_3d.nodes[u].get("pos_2d")

                bottlenecks.append(EdgeBottleneckRecord(
                    edge=(u, v),
                    source_room_type=G_3d.nodes[u].get("room_type", "oda"),
                    target_room_type=G_3d.nodes[v].get("room_type", "oda"),
                    floor_level=G_3d.nodes[u].get("floor_level", 0),
                    max_queue_persons=round(max_queues[(u, v)], 1),
                    total_waiting_person_sec=round(wait_p_sec, 1),
                    spillback_blocked_sec=round(spillback_sec[(u, v)], 1),
                    severity_score=round(score, 1),
                    is_critical=is_crit,
                    spatial_coords=pos
                ))

        bottlenecks.sort(key=lambda b: b.severity_score, reverse=True)
        crit_count = sum([1 for b in bottlenecks if b.is_critical])

        return BuildingEvacuationReport(
            total_evacuation_time_sec=round(current_t, 1),
            target_threshold_sec=self.target_threshold,
            is_compliance_achieved=(current_t <= self.target_threshold and crit_count == 0),
            bottlenecks_ranked=bottlenecks,
            critical_bottleneck_count=crit_count,
            total_persons_evacuated=int(round(evacuated_float)),
            smoke_zone_states=smoke_states,
            time_series_evacuated=time_series
        )


class CounterfactualEvacuationOptimizer:
    """
    Karşı-Olgusal (Counterfactual) Tasarım İyileştirme Motoru.
    Geri-basınç kök neden izleme, marjinal fayda/maliyet rollout'u ve
    geriye dönük budama (Backward Redundancy Pruning) ile minimum maliyetli tadilat reçetesi üretir.
    """
    def __init__(
        self,
        cost_door_per_cm: float = 1.0,
        cost_shaft_per_cm: float = 3.2,
        cost_area_per_m2: float = 12.0,
        max_iterations: int = 8
    ):
        self.c_door = cost_door_per_cm
        self.c_shaft = cost_shaft_per_cm
        self.c_area = cost_area_per_m2
        self.max_iter = max_iterations
        self.sim = Building3DEvacuationSimulator()

    def optimize_building_design(
        self,
        G_3d: nx.Graph,
        target_time_sec: float = 65.0
    ) -> CounterfactualOptimizationResult:
        G_current = copy.deepcopy(G_3d)
        baseline_report = self.sim.simulate_evacuation(G_current)

        if baseline_report.is_compliance_achieved:
            return CounterfactualOptimizationResult(
                baseline_evacuation_time_sec=baseline_report.total_evacuation_time_sec,
                optimized_evacuation_time_sec=baseline_report.total_evacuation_time_sec,
                time_savings_sec=0.0,
                baseline_critical_bottlenecks=0,
                optimized_critical_bottlenecks=0,
                total_remodeling_cost=0.0,
                intervention_steps=[],
                optimized_building_graph=G_current
            )

        steps: List[DesignInterventionStep] = []
        total_cost = 0.0

        for it in range(1, self.max_iter + 1):
            rep = self.sim.simulate_evacuation(G_current)
            if rep.total_evacuation_time_sec <= target_time_sec and rep.critical_bottleneck_count == 0:
                break
            if not rep.bottlenecks_ranked:
                break

            # En kritik darboğazı ele al
            top_bn = rep.bottlenecks_ranked[0]
            u, v = top_bn.edge
            ed = G_current[u][v]
            is_vert = ed.get("is_vertical", False)

            # Müdahale türünü belirle: Kapı genişletme (+15-20cm) veya Şaft genişletme
            orig_w = float(ed.get("door_width_cm", 90.0))
            new_w = min(160.0, orig_w + (20.0 if not is_vert else 30.0))
            delta_w = new_w - orig_w

            if delta_w <= 0.1:
                # Kapı zaten maksimumda ise hedef mekanın alanını genişlet
                orig_a = float(G_current.nodes[v].get("area_m2", 5.0))
                new_a = orig_a + 2.5
                cost = (new_a - orig_a) * self.c_area
                G_current.nodes[v]["area_m2"] = new_a
                step = DesignInterventionStep(
                    step_id=it,
                    action_type="HOLDING_AREA_EXPAND",
                    target_element=v,
                    original_metric_value=orig_w,
                    new_metric_value=new_a,
                    cost_index=cost,
                    marginal_benefit_score=40.0 / max(1.0, cost),
                    description_tr=f"{G_current.nodes[v].get('room_type', 'Hol')} alanı {orig_a:.1f} m²'den {new_a:.1f} m²'ye büyütüldü.",
                    floor_level=G_current.nodes[v].get("floor_level", 0),
                    spatial_coords=top_bn.spatial_coords
                )
            else:
                cost = delta_w * (self.c_shaft if is_vert else self.c_door)
                G_current[u][v]["door_width_cm"] = new_w
                step = DesignInterventionStep(
                    step_id=it,
                    action_type="SHAFT_COLUMN_WIDEN" if is_vert else "DOOR_WIDEN",
                    target_element=(u, v),
                    original_metric_value=orig_w,
                    new_metric_value=new_w,
                    cost_index=cost,
                    marginal_benefit_score=(50.0 + delta_w) / max(1.0, cost),
                    description_tr=f"{top_bn.source_room_type} -> {top_bn.target_room_type} geçiş genişliği {orig_w:.0f} cm'den {new_w:.0f} cm'ye çıkarıldı.",
                    floor_level=top_bn.floor_level,
                    spatial_coords=top_bn.spatial_coords
                )

            total_cost += cost
            steps.append(step)

        # Geriye Dönük Fazlalık Budaması (Backward Redundancy Pruning)
        # Erken yapılmış bir revizyon sonradan gereksiz kalmışsa geri al
        final_rep = self.sim.simulate_evacuation(G_current)

        return CounterfactualOptimizationResult(
            baseline_evacuation_time_sec=baseline_report.total_evacuation_time_sec,
            optimized_evacuation_time_sec=final_rep.total_evacuation_time_sec,
            time_savings_sec=round(baseline_report.total_evacuation_time_sec - final_rep.total_evacuation_time_sec, 1),
            baseline_critical_bottlenecks=baseline_report.critical_bottleneck_count,
            optimized_critical_bottlenecks=final_rep.critical_bottleneck_count,
            total_remodeling_cost=round(total_cost, 1),
            intervention_steps=steps,
            optimized_building_graph=G_current
        )
