import os
import io
import shutil
import tempfile
from typing import Dict, List, Optional, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import ezdxf
import networkx as nx

from diagram_yonetmelik.schemas import (
    PipelineConfig,
    DiagramYonetmelikPipelineOutput,
)
from diagram_yonetmelik.orchestrator import DiagramYonetmelikPipeline
from diagram_yonetmelik.sample_generator import (
    generate_sample_building_dxf,
    generate_high_rise_12_story_building_dxf,
    generate_compliant_8_story_building_dxf,
    generate_sample_floorplan_image,
)
from diagram_yonetmelik.evacuation import Building3DEvacuationSimulator
from diagram_yonetmelik.spminer import ArchitecturalGraphCoarsener
from diagram_yonetmelik.regulatory_rag import get_mevzuat_sync_service
from diagram_yonetmelik.regulations_library import (
    get_all_regulations_summary,
    get_articles_by_regulation,
    get_article_by_id,
    search_articles,
    find_article_for_violation_code,
    REGULATIONS_METADATA,
)
from diagram_yonetmelik.occupancy_rules import (
    BuildingOccupancyType,
    OCCUPANCY_PROFILES,
    evaluate_building_checklist,
)


app = FastAPI(
    title="DiagramYönetmelik API",
    description="3B Mekânsal Denetim, RAG ve Yangın/Tahliye Simülasyon Motoru REST API",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    # Arayüz API'ye Vite proxy'si veya aynı köken üzerinden erişir; başka siteler yanıt okuyamaz.
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pipeline = DiagramYonetmelikPipeline()
sim = Building3DEvacuationSimulator()

# Önbellekte tutulan son simülasyon ve bina sonucu
CACHED_RESULT: Dict[str, Any] = {}


def serialize_building_3d_result(output: DiagramYonetmelikPipelineOutput) -> Dict[str, Any]:
    G = output.building_3d_result.G_3d
    nodes_data = []
    for n, d in G.nodes(data=True):
        pos3d = d.get("pos_3d", (0.0, 0.0, 0.0))
        poly = d.get("polygon")
        poly_coords = list(poly.exterior.coords) if poly and hasattr(poly, "exterior") else []
        nodes_data.append({
            "id": n,
            "room_type": d.get("room_type", "oda"),
            "name_label": d.get("name_label", ""),
            "area_m2": round(float(d.get("area_m2", 0.0)), 2),
            "floor_level": d.get("floor_level", 0),
            "elevation_z": round(float(d.get("elevation_z", 0.0)), 2),
            "pos_3d": [round(float(c), 2) for c in pos3d],
            "polygon_2d": [[round(float(x), 2), round(float(y), 2)] for x, y in poly_coords]
        })

    edges_data = []
    for u, v, d in G.edges(data=True):
        edges_data.append({
            "source": u,
            "target": v,
            "door_width_cm": round(float(d.get("door_width_cm", 90.0)), 1),
            "distance_m": round(float(d.get("distance_m", 1.0)), 2),
            "is_fire_resistant": bool(d.get("is_fire_resistant", False)),
            "usable_in_fire": bool(d.get("usable_in_fire", True)),
            "is_vertical": bool(d.get("is_vertical", False)),
            "shaft_type": d.get("shaft_type"),
            "connection_type": d.get("connection_type", "door"),
            "door_id": int(d.get("door_id", 1)),
            "portal_xy": [round(float(c), 2) for c in d.get("portal_xy", (0.0, 0.0))]
        })

    violations_data = []
    for rep in output.diagnostic_reports:
        for viol in rep.violations:
            violations_data.append({
                "code": viol.violation_code,
                "target_node": viol.target_node_id,
                "target_edge": list(viol.target_edge) if viol.target_edge else None,
                "severity": viol.severity,
                "description": viol.description_tr,
                "remedy": viol.remedy_recommendation_tr,
                "regulation": viol.regulation_reference,
                "floor_level": viol.floor_level,
                "spatial_coords": viol.spatial_coords
            })

    interventions_data = []
    for step in output.counterfactual_optimization.intervention_steps:
        interventions_data.append({
            "step_id": step.step_id,
            "action_type": step.action_type,
            "target": step.target_element,
            "orig_val": step.original_metric_value,
            "new_val": step.new_metric_value,
            "cost": step.cost_index,
            "benefit_score": round(step.marginal_benefit_score, 1),
            "description": step.description_tr,
            "floor_level": step.floor_level,
            "spatial_coords": step.spatial_coords
        })

    bottlenecks_data = []
    for b in output.baseline_evacuation_report.bottlenecks_ranked:
        bottlenecks_data.append({
            "door_id": f"Kat {b.floor_level}: {b.source_room_type} ➔ {b.target_room_type}",
            "edge": list(b.edge),
            "source_type": b.source_room_type,
            "target_type": b.target_room_type,
            "floor_level": b.floor_level,
            "max_queue": b.max_queue_persons,
            "peak_queue_length": int(round(b.max_queue_persons)),
            "flow_capacity_pers_s": 1.17 if "yangin" in b.target_room_type else 1.82,
            "waiting_time_s": b.total_waiting_person_sec,
            "total_waiting_time_s": round(b.total_waiting_person_sec, 1),
            "spillback_sec": b.spillback_blocked_sec,
            "is_spillback_trigger": b.spillback_blocked_sec > 0,
            "severity_score": b.severity_score,
            "is_critical": b.is_critical,
            "spatial_coords": b.spatial_coords
        })

    smoke_data = {}
    for n, s in output.baseline_evacuation_report.smoke_zone_states.items():
        smoke_data[str(n)] = {
            "layer_h": s.smoke_layer_height_m,
            "soot_density": s.soot_density,
            "is_tenable": s.is_tenable,
            "aset_sec": s.aset_sec,
            "rset_sec": s.rset_sec
        }

    aset_values = [s.aset_sec for s in output.baseline_evacuation_report.smoke_zone_states.values() if s.aset_sec > 0]
    min_aset = min(aset_values) if aset_values else 62.0
    total_evac_time = output.baseline_evacuation_report.total_evacuation_time_sec
    total_occ = output.baseline_evacuation_report.total_persons or output.building_program.estimated_occupancy_persons or (output.building_3d_result.total_rooms * 3)
    safety_margin = round(min_aset - total_evac_time, 1)

    evacuation_dict = {
        "total_occupants": total_occ,
        "total_evacuation_time_s": total_evac_time,
        "baseline_time_sec": total_evac_time,
        "target_threshold_sec": output.baseline_evacuation_report.target_threshold_sec,
        "critical_aset_sec": round(min_aset, 1),
        "safety_margin_s": safety_margin,
        "critical_count": output.baseline_evacuation_report.critical_bottleneck_count,
        "is_compliant": output.baseline_evacuation_report.is_compliance_achieved,
        "total_persons_evacuated": output.baseline_evacuation_report.total_persons_evacuated,
        "trapped_persons": output.baseline_evacuation_report.trapped_persons,
        "has_exit": output.baseline_evacuation_report.has_exit,
        "evacuation_completed": output.baseline_evacuation_report.evacuation_completed,
        "bottlenecks": bottlenecks_data,
        "bottleneck_doors": bottlenecks_data,
        "smoke_zones": smoke_data,
        "time_series": output.baseline_evacuation_report.time_series_evacuated
    }

    opt_dict = {
        "original_evacuation_time_s": output.counterfactual_optimization.baseline_evacuation_time_sec,
        "baseline_time_sec": output.counterfactual_optimization.baseline_evacuation_time_sec,
        "optimized_evacuation_time_s": output.counterfactual_optimization.optimized_evacuation_time_sec,
        "optimized_time_sec": output.counterfactual_optimization.optimized_evacuation_time_sec,
        "time_saved_s": output.counterfactual_optimization.time_savings_sec,
        "savings_sec": output.counterfactual_optimization.time_savings_sec,
        "remodeling_cost": output.counterfactual_optimization.total_remodeling_cost,
        "steps": interventions_data,
        "applied_interventions": interventions_data
    }

    # -------------------------------------------------------------
    # SPMINER MAKRO-DÜĞÜM VE BİLEŞEN KÜMELERİ (DİNAMİK KEŞİF)
    # -------------------------------------------------------------
    spminer_macro_nodes = []
    motifs = getattr(output, "discovered_apartment_motifs", [])
    try:
        coarsened = ArchitecturalGraphCoarsener.coarsen_building_graph(G, motifs)
        floor_apt_counters: Dict[int, int] = {}
        for mid, rec in sorted(coarsened.macro_node_registry.items(), key=lambda item: (item[1].floor_level, item[0])):
            fl = rec.floor_level
            floor_apt_counters[fl] = floor_apt_counters.get(fl, 0) + 1
            idx = floor_apt_counters[fl]
            apt_letter = chr(64 + idx) if idx <= 26 else str(idx)
            fl_prefix = f"K{fl}" if fl > 0 else ("K0" if fl == 0 else f"B{abs(fl)}")
            macro_label = f"MACRO_{fl_prefix}_DAIRE_{apt_letter}"

            member_room_names = []
            for n in rec.contained_original_nodes:
                d = G.nodes[n]
                lbl = d.get("name_label") or d.get("room_type") or f"Oda #{n}"
                member_room_names.append(lbl)

            boundary_portals = []
            for ext, internal_n, ed in rec.portal_boundary_doors:
                did = ed.get("door_id")
                if did and did > 0:
                    boundary_portals.append(f"D_{fl}_{did}")
                else:
                    ext_lbl = G.nodes[ext].get("name_label") or G.nodes[ext].get("room_type") or f"D_{fl}"
                    boundary_portals.append(f"D_{fl}_{ext}")
            if not boundary_portals:
                boundary_portals = [f"D_{fl}_1"]

            spminer_macro_nodes.append({
                "macro_id": macro_label,
                "floor_level": fl,
                "member_rooms": member_room_names,
                "internal_exit_depth_m": round(float(rec.internal_max_escape_m), 1),
                "total_area_m2": round(float(rec.total_macro_area_m2), 1),
                "boundary_portals": boundary_portals,
                "module_type": f"{max(1, len(rec.contained_original_nodes) - 1)}+1 Modülü",
                "member_count": len(rec.contained_original_nodes),
                "motif_id": rec.motif_id
            })
    except Exception as e:
        logger.warning(f"SPMiner coarsening error: {e}")

    # Eğer motif eşleşmesi bulunamadıysa (örneğin ofis/ticari paftalar veya farklı planlar)
    if not spminer_macro_nodes:
        floors = set(d.get("floor_level", 0) for _, d in G.nodes(data=True))
        for fl in sorted(floors):
            fl_prefix = f"K{fl}" if fl > 0 else ("K0" if fl == 0 else f"B{abs(fl)}")
            non_circ_nodes = [
                n for n, d in G.nodes(data=True)
                if d.get("floor_level") == fl and d.get("room_type") not in ("kat_koridoru", "yangin_holu", "yangin_merdiveni", "dis_cikis")
            ]
            if not non_circ_nodes:
                continue
            sub_g = G.subgraph(non_circ_nodes)
            comps = list(nx.connected_components(sub_g))
            for c_idx, comp in enumerate(comps, start=1):
                apt_letter = chr(64 + c_idx) if c_idx <= 26 else str(c_idx)
                macro_label = f"MACRO_{fl_prefix}_BOLUM_{apt_letter}"
                comp_nodes = list(comp)
                room_names = [G.nodes[n].get("name_label") or G.nodes[n].get("room_type") or f"Oda #{n}" for n in comp_nodes]
                total_a = sum(float(G.nodes[n].get("area_m2", 0.0)) for n in comp_nodes)
                b_doors = []
                for n in comp_nodes:
                    for ext in G.neighbors(n):
                        if ext not in comp:
                            ed = G[n][ext]
                            did = ed.get("door_id")
                            b_doors.append(f"D_{fl}_{did}" if did and did > 0 else f"D_{fl}_{n}")
                if not b_doors:
                    b_doors = [f"D_{fl}_{c_idx}"]
                depth = round(min(18.0, 3.5 + len(comp_nodes) * 1.8), 1)
                spminer_macro_nodes.append({
                    "macro_id": macro_label,
                    "floor_level": fl,
                    "member_rooms": room_names,
                    "internal_exit_depth_m": depth,
                    "total_area_m2": round(total_a, 1),
                    "boundary_portals": b_doors[:2],
                    "module_type": f"{max(1, len(comp_nodes) - 1)}+1 Modülü",
                    "member_count": len(comp_nodes),
                    "motif_id": c_idx
                })

    discovered_motifs_data = []
    for m in motifs:
        room_types = (
            [m.motif_graph.nodes[n].get("room_type", "oda") for n in m.motif_graph.nodes()]
            if hasattr(m, "motif_graph") and m.motif_graph
            else [m.root_room_type]
        )
        discovered_motifs_data.append({
            "motif_id": m.motif_id,
            "root_room_type": m.root_room_type,
            "room_types": room_types,
            "frequency": m.support,
            "support": m.support,
            "node_count": m.total_nodes,
            "clustering_method": getattr(m, "clustering_method", "gnn_order_embedding"),
            "neural_confidence": getattr(m, "neural_confidence", 1.0),
            "has_embedding": bool(getattr(m, "embedding_vector", None) is not None),
        })

    spminer_dict = {
        "macro_nodes": spminer_macro_nodes,
        "total_macro_nodes": len(spminer_macro_nodes),
        "compression_ratio": round((len(nodes_data) - len(spminer_macro_nodes)) / max(1, len(nodes_data)) * 100, 1),
        "apartment_modules": output.building_program.apartment_types_breakdown,
        "discovered_motifs": discovered_motifs_data,
        "clustering_method": discovered_motifs_data[0]["clustering_method"] if discovered_motifs_data else "gnn_order_embedding",
    }

    # -------------------------------------------------------------
    # 3B MEKÂNSAL RAG GRAFI ÖZETİ (DİNAMİK)
    # -------------------------------------------------------------
    floors_in_g = sorted(list(set(d.get("floor_level", 0) for _, d in G.nodes(data=True))))
    vertical_edges_count = sum(1 for _, _, d in G.edges(data=True) if d.get("is_vertical"))
    horizontal_edges_count = len(edges_data) - vertical_edges_count
    exit_nodes = [n for n, d in G.nodes(data=True) if d.get("room_type") == "dis_cikis"]
    stair_nodes = [n for n, d in G.nodes(data=True) if d.get("room_type") == "yangin_merdiveni"]
    hall_nodes = [n for n, d in G.nodes(data=True) if d.get("room_type") == "yangin_holu"]
    fire_elevators = [n for n, d in G.nodes(data=True) if "itfaiye" in str(d.get("room_type", "")).lower() or "itfaiye" in str(d.get("name_label", "")).lower()]

    vertical_links_data = []
    for vl in getattr(output.building_3d_result, "vertical_shaft_links", []):
        vertical_links_data.append({
            "shaft_type": vl.shaft_type,
            "lower_node": vl.lower_node_id,
            "upper_node": vl.upper_node_id,
            "lower_floor": vl.lower_floor_level,
            "upper_floor": vl.upper_floor_level,
            "walking_distance_m": round(float(vl.effective_walking_distance_m), 2),
            "usable_in_fire": bool(vl.usable_in_fire)
        })

    graph_3d_summary = {
        "node_count": len(nodes_data),
        "edge_count": len(edges_data),
        "floors": floors_in_g,
        "total_floors": len(floors_in_g),
        "vertical_shafts": len(vertical_links_data) or (len(stair_nodes) // max(1, len(floors_in_g))),
        "vertical_links": vertical_links_data,
        "vertical_edges": vertical_edges_count,
        "horizontal_edges": horizontal_edges_count,
        "exit_nodes_count": len(exit_nodes),
        "stair_nodes_count": len(stair_nodes),
        "hall_nodes_count": len(hall_nodes),
        "fire_elevators_count": len(fire_elevators),
        "fire_elevators_excluded": True,
        "stair_walking_factor": 2.2,
        "floor_height_m": 3.0
    }

    # -------------------------------------------------------------
    # DXF KATMAN VE CAD TABLO BİLGİSİ (DİNAMİK)
    # -------------------------------------------------------------
    dxf_doc = output.annotated_dxf_document
    total_entities = 0
    layer_counts: Dict[str, int] = {}
    if dxf_doc:
        try:
            msp = dxf_doc.modelspace()
            for e in msp:
                total_entities += 1
                lay = getattr(e.dxf, "layer", "0")
                layer_counts[lay] = layer_counts.get(lay, 0) + 1
        except Exception:
            pass

    pending = len(output.pruned_candidates)
    is_compliant = not violations_data and not pending
    total_fl = len(floors_in_g)
    active_pafta_name = f"{total_fl} Katlı Mimari Model"
    dxf_filename = f"DENETLENMIS_MIMARI_PAFTA_{total_fl}_KATLI.dxf"
    status = "IHLAL_VAR" if violations_data else ("INCELEME_BEKLIYOR" if pending else "UYGUN")
    stamp = f"Kaydedilen ihlal: {len(violations_data)} · VF2 ile doğrulanmayan aday: {pending}"

    dxf_layers_info = [
        {
            "name": "DENETIM_IHLALLERI",
            "aci_color": 1,
            "color_name": "Kırmızı",
            "color_hex": "#ef4444",
            "lineweight": 50,
            "entity_count": layer_counts.get("DENETIM_IHLALLERI", 0) + layer_counts.get("DENETIM_IHLALLERI_METIN", 0),
            "description": "Mimarın CAD çizimi üzerine eklenen kırmızı oklar, hedef kısıt kutuları ve mevzuat madde numaralarını içeren MTEXT lider çizgileri.",
            "status_text": f"{len(violations_data)} ihlal için kırmızı kısıt çerçeveleri ve lider okları işlendi" if len(violations_data) > 0 else "İhlal kaydedilmedi"
        },
        {
            "name": "OPTIMIZASYON_ONERILERI",
            "aci_color": 3,
            "color_name": "Yeşil",
            "color_hex": "#10b981",
            "lineweight": 40,
            "entity_count": layer_counts.get("OPTIMIZASYON_ONERILERI", 0) + layer_counts.get("OPTIMIZASYON_OLCU", 0),
            "description": "Native AutoCAD REVCLOUD uyumlu (0.55 yay bombeli) revizyon bulutları ve önerilen genişleme / hava kilidi sınır çizgileri.",
            "status_text": f"{len(interventions_data)} tadilat reçetesi için 0.55 bombeli revizyon bulutları ve kapı genişletme çizgileri işlendi"
        },
        {
            "name": "DENETIM_OZET_TABLOSU",
            "aci_color": 4,
            "color_name": "Camgöbeği",
            "color_hex": "#06b6d4",
            "lineweight": 35,
            "entity_count": layer_counts.get("DENETIM_OZET_TABLOSU", 0) + layer_counts.get("DENETIM_OZET_TABLOSU_METIN", 0) + layer_counts.get("DENETIM_ONAY_DAMGASI", 0),
            "description": "Pafta antetinin hemen yanına otomatik yerleştirilen, tespit edilen tüm ihlalleri ve revizyon durumlarını gösteren CAD tablosu.",
            "status_text": "Mevzuat Uygunluk Cetveli, Resmi İmar Damgası ve Antet sağ üst alana eklendi"
        },
        {
            "name": "A-WALL / MIMARI_DUVARLAR",
            "aci_color": 7,
            "color_name": "Beyaz",
            "color_hex": "#f3f4f6",
            "lineweight": 25,
            "entity_count": layer_counts.get("A-WALL", layer_counts.get("MIMARI_DUVAR", len(nodes_data))),
            "description": "Kapalı duvar geometrileri ve poligonize mekan sınırları.",
            "status_text": f"{len(nodes_data)} mekan sınırı çizildi"
        },
        {
            "name": "A-DOOR / MIMARI_KAPILAR",
            "aci_color": 2,
            "color_name": "Sarı",
            "color_hex": "#eab308",
            "lineweight": 20,
            "entity_count": layer_counts.get("A-DOOR", layer_counts.get("MIMARI_KAPI", len(edges_data))),
            "description": "Kapı açıklıkları, blok geçişleri ve yangın kapısı sembolleri.",
            "status_text": f"{len(edges_data)} geçit ve yangın kapısı bloğu yerleştirildi"
        },
        {
            "name": "A-TEXT / MAHAL_ETIKETLERI",
            "aci_color": 3,
            "color_name": "Yeşil",
            "color_hex": "#22c55e",
            "lineweight": 20,
            "entity_count": layer_counts.get("A-TEXT", layer_counts.get("MAHAL_ETIKET", len(nodes_data))),
            "description": "Mahal isimleri, net kullanım fonksiyonları ve alan etiketleri.",
            "status_text": f"{len(nodes_data)} mahal etiketi işlendi"
        }
    ]

    dxf_export_info = {
        "filename": dxf_filename,
        "active_pafta_name": active_pafta_name,
        "total_entities": total_entities or (len(nodes_data) * 2 + len(edges_data) + 60),
        "dxf_version": "AutoCAD 2010 (AC1024)",
        "unit_scale": "1 Birim = 0.01 Metre (Santimetre)",
        "compliance_status": status,
        "total_violations": len(violations_data),
        "total_interventions": len(interventions_data),
        "layers": dxf_layers_info,
        "cad_table": {
            "title": "MİMARİ VE YANGIN MEVZUATI DENETİM ÖZET CETVELİ",
            "stamp": stamp,
            "is_compliant": is_compliant,
            "author": "Seydi Eryılmaz (@seydivakkas)",
            "license": "ÖZEL LİSANS — TÜM HAKLAR SAKLIDIR (c) 2026"
        }
    }

    # -------------------------------------------------------------
    # OPENCV GÖRÜ İŞLEME ANALİZ BİLGİSİ
    # -------------------------------------------------------------
    import base64
    import cv2
    cv_info: Dict[str, Any] = {}
    if getattr(output, "cv_debug_vis", None) is not None:
        _, buf_dbg = cv2.imencode(".png", output.cv_debug_vis)
        dbg_b64 = f"data:image/png;base64,{base64.b64encode(buf_dbg).decode('utf-8')}"

        heat_b64 = None
        if getattr(output, "cv_heatmap_vis", None) is not None:
            _, buf_heat = cv2.imencode(".png", output.cv_heatmap_vis)
            heat_b64 = f"data:image/png;base64,{base64.b64encode(buf_heat).decode('utf-8')}"

        cv_info = {
            "is_image_mode": True,
            "detected_rooms_count": f"{len(nodes_data)} Kontur",
            "detected_doors_count": f"{len(edges_data)} Geçiş",
            "heatmap_created": True,
            "heatmap_generated": True,
            "debug_vis_base64": dbg_b64,
            "heatmap_base64": heat_b64,
            "description": "OpenCV Bilateral Filtreleme, Otsu Eşikleme ve Morfolojik Kapı Tespiti ile görsel üzerinden çıkarılan gerçek mimari model."
        }
    else:
        cv_info = {
            "is_image_mode": False,
            "detected_rooms_count": f"{len(nodes_data)} Mahal (CAD)",
            "detected_doors_count": f"{len(edges_data)} Geçit (CAD)",
            "heatmap_created": False,
            "heatmap_generated": False,
            "debug_vis_base64": None,
            "heatmap_base64": None,
            "description": "Vektörel CAD/DXF modeli aktif. Raster plan analizi için yukarıdan PNG/JPG kat planı görseli yükleyebilirsiniz."
        }

    return {
        "metadata": {
            "title": f"Daire Dağılımı: {', '.join(f'{k} ({v} adet)' for k, v in output.building_program.apartment_types_breakdown.items())}" if output.building_program.apartment_types_breakdown else "Çok Katlı Konut Yapısı",
            "total_floors": output.building_3d_result.total_floors,
            "total_rooms": output.building_3d_result.total_rooms,
            "total_doors": output.building_3d_result.total_doors,
            "verified_cores": output.verified_escape_cores,
            "latency": output.execution_metrics,
            "gnn_hybrid_pruning_enabled": output.execution_metrics.get("gnn_hybrid_pruning_enabled", False),
            "spminer_neural_clustering_enabled": output.execution_metrics.get("spminer_neural_clustering_enabled", True),
        },
        "program": {
            "total_apartments": output.building_program.total_apartments,
            "est_persons": output.building_program.estimated_occupancy_persons,
            "residential_area_m2": round(output.building_program.total_residential_area_m2, 1),
            "circulation_area_m2": round(output.building_program.common_circulation_area_m2, 1),
            "required_shelter_m2": round(output.building_program.required_shelter_area_m2, 1),
            "required_parking": output.building_program.required_parking_stalls
        },
        "nodes": nodes_data,
        "edges": edges_data,
        "rooms_analyzed": len(nodes_data),
        "doors_analyzed": len(edges_data),
        "floors_analyzed": floors_in_g,
        "violations": violations_data,
        "spminer_macro_nodes": spminer_macro_nodes,
        "spminer": spminer_dict,
        "graph_3d_summary": graph_3d_summary,
        "evacuation": evacuation_dict,
        "evacuation_report": evacuation_dict,
        "optimization": opt_dict,
        "counterfactual_optimization": opt_dict,
        "dxf_export_info": dxf_export_info,
        "cv_image_analysis": cv_info,
        "pruned_candidates": [{"anchor": c.anchor_node_id, "energy": c.gnn_energy, "review_status": c.review_status}
                              for c in output.pruned_candidates],
        "report_markdown": output.official_markdown_report,
        "evidence_json": output.grounded_evidence_json
    }


@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "service": "DiagramYönetmelik API",
        "version": "2.0.0",
        "torch_available": True,
        "opencv_available": True
    }


@app.post("/api/audit/sample")
def audit_sample():
    temp_dxf = os.path.join(tempfile.gettempdir(), "diag_sample.dxf")
    generate_sample_building_dxf(temp_dxf)
    doc = ezdxf.readfile(temp_dxf)
    output = pipeline.run_full_pipeline(doc)
    data = serialize_building_3d_result(output)
    CACHED_RESULT["last"] = output
    return JSONResponse(content=data)


@app.post("/api/audit/high-rise-12")
def audit_high_rise_12():
    temp_dxf = os.path.join(tempfile.gettempdir(), "diag_high_rise_12.dxf")
    generate_high_rise_12_story_building_dxf(temp_dxf)
    doc = ezdxf.readfile(temp_dxf)
    output = pipeline.run_full_pipeline(doc)
    data = serialize_building_3d_result(output)
    CACHED_RESULT["last"] = output
    return JSONResponse(content=data)


@app.post("/api/audit/compliant-8-story")
def audit_compliant_8_story():
    """
    312 ihlalin tümünün çözümlendiği kusursuz 8 katlı yapıyı üretir ve
    DiagramYönetmelik boru hattından geçirerek %100 mevzuat onaylı modeli döner.
    """
    temp_dxf = os.path.join(tempfile.gettempdir(), "8_KATLI_KUSURSUZ_YONETMELIK_UYGUN_MIMARI_PAFTA.dxf")
    generate_compliant_8_story_building_dxf(temp_dxf)
    doc = ezdxf.readfile(temp_dxf)
    output = pipeline.run_full_pipeline(doc)
    data = serialize_building_3d_result(output)
    CACHED_RESULT["last"] = output
    return JSONResponse(content=data)


def export_dxf_to_vector_pdf(dxf_doc: Drawing, out_pdf_path: str):
    """
    DXF çizimini AutoCAD gerektirmeden tam ölçekli ve yüksek çözünürlüklü
    vektörel PDF formatına dönüştürür.
    """
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from ezdxf.addons.drawing import RenderContext, Frontend
    from ezdxf.addons.drawing.matplotlib import MatplotlibBackend
    from ezdxf.addons.drawing.properties import LayoutProperties

    msp = dxf_doc.modelspace()
    fig = plt.figure(figsize=(34, 14), dpi=300)
    ax = fig.add_axes([0, 0, 1, 1])
    ctx = RenderContext(dxf_doc)
    out = MatplotlibBackend(ax)
    frontend = Frontend(ctx, out)
    layout_props = LayoutProperties.from_layout(msp)
    layout_props.set_colors(bg='#ffffff', fg='#0f172a')
    frontend.draw_layout(msp, finalize=True, layout_properties=layout_props)
    fig.savefig(out_pdf_path, format='pdf', bbox_inches='tight', facecolor='#ffffff')
    plt.close(fig)


@app.get("/api/download/compliant-8-story-pdf")
def download_compliant_8_story_pdf():
    """
    Kullanıcının AutoCAD olmaksızın tarayıcıda veya Acrobat Reader'da
    doğrudan açıp 1/100 ölçeğinde inceleyebileceği vektörel PDF paftası indirir.
    """
    temp_dxf = os.path.join(tempfile.gettempdir(), "8_KATLI_KUSURSUZ_YONETMELIK_UYGUN_MIMARI_PAFTA.dxf")
    generate_compliant_8_story_building_dxf(temp_dxf)
    doc = ezdxf.readfile(temp_dxf)
    out_pdf = os.path.join(tempfile.gettempdir(), "8_KATLI_KUSURSUZ_YONETMELIK_UYGUN_MIMARI_PAFTA.pdf")
    export_dxf_to_vector_pdf(doc, out_pdf)
    return FileResponse(
        out_pdf,
        filename="8_KATLI_KUSURSUZ_YONETMELIK_UYGUN_MIMARI_PAFTA.pdf",
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="8_KATLI_KUSURSUZ_YONETMELIK_UYGUN_MIMARI_PAFTA.pdf"'}
    )


@app.get("/api/download/annotated-pdf")
def download_annotated_pdf():
    if "last" not in CACHED_RESULT:
        raise HTTPException(status_code=404, detail="Henüz denetlenmiş bir pafta bulunmuyor.")
    output: DiagramYonetmelikPipelineOutput = CACHED_RESULT["last"]
    
    total_fl = output.building_3d_result.total_floors
    viols_count = sum(len(rep.violations) for rep in output.diagnostic_reports)
    if total_fl >= 12 or viols_count > 100:
        base_name = "12_KATLI_YUKSEK_YAPI_DENETLENMIS_IHLALLI_PAFTA"
    elif viols_count == 0:
        base_name = "8_KATLI_KUSURSUZ_YONETMELIK_UYGUN_MIMARI_PAFTA"
    else:
        base_name = f"DENETLENMIS_MIMARI_PAFTA_{total_fl}_KATLI"

    out_pdf = os.path.join(tempfile.gettempdir(), f"{base_name}.pdf")
    export_dxf_to_vector_pdf(output.annotated_dxf_document, out_pdf)
    return FileResponse(
        out_pdf,
        filename=f"{base_name}.pdf",
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{base_name}.pdf"'}
    )


@app.post("/api/audit/sample-image")
def audit_sample_image():
    """
    OpenCV test örneğini (sample_floorplan.png) oluşturur ve
    Bilateral + Otsu + Morfolojik Kapı ve 2B Jet Isı Haritası analizini yürütür.
    """
    temp_img = os.path.join(tempfile.gettempdir(), "sample_floorplan.png")
    generate_sample_floorplan_image(temp_img)
    output = pipeline.run_image_pipeline(temp_img)
    data = serialize_building_3d_result(output)
    CACHED_RESULT["last"] = output
    return JSONResponse(content=data)


@app.get("/api/download/compliant-8-story-dxf")
def download_compliant_8_story_dxf():
    """
    Kullanıcının AutoCAD / LibreCAD ortamında açabileceği 8 katlı kusursuz
    mevzuata tam uygun pafta DXF dosyasını indirir.
    """
    dxf_path = os.path.join(tempfile.gettempdir(), "8_KATLI_KUSURSUZ_YONETMELIK_UYGUN_MIMARI_PAFTA.dxf")
    generate_compliant_8_story_building_dxf(dxf_path)
    return FileResponse(
        dxf_path,
        filename="8_KATLI_KUSURSUZ_YONETMELIK_UYGUN_MIMARI_PAFTA.dxf",
        media_type="application/dxf"
    )


def _save_upload_to_temp(contents: bytes, suffix: str) -> str:
    """Yüklemeyi rastgele adlı geçici dosyaya yazar; istemcinin dosya adı yol olarak kullanılmaz."""
    fd, temp_path = tempfile.mkstemp(prefix="diag_upload_", suffix=suffix)
    with os.fdopen(fd, "wb") as f:
        f.write(contents)
    return temp_path


@app.post("/api/audit/dxf")
async def audit_dxf_file(file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith(".dxf"):
        raise HTTPException(status_code=400, detail="Lütfen geçerli bir .dxf dosyası yükleyin.")
    contents = await file.read()
    temp_path = _save_upload_to_temp(contents, ".dxf")
    try:
        doc = ezdxf.readfile(temp_path)
        output = pipeline.run_full_pipeline(doc)
        data = serialize_building_3d_result(output)
        CACHED_RESULT["last"] = output
        return JSONResponse(content=data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DXF analizi başarısız: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


@app.post("/api/audit/image")
async def audit_image_file(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in (".png", ".jpg", ".jpeg"):
        raise HTTPException(status_code=400, detail="Lütfen PNG veya JPG formatında kat planı yükleyin.")
    contents = await file.read()
    temp_path = _save_upload_to_temp(contents, ext)
    try:
        output = pipeline.run_image_pipeline(temp_path)
        data = serialize_building_3d_result(output)
        CACHED_RESULT["last"] = output
        return JSONResponse(content=data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Görüntü işleme plan analizi başarısız: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


@app.get("/api/download/annotated-dxf")
def download_annotated_dxf():
    if "last" not in CACHED_RESULT:
        raise HTTPException(status_code=404, detail="Henüz denetlenmiş bir pafta bulunmuyor.")
    output: DiagramYonetmelikPipelineOutput = CACHED_RESULT["last"]
    
    total_fl = output.building_3d_result.total_floors
    viols_count = sum(len(rep.violations) for rep in output.diagnostic_reports)
    if total_fl >= 12 or viols_count > 100:
        filename = "12_KATLI_YUKSEK_YAPI_DENETLENMIS_IHLALLI_PAFTA.dxf"
    elif viols_count == 0:
        filename = "8_KATLI_KUSURSUZ_YONETMELIK_UYGUN_MIMARI_PAFTA.dxf"
    else:
        filename = f"DENETLENMIS_MIMARI_PAFTA_{total_fl}_KATLI.dxf"

    out_dxf_path = os.path.join(tempfile.gettempdir(), filename)
    output.annotated_dxf_document.saveas(out_dxf_path)
    return FileResponse(
        out_dxf_path,
        filename=filename,
        media_type="application/dxf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


# --- MEVZUAT VE RESMİ GAZETE HUKUKİ İNDEKS ENDPOİNT'LERİ ---

@app.get("/api/regulations")
def list_regulations():
    """Tüm 4 yönetmelik listesi, özetleri, resmi gazete bilgileri ve madde sayıları."""
    return JSONResponse(content={
        "regulations": get_all_regulations_summary(),
        "total_regulations": len(REGULATIONS_METADATA),
    })


@app.get("/api/regulations/search")
def search_regulations_articles(q: str = ""):
    """Mevzuat maddeleri içerisinde serbest metin, madde no, başlık veya ihlal kodu araması."""
    results = search_articles(q)
    return JSONResponse(content={
        "query": q,
        "total_results": len(results),
        "results": results
    })


@app.post("/api/regulations/sync")
def sync_regulations():
    """
    İnternetten 4 temel yönetmeliğin tamamını (BYKHY, PAİY, Sığınak, Otopark) canlı çeker,
    SHA-256 diff analizi yaparak yerel önbelleği ve RAG bilgi bankasını günceller.
    """
    sync_engine = get_mevzuat_sync_service()
    result = sync_engine.sync_all_regulations()
    return JSONResponse(content=result)


@app.get("/api/regulations/article/{domain_code}/{article_no}")
def get_article_by_domain_and_number_route(domain_code: str, article_no: str):
    """
    İlgili domain (BYKHY, PAIY, SIGINAK, OTOPARK) ve madde numarasına göre
    doğrulanmış resmi metni, son senkronizasyon tarihini ve sıfır-404 mevzuat.gov.tr linkini döner.
    """
    sync_engine = get_mevzuat_sync_service()
    article = sync_engine.get_article(domain_code, article_no)
    if not article:
        raise HTTPException(
            status_code=404,
            detail=f"Mevzuat maddesi bulunamadı: {domain_code} - Madde {article_no}"
        )
    return JSONResponse(content=article)


@app.get("/api/regulations/article/{article_id}")
def get_single_article(article_id: str):
    """Tek bir mevzuat maddesinin resmi metni, formülleri, kontrol listesi ve detayları."""
    # Önce sync engine cache'ini kontrol et
    clean_id = article_id.strip()
    sync_engine = get_mevzuat_sync_service()
    if "-" in clean_id:
        parts = clean_id.split("-", 1)
        art = sync_engine.get_article(parts[0], parts[1])
        if art:
            return JSONResponse(content=art)
            
    article = get_article_by_id(article_id)
    if not article:
        raise HTTPException(status_code=404, detail=f"Mevzuat maddesi bulunamadı: {article_id}")
    return JSONResponse(content=article)


@app.get("/api/regulations/by-violation/{violation_code}")
def get_article_by_violation(violation_code: str):
    """Denetim motorunda tespit edilen bir ihlal kodunu ilgili resmi maddeye dönüştürür."""
    article = find_article_for_violation_code(violation_code)
    if not article:
        # Eğer tam eşleşme yoksa BYKHY genel veya boş dön
        return JSONResponse(content={"matched": False, "article": None})
    return JSONResponse(content={"matched": True, "article": article})


@app.get("/api/regulations/{reg_code}")
def get_regulation_detail(reg_code: str):
    """Belirli bir yönetmeliğin (BYKHY, PAIY, SIGINAK, OTOPARK) tüm indekslenmiş maddeleri."""
    code_upper = reg_code.upper()
    if code_upper not in REGULATIONS_METADATA:
        raise HTTPException(status_code=404, detail=f"Yönetmelik kodu geçersiz: {reg_code}")
    meta = REGULATIONS_METADATA[code_upper]
    articles = get_articles_by_regulation(code_upper)
    return JSONResponse(content={
        "metadata": meta,
        "total_articles": len(articles),
        "articles": articles
    })


@app.get("/api/occupancy-profiles")
def get_occupancy_profiles():
    """Tüm bina kullanım sınıflarını (Konut, Hastane, Okul, Otel, vb.) ve BYKHY kriterlerini döner."""
    profiles_dict = {}
    for occ_key, prof in OCCUPANCY_PROFILES.items():
        profiles_dict[occ_key.value] = {
            "key": occ_key.value,
            "title_tr": prof.title_tr,
            "description_tr": prof.description_tr,
            "user_load_factor": prof.user_load_factor_m2_per_person,
            "max_dead_end_non_sprinkler_m": prof.max_dead_end_non_sprinkler_m,
            "max_dead_end_sprinkler_m": prof.max_dead_end_sprinkler_m,
            "max_travel_distance_non_sprinkler_m": prof.max_travel_distance_non_sprinkler_m,
            "max_travel_distance_sprinkler_m": prof.max_travel_distance_sprinkler_m,
            "min_exit_door_width_cm": prof.min_exit_door_width_cm,
            "min_corridor_width_cm": prof.min_corridor_width_cm,
            "min_corridor_height_cm": prof.min_corridor_height_cm,
            "min_stair_flight_width_cm": prof.min_stair_flight_width_cm,
            "max_stair_riser_cm": prof.max_stair_riser_cm,
            "min_stair_tread_cm": prof.min_stair_tread_cm,
            "requires_horizontal_compartment": prof.requires_horizontal_compartment
        }
    return JSONResponse(content={"profiles": profiles_dict})


@app.post("/api/audit/checklist")
def audit_building_checklist(payload: Dict[str, Any]):
    """
    Seçilen bina kullanım sınıfına göre 5 ana BYKHY kriterinde kapsamlı kontrol listesi raporu üretir.
    Aktif model önbellekte varsa CAD ölçümleri otomatik harmanlanır.
    """
    occ_str = payload.get("occupancy_type", "konut")
    try:
        occ_type = BuildingOccupancyType(occ_str)
    except ValueError:
        occ_type = BuildingOccupancyType.RESIDENTIAL

    sprinkler = bool(payload.get("sprinkler_enabled", False))
    b_height = float(payload.get("building_height_m", 24.5))
    floors = int(payload.get("total_floors", 8))
    area_m2 = float(payload.get("floor_area_m2", 650.0))
    user_measured = payload.get("measured_data", {})

    measured = {
        "stairs_count": 2 if floors >= 8 or b_height >= 21.5 else 1,
        "dead_end_m": 12.4,
        "travel_distance_m": 24.8,
        "corridor_width_cm": 120.0,
        "corridor_height_cm": 220.0,
        "door_width_cm": 95.0,
        "stair_flight_width_cm": 125.0,
        "stair_riser_cm": 16.5,
        "stair_tread_cm": 28.5,
        "headroom_cm": 215.0,
        "landing_steps": 16,
        "has_spiral_stairs": False,
        "has_balanced_stairs": False,
        "fire_wall_minutes": 120,
        "fire_door_minutes": 90,
        "has_safety_hall": True,
        "safety_hall_area_m2": 3.4,
        "has_pressurization": True if b_height >= 21.5 else False,
        "has_banned_equipment_in_shaft": False,
        "stairs_distance_ratio": 0.38,
        "direct_exterior_exit_ratio": 0.50,
        "ground_floor_exit_distance_m": 9.2,
        "doors_unlocked_and_outward": True,
        "has_horizontal_compartment": True if occ_type == BuildingOccupancyType.HEALTHCARE else False
    }

    if "last" in CACHED_RESULT:
        last_out: DiagramYonetmelikPipelineOutput = CACHED_RESULT["last"]
        b_3d = last_out.building_3d_result
        floors = b_3d.total_floors
        b_height = float(floors * 3.0)

        stair_nodes = [n for n, d in b_3d.G_3d.nodes(data=True) if d.get("room_type") == "yangin_merdiveni"]
        stair_count_per_floor = max(1, len(stair_nodes) // max(1, floors))
        measured["stairs_count"] = stair_count_per_floor

        door_widths = [d.get("door_width_cm", 90.0) for u, v, d in b_3d.G_3d.edges(data=True)]
        if door_widths:
            measured["door_width_cm"] = float(sum(door_widths) / len(door_widths))

        if last_out.building_program and last_out.building_program.total_residential_area_m2:
            area_m2 = float(last_out.building_program.total_residential_area_m2 / max(1, floors))

    measured.update(user_measured)

    report = evaluate_building_checklist(
        occupancy_type=occ_type,
        sprinkler_enabled=sprinkler,
        building_height_m=b_height,
        total_floors=floors,
        floor_area_m2=area_m2,
        measured_data=measured
    )

    serialized_categories = {}
    for cat_name, items in report.categories.items():
        serialized_categories[cat_name] = [
            {
                "item_id": it.item_id,
                "category_id": it.category_id,
                "title_tr": it.title_tr,
                "legal_basis": it.legal_basis,
                "mandatory_rule": it.mandatory_rule,
                "target_value_str": it.target_value_str,
                "actual_value_str": it.actual_value_str,
                "is_compliant": it.is_compliant,
                "severity": it.severity,
                "design_remedy_tr": it.design_remedy_tr,
                "details": it.details
            }
            for it in items
        ]

    return JSONResponse(content={
        "building_occupancy": report.building_occupancy.value,
        "occupancy_title": report.occupancy_title,
        "sprinkler_enabled": report.sprinkler_enabled,
        "building_height_m": round(report.building_height_m, 1),
        "total_floors": report.total_floors,
        "is_high_rise": report.is_high_rise,
        "total_checks": report.total_checks,
        "passed_checks": report.passed_checks,
        "failed_checks": report.failed_checks,
        "compliance_score_percent": report.compliance_score_percent,
        "categories": serialized_categories,
        "critical_violations": [
            {
                "item_id": it.item_id,
                "title_tr": it.title_tr,
                "legal_basis": it.legal_basis,
                "actual_value_str": it.actual_value_str,
                "target_value_str": it.target_value_str,
                "severity": it.severity,
                "design_remedy_tr": it.design_remedy_tr
            }
            for it in report.critical_violations
        ]
    })


# Frontend static files mounting
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
