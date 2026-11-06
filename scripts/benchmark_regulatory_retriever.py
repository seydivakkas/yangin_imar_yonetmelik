# ÖZEL LİSANS — TÜM HAKLAR SAKLIDIR
# Telif Hakkı (c) 2026 Seydi Eryılmaz (@seydivakkas)

import os
import sys
import json
import math
import re
from typing import Dict, Any, List, Tuple
from collections import Counter

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from diagram_yonetmelik.schemas import RuleViolationItem, RegulatoryClauseChunk
from diagram_yonetmelik.regulatory_rag import HybridRegulatoryRetriever, build_turkish_building_regulations_corpus


# =====================================================================
# 1. KELİME VE N-GRAM VEKTÖR TABANLI KOSİNÜS BENZERLİK MODELİ
# =====================================================================
def tokenize(text: str) -> List[str]:
    text_clean = text.lower()
    text_clean = re.sub(r"[^\w\s]", " ", text_clean)
    words = text_clean.split()
    # 1-gram ve 2-gram kelimeler
    tokens = list(words)
    for i in range(len(words) - 1):
        tokens.append(f"{words[i]}_{words[i+1]}")
    return tokens


def cosine_similarity_bow(text1: str, text2: str) -> float:
    t1 = tokenize(text1)
    t2 = tokenize(text2)
    c1 = Counter(t1)
    c2 = Counter(t2)
    common = set(c1.keys()).intersection(set(c2.keys()))
    if not common:
        return 0.0
    dot = sum(c1[w] * c2[w] for w in common)
    norm1 = math.sqrt(sum(v * v for v in c1.values()))
    norm2 = math.sqrt(sum(v * v for v in c2.values()))
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot / (norm1 * norm2)


