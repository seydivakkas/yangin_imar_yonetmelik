import re
import math
from typing import Dict, List, Tuple, Optional, Any
import ezdxf
from ezdxf.document import Drawing
from ezdxf.entities import LWPolyline, Insert, Text, MText, Line
from shapely.geometry import Polygon, LineString, Point, MultiPolygon
from shapely.strtree import STRtree
from shapely.ops import unary_union, polygonize

from diagram_yonetmelik.schemas import RoomPolygonInput, DoorGeometryInput


# =====================================================================
# 1. TÜRKÇE MİMARİ ETİKET SINIFLANDIRICI (MTEXT / TEXT İÇİN)
# =====================================================================
class TurkishArchitecturalLabelClassifier:
    """
    AutoCAD metinlerini temizler ve Türk Yangın/İmar mevzuatına uygun standart
    mekan ve kapı etiketlerine sınıflandırır.
    """
    RULES: List[Tuple[str, List[str]]] = [
        ("teknik_saft",      ["menfez", "baca", "saft", "tesisat"]),
        ("yangin_holu",     ["yangin guvenlik hol", "yangin hol", "ygh", "y.g.h", "duman hol", "guvenlik hol"]),
        ("yangin_merdiveni", ["yangin merdiven", "kacis merdiven", "acil cikis merdiven", "ym", "yangin kulesi"]),
        ("dis_cikis",        ["bina giris", "ana giris", "dis cikis", "acil cikis", "zemin cikis", "ruzgarlik", "tahliye cikisi"]),
        ("siginak_wc",       ["siginak wc", "siginak lavabo", "siginak tuvalet"]),
        ("siginak_holu",     ["siginak hol", "siginak antre", "gaz sizdirmazlik", "dekontaminasyon"]),
        ("siginak",          ["siginak", "genel siginak", "serpinti siginagi"]),
        ("engelli_otopark",  ["engelli otopark", "engelli arac"]),
        ("otopark_rampasi",  ["otopark rampa", "giris rampasi", "kapali otopark rampasi"]),
        ("kapali_otopark",   ["kapali otopark", "otopark", "bodrum otopark", "arac park"]),
        ("kat_koridoru",     ["kat hol", "kat koridor", "ortak hol", "sirkulasyon", "ana koridor", "merdiven hol", "galeri", "asansor hol"]),
        ("yangin_asansoru",  ["itfaiye asansor", "itfaiyeci asansor", "acil durum asansor", "yangin asansor"]),
        ("asansor",          ["asansor"]),
        ("daire_antresi",    ["daire giris", "antre", "giris hol", "gecis hol", "hol", "koridor"]),
        ("salon",            ["salon", "oturma oda", "yasam alan", "living"]),
        ("mutfak",           ["mutfak", "acik mutfak", "nis mutfak", "kitchen"]),
        ("banyo_wc",         ["banyo", "wc", "tuvalet", "lavabo", "ebeveyn banyo", "islak hacim", "dus"]),
        ("oda",              ["yatak oda", "cocuk oda", "calisma oda", "misafir oda", "oda", "kiler", "giyinme"]),
    ]

    FIRE_KEYWORDS = ["yangin", "fire", "ei30", "ei60", "ei90", "ei120", "yk", "fhc", "duman sizdirmaz", "sizdirmaz"]

    @staticmethod
    def normalize_turkish(text: str) -> str:
        tr_map = str.maketrans("ÇĞİÖŞÜçğıöşü", "CGIOSUcgiosu")
        cleaned = text.translate(tr_map).lower()
        cleaned = re.sub(r"[^a-z0-9\s\.]", " ", cleaned)
        return re.sub(r"\s+", " ", cleaned).strip()

    @classmethod
    def classify_room_type(cls, raw_text: str, aspect_ratio: float = 1.0, area_m2: float = 15.0) -> str:
        norm = cls.normalize_turkish(raw_text)
        for canonical_type, keywords in cls.RULES:
            for kw in keywords:
                if kw in norm:
                    return canonical_type

        # Metin boşsa veya eşleşmediyse geometrik heuristikler
        if aspect_ratio >= 3.5 and area_m2 >= 10.0:
            return "kat_koridoru"
        if area_m2 < 7.0:
            return "banyo_wc"
        if area_m2 >= 24.0:
            return "salon"
        return "oda"

    @classmethod
    def classify_door_attributes(cls, layer_name: str, block_name: str, text_attrib: str) -> Tuple[bool, Optional[float]]:
        combined = f"{layer_name} {block_name} {text_attrib}".lower()
        norm = cls.normalize_turkish(combined)
        is_fire = any(kw in norm for kw in cls.FIRE_KEYWORDS)

        # Kapı genişliği ipuçları (Örn: "K_90", "YK-100", "KAPI 85/210")
        width_match = re.search(r"(?:k|yk|d|kapi|door)[_\-\s]?(\d{2,3})", norm)
        width_cm = float(width_match.group(1)) if width_match else None
        if width_cm and (width_cm < 50 or width_cm > 250):
            width_cm = None
        return is_fire, width_cm


