import copy
import heapq
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


# Duman modeli bu bölgelerin yangın kapılarıyla korunduğunu varsayar; ayrı bir duman sızıntısı hesabı yoktur.
SMOKE_PROTECTED_ZONES = ("yangin_holu", "yangin_merdiveni", "dis_cikis")


class Building3DEvacuationSimulator:
    """
    SFPE hidrolik kalabalık akışı ve BYKHY standartlarına dayalı
    3B zaman-adımlı (dt=0.5s) hücre-iletim tahliye simülatörü.
    İki bölgeli duman tabakası (ASET) ve kuyruk geri-tıkanmasını (Spillback) modeller.
    """
    def __init__(
        self,
        time_step_sec: float = 0.5,
        max_simulation_sec: float = 900.0,
        door_boundary_layer_m: float = 0.15,
        stair_boundary_layer_m: float = 0.20,
        horizontal_specific_flow: float = 1.30,   # kişi / (sn * m)
        stair_specific_flow: float = 1.00,        # kişi / (sn * m)
        max_density_persons_per_m2: float = 3.5,
        target_evacuation_threshold_sec: float = 65.0,
        horizontal_walking_speed_mps: float = 1.19,  # SFPE serbest akış, koridor
        stair_walking_speed_mps: float = 0.85,       # SFPE serbest akış, 7.5"/10" basamak
        ceiling_height_m: float = 2.80,
        critical_smoke_height_m: float = 1.80
    ):
        self.ceiling_h = ceiling_height_m
        self.critical_smoke_h = critical_smoke_height_m
        self.walk_horiz = horizontal_walking_speed_mps
        self.walk_stair = stair_walking_speed_mps
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
            eff_w = max(0.30, w_m - 2 * self.stair_bl)
            return eff_w * self.flow_stair
        else:
            eff_w = max(0.30, w_m - 2 * self.door_bl)
            return eff_w * self.flow_horiz

    def _compute_edge_travel_time(self, edge_data: Dict[str, Any]) -> float:
        distance_m = max(0.0, float(edge_data.get("distance_m", 1.0)))
        speed = self.walk_stair if edge_data.get("is_vertical", False) else self.walk_horiz
        return distance_m / speed

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
                elif rtype in (
                    "kat_koridoru", "yangin_holu", "yangin_merdiveni", "dis_cikis",
                    "asansor", "yangin_asansoru", "dikey_cekirdek", "teknik_saft"
                ):
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

        # Çıkışa yolu olmayan düğümlerdeki kişiler hiçbir zaman tahliye edilemez.
        unreachable_occupied = sorted(
            [n for n, occ in occupancy.items() if occ > 0.0 and n not in exit_nodes and n not in next_hop],
            key=str
        )
        trapped_float = sum(occupancy[n] for n in unreachable_occupied)
        total_persons_float = sum(occupancy.values())

        # Yangın başlangıcı verilmediyse tahliye başlamadan en kalabalık (eşitlikte en büyük) oda seçilir.
        fire_n = fire_origin_node
        if fire_n is None and G_3d.number_of_nodes() > 0:
            occupied = [n for n, occ in occupancy.items() if occ > 0.0 and G_3d.nodes[n].get("room_type") not in SMOKE_PROTECTED_ZONES]
            fire_n = max(occupied or list(G_3d.nodes()), key=lambda n: (occupancy[n], float(G_3d.nodes[n].get("area_m2", 0.0)), str(n)))
        last_occupied: Dict[Any, float] = {n: 0.0 for n in G_3d.nodes()}

        current_t = 0.0
        evacuated_float = 0.0
        time_series: List[Tuple[float, int]] = [(0.0, 0)]

        # Kapıdan geçip bir sonraki mekâna yürüyen kişiler: (varış_zamanı, sıra, hedef, kişi)
        in_transit: List[Tuple[float, int, Any, float]] = []
        inbound_persons: Dict[Any, float] = {}
        transit_seq = 0
        reachable_finished = False

        # 4. Zaman Adımlı Dinamik Simülasyon Döngüsü (dt = 0.5s)
        while True:
            # Sadece çıkışa erişimi olan düğümlerdeki ve yolda olan insanları takip et
            remaining_in_building = sum([occ for n, occ in occupancy.items() if n not in exit_nodes and n in next_hop])
            remaining_in_building += sum(entry[3] for entry in in_transit)
            if remaining_in_building <= 0.1:
                reachable_finished = True
                break
            if current_t >= self.max_t:
                break

            current_t += self.dt

            # Yürüyüşünü bitiren kişileri hedef mekâna veya dış çıkışa al
            while in_transit and in_transit[0][0] <= current_t + 1e-9:
                _, _, arrived_v, arrived_persons = heapq.heappop(in_transit)
                if arrived_v in exit_nodes:
                    evacuated_float += arrived_persons
                else:
                    inbound_persons[arrived_v] -= arrived_persons
                    occupancy[arrived_v] += arrived_persons

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

                # Hedef mekanda boş yer: Space(v) = max(0, Capacity(v) - Occ(v) - Yoldakiler(v))
                if v in exit_nodes:
                    space_v = 999.0
                else:
                    space_v = max(0.0, holding_capacity[v] - occupancy[v] - inbound_persons.get(v, 0.0))

                flow = min(occ, max_edge_flow, space_v)
                flows_this_step[(u, v)] = flow
                if v not in exit_nodes:
                    inbound_persons[v] = inbound_persons.get(v, 0.0) + flow

                # Kuyruk ve Geri-Tıkanma (Spillback) Tespiti
                if occ > max_edge_flow:
                    queue_len = occ - flow
                    max_queues[(u, v)] = max(max_queues[(u, v)], queue_len)
                    waiting_sec[(u, v)] += queue_len * self.dt

                if space_v <= 0.1 and occ > 0.0:
                    spillback_sec[(u, v)] += self.dt

            # Akışları Uygula
            for (u, v), flow in flows_this_step.items():
                if flow <= 0.0:
                    continue
                occupancy[u] = max(0.0, occupancy[u] - flow)
                travel_sec = self._compute_edge_travel_time(G_3d.get_edge_data(u, v, default={}))
                heapq.heappush(in_transit, (current_t + travel_sec, transit_seq, v, flow))
                transit_seq += 1

            time_series.append((round(current_t, 1), int(round(evacuated_float))))
            for n, occ in occupancy.items():
                if occ > 0.01 or inbound_persons.get(n, 0.0) > 0.01:
                    last_occupied[n] = current_t

        has_exit = bool(exit_nodes)
        trapped_persons = int(round(trapped_float))
        evacuation_completed = reachable_finished and has_exit and trapped_float <= 0.0
        # Tahliye tamamlanmadıysa geçerli bir süre yoktur: simülasyon tavanı raporlanır.
        reported_t = current_t if evacuation_completed else self.max_t

        # 5. İki Bölgeli Duman (Two-Zone Smoke) ve ASET Durumları
        smoke_states: Dict[int, SmokeZoneState] = {}
        for n in unreachable_occupied:
            last_occupied[n] = self.max_t
        critical_aset: Optional[float] = None
        aset_margin: Optional[float] = None

        for n, d in G_3d.nodes(data=True):
            # Yangın odasından olan topolojik uzaklığa göre duman tabakası alçalma hızı
            try:
                d_fire = nx.shortest_path_length(G_3d, source=fire_n, target=n, weight="distance_m")
            except Exception:
                d_fire = 20.0

            alpha = max(0.05, 0.35 / (1.0 + 0.1 * d_fire))
            rset = last_occupied[n]
            layer_h = max(0.50, self.ceiling_h - alpha * math.sqrt(max(1.0, rset)))
            aset = ((self.ceiling_h - self.critical_smoke_h) / max(1e-4, alpha)) ** 2
            is_protected = d.get("room_type") in SMOKE_PROTECTED_ZONES

            if not is_protected and rset > 0.0 and (aset_margin is None or aset - rset < aset_margin):
                aset_margin = aset - rset
                critical_aset = aset

            smoke_states[n] = SmokeZoneState(
                node_id=n,
                smoke_layer_height_m=round(layer_h, 2),
                soot_density=round(min(1.0, 1.0 - (layer_h / self.ceiling_h)), 2),
                is_tenable=is_protected or layer_h >= self.critical_smoke_h,
                aset_sec=round(aset, 1),
                rset_sec=round(rset, 1),
                is_protected_zone=is_protected
            )

        aset_compliant = aset_margin is None or aset_margin >= 0.0

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
            total_evacuation_time_sec=round(reported_t, 1),
            target_threshold_sec=self.target_threshold,
            is_compliance_achieved=(evacuation_completed and aset_compliant and reported_t <= self.target_threshold and crit_count == 0),
            bottlenecks_ranked=bottlenecks,
            critical_bottleneck_count=crit_count,
            total_persons_evacuated=int(round(evacuated_float)),
            smoke_zone_states=smoke_states,
            time_series_evacuated=time_series,
            total_persons=int(round(total_persons_float)),
            trapped_persons=trapped_persons,
            unreachable_occupied_nodes=unreachable_occupied,
            has_exit=has_exit,
            evacuation_completed=evacuation_completed,
            fire_origin_node=fire_n,
            critical_aset_sec=None if critical_aset is None else round(critical_aset, 1),
            aset_margin_sec=None if aset_margin is None else round(aset_margin, 1),
            aset_compliant=aset_compliant
        )


