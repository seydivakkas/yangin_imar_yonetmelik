import glob
import os
import tempfile

import pytest
from fastapi.testclient import TestClient

from diagram_yonetmelik.api import app
from diagram_yonetmelik.sample_generator import generate_sample_building_dxf


TEMP_DIR = os.path.realpath(tempfile.gettempdir())


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def _upload_names_escaping_temp_dir(victim: str):
    relative = os.path.relpath(victim, TEMP_DIR)
    # Eski kodda bu ad hedef dosyaya ulaşıyordu; değilse test boşa geçer.
    assert os.path.samefile(os.path.join(TEMP_DIR, relative), victim)
    return [victim.replace("\\", "/"), relative.replace("\\", "/"), relative]


@pytest.mark.parametrize("endpoint,extension", [("/api/audit/dxf", ".dxf"), ("/api/audit/image", ".png")])
def test_upload_filename_cannot_touch_files_outside_temp_dir(client, tmp_path, endpoint, extension):
    victim = tmp_path / f"kurban{extension}"
    victim.write_text("ORIJINAL")

    for filename in _upload_names_escaping_temp_dir(str(victim)):
        response = client.post(endpoint, files={"file": (filename, b"gecersiz icerik")})
        assert response.status_code == 500
        assert victim.read_text() == "ORIJINAL"


def test_valid_dxf_upload_works_and_leaves_no_temp_file(client, tmp_path):
    sample = tmp_path / "ornek.dxf"
    generate_sample_building_dxf(str(sample))
    pattern = os.path.join(tempfile.gettempdir(), "diag_upload_*")
    before = set(glob.glob(pattern))

    response = client.post("/api/audit/dxf", files={"file": ("ornek.dxf", sample.read_bytes())})

    assert response.status_code == 200
    assert "evacuation" in response.json()
    assert set(glob.glob(pattern)) == before


@pytest.mark.parametrize("endpoint,filename", [("/api/audit/dxf", "plan.exe"), ("/api/audit/image", "plan.dxf")])
def test_upload_rejects_wrong_extension(client, endpoint, filename):
    response = client.post(endpoint, files={"file": (filename, b"icerik")})
    assert response.status_code == 400


def test_cors_does_not_allow_arbitrary_sites(client):
    response = client.get("/api/health", headers={"Origin": "https://kotu-site.example"})
    assert "access-control-allow-origin" not in response.headers