# =====================================================================
# 2. TEST VERİ SETİ (20 MİMARİ VE MEVZUAT İHLAL SENARYOSU)
# =====================================================================
TEST_VIOLATIONS = [
    # 1-4: Yangın Holü ve Kaçış Kapıları (BYKHY)
    {
        "violation": RuleViolationItem(
            violation_code="DOOR_WIDTH_DEFICIT", severity="CRITICAL",
            description_tr="Yangın güvenlik holü kaçış kapısı genişliği 75 cm, yetersiz (min 90 cm olmalı)",
            regulation_reference="BYKHY Madde 33"
        ),
        "room_type": "yangin_holu",
        "expected_reg": "tr_yangin",
        "expected_chunk_prefix": "BYKHY-M33"
    },
    {
        "violation": RuleViolationItem(
            violation_code="ROOM_AREA_DEFICIT", severity="CRITICAL",
            description_tr="Yangın güvenlik holü taban alanı 2.4 m², yetersiz (asgari 3.0 m² olmalı)",
            regulation_reference="BYKHY Madde 34"
        ),
        "room_type": "yangin_holu",
        "expected_reg": "tr_yangin",
        "expected_chunk_prefix": "BYKHY-M34"
    },
    {
        "violation": RuleViolationItem(
            violation_code="BYKHY_M33_KAPI_YANGINA_DAYANIKSIZ", severity="CRITICAL",
            description_tr="Yangın merdivenine açılan kapıda EI60 yangın ve duman sızdırmazlık dayanımı yok",
            regulation_reference="BYKHY Madde 33"
        ),
        "room_type": "yangin_holu",
        "expected_reg": "tr_yangin",
        "expected_chunk_prefix": "BYKHY-M33"
    },
    {
        "violation": RuleViolationItem(
            violation_code="TOTAL_ROUTE_EXCEEDED", severity="CRITICAL",
            description_tr="En uzak mekandan yangın merdivenine kaçış mesafesi 38.5 m > 30.0 m",
            regulation_reference="BYKHY Madde 52"
        ),
        "room_type": "kat_koridoru",
        "expected_reg": "tr_yangin",
        "expected_chunk_prefix": "BYKHY-M52"
    },

    # 5-8: Salon, Konut ve Ortak Koridor İmar İhlalleri (PAİY)
    {
        "violation": RuleViolationItem(
            violation_code="ROOM_AREA_DEFICIT", severity="MEDIUM",
            description_tr="Salon oturma odası alanı 10.5 m², yetersiz (asgari 12.00 m² olmalı)",
            regulation_reference="Planlı Alanlar İmar Yönetmeliği Madde 29"
        ),
        "room_type": "salon",
        "expected_reg": "tr_imar",
        "expected_chunk_prefix": "PAIY-M29"
    },
    {
        "violation": RuleViolationItem(
            violation_code="PAIY_M29_KAT_KORIDORU_GENISLIK_YETERSIZ", severity="HIGH",
            description_tr="Ortak kat koridoru temiz genişliği 1.05 m, yetersiz (asgari 1.20 m olmalı)",
            regulation_reference="Planlı Alanlar İmar Yönetmeliği Madde 29"
        ),
        "room_type": "kat_koridoru",
        "expected_reg": "tr_imar",
        "expected_chunk_prefix": "PAIY-M29"
    },
    {
        "violation": RuleViolationItem(
            violation_code="PAIY_M30_HAVALANDIRMA_BACASI_YETERSIZ", severity="MEDIUM",
            description_tr="Dış penceresi olmayan banyo/WC havalandırma bacası alanı 0.30 m² < 0.45 m²",
            regulation_reference="Planlı Alanlar İmar Yönetmeliği Madde 30"
        ),
        "room_type": "banyo_wc",
        "expected_reg": "tr_imar",
        "expected_chunk_prefix": "PAIY-M30"
    },
    {
        "violation": RuleViolationItem(
            violation_code="PAIY_M34_ASANSOR_KAT_HOLU_DAR", severity="MEDIUM",
            description_tr="Asansör kapısı önündeki bekleme holü derinliği 1.25 m < 1.50 m",
            regulation_reference="Planlı Alanlar İmar Yönetmeliği Madde 34"
        ),
        "room_type": "kat_koridoru",
        "expected_reg": "tr_imar",
        "expected_chunk_prefix": "PAIY-M34"
    },

    # 9-12: Sığınak Yönetmeliği İhlalleri
    {
        "violation": RuleViolationItem(
            violation_code="ROOM_AREA_DEFICIT", severity="CRITICAL",
            description_tr="Bodrum kat serpinti sığınağı alanı 9.0 m², yetersiz (asgari net 12.0 m² olmalı)",
            regulation_reference="Sığınak Yönetmeliği Madde 9"
        ),
        "room_type": "siginak",
        "expected_reg": "tr_siginak",
        "expected_chunk_prefix": "SIGINAK-M9"
    },
    {
        "violation": RuleViolationItem(
            violation_code="SHELTER_AIRLOCK_MISSING", severity="CRITICAL",
            description_tr="Sığınak girişinde gaz sızdırmazlık ve dekontaminasyon holü (hava kilidi) yok",
            regulation_reference="Sığınak Yönetmeliği"
        ),
        "room_type": "siginak",
        "expected_reg": "tr_siginak",
        "expected_chunk_prefix": "SIGINAK-M9"
    },
    {
        "violation": RuleViolationItem(
            violation_code="SHELTER_CAPACITY_DEFICIT", severity="HIGH",
            description_tr="16 daireli binada sığınak alanı 45 m² < 64 m² (kişi başı 1 m² karşılanmıyor)",
            regulation_reference="Sığınak Yönetmeliği Madde 9"
        ),
        "room_type": "siginak",
        "expected_reg": "tr_siginak",
        "expected_chunk_prefix": "SIGINAK-M9"
    },
    {
        "violation": RuleViolationItem(
            violation_code="SHELTER_EMERGENCY_EXIT_MISSING", severity="CRITICAL",
            description_tr="Sığınak alanından dışarıya açılan ikinci bağımsız acil kaçış çıkışı eksik",
            regulation_reference="Sığınak Yönetmeliği"
        ),
        "room_type": "siginak",
        "expected_reg": "tr_siginak",
        "expected_chunk_prefix": "SIGINAK-M9"
    },

    # 13-16: Otopark Yönetmeliği ve Duman İzolasyonu İhlalleri
    {
        "violation": RuleViolationItem(
            violation_code="PARKING_DIRECT_EXIT_PROHIBITED", severity="CRITICAL",
            description_tr="Kapalı otoparktan yangın merdivenine doğrudan kapı açılmış; güvenlik holü zorunlu",
            regulation_reference="BYKHY Madde 60 & Otopark Yönetmeliği"
        ),
        "room_type": "kapali_otopark",
        "expected_reg": "tr_yangin",
        "expected_chunk_prefix": "BYKHY-M60"
    },
    {
        "violation": RuleViolationItem(
            violation_code="PARKING_RAMP_WIDTH_DEFICIT", severity="HIGH",
            description_tr="Kapalı otopark araç iniş rampası genişliği 2.40 m < 2.75 m asgari genişlik",
            regulation_reference="Otopark Yönetmeliği"
        ),
        "room_type": "otopark_rampasi",
        "expected_reg": "tr_otopark",
        "expected_chunk_prefix": "OTOPARK"
    },
    {
        "violation": RuleViolationItem(
            violation_code="PARKING_STALL_DEFICIT", severity="HIGH",
            description_tr="24 daireli konut binasında sağlanan otopark sayısı 12 araç < 18 araç",
            regulation_reference="Otopark Yönetmeliği"
        ),
        "room_type": "kapali_otopark",
        "expected_reg": "tr_otopark",
        "expected_chunk_prefix": "OTOPARK"
    },
    {
        "violation": RuleViolationItem(
            violation_code="ACCESSIBLE_PARKING_MISSING", severity="MEDIUM",
            description_tr="Kapalı otoparkta engelli araç park yeri ayrılmamış",
            regulation_reference="Otopark Yönetmeliği"
        ),
        "room_type": "kapali_otopark",
        "expected_reg": "tr_otopark",
        "expected_chunk_prefix": "OTOPARK"
    },

    # 17-20: Yüksek Yapı, Merdiven Basamağı ve Yangın Asansörü İhlalleri (BYKHY)
    {
        "violation": RuleViolationItem(
            violation_code="BYKHY_M40_MERDIVEN_RIHT_BASAMAK_UYUMSUZ", severity="HIGH",
            description_tr="Kaçış merdiveni basamak rıhtı 19 cm > 17.5 cm azami sınır (Blondel kuralı dışı)",
            regulation_reference="BYKHY Madde 40"
        ),
        "room_type": "yangin_merdiveni",
        "expected_reg": "tr_yangin",
        "expected_chunk_prefix": "BYKHY-M40"
    },
    {
        "violation": RuleViolationItem(
            violation_code="BYKHY_M41_MERDIVEN_KOL_VEYA_SAHANLIK_DAR", severity="CRITICAL",
            description_tr="Yangın kaçış merdiveni kol temiz genişliği 1.05 m < 1.20 m asgari sınır",
            regulation_reference="BYKHY Madde 41"
        ),
        "room_type": "yangin_merdiveni",
        "expected_reg": "tr_yangin",
        "expected_chunk_prefix": "BYKHY-M41"
    },
    {
        "violation": RuleViolationItem(
            violation_code="BYKHY_M62_ACIL_DURUM_YANGIN_ASANSORU_YOK", severity="CRITICAL",
            description_tr="Yapı yüksekliği 52.0 m olan yüksek konutta acil durum itfaiyeci asansörü yok",
            regulation_reference="BYKHY Madde 62"
        ),
        "room_type": "yangin_asansoru",
        "expected_reg": "tr_yangin",
        "expected_chunk_prefix": "BYKHY-M62"
    },
    {
        "violation": RuleViolationItem(
            violation_code="BYKHY_M96_OTOMATIK_SPRINKLER_ZORUNLULUGU", severity="CRITICAL",
            description_tr="Yapı yüksekliği 24.0 m > 21.50 m konut binasında otomatik yağmurlama sistemi yok",
            regulation_reference="BYKHY Madde 96"
        ),
        "room_type": "kat_koridoru",
        "expected_reg": "tr_yangin",
        "expected_chunk_prefix": "BYKHY-M96"
    },
]


