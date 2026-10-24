"""
Tests for diagram_yonetmelik.regulations_library and regulations API endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from diagram_yonetmelik.api import app
from diagram_yonetmelik.regulations_library import (
    get_all_regulations_summary,
    get_articles_by_regulation,
    get_article_by_id,
    search_articles,
    find_article_for_violation_code,
    REGULATIONS_METADATA,
    ALL_REGULATION_ARTICLES,
)


def test_regulations_metadata_presence():
    """Tüm 4 temel yönetmelik metadatasının eksiksiz olduğunu doğrula."""
    assert len(REGULATIONS_METADATA) == 4
    for code in ["BYKHY", "PAIY", "SIGINAK", "OTOPARK"]:
        assert code in REGULATIONS_METADATA
        meta = REGULATIONS_METADATA[code]
        assert "name" in meta
        assert "official_url" in meta
        assert "official_gazette_no" in meta
        assert "mevzuat.gov.tr" in meta["official_url"]


def test_articles_indexing_and_parameters():
    """Tüm maddelerin tam metin, sayısal parametre ve kontrol listesi içerdiğini doğrula."""
    assert len(ALL_REGULATION_ARTICLES) >= 20
    
    # BYKHY-M31 Kaçış Merdiveni
    m31 = get_article_by_id("BYKHY-M31")
    assert m31 is not None
    assert "Madde 31" in m31["article_number"]
    assert m31["numerical_parameters"]["yuksek_bina_esigi_m"] == 21.50
    assert m31["numerical_parameters"]["asgari_merdiven_sayisi"] == 2
    assert len(m31["architectural_checklist"]) >= 3

    assert "BYKHY_M31_KACIS_MERDIVEN_SAYISI_YETERSIZ" in m31["associated_violation_codes"]

    # PAIY-M29 Kat Koridoru Genişliği
    m29 = get_article_by_id("PAIY-M29")
    assert m29 is not None
    assert m29["numerical_parameters"]["min_koridor_genisligi_m"] == 1.20

    # SIGINAK-M9 ve M13
    siginak = get_article_by_id("SIGINAK-M9")
    assert siginak is not None
    assert siginak["numerical_parameters"]["kisi_basi_min_alan_m2"] == 1.0
    assert "hava kilidi" in siginak["full_text_tr"].lower()



def test_search_articles():
    """Arama motorunun anahtar kelime ve madde no filtrelemesini doğrula."""
    results = search_articles("yangın merdiveni")
    assert len(results) > 0
    assert any("M31" in r["article_id"] or "M33" in r["article_id"] for r in results)

    siginak_res = search_articles("sığınak")
    assert len(siginak_res) > 0
    assert any("SIGINAK" in r["regulation_code"] for r in siginak_res)


def test_find_article_for_violation_code():
    """İhlal kodu ile ilgili mevzuat maddesinin birebir eşleşmesini doğrula."""
    art = find_article_for_violation_code("BYKHY_M31_KACIS_MERDIVEN_SAYISI_YETERSIZ")
    assert art is not None
    assert art["article_id"] == "BYKHY-M31"

    art2 = find_article_for_violation_code("BYKHY_M32_YANGIN_GUVENLIK_HOLU_EKSİK")
    assert art2 is not None
    assert art2["article_id"] == "BYKHY-M32"


def test_regulations_api_endpoints():
    """FastAPI TestClient üzerinden mevzuat REST API endpoint'lerini test et."""
    client = TestClient(app)

    # 1. /api/regulations
    res = client.get("/api/regulations")
    assert res.status_code == 200
    data = res.json()
    assert data["total_regulations"] == 4
    assert len(data["regulations"]) == 4

    # 2. /api/regulations/BYKHY
    res_bykhy = client.get("/api/regulations/BYKHY")
    assert res_bykhy.status_code == 200
    assert res_bykhy.json()["total_articles"] >= 10

    # 3. /api/regulations/article/BYKHY-M31
    res_art = client.get("/api/regulations/article/BYKHY-M31")
    assert res_art.status_code == 200
    art_data = res_art.json()
    assert art_data["article_id"] == "BYKHY-M31"
    assert "mevzuat.gov.tr" in art_data["official_url"]

    # 4. /api/regulations/search?q=asansor
    res_search = client.get("/api/regulations/search?q=asansor")
    assert res_search.status_code == 200
    assert res_search.json()["total_results"] > 0

    # 5. /api/regulations/by-violation/BYKHY_M31_KACIS_MERDIVEN_SAYISI_YETERSIZ
    res_viol = client.get("/api/regulations/by-violation/BYKHY_M31_KACIS_MERDIVEN_SAYISI_YETERSIZ")
    assert res_viol.status_code == 200
    assert res_viol.json()["matched"] is True
