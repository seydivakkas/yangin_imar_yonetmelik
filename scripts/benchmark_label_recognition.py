import os
import sys
import json
from typing import Dict, Any, List

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from diagram_yonetmelik.cad_ingest import TurkishArchitecturalLabelClassifier

# Test etiket seti: (ham_metin, beklenen_oda_tipi, mutasyon_turu, en_boy_orani, alan_m2)
TEST_LABEL_SAMPLES = [
    # 1. Tam İsimler
    ("YANGIN GUVENLIK HOLU", "yangin_holu", "tam_isim", 1.2, 4.5),
    ("KAT KORIDORU", "kat_koridoru", "tam_isim", 4.0, 20.0),
    ("YANGIN MERDIVENI", "yangin_merdiveni", "tam_isim", 1.5, 12.0),
    ("SALON", "salon", "tam_isim", 1.3, 28.0),
    ("YATAK ODASI", "oda", "tam_isim", 1.2, 14.0),
    ("MUTFAK", "mutfak", "tam_isim", 1.4, 10.0),
    ("BANYO WC", "banyo_wc", "tam_isim", 1.1, 5.0),
    ("DAIRE ANTRESI", "daire_antresi", "tam_isim", 1.5, 8.0),

    # 2. Mimari Kısaltmalar
    ("Y.G.H.", "yangin_holu", "kisaltma", 1.2, 4.5),
    ("Y.H.", "yangin_holu", "kisaltma", 1.2, 4.0),
    ("KOR.", "kat_koridoru", "kisaltma", 4.5, 18.0),
    ("Y.MERD.", "yangin_merdiveni", "kisaltma", 1.5, 12.0),
    ("SAL.", "salon", "kisaltma", 1.3, 30.0),
    ("Y.O.", "oda", "kisaltma", 1.2, 12.0),
    ("MUT.", "mutfak", "kisaltma", 1.3, 9.0),
    ("EBV. BNY", "banyo_wc", "kisaltma", 1.1, 4.5),
    ("ANT.", "daire_antresi", "kisaltma", 1.4, 7.0),

    # 3. Yazım Hatalı / Bozulmuş Metinler (Fuzzy)
    ("yagnin holu", "yangin_holu", "yazim_hatasi", 1.2, 4.5),
    ("kat kordoru", "kat_koridoru", "yazim_hatasi", 4.0, 22.0),
    ("yangn merdiven", "yangin_merdiveni", "yazim_hatasi", 1.5, 11.0),
    ("slon", "salon", "yazim_hatasi", 1.2, 28.0),
    ("ytak odasi", "oda", "yazim_hatasi", 1.2, 13.0),
    ("mutfakc", "mutfak", "yazim_hatasi", 1.4, 10.0),
    ("banyo w.c.", "banyo_wc", "yazim_hatasi", 1.1, 5.0),

    # 4. Silinmiş / Boş / Geometriden Tanınacak Metinler
    ("", "kat_koridoru", "geometrik_fallback", 4.2, 25.0),
    ("", "banyo_wc", "geometrik_fallback", 1.1, 4.0),
    ("", "salon", "geometrik_fallback", 1.2, 32.0),

    # 5. Tamamen Belirsiz (Uydurulmayacak)
    ("", "belirsiz", "belirsiz", 1.3, 14.0),
    ("BLOK A 2. KAT", "belirsiz", "belirsiz", 1.2, 15.0),
]

def run_benchmark() -> Dict[str, Any]:
    correct_old = 0
    correct_new = 0
    results_detail = []

    source_counts = {"sozluk": 0, "bulanik": 0, "geometri": 0, "belirsiz": 0}

    for raw, expected, category, aspect, area in TEST_LABEL_SAMPLES:
        # 1. Eski Sınıflandırıcı Mantığı
        # Sadece basit normalize_turkish ve anahtar kelime kuralları; eşleşmezse "oda" uydurur
        norm = TurkishArchitecturalLabelClassifier.normalize_turkish(raw)
        old_pred = None
        for canonical, kws in TurkishArchitecturalLabelClassifier.RULES:
            if any(kw in norm for kw in kws):
                old_pred = canonical
                break
        if not old_pred:
            if aspect >= 3.5 and area >= 10.0:
                old_pred = "kat_koridoru"
            elif area < 7.0:
                old_pred = "banyo_wc"
            elif area >= 24.0:
                old_pred = "salon"
            else:
                old_pred = "oda" # Uydurma!

        # 2. Yeni Sınıflandırıcı Mantığı (Sözlük + Bulanık + Geometri + Belirsiz)
        new_pred, source, conf = TurkishArchitecturalLabelClassifier.classify_room_details(
            raw,
            aspect_ratio=aspect,
            area_m2=area,
            fuzzy_threshold=0.70
        )
        source_counts[source] = source_counts.get(source, 0) + 1

        is_old_correct = (old_pred == expected)
        is_new_correct = (new_pred == expected)
        if is_old_correct:
            correct_old += 1
        if is_new_correct:
            correct_new += 1

        results_detail.append({
            "raw_text": raw,
            "expected_type": expected,
            "category": category,
            "old_method_prediction": old_pred,
            "old_method_correct": is_old_correct,
            "new_method_prediction": new_pred,
            "new_method_source": source,
            "new_method_confidence": conf,
            "new_method_correct": is_new_correct
        })

    total_samples = len(TEST_LABEL_SAMPLES)
    acc_old = round((correct_old / total_samples) * 100.0, 1)
    acc_new = round((correct_new / total_samples) * 100.0, 1)

    output = {
        "benchmark": "Türkçe Mimari Etiket Tanıma ve Dayanıklılık Ölçümü",
        "description": "Bozulmuş, kısaltılmış, yazım hatalı ve silinmiş etiketlerde eski vs yeni sınıflandırıcının doğruluk oranları.",
        "total_test_samples": total_samples,
        "old_accuracy_pct": acc_old,
        "new_accuracy_pct": acc_new,
        "accuracy_gain_pct": round(acc_new - acc_old, 1),
        "label_source_distribution": source_counts,
        "results_detail": results_detail
    }

    out_path = os.path.join("data", "benchmarks", "label_recognition.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Benchmark tamamlandi: {out_path}")
    return output

if __name__ == "__main__":
    run_benchmark()

