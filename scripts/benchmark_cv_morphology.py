import os
import sys
import json
import math
import cv2
import numpy as np
from typing import Dict, Any, List, Tuple

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from diagram_yonetmelik.cv_analyzer import FloorplanImageAnalyzer

def generate_orthogonal_plan(ppm: int) -> Tuple[np.ndarray, int]:
    # 4 odalı dik plan (her oda 4m x 4m)
    w_px, h_px = int(10 * ppm), int(10 * ppm)
    img = np.ones((h_px, w_px, 3), dtype=np.uint8) * 255
    th = max(2, int(0.20 * ppm))
    door_w = int(0.90 * ppm)

    # Dış duvarlar
    cv2.rectangle(img, (int(ppm), int(ppm)), (int(9*ppm), int(9*ppm)), (0, 0, 0), th)
    # İç duvarlar (haç şeklinde, ortada kapı açıklıkları)
    # Yatay duvar
    cv2.line(img, (int(ppm), int(5*ppm)), (int(4.5*ppm), int(5*ppm)), (0, 0, 0), th)
    cv2.line(img, (int(5.5*ppm), int(5*ppm)), (int(9*ppm), int(5*ppm)), (0, 0, 0), th)
    # Dikey duvar
    cv2.line(img, (int(5*ppm), int(ppm)), (int(5*ppm), int(4.5*ppm)), (0, 0, 0), th)
    cv2.line(img, (int(5*ppm), int(5.5*ppm)), (int(5*ppm), int(9*ppm)), (0, 0, 0), th)

    return img, 4

def generate_30deg_plan(ppm: int) -> Tuple[np.ndarray, int]:
    # 3 odalı, 30 derece açılı duvar içeren plan
    w_px, h_px = int(12 * ppm), int(12 * ppm)
    img = np.ones((h_px, w_px, 3), dtype=np.uint8) * 255
    th = max(2, int(0.20 * ppm))

    cv2.rectangle(img, (int(ppm), int(ppm)), (int(11*ppm), int(11*ppm)), (0, 0, 0), th)
    # 30 derece açılı bölücü duvar (açıklıklı)
    x1, y1 = int(ppm), int(4*ppm)
    length = 8 * ppm
    rad = math.radians(30)
    x2 = int(x1 + length * math.cos(rad))
    y2 = int(y1 + length * math.sin(rad))

    # Ortada 1.0m kapı boşluğu bırak
    mid_x = (x1 + x2) // 2
    mid_y = (y1 + y2) // 2
    dx = int(0.5 * ppm * math.cos(rad))
    dy = int(0.5 * ppm * math.sin(rad))
    cv2.line(img, (x1, y1), (mid_x - dx, mid_y - dy), (0, 0, 0), th)
    cv2.line(img, (mid_x + dx, mid_y + dy), (x2, y2), (0, 0, 0), th)

    # İkinci dikey bölücü
    cv2.line(img, (int(6*ppm), int(7*ppm)), (int(6*ppm), int(11*ppm)), (0, 0, 0), th)

    return img, 3

def generate_45deg_plan(ppm: int) -> Tuple[np.ndarray, int]:
    # 4 odalı, 45 derece çapraz pahlı plan
    w_px, h_px = int(12 * ppm), int(12 * ppm)
    img = np.ones((h_px, w_px, 3), dtype=np.uint8) * 255
    th = max(2, int(0.20 * ppm))

    cv2.rectangle(img, (int(ppm), int(ppm)), (int(11*ppm), int(11*ppm)), (0, 0, 0), th)
    # 45 derece çapraz duvarlar
    # Çapraz 1 (Sol alt -> Sağ üst)
    cv2.line(img, (int(2*ppm), int(2*ppm)), (int(5*ppm), int(5*ppm)), (0, 0, 0), th)
    cv2.line(img, (int(6.2*ppm), int(6.2*ppm)), (int(10*ppm), int(10*ppm)), (0, 0, 0), th)
    # Çapraz 2 (Sol üst -> Sağ alt)
    cv2.line(img, (int(2*ppm), int(10*ppm)), (int(5*ppm), int(7*ppm)), (0, 0, 0), th)
    cv2.line(img, (int(6.2*ppm), int(5.8*ppm)), (int(10*ppm), int(2*ppm)), (0, 0, 0), th)

    return img, 4