class CounterfactualEvacuationOptimizer:
    """
    Karşı-Olgusal (Counterfactual) Tasarım İyileştirme Motoru.
    En çok geri-basınç üreten geçişi açgözlü biçimde iyileştirir, ardından sonucu kötüleştirmeden
    çıkarılabilen adımları geriye dönük budamayla eler. Sonuç iyi bir reçetedir; en ucuz olduğu garanti edilmez.
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

        plan: List[Dict[str, Any]] = []
        for _ in range(self.max_iter):
            rep = self.sim.simulate_evacuation(G_current)
            # Kapı genişletmek, çıkışa yolu olmayan kişileri kurtaramaz; reçete önerilmez.
            if rep.trapped_persons > 0 or not rep.has_exit:
                break
            if rep.total_evacuation_time_sec <= target_time_sec and rep.critical_bottleneck_count == 0:
                break
            if not rep.bottlenecks_ranked:
                break

            top_bn = rep.bottlenecks_ranked[0]
            u, v = top_bn.edge
            width = float(G_current[u][v].get("door_width_cm", 90.0))
            item = {"kind": "door" if width < 159.9 else "area", "edge": (u, v), "bottleneck": top_bn}
            plan.append(item)
            self._apply_plan_item(G_current, item, step_id=len(plan))

        # Geriye Dönük Fazlalık Budaması: çıkarıldığında sonucu kötüleştirmeyen adımlar elenir.
        full_rep = self.sim.simulate_evacuation(self._replay(G_3d, plan)[0])
        pruned_count = 0
        for index in range(len(plan) - 1, -1, -1):
            remaining = plan[:index] + plan[index + 1:]
            trial = self.sim.simulate_evacuation(self._replay(G_3d, remaining)[0])
            if (trial.total_evacuation_time_sec <= full_rep.total_evacuation_time_sec
                    and trial.critical_bottleneck_count <= full_rep.critical_bottleneck_count
                    and trial.is_compliance_achieved >= full_rep.is_compliance_achieved):
                plan = remaining
                pruned_count += 1

        G_current, steps = self._replay(G_3d, plan, measure_delta=True)
        total_cost = sum(step.cost_index for step in steps)
        final_rep = self.sim.simulate_evacuation(G_current)

        return CounterfactualOptimizationResult(
            baseline_evacuation_time_sec=baseline_report.total_evacuation_time_sec,
            optimized_evacuation_time_sec=final_rep.total_evacuation_time_sec,
            time_savings_sec=round(baseline_report.total_evacuation_time_sec - final_rep.total_evacuation_time_sec, 1),
            baseline_critical_bottlenecks=baseline_report.critical_bottleneck_count,
            optimized_critical_bottlenecks=final_rep.critical_bottleneck_count,
            total_remodeling_cost=round(total_cost, 1),
            intervention_steps=steps,
            optimized_building_graph=G_current,
            baseline_trapped_persons=baseline_report.trapped_persons,
            pruned_redundant_steps=pruned_count
        )

    def _apply_plan_item(self, G: nx.Graph, item: Dict[str, Any], step_id: int) -> DesignInterventionStep:
        u, v = item["edge"]
        bottleneck = item["bottleneck"]
        edge = G[u][v]
        is_vert = edge.get("is_vertical", False)
        width = float(edge.get("door_width_cm", 90.0))

        if item["kind"] == "door":
            new_width = min(160.0, width + (30.0 if is_vert else 20.0))
            delta = new_width - width
            cost = delta * (self.c_shaft if is_vert else self.c_door)
            edge["door_width_cm"] = new_width
            return DesignInterventionStep(
                step_id=step_id,
                action_type="SHAFT_COLUMN_WIDEN" if is_vert else "DOOR_WIDEN",
                target_element=(u, v),
                original_metric_value=width,
                new_metric_value=new_width,
                cost_index=cost,
                marginal_benefit_score=(50.0 + delta) / max(1.0, cost),
                description_tr=f"{bottleneck.source_room_type} -> {bottleneck.target_room_type} geçiş genişliği {width:.0f} cm'den {new_width:.0f} cm'ye çıkarıldı.",
                floor_level=bottleneck.floor_level,
                spatial_coords=bottleneck.spatial_coords
            )

        area = float(G.nodes[v].get("area_m2", 5.0))
        new_area = area + 2.5
        cost = (new_area - area) * self.c_area
        G.nodes[v]["area_m2"] = new_area
        return DesignInterventionStep(
            step_id=step_id,
            action_type="HOLDING_AREA_EXPAND",
            target_element=v,
            original_metric_value=area,
            new_metric_value=new_area,
            cost_index=cost,
            marginal_benefit_score=40.0 / max(1.0, cost),
            description_tr=f"{G.nodes[v].get('room_type', 'Hol')} alanı {area:.1f} m²'den {new_area:.1f} m²'ye büyütüldü.",
            floor_level=G.nodes[v].get("floor_level", 0),
            spatial_coords=bottleneck.spatial_coords
        )

    def _replay(self, G_base: nx.Graph, plan: List[Dict[str, Any]], measure_delta: bool = False) -> Tuple[nx.Graph, List[DesignInterventionStep]]:
        """Planı özgün grafa baştan uygular; istenirse her adımın ölçülen süre etkisini kaydeder."""
        G = copy.deepcopy(G_base)
        steps: List[DesignInterventionStep] = []
        previous = self.sim.simulate_evacuation(G).total_evacuation_time_sec if measure_delta else None
        for index, item in enumerate(plan, start=1):
            step = self._apply_plan_item(G, item, step_id=index)
            if measure_delta:
                current = self.sim.simulate_evacuation(G).total_evacuation_time_sec
                step.evacuation_time_delta_sec = round(current - previous, 1)
                previous = current
            steps.append(step)
        return G, steps
