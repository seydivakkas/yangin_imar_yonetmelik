import math
from typing import Dict, List, Tuple, Optional, Any
import ezdxf
from ezdxf.document import Drawing
from shapely.geometry import Polygon, LineString, Point

from diagram_yonetmelik.schemas import (
    RuleViolationItem,
    CandidateDiagnosticReport,
    DesignInterventionStep,
    CounterfactualOptimizationResult,
    RoomPolygonInput,
    DoorGeometryInput,
)


class DXFViolationAnnotator:
    """
    Tespit edilen yönetmelik ihlallerini AutoCAD (.dxf) paftasına
    kırmızı ACI 1 katmanlarıyla işler:
    - Kırmızı kısıt sınır kutuları ve mahal sınırları (DENETIM_IHLALLERI)
    - Katı üçgen uçlu kılavuz okları (Leader Arrow) ve hedef çemberleri
    - Mevzuat madde numaralarını içeren maskeli MTEXT lider açıklamaları (DENETIM_IHLALLERI_METIN).
    """
    def annotate_violations_on_dxf(
        self,
        dxf_doc: Drawing,
        diagnostic_reports: List[CandidateDiagnosticReport],
        rooms: List[RoomPolygonInput],
        unit_scale_to_meters: float = 0.01
    ) -> Drawing:
        msp = dxf_doc.modelspace()
        scale = unit_scale_to_meters
        inv_scale = 1.0 / max(1e-4, scale)

        # Katmanları Tanımla
        layers = dxf_doc.layers
        if "DENETIM_IHLALLERI" not in layers:
            layers.new("DENETIM_IHLALLERI", dxfattribs={"color": 1, "lineweight": 50})  # ACI 1: Kırmızı
        if "DENETIM_IHLALLERI_METIN" not in layers:
            layers.new("DENETIM_IHLALLERI_METIN", dxfattribs={"color": 7})              # ACI 7: Beyaz / Arka Plan Maskeli

        room_map = {r.room_id: r for r in rooms}

        # İhlalleri hedefe göre grupla
        grouped_by_target: Dict[int, List[RuleViolationItem]] = {}
        for rep in diagnostic_reports:
            for v in rep.violations:
                target_key = v.target_node_id or rep.anchor_node_id
                if target_key not in grouped_by_target:
                    grouped_by_target[target_key] = []
                grouped_by_target[target_key].append(v)

        for target_node, viols in grouped_by_target.items():
            r_info = room_map.get(target_node)
            if not r_info:
                continue

            poly = r_info.polygon
            coords = list(poly.exterior.coords)
            dxf_pts = [(x, y) for x, y in coords]

            # 1. Kusurlu Odanın Sınırını Kırmızı Kalın Çizgiyle Çiz
            msp.add_lwpolyline(dxf_pts, close=True, dxfattribs={"layer": "DENETIM_IHLALLERI", "color": 1})

            # Merkez Noktası
            cx = r_info.global_dxf_pos[0]
            cy = r_info.global_dxf_pos[1]

            # Hedef Kısıt Kutusu (Bounding Constraint Box)
            box_r = 30.0
            constraint_box = [
                (cx - box_r, cy - box_r),
                (cx + box_r, cy - box_r),
                (cx + box_r, cy + box_r),
                (cx - box_r, cy + box_r)
            ]
            msp.add_lwpolyline(constraint_box, close=True, dxfattribs={"layer": "DENETIM_IHLALLERI", "color": 1, "lineweight": 35})
            msp.add_circle((cx, cy), radius=10.0, dxfattribs={"layer": "DENETIM_IHLALLERI", "color": 1})

            # 2. Lider Çizgisi ve Katı Ok Ucu (Leader Arrow)
            tx = cx + 80.0
            ty = cy + 70.0
            dx = cx - tx
            dy = cy - ty
            dist = math.hypot(dx, dy)
            if dist > 1e-3:
                ux = dx / dist
                uy = dy / dist
                px = -uy
                py = ux
                arrow_len = 25.0
                arrow_w = 10.0
                tip = (cx, cy)
                base1 = (cx - ux * arrow_len + px * (arrow_w / 2.0),
                         cy - uy * arrow_len + py * (arrow_w / 2.0))
                base2 = (cx - ux * arrow_len - px * (arrow_w / 2.0),
                         cy - uy * arrow_len - py * (arrow_w / 2.0))
                # Katı üçgen ok ucu
                msp.add_lwpolyline([tip, base1, base2], close=True, dxfattribs={"layer": "DENETIM_IHLALLERI", "color": 1})
                # Kılavuz çizgisi
                msp.add_line((cx - ux * arrow_len, cy - uy * arrow_len), (tx, ty), dxfattribs={"layer": "DENETIM_IHLALLERI", "color": 1, "lineweight": 25})

            # 3. İhlal Metin Balonu (Maskeli MTEXT)
            room_name = getattr(r_info, "name_label", None) or f"Oda #{target_node}"
            lines = [r"{\C1\b! İHLAL RAPORU: " + str(room_name) + r"}\P"]
            for idx, v in enumerate(viols[:4], start=1):
                reg_ref = f"[{v.violation_code}]"
                lines.append(f"{idx}. {reg_ref} {v.description_tr}")
                if v.remedy_recommendation_tr:
                    lines.append(f"   -> Oneri: {v.remedy_recommendation_tr}")
            if len(viols) > 4:
                lines.append(f"   ... ve {len(viols) - 4} adet ek kural ihlali.")
            body = "\\P".join(lines)

            mtext = msp.add_mtext(
                body,
                dxfattribs={
                    "layer": "DENETIM_IHLALLERI_METIN",
                    "char_height": 22.0,
                    "width": 380.0
                }
            )
            mtext.set_location(insert=(tx + 5.0, ty + 20.0))

        return dxf_doc