def generate_circular_plan(ppm: int) -> Tuple[np.ndarray, int]:
    # 2 odalı, iç dairesel çekirdek ve dış dairesel oda
    w_px, h_px = int(12 * ppm), int(12 * ppm)
    img = np.ones((h_px, w_px, 3), dtype=np.uint8) * 255
    th = max(2, int(0.20 * ppm))
    cx, cy = int(6 * ppm), int(6 * ppm)

    # Dış dairesel duvar
    cv2.circle(img, (cx, cy), int(5 * ppm), (0, 0, 0), th)
    # İç dairesel duvar (kapı açıklıklı yay)
    r_inner = int(2.5 * ppm)
    # 0 - 320 derece çiz, 40 derecelik kapı açıklığı bırak
    cv2.ellipse(img, (cx, cy), (r_inner, r_inner), 0, 40, 360, (0, 0, 0), th)

    return img, 2

def analyze_old_method(img_bgr: np.ndarray, ppm: float) -> int:
    """Eski yöntem: 25-85 piksel sınırı ve yalnızca yatay/dikey kapatma"""
    img_gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    blurred = cv2.bilateralFilter(img_gray, d=7, sigmaColor=50, sigmaSpace=50)
    _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    door_k_size = int(max(25, min(85, ppm * 1.5)))
    k_h = cv2.getStructuringElement(cv2.MORPH_RECT, (door_k_size, 5))
    k_v = cv2.getStructuringElement(cv2.MORPH_RECT, (5, door_k_size))
    closed_h = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, k_h)
    closed_walls = cv2.morphologyEx(closed_h, cv2.MORPH_CLOSE, k_v)

    rooms_mask = cv2.bitwise_not(closed_walls)
    clean_rooms = cv2.morphologyEx(rooms_mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)))
    contours, _ = cv2.findContours(clean_rooms, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)

    valid_count = 0
    h, w = img_bgr.shape[:2]
    min_area_px = 3.0 * (ppm ** 2)
    for cnt in contours:
        if cv2.contourArea(cnt) < min_area_px:
            continue
        x, y, cw, ch = cv2.boundingRect(cnt)
        if cw > w * 0.96 and ch > h * 0.96:
            continue
        valid_count += 1
    return valid_count

def run_benchmark() -> Dict[str, Any]:
    test_plans = [
        ("Dik Duvarlı Plan (Orthogonal)", generate_orthogonal_plan),
        ("30° Pahlı Plan (30-deg Chamfered)", generate_30deg_plan),
        ("45° Pahlı Plan (45-deg Chamfered)", generate_45deg_plan),
        ("Dairesel Duvarlı Plan (Circular)", generate_circular_plan),
    ]

    ppms = [25, 100]
    results = []

    for name, gen_fn in test_plans:
        for ppm in ppms:
            img, known_rooms = gen_fn(ppm)

            # 1. Eski Yöntem (Old Method)
            detected_old = analyze_old_method(img, ppm=float(ppm))

            # 2. Yeni Yöntem (New Method: Hough dominant angles + dynamic kernel size)
            analyzer_new = FloorplanImageAnalyzer(pixels_per_meter=float(ppm), door_bridge_m=1.50)
            rooms_new, _, _ = analyzer_new.analyze_image_array(img)
            detected_new = len(rooms_new)

            results.append({
                "plan_type": name,
                "pixels_per_meter": ppm,
                "known_rooms_count": known_rooms,
                "detected_rooms_old_method": detected_old,
                "error_old_method": abs(detected_old - known_rooms),
                "detected_rooms_new_method": detected_new,
                "error_new_method": abs(detected_new - known_rooms),
                "success_new_method": detected_new == known_rooms
            })

    output = {
        "benchmark": "OpenCV Morfolojik Kapatma ve Açısal Çekirdek Ölçümü",
        "description": "Dik, 30°, 45° ve dairesel planlarda ppm 25 ve 100 ölçeklerinde bilinen oda sayısına karşı tespit edilen oda sayıları.",
        "results": results
    }

    out_path = os.path.join("data", "benchmarks", "cv_morphology.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Benchmark tamamlandi: {out_path}")
    return output

if __name__ == "__main__":
    run_benchmark()