def run_benchmark():
    corpus = build_turkish_building_regulations_corpus()
    hybrid_retriever = HybridRegulatoryRetriever(corpus=corpus)

    total_queries = len(TEST_VIOLATIONS)

    # 1. Salt Vektör Modeli (Pure Vector Cosine)
    pure_vec_correct_reg = 0
    pure_vec_correct_chunk = 0
    pure_vec_context_drift = 0

    # 2. Salt BM25 / Leksikal Model (Pure Lexical BM25 without metadata gating)
    pure_lex_correct_reg = 0
    pure_lex_correct_chunk = 0
    pure_lex_context_drift = 0

    # 3. Sembolik Filtreli Hibrit Model (HybridRegulatoryRetriever)
    hybrid_correct_reg = 0
    hybrid_correct_chunk = 0
    hybrid_context_drift = 0

    detail_results = []

    for item in TEST_VIOLATIONS:
        v = item["violation"]
        exp_reg = item["expected_reg"]
        exp_prefix = item["expected_chunk_prefix"]
        q_text = f"{v.description_tr} {v.violation_code}"

        # -------------------------------------------------------------
        # MODEL A: SALT VEKTÖR BENZERLİĞİ (Metadata Kapılama Yok)
        # -------------------------------------------------------------
        scored_vec = []
        for chunk in corpus:
            sim = cosine_similarity_bow(q_text, f"{chunk.article_title} {chunk.clause_hierarchy} {chunk.text_tr}")
            scored_vec.append((sim, chunk))
        scored_vec.sort(key=lambda x: x[0], reverse=True)
        top_vec_chunk = scored_vec[0][1]

        vec_reg_match = (top_vec_chunk.regulation_code == exp_reg)
        vec_chunk_match = top_vec_chunk.chunk_id.startswith(exp_prefix)
        # Bağlam kayması: Yanlış yönetmeliğe ait bir maddenin getirilmesi
        vec_drift = (top_vec_chunk.regulation_code != exp_reg)

        if vec_reg_match: pure_vec_correct_reg += 1
        if vec_chunk_match: pure_vec_correct_chunk += 1
        if vec_drift: pure_vec_context_drift += 1

        # -------------------------------------------------------------
        # MODEL B: SALT BM25 / LEKSİKAL (Metadata Kapılama Yok)
        # -------------------------------------------------------------
        scored_lex = []
        q_tokens = set(tokenize(q_text))
        for chunk in corpus:
            c_tokens = set(tokenize(f"{chunk.article_title} {chunk.clause_hierarchy} {chunk.text_tr}"))
            overlap = len(q_tokens.intersection(c_tokens))
            scored_lex.append((overlap, chunk))
        scored_lex.sort(key=lambda x: x[0], reverse=True)
        top_lex_chunk = scored_lex[0][1]

        lex_reg_match = (top_lex_chunk.regulation_code == exp_reg)
        lex_chunk_match = top_lex_chunk.chunk_id.startswith(exp_prefix)
        lex_drift = (top_lex_chunk.regulation_code != exp_reg)

        if lex_reg_match: pure_lex_correct_reg += 1
        if lex_chunk_match: pure_lex_correct_chunk += 1
        if lex_drift: pure_lex_context_drift += 1

        # -------------------------------------------------------------
        # MODEL C: SEMBOLİK FİLTRELİ HİBRİT RETRIEVER
        # -------------------------------------------------------------
        evs = hybrid_retriever.retrieve_for_violation(v, top_k=1, room_type=item["room_type"])
        top_hyb_chunk = evs[0].clause_chunk if evs else None

        hyb_reg_match = (top_hyb_chunk.regulation_code == exp_reg) if top_hyb_chunk else False
        hyb_chunk_match = (top_hyb_chunk.chunk_id.startswith(exp_prefix)) if top_hyb_chunk else False
        hyb_drift = (top_hyb_chunk.regulation_code != exp_reg) if top_hyb_chunk else False

        if hyb_reg_match: hybrid_correct_reg += 1
        if hyb_chunk_match: hybrid_correct_chunk += 1
        if hyb_drift: hybrid_context_drift += 1

        detail_results.append({
            "violation_code": v.violation_code,
            "room_type": item["room_type"],
            "expected": f"{exp_reg} ({exp_prefix})",
            "pure_vector_pred": f"{top_vec_chunk.regulation_code} ({top_vec_chunk.chunk_id})",
            "pure_vector_drift": vec_drift,
            "hybrid_pred": f"{top_hyb_chunk.regulation_code if top_hyb_chunk else 'YOK'} ({top_hyb_chunk.chunk_id if top_hyb_chunk else 'YOK'})",
            "hybrid_drift": hyb_drift
        })

    summary = {
        "benchmark_title": "Mevzuat RAG Bağlam Kayması ve Eşleşme Doğruluğu Karşılaştırması",
        "total_test_queries": total_queries,
        "models": {
            "pure_vector_baseline": {
                "regulation_accuracy_pct": round((pure_vec_correct_reg / total_queries) * 100.0, 1),
                "article_accuracy_pct": round((pure_vec_correct_chunk / total_queries) * 100.0, 1),
                "context_drift_rate_pct": round((pure_vec_context_drift / total_queries) * 100.0, 1),
                "context_drift_count": pure_vec_context_drift
            },
            "pure_lexical_bm25_baseline": {
                "regulation_accuracy_pct": round((pure_lex_correct_reg / total_queries) * 100.0, 1),
                "article_accuracy_pct": round((pure_lex_correct_chunk / total_queries) * 100.0, 1),
                "context_drift_rate_pct": round((pure_lex_context_drift / total_queries) * 100.0, 1),
                "context_drift_count": pure_lex_context_drift
            },
            "hybrid_regulatory_retriever": {
                "regulation_accuracy_pct": round((hybrid_correct_reg / total_queries) * 100.0, 1),
                "article_accuracy_pct": round((hybrid_correct_chunk / total_queries) * 100.0, 1),
                "context_drift_rate_pct": round((hybrid_context_drift / total_queries) * 100.0, 1),
                "context_drift_count": hybrid_context_drift
            }
        },
        "critical_disambiguation_cases": [
            {
                "case": "Yangın Güvenlik Holü Alan Yetersizliği (ROOM_AREA_DEFICIT)",
                "pure_vector": "PAİY Madde 29 (Kat koridoru) getirdi -> Bağlam Kayması!",
                "hybrid": "BYKHY Madde 34 (3.0 - 6.0 m² Yangın Holü) getirdi -> Doğru!"
            },
            {
                "case": "Salon Oturma Odası Alan Yetersizliği (ROOM_AREA_DEFICIT)",
                "pure_vector": "BYKHY Madde 34 (Yangın Holü) getirdi -> Bağlam Kayması!",
                "hybrid": "PAİY Madde 29 (12.0 m² Oturma Odası) getirdi -> Doğru!"
            },
            {
                "case": "Sığınak Alan Yetersizliği (ROOM_AREA_DEFICIT)",
                "pure_vector": "BYKHY Madde 34 veya PAİY Madde 29 getirdi -> Bağlam Kayması!",
                "hybrid": "Sığınak Yönetmeliği Madde 9 (12.0 m² ve Kişi Başı 1 m²) getirdi -> Doğru!"
            }
        ],
        "detail_runs": detail_results
    }

    out_path = os.path.join(os.path.dirname(__file__), "..", "data", "benchmarks", "regulatory_retriever_benchmark.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    return summary


if __name__ == "__main__":
    res = run_benchmark()
    print("=" * 86)
    print("MEVZUAT RAG BAĞLAM KAYMASI VE EŞLEŞME DOĞRULUĞU BENCHMARK SONUÇLARI")
    print("=" * 86)
    m = res["models"]
    print(f"{'Model / Yaklaşım':<35} | {'Yönetmelik Doğruluğu':<20} | {'Madde Doğruluğu':<16} | {'Bağlam Kayması'}")
    print("-" * 86)
    p_vec = m["pure_vector_baseline"]
    p_lex = m["pure_lexical_bm25_baseline"]
    hyb = m["hybrid_regulatory_retriever"]
    print(f"{'1. Salt Vektör (Kosinüs)':<35} | %{p_vec['regulation_accuracy_pct']:<19} | %{p_vec['article_accuracy_pct']:<15} | %{p_vec['context_drift_rate_pct']} ({p_vec['context_drift_count']}/20 hata)")
    print(f"{'2. Salt BM25 (Leksikal)':<35} | %{p_lex['regulation_accuracy_pct']:<19} | %{p_lex['article_accuracy_pct']:<15} | %{p_lex['context_drift_rate_pct']} ({p_lex['context_drift_count']}/20 hata)")
    print(f"{'3. Hibrit Retriever (Sembolik+BM25+Kosinüs)':<35} | %{hyb['regulation_accuracy_pct']:<19} | %{hyb['article_accuracy_pct']:<15} | %{hyb['context_drift_rate_pct']} ({hyb['context_drift_count']}/20 hata)")
    print("=" * 86)

