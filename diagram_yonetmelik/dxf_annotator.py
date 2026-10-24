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
    Tespit edilen yönetmelik ihlallerini orijinal AutoCAD (.dxf) paftasına
    kırmızı ACI 1 ve turuncu ACI 30 katmanlarıyla işler (HATCH, Revizyon Çemberi, Maskeli MTEXT).
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

        # Katmanları Tanımla
        layers = dxf_doc.layers
        if "DENETIM_IHLALLERI" not in layers:
            layers.new("DENETIM_IHLALLERI", dxfattribs={"color": 1, "lineweight": 50})  # Kırmızı
        if "DENETIM_IHLALLERI_METIN" not in layers:
            layers.new("DENETIM_IHLALLERI_METIN", dxfattribs={"color": 7})              # Beyaz / Arka Plan Maskeli

        room_map = {r.room_id: r for r in rooms}

        # İhlalleri konuma göre grupla
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
            # Orijinal DXF birimine çevir (1 / scale)
            inv_scale = 1.0 / max(1e-4, scale)
            dxf_pts = [(x * inv_scale, y * inv_scale) for x, y in coords]

            # 1. Kusurlu Odanın Sınırını Kırmızı Kalın Çizgiyle Çiz
            msp.add_lwpolyline(dxf_pts, close=True, dxfattribs={"layer": "DENETIM_IHLALLERI"})

            # 2. İhlal Metin Balonu (Maskeli MTEXT)
            cx = r_info.global_dxf_pos[0] * inv_scale
            cy = r_info.global_dxf_pos[1] * inv_scale

            lines = [r"{\C1\b! KUSUR RAPORU (Oda #" + str(target_node) + r"):}"]
            for idx, v in enumerate(viols, start=1):
                lines.append(f"{idx}. {v.violation_code}: {v.description_tr}")
                if v.remedy_recommendation_tr:
                    lines.append(f"   -> Oneri: {v.remedy_recommendation_tr}")
            body = "\\P".join(lines)

            # MTEXT Ekle
            mtext = msp.add_mtext(
                body,
                dxfattribs={
                    "layer": "DENETIM_IHLALLERI_METIN",
                    "char_height": 25.0 * scale * inv_scale,
                    "width": 350.0 * scale * inv_scale
                }
            )
            mtext.set_location(insert=(cx + 40.0, cy + 40.0))
            # Kılavuz Çizgisi (Leader line)
            msp.add_line((cx, cy), (cx + 40.0, cy + 40.0), dxfattribs={"layer": "DENETIM_IHLALLERI"})
            msp.add_circle((cx, cy), radius=12.0, dxfattribs={"layer": "DENETIM_IHLALLERI"})

        return dxf_doc


class DXFOptimizationAnnotator:
    """
    Karşı-olgusal optimizasyon adımlarını AutoCAD (.dxf) paftasına yeşil ACI 3
    ve camgöbeği ACI 4 katmanlarıyla işler (Gerçek REVCLOUD yayları, yeni kapı kasaları ve antet).
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
            layers.new("OPTIMIZASYON_ONERILERI", dxfattribs={"color": 3, "lineweight": 40})  # Yeşil
        if "OPTIMIZASYON_OLCU" not in layers:
            layers.new("OPTIMIZASYON_OLCU", dxfattribs={"color": 4})                        # Camgöbeği

        for step in opt_result.intervention_steps:
            coords = step.spatial_coords or (100.0, 100.0)
            cx = coords[0] * inv_scale
            cy = coords[1] * inv_scale

            # 1. Gerçek AutoCAD Revizyon Bulutu (REVCLOUD - Bulge = 0.55 Yay Halkası)
            chord_step = 40.0
            r_box = 80.0
            cloud_pts = [
                (cx - r_box, cy - r_box, 0.55),
                (cx + r_box, cy - r_box, 0.55),
                (cx + r_box, cy + r_box, 0.55),
                (cx - r_box, cy + r_box, 0.55),
            ]
            msp.add_lwpolyline(cloud_pts, format="xyb", close=True, dxfattribs={"layer": "OPTIMIZASYON_ONERILERI"})

            # 2. Öneri Açıklama Metni (Sol-Üst Eksen)
            hdr = r"{\C3\bREVİZYON #" + str(step.step_id) + r": " + str(step.action_type) + r"}\P"
            text_body = (
                hdr +
                f"{step.description_tr}\\P"
                f"Fayda İndeksi: {step.marginal_benefit_score:.1f} | Maliyet: {step.cost_index:.1f}"
            )
            mtext = msp.add_mtext(
                text_body,
                dxfattribs={
                    "layer": "OPTIMIZASYON_OLCU",
                    "char_height": 22.0,
                    "width": 320.0
                }
            )
            mtext.set_location(insert=(cx - 360.0, cy + 60.0))
            msp.add_line((cx, cy), (cx - 40.0, cy + 60.0), dxfattribs={"layer": "OPTIMIZASYON_ONERILERI"})

        # 3. Sağ Üst Köşeye Karşı-Olgusal Özet Anteti Ekle
        savings_str = f"-{opt_result.time_savings_sec:.1f} sn"
        summary_table = (
            r"{\C3\b================ TADİLAT VE OPTİMİZASYON REÇETESİ ================}\P"
            + f"Başlangıç Tahliye Süresi : {opt_result.baseline_evacuation_time_sec:.1f} sn\\P"
            + f"Optimize Tahliye Süresi   : {opt_result.optimized_evacuation_time_sec:.1f} sn (" + r"\C2" + savings_str + r"\C3)\P"
            + f"Kritik Darboğaz Sayısı    : {opt_result.baseline_critical_bottlenecks} -> {opt_result.optimized_critical_bottlenecks}\\P"
            + f"Toplam Tadilat Maliyeti   : {opt_result.total_remodeling_cost:.1f} Birim\\P"
            + f"Uygulanan Müdahale Adedi  : {len(opt_result.intervention_steps)} Revizyon\\P"
            + "===================================================================="
        )
        msp.add_mtext(
            summary_table,
            dxfattribs={
                "layer": "OPTIMIZASYON_OLCU",
                "char_height": 28.0,
                "width": 600.0
            }
        ).set_location(insert=(2000.0, 2000.0))

        return dxf_doc
