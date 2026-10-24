import math
from typing import Dict, List, Set, Tuple, Optional, Any
import networkx as nx
from shapely.geometry import Polygon, Point, LineString

from diagram_yonetmelik.schemas import (
    RuleViolationItem,
    CandidateDiagnosticReport,
    BuildingProgramSummary,
)


class MultiFloorComprehensiveAuditor:
    """
    Binaların Yangından Korunması Hakkında Yönetmelik (BYKHY),
    Planlı Alanlar İmar Yönetmeliği (PAİY), Sığınak ve Otopark Yönetmeliklerinin
    TÜM MADDELERİNİ HER KATTA AYRI AYRI VE BİNA GENELİNDE DENETLEYEN MOTOR.
    
    Her katın grafını bağımsız olarak inceler; merdiven sayıları, kapı genişlikleri,
    kaçış yönleri, koridor mesafeleri, yangın holleri, asansör holleri ve engelli
    manevra alanlarını kat bazında doğrular.
    """
    def __init__(
        self,
        default_floor_height_m: float = 3.0,
        high_rise_threshold_m: float = 21.50,
        sprinkler_enabled: bool = False
    ):
        self.floor_h = default_floor_height_m
        self.high_rise_threshold_m = high_rise_threshold_m
        self.sprinkler = sprinkler_enabled

    def audit_entire_building(
        self,
        G_3d: nx.Graph,
        program: Optional[BuildingProgramSummary] = None,
        custom_building_height_m: Optional[float] = None
    ) -> List[CandidateDiagnosticReport]:
        """
        Bütün binayı kat kat ve dikey çekirdek boyunca denetler.
        """
        reports: List[CandidateDiagnosticReport] = []

        # 1. Katları Ayrıştır
        floors_dict: Dict[int, List[int]] = {}
        for n, d in G_3d.nodes(data=True):
            fl = d.get("floor_level", 0)
            floors_dict.setdefault(fl, []).append(n)

        total_floors = len(floors_dict)
        max_floor = max(floors_dict.keys()) if floors_dict else 0
        min_floor = min(floors_dict.keys()) if floors_dict else 0
        
        building_height_m = custom_building_height_m or (max(0, max_floor) * self.floor_h)
        is_high_rise = (building_height_m >= self.high_rise_threshold_m) or (total_floors >= 8)
        is_very_high_rise = (building_height_m >= 51.50) or (total_floors >= 10)

        # -------------------------------------------------------------
        # 2. HER KATTA AYRI AYRI DENETİM YAP
        # -------------------------------------------------------------
        for fl in sorted(floors_dict.keys()):
            node_ids = floors_dict[fl]
            G_fl = G_3d.subgraph(node_ids).copy()
            floor_violations: List[RuleViolationItem] = []

            # 2.1. BYKHY MADDE 31 & 48: KAÇIŞ MERDİVENİ SAYISI
            floor_stairs = [
                n for n in node_ids
                if G_3d.nodes[n].get("room_type") == "yangin_merdiveni"
            ]
            if is_high_rise and fl > 0:
                if len(floor_stairs) < 2:
                    floor_violations.append(RuleViolationItem(
                        violation_code="BYKHY_M31_KACIS_MERDIVEN_SAYISI_YETERSIZ",
                        target_node_id=floor_stairs[0] if floor_stairs else node_ids[0],
                        expected_value=2,
                        actual_value=len(floor_stairs),
                        diagnostic_stage=3,
                        severity="CRITICAL",
                        description_tr=(
                            f"Kat {fl}: Yapı yüksekliği {building_height_m:.1f}m (≥21.50m veya ≥8 kat) olan yüksek "
                            f"binalarda her katta en az 2 adet bağımsız yangın kaçış merdiveni bulunması zorunludur. "
                            f"Mevcut katta {len(floor_stairs)} merdiven tespit edildi."
                        ),
                        remedy_recommendation_tr="Kat planına duman sızdırmaz ikinci bir kaçış merdiveni çekirdeği eklenmelidir.",
                        regulation_reference="Binaların Yangından Korunması Hakkında Yönetmelik - Madde 31 & Madde 48",
                        floor_level=fl,
                        spatial_coords=G_3d.nodes[floor_stairs[0]].get("anchor_point") if floor_stairs else None
                    ))

            # 2.2. BYKHY MADDE 34: YANGIN GÜVENLİK HOLÜ ZORUNLULUĞU VE ALANI
            floor_fire_halls = [
                n for n in node_ids
                if G_3d.nodes[n].get("room_type") == "yangin_holu"
            ]
            
            # Her merdivenin önünde yangın güvenlik holü var mı?
            for stair_node in floor_stairs:
                stair_neighbors = list(G_fl.neighbors(stair_node))
                has_safety_hall = any(G_fl.nodes[nbr].get("room_type") == "yangin_holu" for nbr in stair_neighbors)
                if not has_safety_hall and fl != 0:  # Zemin kattan doğrudan dışarı çıkış hariç
                    stair_pt = G_fl.nodes[stair_node].get("anchor_point")
                    floor_violations.append(RuleViolationItem(
                        violation_code="BYKHY_M34_YANGIN_GUVENLIK_HOLU_EKSIK",
                        target_node_id=stair_node,
                        expected_value="yangin_holu_ara_gecisi",
                        actual_value="dogrudan_baglanti",
                        diagnostic_stage=3,
                        severity="CRITICAL",
                        description_tr=(
                            f"Kat {fl}: Yangın merdivenine geçişte duman ve zehirli gaz sızmasını önleyen "
                            f"Yangın Güvenlik Holü tespit edilemedi. Koridordan merdivene doğrudan geçiş yasaktır."
                        ),
                        remedy_recommendation_tr="Merdiven kapısı önüne en az 3.0 m² net alanlı yangın güvenlik holü yerleştirilmelidir.",
                        regulation_reference="Binaların Yangından Korunması Hakkında Yönetmelik - Madde 34",
                        floor_level=fl,
                        spatial_coords=stair_pt
                    ))

            # Yangın holü alan kontrolü (Min 3.0 m², Maks 6.0 m² konut standardı)
            for hall_node in floor_fire_halls:
                area = float(G_fl.nodes[hall_node].get("area_m2", 0.0))
                hall_pt = G_fl.nodes[hall_node].get("anchor_point")
                if area < 3.0:
                    floor_violations.append(RuleViolationItem(
                        violation_code="BYKHY_M34_YANGIN_HOLU_ALAN_YETERSIZ",
                        target_node_id=hall_node,
                        expected_value=3.0,
                        actual_value=round(area, 2),
                        diagnostic_stage=1,
                        severity="CRITICAL",
                        description_tr=(
                            f"Kat {fl}: Yangın güvenlik holü alanı ({area:.2f} m²) yönetmelikteki "
                            f"asgari 3.0 m² sınırının altındadır."
                        ),
                        remedy_recommendation_tr=f"Hol sınırları en az 3.0 m² olacak şekilde genişletilmelidir (+{3.0 - area:.2f} m²).",
                        regulation_reference="Binaların Yangından Korunması Hakkında Yönetmelik - Madde 34",
                        floor_level=fl,
                        spatial_coords=hall_pt
                    ))

            # 2.3. BYKHY MADDE 33: KAÇIŞ KAPILARI GENİŞLİK VE AÇILIŞ YÖNLERİ
            for u, v, d in G_fl.edges(data=True):
                w_cm = float(d.get("width_cm", 90.0))
                u_type = G_fl.nodes[u].get("room_type", "")
                v_type = G_fl.nodes[v].get("room_type", "")
                is_escape_edge = ("yangin_holu" in (u_type, v_type)) or ("yangin_merdiveni" in (u_type, v_type)) or ("dis_cikis" in (u_type, v_type))
                
                if is_escape_edge:
                    # Yüksek binalarda veya kaçış hollerinde asgari kapı temiz geçişi 1.20m (120cm) olmalıdır
                    min_req_cm = 120.0 if (is_high_rise or "yangin_holu" in (u_type, v_type)) else 90.0
                    if w_cm < min_req_cm:
                        portal_xy = d.get("portal_xy")
                        floor_violations.append(RuleViolationItem(
                            violation_code="BYKHY_M33_KACIS_KAPISI_GENISLIK_DEFICIT",
                            target_edge=(u, v),
                            expected_value=min_req_cm / 100.0,
                            actual_value=w_cm / 100.0,
                            diagnostic_stage=1,
                            severity="CRITICAL",
                            description_tr=(
                                f"Kat {fl}: Kaçış yolu kapı temiz geçiş genişliği ({w_cm/100:.2f}m), "
                                f"asgari {min_req_cm/100:.2f}m standardını sağlamıyor."
                            ),
                            remedy_recommendation_tr=f"Kapı boşluğu {min_req_cm/100:.2f}m temiz genişliğe büyütülmeli (+{(min_req_cm - w_cm)/100:.2f}m).",
                            regulation_reference="Binaların Yangından Korunması Hakkında Yönetmelik - Madde 33",
                            floor_level=fl,
                            spatial_coords=portal_xy
                        ))

            # 2.4. BYKHY MADDE 52 & 53: KAÇIŞ MESAFELERİ VE ÇIKMAZ KORİDOR SINIRI
            # Her bağımsız bölümden en yakın merdivene/hole geodezik mesafe
            escape_targets = floor_fire_halls if floor_fire_halls else floor_stairs
            if fl == 0:
                exits = [n for n in node_ids if G_fl.nodes[n].get("room_type") == "dis_cikis"]
                if exits:
                    escape_targets = exits

            if escape_targets:
                for r_node in node_ids:
                    r_type = G_fl.nodes[r_node].get("room_type", "")
                    if r_type in ("oda", "salon", "daire_antresi"):
                        shortest_m = float("inf")
                        for tgt in escape_targets:
                            try:
                                d_m = nx.shortest_path_length(G_fl, source=r_node, target=tgt, weight="weight")
                                if d_m < shortest_m:
                                    shortest_m = d_m
                            except nx.NetworkXNoPath:
                                pass

                        max_allowable_m = 20.0 if self.sprinkler else 15.0  # Tek yönlü çıkmaz koridor sınırı
                        if shortest_m != float("inf") and shortest_m > max_allowable_m:
                            r_pt = G_fl.nodes[r_node].get("anchor_point")
                            floor_violations.append(RuleViolationItem(
                                violation_code="BYKHY_M52_CIKMAZ_KORIDOR_MESAFESI_ASILDI",
                                target_node_id=r_node,
                                expected_value=max_allowable_m,
                                actual_value=round(shortest_m, 1),
                                diagnostic_stage=1,
                                severity="CRITICAL",
                                description_tr=(
                                    f"Kat {fl}: Mekandan en yakın yangın kaçış noktasına olan mesafe "
                                    f"({shortest_m:.1f}m), izin verilen azami {max_allowable_m:.1f}m sınırını aşıyor."
                                ),
                                remedy_recommendation_tr="Koridor hattına ilave kaçış kapısı açılmalı veya koridor uzunluğu tadil edilmelidir.",
                                regulation_reference="Binaların Yangından Korunması Hakkında Yönetmelik - Madde 52 & Madde 53",
                                floor_level=fl,
                                spatial_coords=r_pt
                            ))

            # 2.5. PAİY MADDE 29 & 30: KAT KORİDORU ASGARİ GENİŞLİĞİ (1.20m)
            floor_corridors = [n for n in node_ids if G_fl.nodes[n].get("room_type") == "kat_koridoru"]
            for corr_node in floor_corridors:
                corr_poly = G_fl.nodes[corr_node].get("polygon")
                corr_pt = G_fl.nodes[corr_node].get("anchor_point")
                if corr_poly and hasattr(corr_poly, "bounds"):
                    minx, miny, maxx, maxy = corr_poly.bounds
                    w_box = min(maxx - minx, maxy - miny)
                    if w_box < 1.15:  # 1.20m toleranslı
                        floor_violations.append(RuleViolationItem(
                            violation_code="PAIY_M29_KAT_KORIDORU_GENISLIK_YETERSIZ",
                            target_node_id=corr_node,
                            expected_value=1.20,
                            actual_value=round(w_box, 2),
                            diagnostic_stage=1,
                            severity="MAJOR",
                            description_tr=(
                                f"Kat {fl}: Kat koridoru temiz genişliği ({w_box:.2f}m), Planlı Alanlar İmar "
                                f"Yönetmeliğindeki asgari 1.20m genişlik şartını sağlamıyor."
                            ),
                            remedy_recommendation_tr="Koridor duvar aksları revize edilerek temiz genişlik en az 1.20m yapılmalıdır.",
                            regulation_reference="Planlı Alanlar İmar Yönetmeliği - Madde 29 & Madde 30",
                            floor_level=fl,
                            spatial_coords=corr_pt
                        ))

            # 2.6. PAİY MADDE 34: ASANSÖR ÖNÜ KAT HOLÜ GENİŞLİĞİ (1.50m / 1.80m)
            floor_elevators = [n for n in node_ids if G_fl.nodes[n].get("room_type") in ("asansor", "dikey_cekirdek")]
            for el_node in floor_elevators:
                el_neighbors = list(G_fl.neighbors(el_node))
                el_pt = G_fl.nodes[el_node].get("anchor_point")
                for nbr in el_neighbors:
                    nbr_poly = G_fl.nodes[nbr].get("polygon")
                    if nbr_poly and hasattr(nbr_poly, "bounds"):
                        minx, miny, maxx, maxy = nbr_poly.bounds
                        lobby_depth = min(maxx - minx, maxy - miny)
                        req_lobby = 1.80 if is_high_rise else 1.50
                        if lobby_depth < req_lobby - 0.05:
                            floor_violations.append(RuleViolationItem(
                                violation_code="PAIY_M34_ASANSOR_KAT_HOLU_DAR",
                                target_node_id=nbr,
                                expected_value=req_lobby,
                                actual_value=round(lobby_depth, 2),
                                diagnostic_stage=1,
                                severity="WARNING",
                                description_tr=(
                                    f"Kat {fl}: Asansör kapısı önündeki kat holü derinliği ({lobby_depth:.2f}m), "
                                    f"asgari {req_lobby:.2f}m şartını karşılamamaktadır."
                                ),
                                remedy_recommendation_tr=f"Asansör önü hol mesafesi en az {req_lobby:.2f}m'ye genişletilmelidir.",
                                regulation_reference="Planlı Alanlar İmar Yönetmeliği - Madde 34",
                                floor_level=fl,
                                spatial_coords=el_pt
                            ))

            # 2.7. PAİY MADDE 5: ENGELLİ ERİŞİLEBİLİRLİĞİ (MANEVRA ÇAPI 1.50m)
            # Kat koridorunda tekerlekli sandalye manevra dairesi kontrolü
            for corr_node in floor_corridors:
                area = float(G_fl.nodes[corr_node].get("area_m2", 0.0))
                corr_poly = G_fl.nodes[corr_node].get("polygon")
                corr_pt = G_fl.nodes[corr_node].get("anchor_point")
                if corr_poly and hasattr(corr_poly, "bounds"):
                    minx, miny, maxx, maxy = corr_poly.bounds
                    shorter_dim = min(maxx - minx, maxy - miny)
                    if shorter_dim < 1.45 and area < 8.0:
                        floor_violations.append(RuleViolationItem(
                            violation_code="PAIY_M5_ENGELLI_MANEVRA_ALANI_YETERSIZ",
                            target_node_id=corr_node,
                            expected_value=1.50,
                            actual_value=round(shorter_dim, 2),
                            diagnostic_stage=1,
                            severity="WARNING",
                            description_tr=(
                                f"Kat {fl}: Ortak kat koridorunda tekerlekli sandalye için zorunlu olan "
                                f"Ø1.50m manevra dönüş dairesi alanı sağlanamamaktadır."
                            ),
                            remedy_recommendation_tr="Koridorun en az bir noktasında 1.50m x 1.50m engelli manevra cebi bırakılmalıdır.",
                            regulation_reference="Planlı Alanlar İmar Yönetmeliği - Madde 5 (Engelli Erişilebilirliği)",
                            floor_level=fl,
                            spatial_coords=corr_pt
                        ))

            # Kat Teşhis Raporu Kaydı
            reports.append(CandidateDiagnosticReport(
                anchor_node_id=node_ids[0],
                target_subgraph_nodes=node_ids,
                is_fully_compliant=(len(floor_violations) == 0),
                diagnostic_stage_reached=1 if floor_violations else 0,
                violations=floor_violations,
                summary_message=(
                    f"Kat {fl}: Mevzuata %100 UYGUNDUR." if not floor_violations
                    else f"Kat {fl}: {len(floor_violations)} adet mevzuat ihlali tespit edildi."
                )
            ))

        # -------------------------------------------------------------
        # 3. BİNA GENELİ & DÜŞEY MEVZUAT KONTROLLERİ
        # -------------------------------------------------------------
        building_violations: List[RuleViolationItem] = []

        # 3.1. BYKHY MADDE 62: YANGIN / ACİL DURUM ASANSÖRÜ
        if is_very_high_rise:
            has_fire_elevator = False
            for n, d in G_3d.nodes(data=True):
                if d.get("room_type") == "yangin_asansoru" or "itfaiye" in d.get("name_label", "").lower():
                    has_fire_elevator = True
                    break
            if not has_fire_elevator:
                building_violations.append(RuleViolationItem(
                    violation_code="BYKHY_M62_ACIL_DURUM_YANGIN_ASANSORU_YOK",
                    target_node_id=0,
                    expected_value=1,
                    actual_value=0,
                    diagnostic_stage=3,
                    severity="CRITICAL",
                    description_tr=(
                        f"Bina yüksekliği {building_height_m:.1f}m (≥51.50m veya ≥10 kat) olan yüksek binalarda "
                        f"itfaiyenin kullanımına mahsus en az 1 adet Acil Durum / Yangın Asansörü zorunludur."
                    ),
                    remedy_recommendation_tr="Çekirdeğe acil durum güç kaynaklı ve kuyu basınçlandırmalı yangın asansörü eklenmelidir.",
                    regulation_reference="Binaların Yangından Korunması Hakkında Yönetmelik - Madde 62",
                    floor_level=max_floor
                ))

        # 3.2. SIĞINAK YÖNETMELİĞİ (MADDE 9 & 13) - BODRUM KAT KONTROLÜ
        shelters = [n for n, d in G_3d.nodes(data=True) if d.get("room_type") == "siginak"]
        if not shelters:
            building_violations.append(RuleViolationItem(
                violation_code="SIGINAK_M9_SIGINAK_ALANI_BULUNAMADI",
                target_node_id=0,
                expected_value=1,
                actual_value=0,
                diagnostic_stage=3,
                severity="CRITICAL",
                description_tr="Binanın bodrum katında yönetmeliğe uygun Serpinti Sığınağı tespit edilemedi.",
                remedy_recommendation_tr="Bodrum katta kişi başı min 1.0 m² veya inşaat alanına oranlı sığınak tahsis edilmelidir.",
                regulation_reference="3194 Sayılı İmar Kanunu Sığınak Yönetmeliği - Madde 9",
                floor_level=-1
            ))
        else:
            for s_node in shelters:
                s_area = float(G_3d.nodes[s_node].get("area_m2", 0.0))
                s_pt = G_3d.nodes[s_node].get("anchor_point")
                # Sığınak girişinde hava kilidi (airlock) var mı?
                s_neighbors = list(G_3d.neighbors(s_node))
                has_airlock = any("hava_kilidi" in G_3d.nodes[nbr].get("name_label", "").lower() or G_3d.nodes[nbr].get("room_type") == "hava_kilidi" for nbr in s_neighbors)
                if not has_airlock:
                    building_violations.append(RuleViolationItem(
                        violation_code="SIGINAK_M13_HAVA_KILIDI_EKSIK",
                        target_node_id=s_node,
                        expected_value="cift_kapili_hava_kilidi",
                        actual_value="hava_kilitsiz_giris",
                        diagnostic_stage=3,
                        severity="CRITICAL",
                        description_tr=(
                            f"Sığınak girişinde zehirli gaz sızmasını engelleyen çift kapılı sızdırmaz "
                            f"Hava Kilidi (Airlock) tespit edilemedi."
                        ),
                        remedy_recommendation_tr="Sığınak giriş kapısı önüne min 1.5 m² alanlı çift kapılı sızdırmaz hava kilidi eklenmelidir.",
                        regulation_reference="Sığınak Yönetmeliği - Madde 13",
                        floor_level=G_3d.nodes[s_node].get("floor_level", -1),
                        spatial_coords=s_pt
                    ))

        # 3.3. OTOPARK YÖNETMELİĞİ & BYKHY MADDE 60 - OTOPARK GEÇİŞ YASAĞI
        parkings = [n for n, d in G_3d.nodes(data=True) if d.get("room_type") == "otopark"]
        for p_node in parkings:
            p_neighbors = list(G_3d.neighbors(p_node))
            p_pt = G_3d.nodes[p_node].get("anchor_point")
            for nbr in p_neighbors:
                nbr_type = G_3d.nodes[nbr].get("room_type", "")
                if nbr_type in ("yangin_merdiveni", "asansor", "kat_koridoru"):
                    building_violations.append(RuleViolationItem(
                        violation_code="OTOPARK_M60_DOGRADAN_MERDIVEN_BAGLANTISI",
                        target_node_id=nbr,
                        expected_value="yangin_holu_araciligiyla",
                        actual_value="dogrudan_baglanti",
                        diagnostic_stage=3,
                        severity="CRITICAL",
                        description_tr=(
                            "Kapalı otopark alanından doğrudan yangın merdivenine / asansör holüne kapı açılmıştır. "
                            "Otopark yangınında merdiven kovasına duman sızmasını önlemek için doğrudan geçiş yasaktır."
                        ),
                        remedy_recommendation_tr="Otopark ile düşey çekirdek arasına duman tahliyeli yangın güvenlik holü yerleştirilmelidir.",
                        regulation_reference="Otopark Yönetmeliği & BYKHY Madde 60",
                        floor_level=G_3d.nodes[p_node].get("floor_level", -1),
                        spatial_coords=p_pt
                    ))

        # Bina Geneli Raporu Kaydı
        if building_violations:
            reports.append(CandidateDiagnosticReport(
                anchor_node_id=0,
                target_subgraph_nodes=[],
                is_fully_compliant=False,
                diagnostic_stage_reached=3,
                violations=building_violations,
                summary_message=f"Bina geneli ve düşey çekirdeklerde {len(building_violations)} adet mevzuat ihlali tespit edildi."
            ))

        return reports
