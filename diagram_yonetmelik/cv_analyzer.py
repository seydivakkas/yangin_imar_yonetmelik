import cv2
import numpy as np
import math
from typing import List, Tuple, Dict, Optional, Any
from shapely.geometry import Polygon, LineString, Point
from shapely.ops import unary_union

from diagram_yonetmelik.schemas import RoomPolygonInput, DoorGeometryInput


class FloorplanImageAnalyzer:
    """
    OpenCV tabanlı mimari kat planı görüntü işleme motoru.
    Görsel (PNG/JPG) olarak yüklenen kat planlarından duvar konturlarını,
    oda poligonlarını ve kapı açıklıklarını çıkarır, RAG formatına dönüştürür.
    """
    def __init__(self, pixels_per_meter: float = 50.0):
        self.ppm = pixels_per_meter

    def analyze_image_file(
        self,
        image_path: str,
        floor_level: int = 0,
        min_room_area_m2: float = 3.0
    ) -> Tuple[List[RoomPolygonInput], List[DoorGeometryInput], np.ndarray]:
        img_bgr = cv2.imread(image_path)
        if img_bgr is None:
            raise ValueError(f"Resim dosyası okunamadı: {image_path}")
        return self.analyze_image_array(img_bgr, floor_level, min_room_area_m2)

    def analyze_image_array(
        self,
        img_bgr: np.ndarray,
        floor_level: int = 0,
        min_room_area_m2: float = 3.0
    ) -> Tuple[List[RoomPolygonInput], List[DoorGeometryInput], np.ndarray]:
        h, w = img_bgr.shape[:2]
        img_gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

        # 1. Kenar Koruyan Gürültü Azaltma (Bilateral Filter)
        blurred = cv2.bilateralFilter(img_gray, d=7, sigmaColor=50, sigmaSpace=50)

        # 2. Adaptif / Otsu İkili Eşikleme (Duvarlar Beyaz, Arka Plan Siyah)
        _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

        # 3. Morfolojik Kapatma & Kapı Boşluklarını Köprüleme (Directional Door Gap Bridging)
        door_k_size = int(max(25, min(85, self.ppm * 1.5)))  # ~1.50m mimari kapı eşiği
        k_h = cv2.getStructuringElement(cv2.MORPH_RECT, (door_k_size, 5))
        k_v = cv2.getStructuringElement(cv2.MORPH_RECT, (5, door_k_size))
        closed_h = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, k_h)
        closed_walls = cv2.morphologyEx(closed_h, cv2.MORPH_CLOSE, k_v)

        # 4. Odaları Bulmak İçin Duvarların Tersini Al (Oda hacimleri beyaz olsun)
        rooms_mask = cv2.bitwise_not(closed_walls)

        # İzole küçük noktaları temizle (Opening)
        kernel_noise = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        clean_rooms = cv2.morphologyEx(rooms_mask, cv2.MORPH_OPEN, kernel_noise)

        # 5. Kontur Çıkarımı (Hiyerarşik Ağaç)
        contours, hierarchy = cv2.findContours(clean_rooms, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)

        rooms: List[RoomPolygonInput] = []
        doors: List[DoorGeometryInput] = []
        debug_vis = img_bgr.copy()

        room_id = 1
        min_area_px = min_room_area_m2 * (self.ppm ** 2)

        for i, cnt in enumerate(contours):
            area_px = cv2.contourArea(cnt)
            if area_px < min_area_px:
                continue

            # Çerçeve sınırlarını hariç tut (büyük dış poligon)
            x, y, cw, ch = cv2.boundingRect(cnt)
            if cw > w * 0.96 and ch > h * 0.96:
                continue

            # Poligon Sadeleştirme (Ramer-Douglas-Peucker)
            peri = cv2.arcLength(cnt, closed=True)
            approx = cv2.approxPolyDP(cnt, epsilon=0.015 * peri, closed=True)

            if len(approx) < 4:
                continue

            pts = [(float(pt[0][0]) / self.ppm, float(h - pt[0][1]) / self.ppm) for pt in approx]
            poly = Polygon(pts)
            if not poly.is_valid or poly.area < min_room_area_m2:
                continue

            # Oda tipi heuristiği
            area_m2 = poly.area
            aspect = float(cw) / max(1.0, float(ch))
            aspect_norm = max(aspect, 1.0 / max(1e-4, aspect))

            if aspect_norm >= 3.5 and area_m2 >= 8.0:
                room_type = "kat_koridoru"
            elif area_m2 < 5.0:
                room_type = "banyo_wc"
            elif area_m2 > 28.0:
                room_type = "salon"
            elif "yangin" in str(room_id):
                room_type = "yangin_holu"
            else:
                room_type = "oda"

            centroid = poly.centroid
            rooms.append(RoomPolygonInput(
                room_id=room_id,
                room_type=room_type,
                polygon=poly,
                name_label=f"CV_{room_type.upper()}_{room_id}",
                floor_level=floor_level,
                global_dxf_pos=(centroid.x, centroid.y)
            ))

            # Görselleştirme üzerine çiz
            cv2.drawContours(debug_vis, [cnt], -1, (0, 255, 0), 2)
            cv2.putText(
                debug_vis,
                f"R{room_id}:{room_type}",
                (x + 5, y + ch // 2),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.45,
                (255, 100, 0),
                1
            )
            room_id += 1

        # 6. Komşu Odalar Arasındaki Kapı Açıklıklarını Yakala
        door_id = 1
        for i in range(len(rooms)):
            for j in range(i + 1, len(rooms)):
                p1 = rooms[i].polygon
                p2 = rooms[j].polygon
                dist = p1.distance(p2)
                # Duvar kalınlığı mesafesinde (10cm - 40cm) yakın olan odalar
                if dist <= 0.40:
                    # En yakın noktalar arasında kapı eşiği oluştur
                    from shapely.ops import nearest_points
                    np1, np2 = nearest_points(p1, p2)
                    mid_x = (np1.x + np2.x) / 2.0
                    mid_y = (np1.y + np2.y) / 2.0
                    
                    dx = np2.x - np1.x
                    dy = np2.y - np1.y
                    normal_dx = -dy
                    normal_dy = dx
                    norm_len = math.hypot(normal_dx, normal_dy)
                    if norm_len > 1e-4:
                        normal_dx /= norm_len
                        normal_dy /= norm_len
                    else:
                        normal_dx, normal_dy = 1.0, 0.0

                    half_w = 0.45  # 90 cm kapı genişliği
                    door_line = LineString([
                        (mid_x - normal_dx * half_w, mid_y - normal_dy * half_w),
                        (mid_x + normal_dx * half_w, mid_y + normal_dy * half_w)
                    ])

                    is_fire = (rooms[i].room_type == "yangin_holu" or rooms[j].room_type == "yangin_holu")
                    doors.append(DoorGeometryInput(
                        door_id=door_id,
                        geometry=door_line,
                        width_cm=90.0,
                        is_fire_resistant=is_fire,
                        floor_level=floor_level,
                        connected_rooms=(rooms[i].room_id, rooms[j].room_id),
                        global_portal_xy=(mid_x, mid_y)
                    ))

                    # Kapıyı görsel üzerine çiz
                    px1 = int((mid_x - normal_dx * half_w) * self.ppm)
                    py1 = int(h - (mid_y - normal_dy * half_w) * self.ppm)
                    px2 = int((mid_x + normal_dx * half_w) * self.ppm)
                    py2 = int(h - (mid_y + normal_dy * half_w) * self.ppm)
                    cv2.line(debug_vis, (px1, py1), (px2, py2), (0, 0, 255), 3)
                    door_id += 1

        return rooms, doors, debug_vis

    def render_evacuation_heatmap(
        self,
        base_image: np.ndarray,
        bottlenecks: List[Dict[str, Any]],
        doors: Optional[List[Any]] = None,
        rooms: Optional[List[Any]] = None
    ) -> np.ndarray:
        """
        Tahliye darboğaz ve kuyruk skorlarını 2B plan üzerine termal ısı haritası olarak bindirir.
        """
        h, w = base_image.shape[:2]
        heatmap = np.zeros((h, w), dtype=np.float32)

        # 1. Oda Merkezleri (Tahliye Kaynak Yükü)
        if rooms:
            for r in rooms:
                pt = getattr(r, "global_dxf_pos", None)
                if pt:
                    rx = int(pt[0] * self.ppm)
                    ry = int(h - pt[1] * self.ppm)
                    if 0 <= rx < w and 0 <= ry < h:
                        cv2.circle(heatmap, (rx, ry), int(self.ppm * 0.9), 75.0, -1)

        # 2. Kapı Eşikleri (Geçiş ve Tahliye Akışı)
        if doors:
            for d in doors:
                pt = getattr(d, "global_portal_xy", None)
                if pt:
                    dx = int(pt[0] * self.ppm)
                    dy = int(h - pt[1] * self.ppm)
                    if 0 <= dx < w and 0 <= dy < h:
                        cv2.circle(heatmap, (dx, dy), int(self.ppm * 0.7), 160.0, -1)

        # 3. Kritik Darboğazlar ve Kuyruk Noktaları (Yüksek Sıcaklık)
        for b in bottlenecks:
            coords = b.get("spatial_coords")
            if coords:
                cx = int(coords[0] * self.ppm)
                cy = int(h - coords[1] * self.ppm)
                score = float(b.get("severity_score", 50.0))
                radius = int(max(20, min(90, score * 1.5)))
                if 0 <= cx < w and 0 <= cy < h:
                    cv2.circle(heatmap, (cx, cy), radius, max(200.0, score * 2.5), -1)

        if np.max(heatmap) > 0:
            heatmap = cv2.GaussianBlur(heatmap, (45, 45), 0)
            norm_heat = cv2.normalize(heatmap, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
            color_heat = cv2.applyColorMap(norm_heat, cv2.COLORMAP_JET)

            # Alfa Harmanlama (Orijinal plan ile birleştir)
            mask = (norm_heat > 15).astype(np.uint8)
            alpha = 0.52
            result = base_image.copy()
            result[mask > 0] = cv2.addWeighted(base_image, 1 - alpha, color_heat, alpha, 0)[mask > 0]
            return result
        return base_image.copy()