# =====================================================================
# 2. AYRIK ÇİZGİLERDEN POLİGON KURTARMA MOTORU (LINE SOUP ROOM POLYGONIZER)
# =====================================================================
class WallLinePolygonizer:
    """
    Kapalı LWPOLYLINE bulunmayan eski paftalarda ayrık LINE çizgilerini,
    kapı köprülemesi ve morfolojik duvar eti erozyonu ile oda poligonlarına dönüştürür.
    """
    def __init__(self, snap_tolerance_cm: float = 5.0, wall_thickness_cm: float = 20.0):
        self.snap_tol = snap_tolerance_cm
        self.wall_th = wall_thickness_cm

    def polygonize_rooms_from_lines(
        self,
        wall_lines: List[LineString],
        door_inputs: List[DoorGeometryInput],
        unit_scale: float = 1.0
    ) -> List[Polygon]:
        if not wall_lines:
            return []

        # 1. Kapı açıklıklarını köprüle (Sanal Baraj)
        bridge_lines: List[LineString] = []
        wall_th_units = (self.wall_th / 100.0) / max(1e-4, unit_scale)
        ext_len = wall_th_units * 1.5
        for door in door_inputs:
            coords = list(door.geometry.coords)
            if len(coords) >= 2:
                p1, p2 = coords[0], coords[-1]
                dx, dy = p2[0] - p1[0], p2[1] - p1[1]
                length = math.hypot(dx, dy)
                if length > 1e-4:
                    ux, uy = dx / length, dy / length
                    p1_ext = (p1[0] - ux * ext_len, p1[1] - uy * ext_len)
                    p2_ext = (p2[0] + ux * ext_len, p2[1] + uy * ext_len)
                    bridge_lines.append(LineString([p1_ext, p2_ext]))

        all_edges = list(wall_lines) + bridge_lines

        # 2. GEOS Planar Noding (Unary Union)
        noded = unary_union(all_edges)

        # 3. Yüzey Çıkarımı
        raw_polygons = list(polygonize(noded))
        valid_rooms: List[Polygon] = []

        # 4. Negatif Tampon Erozyonu: Duvar et kalınlığını (20cm) yok et
        erosion_dist = wall_th_units * 0.85
        min_room_area = 2.0 / (unit_scale ** 2) if unit_scale > 0 else 2.0

        for poly in raw_polygons:
            if not poly.is_valid or poly.area < min_room_area:
                continue
            eroded = poly.buffer(-erosion_dist)
            if not eroded.is_empty and eroded.area > 0.05 * poly.area:
                # Gerçek oda poligonu ayakta kaldı
                valid_rooms.append(poly)

        return valid_rooms


