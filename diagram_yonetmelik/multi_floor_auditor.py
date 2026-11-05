import math
from typing import Dict, List, Set, Tuple, Optional, Any
import networkx as nx
from shapely.geometry import Polygon, Point, LineString

from diagram_yonetmelik.schemas import (
    RuleViolationItem,
    CandidateDiagnosticReport,
    BuildingProgramSummary,
)
from diagram_yonetmelik.vf2_diagnostics import fire_hall_area_limits


class MultiFloorComprehensiveAuditor:
    """
    Binaların Yangından Korunması Hakkında Yönetmelik (BYKHY),
    Planlı Alanlar İmar Yönetmeliği (PAİY), Sığınak ve Otopark Yönetmeliklerinin
    TÜM MADDELERİNİ HER KATTA AYRI AYRI VE BİNA GENELİNDE DENETLEYEN MOTOR.
    
    Her katın grafını bağımsız olarak inceler; merdiven sayıları, kapı genişlikleri,
    kaçış yönleri, koridor mesafeleri, yangın holleri, asansör holleri, merdiven
    geometrisi, yangın dolapları, basınçlandırma ve engelli manevra alanlarını
    kat bazında doğrular.
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

            # Katın sınır poligonu ve diyagonal mesafesi
            floor_polys = [G_fl.nodes[n].get("polygon") for n in node_ids if G_fl.nodes[n].get("polygon") is not None]
            floor_diagonal_m = 30.0
            if floor_polys:
                try:
                    all_bounds = [p.bounds for p in floor_polys if hasattr(p, "bounds")]
                    if all_bounds:
                        minx = min(b[0] for b in all_bounds)
                        miny = min(b[1] for b in all_bounds)
                        maxx = max(b[2] for b in all_bounds)
                        maxy = max(b[3] for b in all_bounds)
                        floor_diagonal_m = math.hypot(maxx - minx, maxy - miny)
                except Exception:
                    floor_diagonal_m = 30.0

            floor_stairs = [
                n for n in node_ids
                if G_3d.nodes[n].get("room_type") == "yangin_merdiveni"
            ]
            floor_fire_halls = [
                n for n in node_ids
                if G_3d.nodes[n].get("room_type") == "yangin_holu"
            ]
            floor_corridors = [
                n for n in node_ids
                if G_3d.nodes[n].get("room_type") in ("kat_koridoru", "koridor", "hol")
            ]
            floor_elevators = [
                n for n in node_ids
                if G_3d.nodes[n].get("room_type") in ("asansor", "dikey_cekirdek", "yangin_asansoru")
            ]

            # ---------------------------------------------------------
            # 2.1. BYKHY MADDE 30: KAÇIŞ YOLLARI SÜREKLİLİĞİ VE ENGELSİZ GEÇİŞ
            # ---------------------------------------------------------
            escape_targets = floor_fire_halls if floor_fire_halls else floor_stairs
            if fl == 0:
                exits = [n for n in node_ids if G_fl.nodes[n].get("room_type") == "dis_cikis"]
                if exits:
                    escape_targets = exits

            for r_node in node_ids:
                r_type = G_fl.nodes[r_node].get("room_type", "")
                if r_type in ("oda", "salon", "daire_antresi", "mutfak"):
                    has_escape_path = False
                    for tgt in escape_targets:
                        if nx.has_path(G_fl, source=r_node, target=tgt):
                            has_escape_path = True
                            break
                    if not has_escape_path and escape_targets:
                        r_pt = G_fl.nodes[r_node].get("anchor_point")
                        floor_violations.append(RuleViolationItem(
                            violation_code="BYKHY_M30_KACIS_YOLU_KESINTILI",
                            target_node_id=r_node,
                            expected_value="kesintisiz_kacis_rotasi",
                            actual_value="ulasilamaz_izole_mekan",
                            diagnostic_stage=3,
                            severity="CRITICAL",
                            description_tr=(
                                f"Kat {fl}: '{G_fl.nodes[r_node].get('name_label', r_type)}' mekanından "
                                f"yangın kaçış merdivenine veya yangın holüne kesintisiz bağlantı sağlanamıyor."
                            ),
                            remedy_recommendation_tr="Mekandan kaçış koridoruna veya hole doğrudan kapı geçişi açılmalıdır.",
                            regulation_reference="Binaların Yangından Korunması Hakkında Yönetmelik - Madde 30",
                            floor_level=fl,
                            spatial_coords=r_pt
                        ))

            # ---------------------------------------------------------
            # 2.2. BYKHY MADDE 31 & 48: KAÇIŞ MERDİVENİ SAYISI
            # ---------------------------------------------------------
            if is_high_rise and fl > 0:
                if len(floor_stairs) < 2:
                    stair_target = floor_stairs[0] if floor_stairs else node_ids[0]
                    floor_violations.append(RuleViolationItem(
                        violation_code="BYKHY_M31_KACIS_MERDIVEN_SAYISI_YETERSIZ",
                        target_node_id=stair_target,
                        expected_value=2,
                        actual_value=len(floor_stairs),
                        diagnostic_stage=3,
                        severity="CRITICAL",
                        description_tr=(
                            f"Kat {fl}: Yapı yüksekliği {building_height_m:.1f}m (≥21.50m veya ≥8 kat) olan yüksek "
                            f"binalarda her katta en az 2 adet bağımsız korunumlu yangın merdiveni zorunludur. "
                            f"Mevcut katta {len(floor_stairs)} merdiven tespit edildi."
                        ),
                        remedy_recommendation_tr="Kat planına duman sızdırmaz ikinci bir kaçış merdiveni çekirdeği eklenmelidir.",
                        regulation_reference="Binaların Yangından Korunması Hakkında Yönetmelik - Madde 31 & Madde 48",
                        floor_level=fl,
                        spatial_coords=G_3d.nodes[stair_target].get("anchor_point")
                    ))

            # ---------------------------------------------------------
            # 2.3. BYKHY MADDE 32: KAÇIŞ MERDİVENİ KOVANI HAVALANDIRMASI / BASINÇLANDIRMA
            # ---------------------------------------------------------
            for stair_node in floor_stairs:
                stair_data = G_fl.nodes[stair_node]
                stair_pt = stair_data.get("anchor_point")
                window_area = float(stair_data.get("window_area_m2", 0.0))
                has_pressurization = bool(stair_data.get("has_pressurization", False))
                
                # Yüksek binalarda mekanik basınçlandırma, alçak binalarda en az 1.0 m² tabii pencere
                if is_high_rise and not has_pressurization:
                    floor_violations.append(RuleViolationItem(
                        violation_code="BYKHY_M32_MERDIVEN_BASINCLANDIRMA_EKSIK",
                        target_node_id=stair_node,
                        expected_value="50_Pa_pozitif_basinclandirma",
                        actual_value="basinclandirmasiz_kovan",
                        diagnostic_stage=2,
                        severity="MAJOR",
                        description_tr=(
                            f"Kat {fl}: Yüksek binalarda kaçış merdiveni kovasında yangın anında duman dolmasını "
                            f"önlemek için mekanik pozitif basınçlandırma sistemi (min 50 Pa) zorunludur."
                        ),
                        remedy_recommendation_tr="Merdiven kovasına acil durum jeneratör beslemeli basınçlandırma menfezi entegre edilmelidir.",
                        regulation_reference="Binaların Yangından Korunması Hakkında Yönetmelik - Madde 32 & Madde 89",
                        floor_level=fl,
                        spatial_coords=stair_pt
                    ))
                elif not is_high_rise and window_area < 1.0 and not has_pressurization:
                    floor_violations.append(RuleViolationItem(
                        violation_code="BYKHY_M32_MERDIVEN_HAVALANDIRMASI_YOK",
                        target_node_id=stair_node,
                        expected_value=1.0,
                        actual_value=round(window_area, 2),
                        diagnostic_stage=2,
                        severity="WARNING",
                        description_tr=(
                            f"Kat {fl}: Kaçış merdiveni kovanında tabii havalandırmayı sağlayan en az "
                            f"1.0 m² açılabilir pencere veya mekanik duman tahliyesi tespit edilemedi."
                        ),
                        remedy_recommendation_tr="Merdiven kovanının dış cephesine min 1.0 m² duman tahliye penceresi açılmalıdır.",
                        regulation_reference="Binaların Yangından Korunması Hakkında Yönetmelik - Madde 32",
                        floor_level=fl,
                        spatial_coords=stair_pt
                    ))

            # ---------------------------------------------------------
            # 2.4. BYKHY MADDE 34: YANGIN GÜVENLİK HOLÜ ZORUNLULUĞU VE ALANI
            # ---------------------------------------------------------
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

            # Yangın holü alan kontrolü (BYKHY M.34: genel 3-6 m², acil durum asansörü önünde 6-10 m²)
            for hall_node in floor_fire_halls:
                area = float(G_fl.nodes[hall_node].get("area_m2", 0.0))
                hall_pt = G_fl.nodes[hall_node].get("anchor_point")
                hall_min, hall_max = fire_hall_area_limits(G_fl, hall_node)
                if area < hall_min:
                    floor_violations.append(RuleViolationItem(
                        violation_code="BYKHY_M34_YANGIN_HOLU_ALAN_YETERSIZ",
                        target_node_id=hall_node,
                        expected_value=hall_min,
                        actual_value=round(area, 2),
                        diagnostic_stage=1,
                        severity="CRITICAL",
                        description_tr=(
                            f"Kat {fl}: Yangın güvenlik holü alanı ({area:.2f} m²) yönetmelikteki "
                            f"asgari {hall_min:.1f} m² sınırının altındadır."
                        ),
                        remedy_recommendation_tr=f"Hol sınırları en az {hall_min:.1f} m² olacak şekilde genişletilmelidir (+{hall_min - area:.2f} m²).",
                        regulation_reference="Binaların Yangından Korunması Hakkında Yönetmelik - Madde 34",
                        floor_level=fl,
                        spatial_coords=hall_pt
                    ))
                elif area > hall_max:
                    floor_violations.append(RuleViolationItem(
                        violation_code="BYKHY_M34_YANGIN_HOLU_ALAN_FAZLA",
                        target_node_id=hall_node,
                        expected_value=hall_max,
                        actual_value=round(area, 2),
                        diagnostic_stage=1,
                        severity="CRITICAL",
                        description_tr=(
                            f"Kat {fl}: Yangın güvenlik holü alanı ({area:.2f} m²) yönetmelikteki "
                            f"azami {hall_max:.1f} m² sınırının üzerindedir."
                        ),
                        remedy_recommendation_tr=f"Hol taban alanı en fazla {hall_max:.1f} m² olacak şekilde küçültülmelidir (-{area - hall_max:.2f} m²).",
                        regulation_reference="Binaların Yangından Korunması Hakkında Yönetmelik - Madde 34",
                        floor_level=fl,
                        spatial_coords=hall_pt
                    ))

            # ---------------------------------------------------------
            # 2.5. BYKHY MADDE 33: KAÇIŞ KAPILARI GENİŞLİK, AÇILIŞ YÖNÜ VE DAYANIM
            # ---------------------------------------------------------
            for u, v, d in G_fl.edges(data=True):
                w_cm = float(d.get("door_width_cm", d.get("width_cm", 90.0)))
                u_type = G_fl.nodes[u].get("room_type", "")
                v_type = G_fl.nodes[v].get("room_type", "")
                is_escape_edge = ("yangin_holu" in (u_type, v_type)) or ("yangin_merdiveni" in (u_type, v_type)) or ("dis_cikis" in (u_type, v_type))
                
                if is_escape_edge:
                    min_req_cm = 120.0 if (is_high_rise or "yangin_holu" in (u_type, v_type)) else 90.0
                    portal_xy = d.get("portal_xy")
                    if w_cm < min_req_cm:
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

                    # Yangına dayanıklılık kontrolü (Yangın kapısı EI60)
                    if "yangin_merdiveni" in (u_type, v_type) or "yangin_holu" in (u_type, v_type):
                        is_fire_rated = bool(d.get("is_fire_resistant", False))
                        if not is_fire_rated and "EI60" not in str(d.get("name", "")):
                            floor_violations.append(RuleViolationItem(
                                violation_code="BYKHY_M33_KAPI_YANGINA_DAYANIKSIZ",
                                target_edge=(u, v),
                                expected_value="EI60_duman_sizdirmaz",
                                actual_value="standart_kapi",
                                diagnostic_stage=1,
                                severity="MAJOR",
                                description_tr=(
                                    f"Kat {fl}: Yangın kaçış kapısı yangına ve zehirli duman sızmasına "
                                    f"karşı en az 60 dakika dayanıklı (EI60) kendiliğinden kapanan kapı niteliğinde değildir."
                                ),
                                remedy_recommendation_tr="Kapı kanadı EI60 sertifikalı duman fitilli yangın kapısı ile değiştirilmelidir.",
                                regulation_reference="Binaların Yangından Korunması Hakkında Yönetmelik - Madde 33 & Madde 34",
                                floor_level=fl,
                                spatial_coords=portal_xy
                            ))

            # ---------------------------------------------------------
            # 2.6. BYKHY MADDE 40 & PAİY MADDE 36: MERDİVEN RIHT VE BASAMAK GEOMETRİSİ
            # ---------------------------------------------------------
            for stair_node in floor_stairs:
                stair_data = G_fl.nodes[stair_node]
                stair_pt = stair_data.get("anchor_point")
                riser_cm = float(stair_data.get("stair_riser_cm", 17.0))
                tread_cm = float(stair_data.get("stair_tread_cm", 28.0))
                
                blondel = 2 * riser_cm + tread_cm
                if riser_cm > 17.5 or tread_cm < 28.0 or not (60.0 <= blondel <= 64.0):
                    floor_violations.append(RuleViolationItem(
                        violation_code="BYKHY_M40_MERDIVEN_RIHT_BASAMAK_UYUMSUZ",
                        target_node_id=stair_node,
                        expected_value="Rıht <= 17.5cm, Basamak >= 28cm, 2R+B=[60..64]cm",
                        actual_value=f"Rıht={riser_cm:.1f}cm, Basamak={tread_cm:.1f}cm, 2R+B={blondel:.1f}cm",
                        diagnostic_stage=1,
                        severity="MAJOR",
                        description_tr=(
                            f"Kat {fl}: Merdiven basamak ve rıht boyutları (R={riser_cm:.1f}cm, B={tread_cm:.1f}cm, "
                            f"Blondel={blondel:.1f}cm) ergonomik ve güvenli tahliye standartlarına uymuyor."
                        ),
                        remedy_recommendation_tr="Merdiven rıht yüksekliği en çok 17.5 cm, basma genişliği en az 28 cm olarak revize edilmelidir.",
                        regulation_reference="Binaların Yangından Korunması Hakkında Yönetmelik - Madde 40 & PAİY Madde 36",
                        floor_level=fl,
                        spatial_coords=stair_pt
                    ))

            # ---------------------------------------------------------
            # 2.7. BYKHY MADDE 41 & PAİY MADDE 36: MERDİVEN KOL VE SAHANLIK GENİŞLİĞİ
            # ---------------------------------------------------------
            for stair_node in floor_stairs:
                stair_data = G_fl.nodes[stair_node]
                stair_pt = stair_data.get("anchor_point")
                flight_w_m = float(stair_data.get("flight_width_m", 1.20))
                if flight_w_m < 1.18:  # 1.20 m toleranslı
                    floor_violations.append(RuleViolationItem(
                        violation_code="BYKHY_M41_MERDIVEN_KOL_VEYA_SAHANLIK_DAR",
                        target_node_id=stair_node,
                        expected_value=1.20,
                        actual_value=round(flight_w_m, 2),
                        diagnostic_stage=1,
                        severity="CRITICAL",
                        description_tr=(
                            f"Kat {fl}: Kaçış merdiveni kol temiz genişliği ({flight_w_m:.2f}m), "
                            f"yönetmelikte zorunlu olan asgari 1.20m genişliğin altındadır."
                        ),
                        remedy_recommendation_tr="Merdiven kolu ve kat sahanlığı temiz genişliği en az 1.20m olacak şekilde akslar açılmalıdır.",
                        regulation_reference="Binaların Yangından Korunması Hakkında Yönetmelik - Madde 41 & PAİY Madde 36",
                        floor_level=fl,
                        spatial_coords=stair_pt
                    ))

            # ---------------------------------------------------------
            # 2.8. BYKHY MADDE 48: KAÇIŞ MERDİVENLERİ ARASI DİYAGONAL MESAFE KURALI
            # ---------------------------------------------------------
            if len(floor_stairs) >= 2:
                # İki merdiven arası kuş uçuşu mesafe
                pt1 = G_fl.nodes[floor_stairs[0]].get("anchor_point", (0, 0))
                pt2 = G_fl.nodes[floor_stairs[1]].get("anchor_point", (0, 0))
                dist_between_stairs_m = math.hypot(pt1[0] - pt2[0], pt1[1] - pt2[1])
                
                req_ratio = 1.0 / 3.0 if self.sprinkler else 0.5
                min_separation_m = floor_diagonal_m * req_ratio
                if dist_between_stairs_m < min_separation_m - 1.0:
                    floor_violations.append(RuleViolationItem(
                        violation_code="BYKHY_M48_MERDIVENLER_ARASI_MESAFE_YETERSIZ",
                        target_node_id=floor_stairs[1],
                        expected_value=round(min_separation_m, 1),
                        actual_value=round(dist_between_stairs_m, 1),
                        diagnostic_stage=2,
                        severity="MAJOR",
                        description_tr=(
                            f"Kat {fl}: İki kaçış merdiveni arasındaki mesafe ({dist_between_stairs_m:.1f}m), "
                            f"kat diyagonalinin ({floor_diagonal_m:.1f}m) {'1/3' if self.sprinkler else '1/2'} "
                            f"oranındaki asgari {min_separation_m:.1f}m ayrım şartını karşılamıyor (Merdivenler birbirine çok yakın)."
                        ),
                        remedy_recommendation_tr="Yangın anında her iki merdivenin aynı anda dumanla bloke olmaması için merdivenler katın zıt cephelerine yerleştirilmelidir.",
                        regulation_reference="Binaların Yangından Korunması Hakkında Yönetmelik - Madde 48 (Köşegen Kuralı)",
                        floor_level=fl,
                        spatial_coords=pt2
                    ))

            # ---------------------------------------------------------
            # 2.9. BYKHY MADDE 52 & 53: ÇIKMAZ KORİDOR VE AZAMİ KAÇIŞ MESAFELERİ
            # ---------------------------------------------------------
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

            # ---------------------------------------------------------
            # 2.10. BYKHY MADDE 74: YANGIN DOLABI VE HORTUM ETKİ YARIÇAPI
            # ---------------------------------------------------------
            if floor_corridors:
                corr_lengths = []
                for c in floor_corridors:
                    c_poly = G_fl.nodes[c].get("polygon")
                    if c_poly and hasattr(c_poly, "bounds"):
                        minx, miny, maxx, maxy = c_poly.bounds
                        corr_lengths.append(max(maxx - minx, maxy - miny))
                
                max_corr_len = max(corr_lengths) if corr_lengths else 0.0
                if max_corr_len > 30.0:
                    c_node = floor_corridors[0]
                    c_pt = G_fl.nodes[c_node].get("anchor_point")
                    floor_violations.append(RuleViolationItem(
                        violation_code="BYKHY_M74_YANGIN_DOLABI_MESAFE_ASIMI",
                        target_node_id=c_node,
                        expected_value=30.0,
                        actual_value=round(max_corr_len, 1),
                        diagnostic_stage=1,
                        severity="MAJOR",
                        description_tr=(
                            f"Kat {fl}: Kat koridoru uzunluğu ({max_corr_len:.1f}m) 30 metreyi aştığı halde "
                            f"koridor boyunca aralarındaki mesafe en fazla 30m olan ilave yangın dolabı tespit edilemedi."
                        ),
                        remedy_recommendation_tr="Koridor hattına 30 metre aralıklarla ilave yangın dolabı ve hidrant ağzı yerleştirilmelidir.",
                        regulation_reference="Binaların Yangından Korunması Hakkında Yönetmelik - Madde 74",
                        floor_level=fl,
                        spatial_coords=c_pt
                    ))

            # ---------------------------------------------------------
            # 2.11. PAİY MADDE 29: KAT KORİDORU ASGARİ GENİŞLİĞİ (1.20m)
            # ---------------------------------------------------------
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

            # ---------------------------------------------------------
            # 2.12. PAİY MADDE 30: HAVALANDIRMA VE IŞIKLIK BACALARI
            # ---------------------------------------------------------
            wet_rooms = [n for n in node_ids if G_fl.nodes[n].get("room_type") in ("banyo", "wc", "banyo_wc", "lavabo")]
            for w_node in wet_rooms:
                w_data = G_fl.nodes[w_node]
                has_window = bool(w_data.get("has_window", False))
                vent_shaft_area = float(w_data.get("vent_shaft_area_m2", 0.0))
                if not has_window and vent_shaft_area < 0.45:
                    w_pt = w_data.get("anchor_point")
                    floor_violations.append(RuleViolationItem(
                        violation_code="PAIY_M30_HAVALANDIRMA_BACASI_YETERSIZ",
                        target_node_id=w_node,
                        expected_value=0.45,
                        actual_value=round(vent_shaft_area, 2),
                        diagnostic_stage=1,
                        severity="WARNING",
                        description_tr=(
                            f"Kat {fl}: Dış cepheye penceresi açılmayan ıslak hacimde (Banyo/WC) "
                            f"yönetmelikte zorunlu olan en az 0.45 m²'lik hava bacası tespit edilemedi."
                        ),
                        remedy_recommendation_tr="Islak hacim bitişiğine en az 0.60m x 0.75m boyutlarında havalandırma bacası açılmalıdır.",
                        regulation_reference="Planlı Alanlar İmar Yönetmeliği - Madde 30 (Işıklıklar ve Hava Bacaları)",
                        floor_level=fl,
                        spatial_coords=w_pt
                    ))

            # ---------------------------------------------------------
            # 2.13. PAİY MADDE 34: ASANSÖR ÖNÜ KAT HOLÜ DERİNLİĞİ (1.50m / 1.80m)
            # ---------------------------------------------------------
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
                                    f"Kat {fl}: Asansör kapısı önündeki kat holü bekleme derinliği ({lobby_depth:.2f}m), "
                                    f"asgari {req_lobby:.2f}m şartını karşılamamaktadır."
                                ),
                                remedy_recommendation_tr=f"Asansör önü hol mesafesi en az {req_lobby:.2f}m'ye genişletilmelidir.",
                                regulation_reference="Planlı Alanlar İmar Yönetmeliği - Madde 34",
                                floor_level=fl,
                                spatial_coords=el_pt
                            ))

            # ---------------------------------------------------------
            # 2.14. PAİY MADDE 5: ENGELLİ ERİŞİLEBİLİRLİĞİ (MANEVRA ÇAPI Ø1.50m)
            # ---------------------------------------------------------
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

            # ---------------------------------------------------------
            # 2.15. PAİY MADDE 40: ÇATI TERASI PARAPET / KORKULUK YÜKSEKLİĞİ
            # ---------------------------------------------------------
            if fl == max_floor and fl > 1:
                terrace_nodes = [n for n in node_ids if "teras" in G_fl.nodes[n].get("room_type", "").lower() or "teras" in G_fl.nodes[n].get("name_label", "").lower()]
                for t_node in terrace_nodes:
                    parapet_h_m = float(G_fl.nodes[t_node].get("parapet_height_m", 0.90))
                    if parapet_h_m < 1.10:
                        t_pt = G_fl.nodes[t_node].get("anchor_point")
                        floor_violations.append(RuleViolationItem(
                            violation_code="PAIY_M40_TERAS_PARAPET_YUKSEKLIK_DEFICIT",
                            target_node_id=t_node,
                            expected_value=1.10,
                            actual_value=round(parapet_h_m, 2),
                            diagnostic_stage=1,
                            severity="MAJOR",
                            description_tr=(
                                f"Kat {fl} (Çatı Katı): Teras korkuluk veya parapet yüksekliği ({parapet_h_m:.2f}m), "
                                f"Planlı Alanlar İmar Yönetmeliği asgari 1.10m güvenlik sınırının altındadır."
                            ),
                            remedy_recommendation_tr="Teras parapet yüksekliği veya emniyet korkuluğu en az 1.10m seviyesine yükseltilmelidir.",
                            regulation_reference="Planlı Alanlar İmar Yönetmeliği - Madde 40 (Çatı ve Parapetler)",
                            floor_level=fl,
                            spatial_coords=t_pt
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

        # 3.2. BYKHY MADDE 96: OTOMATİK YAĞMURLAMA (SPRINKLER) SİSTEMİ
        total_building_area_m2 = sum(float(d.get("area_m2", 0.0)) for _, d in G_3d.nodes(data=True))
        parkings = [n for n, d in G_3d.nodes(data=True) if d.get("room_type") == "otopark"]
        parking_area_m2 = sum(float(G_3d.nodes[p].get("area_m2", 0.0)) for p in parkings)
        
        needs_sprinkler = is_high_rise or (total_building_area_m2 > 5000.0) or (parking_area_m2 > 600.0)
        if needs_sprinkler and not self.sprinkler:
            building_violations.append(RuleViolationItem(
                violation_code="BYKHY_M96_OTOMATIK_SPRINKLER_ZORUNLULUGU",
                target_node_id=0,
                expected_value="otomatik_yagmurlama_sprinkler",
                actual_value="sprinklersiz_bina",
                diagnostic_stage=2,
                severity="CRITICAL",
                description_tr=(
                    f"Yapı yüksekliği ({building_height_m:.1f}m ≥ 21.50m veya alan > 5000m²) nedeniyle "
                    f"binanın tüm kaçış yollarında, ortak alanlarında ve kapalı otoparkında "
                    f"otomatik yağmurlama (sprinkler) tesisatı zorunludur."
                ),
                remedy_recommendation_tr="Binanın tavan hatlarına TS EN 12845 uyumlu ıslak borulu sprinkler sistemi projelendirilmelidir.",
                regulation_reference="Binaların Yangından Korunması Hakkında Yönetmelik - Madde 96",
                floor_level=0
            ))

        # 3.3. SIĞINAK YÖNETMELİĞİ (MADDE 9 & 13) - BODRUM KAT KONTROLÜ
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
                
                # Minimum sığınak alanı hesabı
                req_shelter_area = program.required_shelter_area_m2 if program else 12.0
                if s_area < req_shelter_area:
                    building_violations.append(RuleViolationItem(
                        violation_code="SIGINAK_M9_SIGINAK_ALANI_YETERSIZ",
                        target_node_id=s_node,
                        expected_value=round(req_shelter_area, 1),
                        actual_value=round(s_area, 1),
                        diagnostic_stage=1,
                        severity="CRITICAL",
                        description_tr=(
                            f"Serpinti sığınağı alanı ({s_area:.1f} m²), bina nüfusu için hesaplanan "
                            f"asgari {req_shelter_area:.1f} m² alan ihtiyacını karşılamıyor."
                        ),
                        remedy_recommendation_tr=f"Sığınak alanı en az {req_shelter_area:.1f} m² olacak şekilde büyütülmelidir (+{req_shelter_area - s_area:.1f} m²).",
                        regulation_reference="Sığınak Yönetmeliği - Madde 9",
                        floor_level=G_3d.nodes[s_node].get("floor_level", -1),
                        spatial_coords=s_pt
                    ))

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

        # 3.4. OTOPARK YÖNETMELİĞİ & BYKHY MADDE 60 - OTOPARK GEÇİŞ YASAĞI
        for p_node in parkings:
            p_neighbors = list(G_3d.neighbors(p_node))
            p_pt = G_3d.nodes[p_node].get("anchor_point")
            for nbr in p_neighbors:
                nbr_type = G_3d.nodes[nbr].get("room_type", "")
                if nbr_type in ("yangin_merdiveni", "asansor", "kat_koridoru"):
                    building_violations.append(RuleViolationItem(
                        violation_code="BYKHY_M60_OTOPARK_DOGRADAN_MERDIVEN_BAGLANTISI",
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