class DXFOptimizationAnnotator:
    """
    Karşı-olgusal optimizasyon adımlarını AutoCAD (.dxf) paftasına yeşil ACI 3
    ve camgöbeği ACI 4 katmanlarıyla işler:
    - Native AutoCAD REVCLOUD uyumlu (0.55 yay bombeli) çok loblu revizyon bulutları (OPTIMIZASYON_ONERILERI)
    - Önerilen kapı genişletme (+30cm / 1.20m) ve hava kilidi sınır çizgileri
    - Açıklayıcı tadilat metinleri (OPTIMIZASYON_OLCU).
    """
    def annotate_optimizations_on_dxf(
        self,
        dxf_doc: Drawing,
        opt_result: CounterfactualOptimizationResult,
        unit_scale_to_meters: float = 0.01
    ) -> Drawing:
        msp = dxf_doc.modelspace()
        scale = unit_scale_to_meters
        inv_scale = 1.0 / max(1e-4, scale)

        layers = dxf_doc.layers
        if "OPTIMIZASYON_ONERILERI" not in layers:
            layers.new("OPTIMIZASYON_ONERILERI", dxfattribs={"color": 3, "lineweight": 40})  # ACI 3: Yeşil
        if "OPTIMIZASYON_OLCU" not in layers:
            layers.new("OPTIMIZASYON_OLCU", dxfattribs={"color": 4})                        # ACI 4: Camgöbeği

        for step in opt_result.intervention_steps:
            coords = step.spatial_coords
            if not coords or (coords[0] < 300.0 and coords[1] < 300.0):
                continue
            cx = coords[0]
            cy = coords[1]

            # 1. Gerçek AutoCAD Revizyon Bulutu (REVCLOUD - 8 Loblu, Bulge = 0.55 Yay)
            # Bulge 0.55 = tan(theta/4) => theta ≈ 115.6 derece dışbükey dairesel yay
            lobes = 8
            r_box = 85.0
            cloud_pts = []
            for i in range(lobes):
                ang = 2.0 * math.pi * i / lobes
                px = cx + r_box * math.cos(ang)
                py = cy + r_box * math.sin(ang)
                cloud_pts.append((px, py, 0.55))
            msp.add_lwpolyline(cloud_pts, format="xyb", close=True, dxfattribs={"layer": "OPTIMIZASYON_ONERILERI", "color": 3})

            # 2. Önerilen Genişleme / Hava Kilidi Sınır Çizgileri (Dashed Green Box)
            exp_w = 110.0
            exp_h = 75.0
            expansion_box = [
                (cx - exp_w / 2.0, cy - exp_h / 2.0),
                (cx + exp_w / 2.0, cy - exp_h / 2.0),
                (cx + exp_w / 2.0, cy + exp_h / 2.0),
                (cx - exp_w / 2.0, cy + exp_h / 2.0)
            ]
            msp.add_lwpolyline(expansion_box, close=True, dxfattribs={"layer": "OPTIMIZASYON_ONERILERI", "color": 3, "lineweight": 25})

            # 3. Öneri Açıklama Metni (Sol-Üst Eksen)
            hdr = r"{\C3\bREVİZYON #" + str(step.step_id) + r": " + str(step.action_type) + r"}\P"
            text_body = (
                hdr +
                f"{step.description_tr}\\P"
                f"Fayda İndeksi: {step.marginal_benefit_score:.1f} | Maliyet: {step.cost_index:.1f} | Hedef: 1.20m EI60"
            )
            mtext = msp.add_mtext(
                text_body,
                dxfattribs={
                    "layer": "OPTIMIZASYON_OLCU",
                    "char_height": 20.0,
                    "width": 340.0
                }
            )
            mtext.set_location(insert=(cx - 380.0, cy + 60.0))
            msp.add_line((cx, cy), (cx - 40.0, cy + 60.0), dxfattribs={"layer": "OPTIMIZASYON_ONERILERI", "color": 3})

        return dxf_doc