# =====================================================================
# 3. AUTOCAD (.DXF) VEKTÖREL AYRIŞTIRICI
# =====================================================================
class DXFFloorplanParser:
    """
    AutoCAD DXF dosyasını okur; birim ölçekleme, LWPOLYLINE bulge eğrileri,
    INSERT kapı blokları ve LINE Soup fallback mantığıyla geometrileri ayrıştırır.
    """
    def __init__(self, target_unit: str = "m"):
        self.target_unit = target_unit
        self.classifier = TurkishArchitecturalLabelClassifier()
        self.polygonizer = WallLinePolygonizer()

    def parse_dxf_document(
        self,
        dxf_doc: Drawing,
        default_scale_to_m: float = 0.01
    ) -> Tuple[List[RoomPolygonInput], List[DoorGeometryInput], float]:
        """
        Dökümanı tarar. Kapalı poligon sayısı < 2 ise otomatik Line Soup moduna geçer.
        """
        msp = dxf_doc.modelspace()
        scale = self._detect_unit_scale(dxf_doc, default_scale_to_m)

        # 1. Kapıları Çıkar
        doors: List[DoorGeometryInput] = []
        door_id = 1
        for insert in msp.query('INSERT'):
            layer = insert.dxf.layer
            name = insert.dxf.name
            attrib_text = " ".join([a.dxf.text for a in insert.attribs]) if hasattr(insert, 'attribs') else ""
            is_fire, explicit_w = self.classifier.classify_door_attributes(layer, name, attrib_text)
            
            # Blok içinden çizgi/yay geometrisi veya insert noktası türet
            pos = insert.dxf.insert
            rotation = getattr(insert.dxf, 'rotation', 0.0)
            rad = math.radians(rotation)
            door_w = (explicit_w or 90.0) / 100.0 / scale
            p1 = (pos.x - math.cos(rad) * door_w / 2, pos.y - math.sin(rad) * door_w / 2)
            p2 = (pos.x + math.cos(rad) * door_w / 2, pos.y + math.sin(rad) * door_w / 2)
            
            doors.append(DoorGeometryInput(
                door_id=door_id,
                geometry=LineString([p1, p2]),
                width_cm=explicit_w or 90.0,
                is_fire_resistant=is_fire,
                door_layer=layer,
                global_portal_xy=(float(pos.x), float(pos.y))
            ))
            door_id += 1

        # 2. Metin Etiketlerini Topla
        text_entries: List[Tuple[Point, str]] = []
        for text_entity in msp.query('TEXT MTEXT'):
            txt = getattr(text_entity, 'plain_text', lambda: getattr(text_entity.dxf, 'text', ''))()
            ins = text_entity.dxf.insert
            text_entries.append((Point(ins.x, ins.y), txt))

        # 3. Odaları Çıkar (LWPOLYLINE - Bulge/Yay Eğrilerini Koru)
        closed_polys: List[Polygon] = []
        non_room_layers = {
            'a-sheet', 'a-border', 'denetim_ozet_tablosu', 'denetim_ozet_tablosu_metin',
            'a-anno', 'a-cols', 'defpoints', 'viewport', 'denetim_onay_damgasi'
        }
        for polyline in msp.query('LWPOLYLINE'):
            layer_name = getattr(polyline.dxf, 'layer', '').lower()
            if layer_name in non_room_layers:
                continue
            if polyline.is_closed and len(polyline) >= 3:
                if getattr(polyline, 'has_arc', False):
                    from ezdxf import path as dxf_path
                    sagitta = max(0.02, 0.05 / max(1e-4, scale))
                    p_path = dxf_path.make_path(polyline)
                    pts = [(round(float(v.x), 6), round(float(v.y), 6)) for v in p_path.flattening(sagitta)]
                else:
                    pts = [(round(float(p[0]), 6), round(float(p[1]), 6)) for p in polyline.get_points('xy')]
                poly = Polygon(pts)
                area_m2 = poly.area * (scale ** 2)
                if poly.is_valid and 2.0 <= area_m2 <= 600.0:
                    closed_polys.append(poly)

        # 4. Fallback Kontrolü: Yeterli kapalı poligon yoksa LINE Soup modunu devreye sok (LINE, ARC, CIRCLE)
        if len(closed_polys) < 2:
            from ezdxf import path as dxf_path
            wall_lines: List[LineString] = []
            for line in msp.query('LINE'):
                start = line.dxf.start
                end = line.dxf.end
                wall_lines.append(LineString([(round(float(start.x), 6), round(float(start.y), 6)), (round(float(end.x), 6), round(float(end.y), 6))]))
            for arc_ent in msp.query('ARC CIRCLE'):
                sagitta = max(0.02, 0.05 / max(1e-4, scale))
                arc_path = dxf_path.make_path(arc_ent)
                arc_pts = [(round(float(v.x), 6), round(float(v.y), 6)) for v in arc_path.flattening(sagitta)]
                if len(arc_pts) >= 2:
                    wall_lines.append(LineString(arc_pts))
            for pl in msp.query('LWPOLYLINE'):
                if not pl.is_closed and len(pl) >= 2:
                    sagitta = max(0.02, 0.05 / max(1e-4, scale))
                    pl_path = dxf_path.make_path(pl)
                    pl_pts = [(round(float(v.x), 6), round(float(v.y), 6)) for v in pl_path.flattening(sagitta)]
                    if len(pl_pts) >= 2:
                        wall_lines.append(LineString(pl_pts))
            recovered_polys = self.polygonizer.polygonize_rooms_from_lines(wall_lines, doors, scale)
            if len(recovered_polys) >= len(closed_polys):
                closed_polys = recovered_polys

        # 5. Metinleri Poligonlara Eşle ve RoomPolygonInput Üret
        rooms: List[RoomPolygonInput] = []
        text_points = [p for p, _ in text_entries]
        tree = STRtree(text_points) if text_points else None

        for room_id, poly in enumerate(closed_polys, start=1):
            centroid = poly.centroid
            label = ""
            if tree and text_points:
                # Poligon sınırları içindeki metinleri sorgula
                indices = tree.query(poly)
                for idx in indices:
                    pt, txt = text_entries[idx]
                    if poly.contains(pt):
                        label += " " + txt
            label = label.strip()

            area_m2 = poly.area * (scale ** 2)
            bounds = poly.bounds
            aspect_ratio = max(bounds[2] - bounds[0], bounds[3] - bounds[1]) / max(1e-4, min(bounds[2] - bounds[0], bounds[3] - bounds[1]))
            room_type = self.classifier.classify_room_type(label, aspect_ratio=aspect_ratio, area_m2=area_m2)

            rooms.append(RoomPolygonInput(
                room_id=room_id,
                room_type=room_type,
                polygon=poly,
                name_label=label,
                global_dxf_pos=(float(centroid.x), float(centroid.y))
            ))

        return rooms, doors, scale

    def _detect_unit_scale(self, doc: Drawing, default_scale: float) -> float:
        try:
            insunits = doc.header.get('$INSUNITS', 0)
            if insunits == 4:     # mm
                return 0.001
            elif insunits == 5:   # cm
                return 0.01
            elif insunits == 6:   # m
                return 1.0
        except Exception:
            pass
        return default_scale
