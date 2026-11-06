import copy
from diagram_yonetmelik.gnn_order import extract_anchored_k_hop
from typing import Dict, List, Set, Tuple, Optional, Any
import networkx as nx
from networkx.algorithms import isomorphism

from diagram_yonetmelik.schemas import RuleViolationItem, CandidateDiagnosticReport


FIRE_HALL_AREA_LIMITS_M2: Tuple[float, float] = (3.0, 6.0)  # BYKHY Madde 34(3)
EMERGENCY_ELEVATOR_HALL_AREA_LIMITS_M2: Tuple[float, float] = (6.0, 10.0)  # BYKHY Madde 34(4)


def fire_hall_area_limits(
    G: nx.Graph,
    hall_node: Any,
    general_limits: Tuple[float, float] = FIRE_HALL_AREA_LIMITS_M2
) -> Tuple[float, float]:
    """Yangın güvenlik holünün (asgari, azami) taban alanı sınırlarını döndürür."""
    for neighbor in G.neighbors(hall_node):
        if G.nodes[neighbor].get("room_type") == "yangin_asansoru":
            return EMERGENCY_ELEVATOR_HALL_AREA_LIMITS_M2
    return general_limits


class ExplainableVF2Analyzer:
    """
    Nöro-sembolik kararlar için 3 Aşamalı Kademeli Kısıt Gevşetme Hunisi.
    GNN Order Embedding filtresinden geçen fakat tam monomorfizmi sağlamayan
    hatalı mimari bölgelerin kök nedenini yapılandırılmış teşhis raporuna dönüştürür.
    """
    def __init__(
        self,
        min_door_width_cm: float = 90.0,
        min_fire_hall_area_m2: float = 3.0,
        max_fire_hall_area_m2: float = 6.0,
        max_escape_distance_m: float = 30.0,
        gnn_model: Optional[Any] = None
    ):
        self.min_w = min_door_width_cm
        self.min_fh_area = min_fire_hall_area_m2
        self.max_fh_area = max_fire_hall_area_m2
        self.max_dist = max_escape_distance_m
        self.gnn = gnn_model

    def build_standard_fire_core_query(self, include_exit: bool = True) -> nx.Graph:
        """
        BYKHY Madde 34 / 38'e uygun standart kaçış şablonu:
        Kat Koridoru (0) -> Yangın Güvenlik Holü (1, Çapa) -> Yangın Merdiveni (2) [-> Dış Çıkış (3)]
        """
        Q = nx.Graph()
        Q.add_node(0, room_type="kat_koridoru", min_area=4.0)
        Q.add_node(1, room_type="yangin_holu", is_anchor=True)  # Alan sınırları: fire_hall_area_limits
        Q.add_node(2, room_type="yangin_merdiveni", min_area=5.0)

        Q.add_edge(0, 1, min_width=90.0, is_fire_resistant=True, max_dist=15.0)
        Q.add_edge(1, 2, min_width=90.0, is_fire_resistant=True, max_dist=5.0)
        if include_exit:
            Q.add_node(3, room_type="dis_cikis", min_area=2.0)
            Q.add_edge(2, 3, min_width=100.0, is_fire_resistant=True, max_dist=20.0)
        return Q

    def explain_candidate(
        self,
        query_pattern: nx.Graph,
        target_subgraph: nx.Graph,
        anchor_node_id: int,
        prune_with_gnn: bool = False,
        gnn_pruning_threshold: float = 0.40
    ) -> CandidateDiagnosticReport:
        # Sorgu çapasını belirle
        query_anchor = None
        for n, d in query_pattern.nodes(data=True):
            if d.get("is_anchor", False) or d.get("room_type") == "yangin_holu":
                query_anchor = n
                break
        if query_anchor is None:
            query_anchor = list(query_pattern.nodes())[0]

        # -------------------------------------------------------------
        # YALNIZCA ÖLÇÜM / İSTEĞE BAĞLI ÖN ELEME: GNN enerjisi
        # -------------------------------------------------------------
        gnn_energy_val: Optional[float] = None
        if self.gnn is not None:
            try:
                import torch
                from diagram_yonetmelik.gnn_order import nx_subgraph_to_pyg_data, violation_energy
                q_data = nx_subgraph_to_pyg_data(query_pattern, anchor_node=query_anchor)
                t_data = nx_subgraph_to_pyg_data(target_subgraph, anchor_node=anchor_node_id)
                with torch.no_grad():
                    if hasattr(q_data, 'x'):
                        z_q = self.gnn(q_data.x, q_data.edge_index, q_data.edge_attr, q_data.anchor_mask)
                        z_t = self.gnn(t_data.x, t_data.edge_index, t_data.edge_attr, t_data.anchor_mask)
                    else:
                        z_q = self.gnn(q_data['x'], q_data['edge_index'], q_data['edge_attr'], q_data['anchor_mask'])
                        z_t = self.gnn(t_data['x'], t_data['edge_index'], t_data['edge_attr'], t_data['anchor_mask'])
                    e = violation_energy(z_q, z_t)
                    gnn_energy_val = float(e.squeeze().item())
            except Exception:
                gnn_energy_val = None

        is_pruned = False
        if prune_with_gnn and gnn_energy_val is not None and gnn_energy_val > gnn_pruning_threshold:
            # GNN ön elemesi: Monomorfizm sağlanamaz, sıkı VF2 araması atlanır
            full_match = False
            mapping = {}
            is_pruned = True
        else:
            # -------------------------------------------------------------
            # 0. TAM MONOMORFİZM DENETİMİ (TAM UYGUNLUK)
            # -------------------------------------------------------------
            full_match, mapping = self._run_strict_vf2(query_pattern, target_subgraph, query_anchor, anchor_node_id)

        if full_match:
            return CandidateDiagnosticReport(
                anchor_node_id=anchor_node_id,
                target_subgraph_nodes=list(target_subgraph.nodes()),
                is_fully_compliant=True,
                diagnostic_stage_reached=0,
                violations=[],
                partial_node_mapping=mapping,
                summary_message="Kaçış çekirdeği sorgudaki topolojik ve geometrik koşulları karşıladı.",
                gnn_energy=gnn_energy_val,
                is_pruned_by_gnn=False
            )

        # Belirsiz etiket kontrolü
        has_uncertain_label = any(
            target_subgraph.nodes[n].get("label_source") == "belirsiz"
            for n in target_subgraph.nodes()
        )

        def _tag_uncertain(v_list: List[RuleViolationItem]):
            if has_uncertain_label:
                for v in v_list:
                    if "etiket belirsiz, uzman kontrolü gerekli" not in v.description_tr:
                        v.description_tr = f"{v.description_tr} (etiket belirsiz, uzman kontrolü gerekli)"
            return v_list

        # -------------------------------------------------------------
        # AŞAMA 1: PARAMETRİK GEVŞETME (Topoloji ve Tipler Tam, Ölçüler Kusurlu)
        # -------------------------------------------------------------
        stage1_match, stage1_mapping = self._run_topology_and_types_vf2(query_pattern, target_subgraph, query_anchor, anchor_node_id)
        if stage1_match:
            violations = _tag_uncertain(self._audit_parametric_violations(query_pattern, target_subgraph, stage1_mapping))
            return CandidateDiagnosticReport(
                anchor_node_id=anchor_node_id,
                target_subgraph_nodes=list(target_subgraph.nodes()),
                is_fully_compliant=False,
                diagnostic_stage_reached=1,
                violations=violations,
                partial_node_mapping=stage1_mapping,
                summary_message=f"Topolojik bağlantı tam fakat {len(violations)} adet parametrik kusur tespit edildi.",
                gnn_energy=gnn_energy_val,
                is_pruned_by_gnn=is_pruned
            )

        # -------------------------------------------------------------
        # AŞAMA 2: ODA ROLÜ / TİPİ GEVŞETME (Salt İskelet Eşleşmesi)
        # -------------------------------------------------------------
        stage2_match, stage2_mapping = self._run_skeleton_only_vf2(query_pattern, target_subgraph, query_anchor, anchor_node_id)
        if stage2_match:
            violations = _tag_uncertain(self._audit_role_violations(query_pattern, target_subgraph, stage2_mapping))
            return CandidateDiagnosticReport(
                anchor_node_id=anchor_node_id,
                target_subgraph_nodes=list(target_subgraph.nodes()),
                is_fully_compliant=False,
                diagnostic_stage_reached=2,
                violations=violations,
                partial_node_mapping=stage2_mapping,
                summary_message=f"Mekan fonksiyon uyuşmazlığı: Şablon iskeleti bulundu ancak {len(violations)} odanın tipi hatalı.",
                gnn_energy=gnn_energy_val,
                is_pruned_by_gnn=is_pruned
            )

        # -------------------------------------------------------------
        # AŞAMA 3: KISMİ HİZALAMA (BFS İle Kopuk Kapı / Eksik Mekan Tespiti)
        # -------------------------------------------------------------
        violations, partial_map = self._run_partial_bfs_alignment(query_pattern, target_subgraph, query_anchor, anchor_node_id)
        violations = _tag_uncertain(violations)
        return CandidateDiagnosticReport(
            anchor_node_id=anchor_node_id,
            target_subgraph_nodes=list(target_subgraph.nodes()),
            is_fully_compliant=False,
            diagnostic_stage_reached=3,
            violations=violations,
            partial_node_mapping=partial_map,
            summary_message="Ağır topolojik kusur: Zorunlu kapı bağlantısı veya mekan kat planında mevcut değil.",
            gnn_energy=gnn_energy_val,
            is_pruned_by_gnn=is_pruned
        )

    def _hall_limits(self, G: nx.Graph, hall_node: Any) -> Tuple[float, float]:
        return fire_hall_area_limits(G, hall_node, (self.min_fh_area, self.max_fh_area))

    def _run_strict_vf2(self, Q: nx.Graph, T: nx.Graph, q_anc: int, t_anc: int) -> Tuple[bool, Dict[int, int]]:
        def node_match(n1, n2):
            if n1.get("room_type") != n2.get("room_type"):
                return False
            area = n1.get("area_m2", 0.0)
            hall_limits = n1.get("_hall_limits")
            if hall_limits is not None:
                return hall_limits[0] <= area <= hall_limits[1]
            return area >= n2.get("min_area", 0.0)

        def edge_match(e1, e2):
            return (
                e1.get("door_width_cm", 0.0) >= e2.get("min_width", 90.0) and
                (not e2.get("is_fire_resistant", False) or e1.get("is_fire_resistant", False))
            )

        T_copy = T.copy()
        for n in T_copy.nodes():
            if T_copy.nodes[n].get("room_type") == "yangin_holu":
                T_copy.nodes[n]["_hall_limits"] = self._hall_limits(T_copy, n)

        matcher = isomorphism.GraphMatcher(T_copy, Q, node_match=node_match, edge_match=edge_match)
        for iso in matcher.subgraph_monomorphisms_iter():
            rev = {v: k for k, v in iso.items()}
            if rev.get(q_anc) == t_anc:
                # Kümülatif rota kontrolü
                total_dist = sum([T_copy[rev[u]][rev[v]].get("distance_m", 1.0) for u, v in Q.edges()])
                if total_dist <= self.max_dist:
                    return True, rev
        return False, {}

    def _run_topology_and_types_vf2(self, Q: nx.Graph, T: nx.Graph, q_anc: int, t_anc: int) -> Tuple[bool, Dict[int, int]]:
        def node_match(n1, n2):
            return n1.get("room_type") == n2.get("room_type")

        T_copy = T.copy()
        matcher = isomorphism.GraphMatcher(T_copy, Q, node_match=node_match)
        for iso in matcher.subgraph_monomorphisms_iter():
            rev = {v: k for k, v in iso.items()}
            if rev.get(q_anc) == t_anc:
                return True, rev
        return False, {}

    def _run_skeleton_only_vf2(self, Q: nx.Graph, T: nx.Graph, q_anc: int, t_anc: int) -> Tuple[bool, Dict[int, int]]:
        matcher = isomorphism.GraphMatcher(T, Q)
        for iso in matcher.subgraph_monomorphisms_iter():
            rev = {v: k for k, v in iso.items()}
            if rev.get(q_anc) == t_anc:
                return True, rev
        return False, {}

    def _audit_parametric_violations(self, Q: nx.Graph, T: nx.Graph, mapping: Dict[int, int]) -> List[RuleViolationItem]:
        items: List[RuleViolationItem] = []
        # Oda alanları
        for q_node, t_node in mapping.items():
            qd = Q.nodes[q_node]
            td = T.nodes[t_node]
            act_a = td.get("area_m2", 0.0)
            if td.get("room_type") == "yangin_holu":
                # Genel kat denetçisiyle aynı kod ve kat: orkestratör mükerrer ihlali eler.
                hall_min, hall_max = self._hall_limits(T, t_node)
                if act_a < hall_min or act_a > hall_max:
                    is_deficit = act_a < hall_min
                    limit = hall_min if is_deficit else hall_max
                    items.append(RuleViolationItem(
                        violation_code="BYKHY_M34_YANGIN_HOLU_ALAN_YETERSIZ" if is_deficit else "BYKHY_M34_YANGIN_HOLU_ALAN_FAZLA",
                        target_node_id=t_node,
                        expected_value=limit,
                        actual_value=round(act_a, 2),
                        diagnostic_stage=1,
                        severity="CRITICAL",
                        description_tr=f"Yangın güvenlik holü alanı ({act_a:.2f} m²) izin verilen {hall_min:.1f}-{hall_max:.1f} m² aralığının dışındadır.",
                        remedy_recommendation_tr=f"Hol taban alanı {hall_min:.1f}-{hall_max:.1f} m² aralığına getirilmelidir.",
                        regulation_reference="Binaların Yangından Korunması Hakkında Yönetmelik - Madde 34",
                        floor_level=td.get("floor_level", 0)
                    ))
                continue

            min_a = qd.get("min_area", 0.0)
            if act_a < min_a:
                items.append(RuleViolationItem(
                    violation_code="ROOM_AREA_DEFICIT",
                    target_node_id=t_node,
                    expected_value=min_a,
                    actual_value=act_a,
                    diagnostic_stage=1,
                    severity="CRITICAL",
                    description_tr=f"{td.get('name_label', 'Mekan')} alanı yetersiz ({act_a:.1f} m² < {min_a:.1f} m²)",
                    remedy_recommendation_tr="Mekan sınırları yönetmelik minimum alan şartına genişletilmeli.",
                    regulation_reference="BYKHY Madde 34 / PAİY Madde 29"
                ))

        # Kapı genişlikleri ve yangın dayanımı
        total_dist = 0.0
        for q_u, q_v in Q.edges():
            t_u, t_v = mapping.get(q_u), mapping.get(q_v)
            if t_u is not None and t_v is not None and T.has_edge(t_u, t_v):
                qed = Q[q_u][q_v]
                ted = T[t_u][t_v]
                w_act = ted.get("door_width_cm", 0.0)
                w_req = qed.get("min_width", 90.0)
                if w_act < w_req:
                    items.append(RuleViolationItem(
                        violation_code="DOOR_WIDTH_DEFICIT",
                        target_edge=(t_u, t_v),
                        expected_value=w_req,
                        actual_value=w_act,
                        diagnostic_stage=1,
                        severity="CRITICAL",
                        description_tr=f"Kapı net genişliği yetersiz ({w_act:.0f} cm < {w_req:.0f} cm)",
                        remedy_recommendation_tr=f"Kapı kasası en az {w_req:.0f} cm genişletilmelidir.",
                        regulation_reference="BYKHY Madde 38"
                    ))
                if qed.get("is_fire_resistant", False) and not ted.get("is_fire_resistant", False):
                    items.append(RuleViolationItem(
                        violation_code="FIRE_DOOR_MISSING",
                        target_edge=(t_u, t_v),
                        expected_value=True,
                        actual_value=False,
                        diagnostic_stage=1,
                        severity="CRITICAL",
                        description_tr="Kaçış güzergahındaki kapıda yangın dayanımı (EI60/EI90) eksik.",
                        remedy_recommendation_tr="Kapı yangına ve dumana en az 60 dakika dayanıklı sertifikalı kapı ile değiştirilmelidir.",
                        regulation_reference="BYKHY Madde 34"
                    ))
                total_dist += ted.get("distance_m", 1.0)

        if total_dist > self.max_dist:
            items.append(RuleViolationItem(
                violation_code="TOTAL_ROUTE_EXCEEDED",
                expected_value=self.max_dist,
                actual_value=total_dist,
                diagnostic_stage=1,
                severity="CRITICAL",
                description_tr=f"Toplam kaçış rotası mesafesi aşıldı ({total_dist:.1f} m > {self.max_dist:.1f} m)",
                remedy_recommendation_tr="Yangın kaçış holü ve merdiven konumu bağımsız bölümlere yaklaştırılmalıdır.",
                regulation_reference="BYKHY Madde 31"
            ))
        return items

    def _audit_role_violations(self, Q: nx.Graph, T: nx.Graph, mapping: Dict[int, int]) -> List[RuleViolationItem]:
        items = []
        for q_n, t_n in mapping.items():
            req_type = Q.nodes[q_n].get("room_type")
            act_type = T.nodes[t_n].get("room_type")
            if req_type != act_type:
                items.append(RuleViolationItem(
                    violation_code="ROOM_TYPE_MISMATCH",
                    target_node_id=t_n,
                    expected_value=req_type,
                    actual_value=act_type,
                    diagnostic_stage=2,
                    severity="CRITICAL",
                    description_tr=f"Mekan fonksiyon uyuşmazlığı: Beklenen '{req_type}' yerine '{act_type}' tespit edildi.",
                    remedy_recommendation_tr=f"Bu mekan plan tadilatıyla '{req_type}' fonksiyonuna tahsis edilmeli.",
                    regulation_reference="BYKHY Madde 34"
                ))
        return items

    def _run_partial_bfs_alignment(self, Q: nx.Graph, T: nx.Graph, q_anc: int, t_anc: int) -> Tuple[List[RuleViolationItem], Dict[int, int]]:
        items = []
        mapping = {q_anc: t_anc}
        visited_q = {q_anc}
        queue = [q_anc]

        while queue:
            curr_q = queue.pop(0)
            curr_t = mapping.get(curr_q)

            for q_neighbor in Q.neighbors(curr_q):
                if q_neighbor in visited_q:
                    continue
                visited_q.add(q_neighbor)
                req_type = Q.nodes[q_neighbor].get("room_type")

                if curr_t is not None:
                    matched_t = None
                    for t_neighbor in T.neighbors(curr_t):
                        if T.nodes[t_neighbor].get("room_type") == req_type and t_neighbor not in mapping.values():
                            matched_t = t_neighbor
                            break

                    if matched_t is not None:
                        mapping[q_neighbor] = matched_t
                        queue.append(q_neighbor)
                    else:
                        found_in_T = [n for n, d in T.nodes(data=True) if d.get("room_type") == req_type and n not in mapping.values()]
                        if found_in_T:
                            items.append(RuleViolationItem(
                                violation_code="MISSING_DOOR_CONNECTION",
                                target_node_id=found_in_T[0],
                                expected_value=f"Kapı bağlantısı: {curr_t} <-> {found_in_T[0]}",
                                actual_value="Bağlantı Yok",
                                diagnostic_stage=3,
                                severity="CRITICAL",
                                description_tr=f"'{req_type}' mevcuttur ancak ilgili kaçış mekanına doğrudan kapı bağlantısı bulunmuyor.",
                                remedy_recommendation_tr="Duvar üzerinde yönetmeliğe uygun yangın geçiş kapısı açılmalıdır.",
                                regulation_reference="BYKHY Madde 34 / 38"
                            ))
                            mapping[q_neighbor] = found_in_T[0]
                            queue.append(q_neighbor)
                        else:
                            items.append(RuleViolationItem(
                                violation_code="MISSING_ROOM_NODE",
                                expected_value=req_type,
                                actual_value="Yok",
                                diagnostic_stage=3,
                                severity="CRITICAL",
                                description_tr=f"Katta zorunlu '{req_type}' hacmi hiç çizilmemiş.",
                                remedy_recommendation_tr=f"Kat planına bağımsız yangın kaçışına hizmet eden bir '{req_type}' projelendirilmelidir.",
                                regulation_reference="BYKHY Madde 34"
                            ))
                else:
                    found_in_T = [n for n, d in T.nodes(data=True) if d.get("room_type") == req_type and n not in mapping.values()]
                    if not found_in_T:
                        items.append(RuleViolationItem(
                            violation_code="MISSING_ROOM_NODE",
                            expected_value=req_type,
                            actual_value="Yok",
                            diagnostic_stage=3,
                            severity="CRITICAL",
                            description_tr=f"Katta zorunlu '{req_type}' hacmi hiç çizilmemiş.",
                            remedy_recommendation_tr=f"Kat planına bağımsız yangın kaçışına hizmet eden bir '{req_type}' projelendirilmelidir.",
                            regulation_reference="BYKHY Madde 34"
                        ))
        return items, mapping


def fire_candidates(graph, analyzer, hops):
    for floor in sorted({d["floor_level"] for _, d in graph.nodes(data=True)}):
        rooms = [n for n in graph if graph.nodes[n]["floor_level"] == floor]
        halls = [n for n in rooms if graph.nodes[n]["room_type"] == "yangin_holu"]
        for anchor in halls or [n for n in rooms if graph.nodes[n]["room_type"] == "yangin_merdiveni"]:
            target = extract_anchored_k_hop(graph, anchor, hops)
            exit_required = floor == 0 and any(d["room_type"] == "dis_cikis" for _, d in target.nodes(data=True))
            yield analyzer.build_standard_fire_core_query(exit_required), target, anchor
