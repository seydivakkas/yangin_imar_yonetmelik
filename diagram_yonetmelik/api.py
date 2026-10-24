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

from diagram_yonetmelik.schemas import (
    PipelineConfig,
    DiagramYonetmelikPipelineOutput,
)
from diagram_yonetmelik.orchestrator import DiagramYonetmelikPipeline
from diagram_yonetmelik.sample_generator import (
    generate_sample_building_dxf,
    generate_sample_floorplan_image,
)
from diagram_yonetmelik.evacuation import Building3DEvacuationSimulator

app = FastAPI(
    title="DiagramYönetmelik API",
    description="3B Mekânsal Denetim, RAG ve Yangın/Tahliye Simülasyon Motoru REST API",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
            "connection_type": d.get("connection_type", "door"),
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
            "edge": list(b.edge),
            "source_type": b.source_room_type,
            "target_type": b.target_room_type,
            "floor_level": b.floor_level,
            "max_queue": b.max_queue_persons,
            "spillback_sec": b.spillback_blocked_sec,
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

    return {
        "metadata": {
            "title": output.building_program.apartment_types_breakdown,
            "total_floors": output.building_3d_result.total_floors,
            "total_rooms": output.building_3d_result.total_rooms,
            "total_doors": output.building_3d_result.total_doors,
            "verified_cores": output.verified_escape_cores,
            "latency": output.execution_metrics
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
        "violations": violations_data,
        "evacuation": {
            "baseline_time_sec": output.baseline_evacuation_report.total_evacuation_time_sec,
            "target_threshold_sec": output.baseline_evacuation_report.target_threshold_sec,
            "critical_count": output.baseline_evacuation_report.critical_bottleneck_count,
            "is_compliant": output.baseline_evacuation_report.is_compliance_achieved,
            "bottlenecks": bottlenecks_data,
            "smoke_zones": smoke_data,
            "time_series": output.baseline_evacuation_report.time_series_evacuated
        },
        "optimization": {
            "baseline_time_sec": output.counterfactual_optimization.baseline_evacuation_time_sec,
            "optimized_time_sec": output.counterfactual_optimization.optimized_evacuation_time_sec,
            "savings_sec": output.counterfactual_optimization.time_savings_sec,
            "remodeling_cost": output.counterfactual_optimization.total_remodeling_cost,
            "steps": interventions_data
        },
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


@app.post("/api/audit/dxf")
async def audit_dxf_file(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".dxf"):
        raise HTTPException(status_code=400, detail="Lütfen geçerli bir .dxf dosyası yükleyin.")
    contents = await file.read()
    temp_path = os.path.join(tempfile.gettempdir(), file.filename)
    with open(temp_path, "wb") as f:
        f.write(contents)
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
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".png", ".jpg", ".jpeg"):
        raise HTTPException(status_code=400, detail="Lütfen PNG veya JPG formatında kat planı yükleyin.")
    contents = await file.read()
    temp_path = os.path.join(tempfile.gettempdir(), file.filename)
    with open(temp_path, "wb") as f:
        f.write(contents)
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
    out_dxf_path = os.path.join(tempfile.gettempdir(), "denetlenmis_diagram_yonetmelik.dxf")
    output: DiagramYonetmelikPipelineOutput = CACHED_RESULT["last"]
    output.annotated_dxf_document.saveas(out_dxf_path)
    return FileResponse(out_dxf_path, filename="denetlenmis_diagram_yonetmelik.dxf", media_type="application/dxf")


# Frontend static files mounting
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
