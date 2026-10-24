import math
from typing import Dict, List, Set, Tuple, Optional, Any
import networkx as nx

from diagram_yonetmelik.schemas import (
    RuleViolationItem,
    BuildingProgramSummary,
)


class BasementComplianceAuditor:
    """
    Bodrum katlarda Sığınak (tr_siginak) ve Otopark (tr_otopark) mevzuatını denetler.
    Üst katlardan gelen bağımsız bölüm ve kişi sayısına göre dinamik kapasiteyi doğrular.
    Kapalı otoparktan yangın merdiveni/asansöre doğrudan açılan yasaklı kenarları yakalar.
    """
    def __init__(
        self,
        min_shelter_area_per_person_m2: float = 1.0,
        ramp_max_slope_percent: float = 20.0,
        ramp_min_width_cm: float = 275.0
    ):
        self.shelter_rate = min_shelter_area_per_person_m2
        self.max_slope = ramp_max_slope_percent
        self.min_ramp_w = ramp_min_width_cm

    def audit_basement_graph(
        self,
        G_3d: nx.Graph,
        program: BuildingProgramSummary
    ) -> List[RuleViolationItem]:
        violations: List[RuleViolationItem] = []

        # Sadece bodrum kat düğümlerini filtrele (floor_level < 0)
        basement_nodes = [n for n, d in G_3d.nodes(data=True) if d.get("floor_level", 0) < 0]
        if not basement_nodes:
            # Bodrum kat tanımlanmamışsa ama bağımsız bölüm >= 12 ise sığınak eksik uyarısı
            if program.total_apartments >= 12 or program.total_residential_area_m2 >= 1500.0:
                violations.append(RuleViolationItem(
                    violation_code="SHELTER_MANDATORY_MISSING",
                    expected_value=f"En az {program.required_shelter_area_m2:.1f} m² Sığınak",
                    actual_value="Bodrum Kat Yok",
                    diagnostic_stage=1,
                    severity="CRITICAL",
                    description_tr=f"Binada {program.total_apartments} bağımsız bölüm bulunmasına rağmen bodrum katta sığınak projelendirilmemiş.",
                    remedy_recommendation_tr="Sığınak Yönetmeliği uyarınca bodrum kata sığınak tahsis edilmelidir.",
                    regulation_reference="Sığınak Yönetmeliği Madde 4"
                ))
            return violations

        # -------------------------------------------------------------
        # 1. SIĞINAK ALANI VE AIRLOCK TOPOLOJİ DENETİMİ
        # -------------------------------------------------------------
        shelter_nodes = [n for n in basement_nodes if G_3d.nodes[n].get("room_type") == "siginak"]
        total_act_shelter = sum([G_3d.nodes[n].get("area_m2", 0.0) for n in shelter_nodes])

        if program.required_shelter_area_m2 > 0:
            if not shelter_nodes:
                violations.append(RuleViolationItem(
                    violation_code="SHELTER_ROOM_MISSING",
                    expected_value=f"{program.required_shelter_area_m2:.1f} m² Sığınak",
                    actual_value="0 m²",
                    diagnostic_stage=1,
                    severity="CRITICAL",
                    description_tr=f"Bodrum katta zorunlu sığınak hacmi tespit edilemedi (Gereken: {program.required_shelter_area_m2:.1f} m²).",
                    remedy_recommendation_tr="Bodrum katta bağımsız bölümlere hizmet veren sığınak ayrılmalıdır.",
                    regulation_reference="Sığınak Yönetmeliği Madde 8"
                ))
            elif total_act_shelter < program.required_shelter_area_m2:
                violations.append(RuleViolationItem(
                    violation_code="SHELTER_AREA_DEFICIT",
                    target_node_id=shelter_nodes[0],
                    expected_value=program.required_shelter_area_m2,
                    actual_value=total_act_shelter,
                    diagnostic_stage=1,
                    severity="CRITICAL",
                    description_tr=f"Sığınak net taban alanı yetersiz ({total_act_shelter:.1f} m² < {program.required_shelter_area_m2:.1f} m²).",
                    remedy_recommendation_tr=f"Sığınak alanı kişi başı 1 m² hesabıyla en az {program.required_shelter_area_m2:.1f} m² olmalıdır.",
                    regulation_reference="Sığınak Yönetmeliği Madde 8"
                ))

            # Sığınak girişinde airlock (gaz sızdırmazlık holü) denetimi
            for sn in shelter_nodes:
                has_airlock = False
                for neighbor in G_3d.neighbors(sn):
                    if G_3d.nodes[neighbor].get("room_type") in ("siginak_holu", "yangin_holu"):
                        has_airlock = True
                        break
                if not has_airlock:
                    violations.append(RuleViolationItem(
                        violation_code="SHELTER_AIRLOCK_MISSING",
                        target_node_id=sn,
                        expected_value="Gaz Sızdırmazlık Holü (Airlock)",
                        actual_value="Doğrudan Giriş",
                        diagnostic_stage=2,
                        severity="CRITICAL",
                        description_tr="Sığınağa doğrudan koridordan girilmektedir; gaz sızdırmazlık / dekontaminasyon holü eksik.",
                        remedy_recommendation_tr="Sığınak girişine iki kapılı hava kilidi (airlock) tasarlanmalıdır.",
                        regulation_reference="Sığınak Yönetmeliği Madde 9"
                    ))

        # -------------------------------------------------------------
        # 2. KAPALI OTOPARK VE YASAKLI DOĞRUDAN BAĞLANTI DENETİMİ
        # -------------------------------------------------------------
        parking_nodes = [n for n in basement_nodes if G_3d.nodes[n].get("room_type") == "kapali_otopark"]

        for pn in parking_nodes:
            for neighbor in G_3d.neighbors(pn):
                n_type = G_3d.nodes[neighbor].get("room_type")
                # Yasaklı doğrudan kenar: Otopark -> Merdiven veya Asansör
                if n_type in ("yangin_merdiveni", "asansor"):
                    violations.append(RuleViolationItem(
                        violation_code="PARKING_DIRECT_EXIT_PROHIBITED",
                        target_edge=(pn, neighbor),
                        expected_value="Yangın Holü üzerinden geçiş",
                        actual_value=f"Otoparktan doğrudan {n_type} kapısı",
                        diagnostic_stage=3,
                        severity="CRITICAL",
                        description_tr=f"Kapalı otoparktan doğrudan '{n_type}' hacmine açılan kapı tespit edildi. Yangın/duman sızması riski taşır.",
                        remedy_recommendation_tr="Kapalı otopark ile yangın merdiveni/asansör arasına en az EI60 kapılı bir yangın güvenlik holü eklenmelidir.",
                        regulation_reference="BYKHY Madde 60 & Otopark Yönetmeliği Madde 6"
                    ))

        return violations