class DXFAuditTableAnnotator:
    """
    Pafta antetinin veya kat planının hemen yanına otomatik yerleştirilen,
    tespit edilen tüm mevzuat ihlallerini, revizyon durumlarını ve resmi
    onay antetini içeren native AutoCAD CAD Tablosu (DENETIM_OZET_TABLOSU).
    """
    def annotate_audit_table_on_dxf(
        self,
        dxf_doc: Drawing,
        diagnostic_reports: List[CandidateDiagnosticReport],
        opt_result: CounterfactualOptimizationResult,
        rooms: List[RoomPolygonInput],
        doors: List[DoorGeometryInput],
        unit_scale_to_meters: float = 0.01,
        project_title: str = "Çok Katlı Konut Yapısı"
    ) -> Drawing:
        msp = dxf_doc.modelspace()
        scale = unit_scale_to_meters
        inv_scale = 1.0 / max(1e-4, scale)

        layers = dxf_doc.layers
        if "DENETIM_OZET_TABLOSU" not in layers:
            layers.new("DENETIM_OZET_TABLOSU", dxfattribs={"color": 4, "lineweight": 35})         # ACI 4: Camgöbeği
        if "DENETIM_OZET_TABLOSU_METIN" not in layers:
            layers.new("DENETIM_OZET_TABLOSU_METIN", dxfattribs={"color": 8})                     # ACI 8: Koyu Gri / Kontrastlı Siyah
        if "DENETIM_ONAY_DAMGASI" not in layers:
            layers.new("DENETIM_ONAY_DAMGASI", dxfattribs={"color": 3, "lineweight": 50})         # ACI 3: Yeşil

        # Çizim sınır kutusunu (bounding box) hesapla
        all_x: List[float] = []
        all_y: List[float] = []
        for r in rooms:
            if hasattr(r, "polygon") and r.polygon:
                for pt in r.polygon.exterior.coords:
                    all_x.append(pt[0])
                    all_y.append(pt[1])
        if not all_x:
            for e in msp:
                if hasattr(e, "dxf") and hasattr(e.dxf, "insert"):
                    ins = e.dxf.insert
                    all_x.append(ins[0])
                    all_y.append(ins[1])

        x_max = max(all_x) if all_x else 2400.0
        y_max = max(all_y) if all_y else 1800.0

        # Tabloyu çizimin uygun yanına yerleştir (Eğer 8 katlı pafta çerçevesi varsa antet yanına)
        if x_max > 12000.0:
            x_tab = 13850.0
            y_tab = 4600.0
        else:
            x_tab = x_max + 120.0
            y_tab = y_max + 40.0
        table_width = 960.0

        # İhlalleri topla
        all_violations: List[Tuple[str, str, str, str]] = []
        for rep in diagnostic_reports:
            for v in rep.violations:
                all_violations.append((
                    v.violation_code,
                    f"Kat {v.floor_level} (Hedef #{v.target_node_id or rep.anchor_node_id})",
                    v.severity.upper(),
                    v.description_tr
                ))

        is_compliant = (len(all_violations) == 0)
        floors_count = len(set(r.floor_level for r in rooms)) if rooms else 1

        # -------------------------------------------------------------
        # 1. BAŞLIK BANNERI (Title Block Header)
        # -------------------------------------------------------------
        header_h = 70.0
        msp.add_lwpolyline([
            (x_tab, y_tab),
            (x_tab + table_width, y_tab),
            (x_tab + table_width, y_tab - header_h),
            (x_tab, y_tab - header_h)
        ], close=True, dxfattribs={"layer": "DENETIM_OZET_TABLOSU", "color": 4, "lineweight": 40})

        title_mtext = (
            r"{\C4\bT.C. ÇEVRE, ŞEHİRCİLİK VE İKLİM DEĞİŞİKLİĞİ BAKANLIĞI / İTFAİYE DAİRE BAŞKANLIĞI}\P"
            + r"{\C7\bMİMARİ VE YANGIN MEVZUATI DENETİM ÖZET CETVELİ}\P"
            + f"{{\\C8Proje: {project_title} | Tarih: 2026-10-29 | Motor: DiagramYönetmelik GNN+VF2}}"
        )
        mt = msp.add_mtext(title_mtext, dxfattribs={"layer": "DENETIM_OZET_TABLOSU_METIN", "char_height": 18.0, "width": table_width - 40.0})
        mt.set_location(insert=(x_tab + 20.0, y_tab - 12.0))

        cur_y = y_tab - header_h

        # -------------------------------------------------------------
        # 2. MEVZUAT ONAY DAMGASI KUTUSU (Compliance Stamp)
        # -------------------------------------------------------------
        stamp_h = 60.0
        stamp_color = 3 if is_compliant else 1
        stamp_layer = "DENETIM_ONAY_DAMGASI"
        msp.add_lwpolyline([
            (x_tab, cur_y),
            (x_tab + table_width, cur_y),
            (x_tab + table_width, cur_y - stamp_h),
            (x_tab, cur_y - stamp_h)
        ], close=True, dxfattribs={"layer": stamp_layer, "color": stamp_color, "lineweight": 45})

        # Çift çerçeve (Double border)
        msp.add_lwpolyline([
            (x_tab + 6.0, cur_y - 6.0),
            (x_tab + table_width - 6.0, cur_y - 6.0),
            (x_tab + table_width - 6.0, cur_y - stamp_h + 6.0),
            (x_tab + 6.0, cur_y - stamp_h + 6.0)
        ], close=True, dxfattribs={"layer": stamp_layer, "color": stamp_color, "lineweight": 25})

        if is_compliant:
            stamp_text = "Uygulanan denetimlerde ihlal kaydedilmedi."
        else:
            stamp_text = (
                f"{{\\C1\\b[ DİKKAT: {len(all_violations)} ADET MEVZUAT İHLALİ TESPİT EDİLDİ ]}}\\P"
                + r"{\C7İmar ruhsatı ve iskan için kırmızı lider işaretlerindeki ve yeşil revcloud reçetelerindeki tadilatlar gereklidir.}"
            )
        mt_stamp = msp.add_mtext(stamp_text, dxfattribs={"layer": "DENETIM_OZET_TABLOSU_METIN", "char_height": 17.0, "width": table_width - 40.0})
        mt_stamp.set_location(insert=(x_tab + 20.0, cur_y - 12.0))

        cur_y -= stamp_h

        # -------------------------------------------------------------
        # 3. TEMEL METRİK VE GRAF ÖZETİ (4 Hücreli Izgara)
        # -------------------------------------------------------------
        metrics_h = 42.0
        col_w = table_width / 4.0
        kpis = [
            f"TOPLAM MEKAN: {len(rooms)}",
            f"KÖPRÜLENEN GEÇİT: {len(doors)}",
            f"KAT SAYISI: {floors_count}",
            f"TAHLİYE EFORU: {opt_result.baseline_evacuation_time_sec:.1f}s"
        ]
        for c_idx, kpi in enumerate(kpis):
            cx_box = x_tab + c_idx * col_w
            msp.add_lwpolyline([
                (cx_box, cur_y),
                (cx_box + col_w, cur_y),
                (cx_box + col_w, cur_y - metrics_h),
                (cx_box, cur_y - metrics_h)
            ], close=True, dxfattribs={"layer": "DENETIM_OZET_TABLOSU", "color": 4, "lineweight": 25})
            mt_kpi = msp.add_mtext(f"{{\\C7\\b{kpi}}}", dxfattribs={"layer": "DENETIM_OZET_TABLOSU_METIN", "char_height": 14.0, "width": col_w - 10.0})
            mt_kpi.set_location(insert=(cx_box + 12.0, cur_y - 12.0))

        cur_y -= metrics_h

        # -------------------------------------------------------------
        # 4. TABLO SÜTUN BAŞLIKLARI (Table Column Headers)
        # -------------------------------------------------------------
        col_widths = [60.0, 180.0, 150.0, 130.0, 440.0]
        header_cols = ["NO", "MEVZUAT MADDESİ", "MAHAL / KONUM", "KATEGORİ", "DURUM / REVİZYON ÖNERİSİ"]
        cols_h = 35.0

        cur_x = x_tab
        for w, hdr in zip(col_widths, header_cols):
            msp.add_lwpolyline([
                (cur_x, cur_y),
                (cur_x + w, cur_y),
                (cur_x + w, cur_y - cols_h),
                (cur_x, cur_y - cols_h)
            ], close=True, dxfattribs={"layer": "DENETIM_OZET_TABLOSU", "color": 4, "lineweight": 30})
            mt_col = msp.add_mtext(f"{{\\C4\\b{hdr}}}", dxfattribs={"layer": "DENETIM_OZET_TABLOSU_METIN", "char_height": 13.0, "width": w - 8.0})
            mt_col.set_location(insert=(cur_x + 8.0, cur_y - 10.0))
            cur_x += w

        cur_y -= cols_h

        # -------------------------------------------------------------
        # 5. SATIRLAR (Rows: İhlaller veya Kusursuz Pafta Onay Maddeleri)
        # -------------------------------------------------------------
        row_h = 32.0
        table_rows_data = []

        if is_compliant:
            table_rows_data = [("-", "-", "Bina", "ÖZET", "Denetlenen kurallarda ihlal kaydedilmedi")]
        else:
            for idx, (code, loc, sev, desc) in enumerate(all_violations[:10], start=1):
                table_rows_data.append((str(idx), code, loc, sev, desc[:48]))
            if len(all_violations) > 10:
                table_rows_data.append((
                    "...",
                    "VE DİĞER İHLALLER",
                    f"{len(all_violations) - 10} Adet",
                    "ÖZET",
                    "Detaylı liste DXF paftasındaki MTEXT liderlerinde gösterilmektedir."
                ))

        for row_tuple in table_rows_data:
            cur_x = x_tab
            for w, val in zip(col_widths, row_tuple):
                msp.add_lwpolyline([
                    (cur_x, cur_y),
                    (cur_x + w, cur_y),
                    (cur_x + w, cur_y - row_h),
                    (cur_x, cur_y - row_h)
                ], close=True, dxfattribs={"layer": "DENETIM_OZET_TABLOSU", "color": 4, "lineweight": 18})
                mt_val = msp.add_mtext(f"{{\\C7{val}}}", dxfattribs={"layer": "DENETIM_OZET_TABLOSU_METIN", "char_height": 12.0, "width": w - 6.0})
                mt_val.set_location(insert=(cur_x + 6.0, cur_y - 9.0))
                cur_x += w
            cur_y -= row_h

        # -------------------------------------------------------------
        # 6. RESMİ ANTET VE İMZA BLOKLARI (Official Title Block)
        # -------------------------------------------------------------
        antet_h = 70.0
        antet_col_w = table_width / 3.0
        antet_boxes = [
            ("MİMARİ PROJE MÜELLİFİ", "TMMOB Mimarlar Odası\nSicil: 48921 / Tasarımcı Kaşe\nİmza: ........................"),
            ("YANGIN GÜVENLİK DANIŞMANI", "BYKHY 2007/2015 Akredite Uzman\nEI120 / EI90 Yangın Bariyeri\nİmza: ........................"),
            ("T.C. İMAR RUHSAT SERVİSİ", "Mevzuat Denetim Onay Servisi\n" + ("DURUM: ONAYLANDI (KUSURSUZ)" if is_compliant else "DURUM: ŞERHLİ (TADİLAT GEREKLİ)") + "\nLisans: (c) 2026 Seydi Eryılmaz")
        ]
        for a_idx, (b_hdr, b_sub) in enumerate(antet_boxes):
            ax = x_tab + a_idx * antet_col_w
            msp.add_lwpolyline([
                (ax, cur_y),
                (ax + antet_col_w, cur_y),
                (ax + antet_col_w, cur_y - antet_h),
                (ax, cur_y - antet_h)
            ], close=True, dxfattribs={"layer": "DENETIM_OZET_TABLOSU", "color": 4, "lineweight": 30})
            antet_body = f"{{\\C4\\b{b_hdr}}}\\P{{\\C7{b_sub.replace(chr(10), '\\P')}}}"
            mt_a = msp.add_mtext(antet_body, dxfattribs={"layer": "DENETIM_OZET_TABLOSU_METIN", "char_height": 12.0, "width": antet_col_w - 10.0})
            mt_a.set_location(insert=(ax + 10.0, cur_y - 10.0))

        cur_y -= antet_h

        # -------------------------------------------------------------
        # 7. LİSANS VE TELİF HAKKI ŞERHİ (Tüm Hakları Saklıdır Kuralı)
        # -------------------------------------------------------------
        legal_notice = (
            r"{\C8ÖZEL LİSANS — TÜM HAKLAR SAKLIDIR | Telif Hakkı (c) 2026 Seydi Eryılmaz (@seydivakkas) | "
            r"DiagramYönetmelik AI Mimari & Yangın Denetim Sistemi}"
        )
        mt_legal = msp.add_mtext(legal_notice, dxfattribs={"layer": "DENETIM_OZET_TABLOSU_METIN", "char_height": 11.0, "width": table_width})
        mt_legal.set_location(insert=(x_tab + 5.0, cur_y - 6.0))

        # -------------------------------------------------------------
        # 8. ÇİZİM SINIRLARI VE OTOMATİK SIĞDIRMA (Extents & Viewport)
        # -------------------------------------------------------------
        try:
            from ezdxf import zoom, appsettings
            ext_box = appsettings.update_extents(dxf_doc)
            if ext_box.has_data:
                dxf_doc.header['$LIMMIN'] = (float(ext_box.extmin.x), float(ext_box.extmin.y))
                dxf_doc.header['$LIMMAX'] = (float(ext_box.extmax.x), float(ext_box.extmax.y))
                zoom.extents(msp)
        except Exception:
            pass

        return dxf_doc
