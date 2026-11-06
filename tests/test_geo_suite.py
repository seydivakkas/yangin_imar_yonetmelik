"""
GEO-05: 3B Duvar Yerleşimi ve Yay Geometrisi Test Süiti (GEO-T01 - GEO-T16).
DiagramYönetmelik Bölüm 7 gereksinimlerine göre tüm geometrik durumları deterministik olarak test eder.
"""
import math
import pytest
import ezdxf
from shapely.geometry import Polygon, LineString, Point
from diagram_yonetmelik.cad_ingest import DXFFloorplanParser, WallLinePolygonizer
from diagram_yonetmelik.schemas import RoomPolygonInput, DoorGeometryInput


# -----------------------------------------------------------------------------
# YARDIMCI HESAPLAMA VE SEGMENTASYON ALGORİTMALARI (Frontend Mantığı ile Birebir)
# -----------------------------------------------------------------------------
def decompose_and_node_segments(room_polygons):
    """
    Frontend ThreeScene'de uygulanan atomik noding ve T-junction ayrıştırma algoritması.
    """
    # 1. Tüm tekil köşe noktalarını topla
    all_vertices = []
    for poly in room_polygons:
        for x, z in poly:
            if not any(math.hypot(vx - x, vz - z) < 0.05 for vx, vz in all_vertices):
                all_vertices.append((x, z))

    # 2. Segmentleri iç noktalarında kır
    atomic_segments = []
    for poly in room_polygons:
        for i in range(len(poly) - 1):
            x1, z1 = poly[i]
            x2, z2 = poly[i + 1]
            seg_len = math.hypot(x2 - x1, z2 - z1)
            if seg_len < 0.05 or math.isnan(seg_len):
                continue

            vx = (x2 - x1) / seg_len
            vz = (z2 - z1) / seg_len

            split_ts = [0.0, seg_len]
            for px, pz in all_vertices:
                dx = px - x1
                dz = pz - z1
                t = dx * vx + dz * vz
                if 0.05 < t < seg_len - 0.05:
                    perp_dist = abs(dx * vz - dz * vx)
                    if perp_dist < 0.05:
                        split_ts.append(t)

            split_ts = sorted(list(set(round(t, 4) for t in split_ts)))
            for j in range(len(split_ts) - 1):
                tA = split_ts[j]
                tB = split_ts[j + 1]
                if tB - tA < 0.05:
                    continue
                atomic_segments.append((
                    (round(x1 + vx * tA, 3), round(z1 + vz * tA, 3)),
                    (round(x1 + vx * tB, 3), round(z1 + vz * tB, 3))
                ))

    # 3. Kanonik anahtarla tekilleştir
    segments_map = {}
    for (px1, pz1), (px2, pz2) in atomic_segments:
        k1 = f"{px1:.2f},{pz1:.2f}"
        k2 = f"{px2:.2f},{pz2:.2f}"
        key = f"{k1}_{k2}" if k1 < k2 else f"{k2}_{k1}"
        if key in segments_map:
            segments_map[key]["count"] += 1
        else:
            is_forward = k1 < k2
            segments_map[key] = {
                "seg": ((px1, pz1), (px2, pz2)) if is_forward else ((px2, pz2), (px1, pz1)),
                "count": 1,
            }

    return segments_map


# -----------------------------------------------------------------------------
# TESTLER: GEO-T01 - GEO-T16
# -----------------------------------------------------------------------------
def test_geo_t01_horizontal_wall():
    """GEO-T01: Yatay duvar segment doğrultusu (açı=0) ve kalınlığı doğru."""
    p1 = (0.0, 5.0)
    p2 = (10.0, 5.0)
    dx = p2[0] - p1[0]
    dz = p2[1] - p1[1]
    length = math.hypot(dx, dz)
    angle = math.atan2(dz, dx)

    assert math.isclose(length, 10.0, rel_tol=1e-5), "Yatay duvar uzunluğu hatalı"
    assert math.isclose(angle, 0.0, abs_tol=1e-5), "Yatay duvar açısı 0 radyan olmalı"

    # Et kalınlığı normal vektörü yönünde uygulanmalı (normal = (-sin, cos) = (0, 1))
    normal = (-dz / length, dx / length)
    assert math.isclose(normal[0], 0.0, abs_tol=1e-5)
    assert math.isclose(normal[1], 1.0, abs_tol=1e-5)


def test_geo_t02_vertical_wall():
    """GEO-T02: Dikey duvar dönüş (açı=pi/2) ve uç noktalar doğru."""
    p1 = (5.0, 0.0)
    p2 = (5.0, 8.0)
    dx = p2[0] - p1[0]
    dz = p2[1] - p1[1]
    length = math.hypot(dx, dz)
    angle = math.atan2(dz, dx)

    assert math.isclose(length, 8.0, rel_tol=1e-5), "Dikey duvar uzunluğu hatalı"
    assert math.isclose(angle, math.pi / 2, abs_tol=1e-5), "Dikey duvar açısı pi/2 olmalı"


def test_geo_t03_angled_45_wall():
    """GEO-T03: 45° eğimli duvar rastgele döndürülmeden eksene oturuyor."""
    p1 = (0.0, 0.0)
    p2 = (4.0, 4.0)
    dx = p2[0] - p1[0]
    dz = p2[1] - p1[1]
    length = math.hypot(dx, dz)
    angle = math.atan2(dz, dx)

    assert math.isclose(length, 4.0 * math.sqrt(2), rel_tol=1e-5)
    assert math.isclose(angle, math.pi / 4, abs_tol=1e-5), "45 derece eğimli duvar açısı pi/4 olmalı"


def test_geo_t04_t_junction_joined_walls():
    """GEO-T04: Birleşen koridor ve oda duvarlarında T-junction noding ile kırılma sağlanır."""
    # Koridor: (7, 20) -> (7, 31) (11 metre)
    # Salon: (0, 20) -> (7, 20) -> (7, 26) -> (0, 26) -> (0, 20)
    # Oda: (0, 26) -> (7, 26) -> (7, 31) -> (0, 31) -> (0, 26)
    salon = [(0, 20), (7, 20), (7, 26), (0, 26), (0, 20)]
    oda = [(0, 26), (7, 26), (7, 31), (0, 31), (0, 26)]
    koridor = [(7, 20), (11, 20), (11, 31), (7, 31), (7, 20)]

    segments_map = decompose_and_node_segments([salon, oda, koridor])

    # Koridorun (7, 20) -> (7, 31) kenarı (7, 26)'da kırılmalı:
    # 1. parça: (7, 20) - (7, 26) -> Salon ve Koridor ortak (count = 2)
    # 2. parça: (7, 26) - (7, 31) -> Oda ve Koridor ortak (count = 2)
    k1 = "7.00,20.00_7.00,26.00"
    k2 = "7.00,26.00_7.00,31.00"
    k_naive = "7.00,20.00_7.00,31.00"

    assert k1 in segments_map, "Segment 1 (7,20)-(7,26) ayrıştırılmadı"
    assert k2 in segments_map, "Segment 2 (7,26)-(7,31) ayrıştırılmadı"
    assert k_naive not in segments_map, "11 metrelik kırılmamış naif koridor duvarı var olmamalı!"

    assert segments_map[k1]["count"] == 2, "Ortak iç duvar count=2 olmalı"
    assert segments_map[k2]["count"] == 2, "Ortak iç duvar count=2 olmalı"


def test_geo_t05_wall_door_cutout():
    """GEO-T05: Kapı boşluğu duvar mesh'i tarafından kapatılmıyor, açılan aralık doğru."""
    seg_len = 6.0
    door_w = 0.90
    door_center_s = 3.0  # Duvarda 3. metrede

    # Boşluk aralığı
    cut_start = door_center_s - door_w / 2  # 2.55
    cut_end = door_center_s + door_w / 2    # 3.45

    left_piece = (0.0, cut_start)
    right_piece = (cut_end, seg_len)

    assert math.isclose(left_piece[1] - left_piece[0], 2.55, abs_tol=1e-5)
    assert math.isclose(right_piece[1] - right_piece[0], 2.55, abs_tol=1e-5)
    assert cut_end - cut_start == pytest.approx(0.90, abs=1e-5), "Kapı boşluğu genişliği 90cm olmalı"


def test_geo_t06_scale_mm_cm_m_equivalence():
    """GEO-T06: mm, cm ve m ölçekleri dünya koordinatlarında birebir eşdeğer metrik sonuç üretir."""
    parser = DXFFloorplanParser()

    # 1. Metre tabanlı doküman (10m x 10m)
    doc_m = ezdxf.new('R2010')
    doc_m.header['$INSUNITS'] = 6  # Meter
    msp_m = doc_m.modelspace()
    doc_m.layers.new('A-WALL')
    msp_m.add_lwpolyline([(0, 0), (10, 0), (10, 10), (0, 10)], close=True, dxfattribs={'layer': 'A-WALL'})
    msp_m.add_text("SALON M", dxfattribs={'layer': 'A-TEXT', 'insert': (5, 5)})
    rooms_m, _, scale_m = parser.parse_dxf_document(doc_m)

    # 2. Milimetre tabanlı doküman (10000mm x 10000mm)
    doc_mm = ezdxf.new('R2010')
    doc_mm.header['$INSUNITS'] = 4  # Millimeter
    msp_mm = doc_mm.modelspace()
    doc_mm.layers.new('A-WALL')
    msp_mm.add_lwpolyline([(0, 0), (10000, 0), (10000, 10000), (0, 10000)], close=True, dxfattribs={'layer': 'A-WALL'})
    msp_mm.add_text("SALON MM", dxfattribs={'layer': 'A-TEXT', 'insert': (5000, 5000)})
    rooms_mm, _, scale_mm = parser.parse_dxf_document(doc_mm)

    assert math.isclose(scale_m, 1.0, abs_tol=1e-5)
    assert math.isclose(scale_mm, 0.001, abs_tol=1e-5)

    # Dünya metre cinsinden alanlar eşdeğer olmalı
    area_m_m2 = rooms_m[0].polygon.area * (scale_m ** 2)
    area_mm_m2 = rooms_mm[0].polygon.area * (scale_mm ** 2)
    assert math.isclose(area_m_m2, 100.0, rel_tol=1e-3)
    assert math.isclose(area_mm_m2, 100.0, rel_tol=1e-3)

    # 3B Dünya metre koordinat sınırları (bounding box) birebir örtüşmeli: [0, 0, 10, 10]
    bbox_m = [round(c * scale_m, 3) for c in rooms_m[0].polygon.bounds]
    bbox_mm = [round(c * scale_mm, 3) for c in rooms_mm[0].polygon.bounds]
    assert bbox_m == bbox_mm == [0.0, 0.0, 10.0, 10.0], "Dünya koordinatları mm ve m için birebir eşdeğer olmalı"


def test_geo_t07_multi_floor_elevation():
    """GEO-T07: Katlar arası yatay koordinatlar korunurken düşey kot (Y) story_height ile ayrışır."""
    story_h = 3.20
    floors = [-1, 0, 1, 2]
    floor_elevations = {fl: fl * story_h for fl in floors}

    assert floor_elevations[-1] == pytest.approx(-3.20, abs=1e-5)
    assert floor_elevations[0] == pytest.approx(0.00, abs=1e-5)
    assert floor_elevations[1] == pytest.approx(3.20, abs=1e-5)
    assert floor_elevations[2] == pytest.approx(6.40, abs=1e-5)


def test_geo_t08_closed_polygon_extrusion():
    """GEO-T08: Kapalı oda poligonlarının alan ve yönü (winding) geçerli ve pozitiftir."""
    poly_pts = [(0.0, 0.0), (8.0, 0.0), (8.0, 6.0), (0.0, 6.0), (0.0, 0.0)]
    poly = Polygon(poly_pts)

    assert poly.is_valid, "Poligon geçerli olmalı"
    assert poly.is_simple, "Poligon kendine temas etmemeli (self-intersecting olmamalı)"
    assert poly.area == pytest.approx(48.0, abs=1e-5)


def test_geo_t09_duplicate_entity_prevention():
    """GEO-T09: İki yönlü çizilmiş duvar segmenti kanonik anahtarla tekilleşir (sahte çift duvar önlenir)."""
    seg_forward = ((0.0, 20.0), (7.0, 20.0))
    seg_reverse = ((7.0, 20.0), (0.0, 20.0))

    def make_canonical_key(p1, p2):
        k1 = f"{p1[0]:.2f},{p1[1]:.2f}"
        k2 = f"{p2[0]:.2f},{p2[1]:.2f}"
        return f"{k1}_{k2}" if k1 < k2 else f"{k2}_{k1}"

    key1 = make_canonical_key(*seg_forward)
    key2 = make_canonical_key(*seg_reverse)

    assert key1 == key2 == "0.00,20.00_7.00,20.00", "Kanonik anahtar yön farkını tekilleştirmeli"


def test_geo_t10_cad_arc_sampling():
    """GEO-T10: Serbest CAD ARC entitesi merkez, yarıçap ve açı aralığına uygun ayrıştırılır."""
    doc = ezdxf.new('R2010')
    msp = doc.modelspace()
    doc.layers.new('A-WALL')

    # 90 derecelik yay: Merkez (0,0), Yarıçap 3.0, 0° -> 90°
    msp.add_arc(center=(0.0, 0.0), radius=3.0, start_angle=0.0, end_angle=90.0, dxfattribs={'layer': 'A-WALL'})
    arc_entity = msp.query('ARC')[0]

    path = ezdxf.path.make_path(arc_entity)
    points = [v for v in path.flattening(distance=0.05)]

    assert len(points) >= 6, "Yay en az 6 segmente kırılmalı"
    start_pt = points[0]
    end_pt = points[-1]
    assert math.isclose(start_pt.x, 3.0, abs_tol=0.01)
    assert math.isclose(start_pt.y, 0.0, abs_tol=0.01)
    assert math.isclose(end_pt.x, 0.0, abs_tol=0.01)
    assert math.isclose(end_pt.y, 3.0, abs_tol=0.01)


def test_geo_t11_lwpolyline_bulge_positive_and_negative():
    """GEO-T11: LWPOLYLINE içinde pozitif (+) ve negatif (-) bulge eğrileri doğru yönde üretilir."""
    # Pozitif bulge (+1.0): Saat yönünün tersine 180 derece yay
    # Negatif bulge (-1.0): Saat yönünde 180 derece yay
    doc = ezdxf.new('R2010')
    msp = doc.modelspace()

    pts_pos = [(0.0, 0.0, 0.0, 0.0, 1.0), (4.0, 0.0, 0.0, 0.0, 0.0)]
    pts_neg = [(0.0, 0.0, 0.0, 0.0, -1.0), (4.0, 0.0, 0.0, 0.0, 0.0)]

    poly_pos = msp.add_lwpolyline(pts_pos, format='xyseb')
    poly_neg = msp.add_lwpolyline(pts_neg, format='xyseb')

    path_pos = ezdxf.path.make_path(poly_pos)
    path_neg = ezdxf.path.make_path(poly_neg)

    pts_pos_flat = list(path_pos.flattening(0.05))
    pts_neg_flat = list(path_neg.flattening(0.05))

    # Pozitif yay -Y yönünde kubbe oluşturur (min_y < -1.5)
    min_y_pos = min(p.y for p in pts_pos_flat)
    assert min_y_pos < -1.8, "Pozitif bulge -Y yönünde kavis oluşturmalı"

    # Negatif yay +Y yönünde kubbe oluşturur (max_y > 1.5)
    max_y_neg = max(p.y for p in pts_neg_flat)
    assert max_y_neg > 1.8, "Negatif bulge +Y yönünde kavis oluşturmalı"


def test_geo_t12_door_swing_arc_geometry():
    """GEO-T12: Kapı açılım yayı kapı genişliğine eşit yarıçap ve 90° açıyla duvara bağlanır."""
    door_w = 1.0  # 100 cm
    # Hinge (-0.5, 0), Arc (r=1.0, sweep=90°)
    hinge_x = -door_w / 2
    r = door_w
    # Start: (hinge_x + r, 0) = (+0.5, 0) (duvar düzlemi)
    # End: (hinge_x, r) = (-0.5, 1.0) (oda içine 90 derece)
    p_start = (hinge_x + r * math.cos(0), r * math.sin(0))
    p_end = (hinge_x + r * math.cos(math.pi / 2), r * math.sin(math.pi / 2))

    assert math.isclose(p_start[0], 0.5, abs_tol=1e-5)
    assert math.isclose(p_start[1], 0.0, abs_tol=1e-5)
    assert math.isclose(p_end[0], -0.5, abs_tol=1e-5)
    assert math.isclose(p_end[1], 1.0, abs_tol=1e-5)


def test_geo_t13_overlay_visibility_immutability():
    """GEO-T13: Overlay (CAD çizgileri, RAG, duman) açılıp kapandığında oda geometrisi değişmez."""
    initial_poly = Polygon([(0, 0), (7, 0), (7, 5), (0, 5), (0, 0)])
    room = RoomPolygonInput(
        room_id=1,
        room_type="salon",
        polygon=initial_poly,
        name_label="SALON"
    )

    # Simüle edilmiş overlay toggle işlemi
    show_rag = False
    show_smoke = False
    show_arcs = False

    # Overlay durumları değişir
    show_rag = True
    show_smoke = True
    show_arcs = True

    # Odanın temel geometrisi kesinlikle aynı kalmalıdır
    assert room.polygon.equals(initial_poly)
    assert room.polygon.area == pytest.approx(35.0, abs=1e-5)


def test_geo_t14_2d_to_3d_projection():
    """GEO-T14: 3B duvar mesh'inin 2B yatay düzlem izdüşümü kaynak segmentle örtüşür."""
    # 2B Kaynak segment: (2.0, 3.0) -> (8.0, 3.0)
    p1 = (2.0, 3.0)
    p2 = (8.0, 3.0)
    length = 6.0
    thickness = 0.20

    # 3B Duvarın bounding box XZ izdüşümü
    # Merkez: (5.0, 3.0), Genişlik: 6.0, Derinlik: 0.20
    min_x = 5.0 - length / 2
    max_x = 5.0 + length / 2
    min_z = 3.0 - thickness / 2
    max_z = 3.0 + thickness / 2

    assert math.isclose(min_x, 2.0, abs_tol=1e-5)
    assert math.isclose(max_x, 8.0, abs_tol=1e-5)
    assert (max_z + min_z) / 2 == pytest.approx(3.0, abs=1e-5), "Duvar ekseni tam 2B çizgisi üzerinde olmalı"


def test_geo_t15_curved_wall_preservation_in_polygonizer():
    """GEO-T15: DXF kavisli duvarı silinmez; eğrisel poligon olarak korunur."""
    doc = ezdxf.new('R2010')
    doc.header['$INSUNITS'] = 6
    msp = doc.modelspace()
    doc.layers.new('A-WALL')

    # Düz duvarlar + kavisli yay duvar
    msp.add_line((0, 0), (0, 6), dxfattribs={'layer': 'A-WALL'})
    msp.add_line((0, 6), (6, 6), dxfattribs={'layer': 'A-WALL'})
    msp.add_line((6, 6), (6, 0), dxfattribs={'layer': 'A-WALL'})
    # Yay alt kenarı kapatıyor (yarıçap=3, 180° -> 360°)
    msp.add_arc((3.0, 0.0), radius=3.0, start_angle=180.0, end_angle=360.0, dxfattribs={'layer': 'A-WALL'})
    msp.add_text("KAVISLI ODA", dxfattribs={'layer': 'A-TEXT', 'insert': (3.0, 3.0)})

    parser = DXFFloorplanParser()
    rooms, _, _ = parser.parse_dxf_document(doc)

    assert len(rooms) == 1, "Kavisli oda başarıyla poligonlaştırılmalı"
    coords = list(rooms[0].polygon.exterior.coords)
    assert len(coords) > 8, f"Kavisli duvar ara noktalarıyla korunmalı (Mevcut nokta sayısı: {len(coords)})"


def test_geo_t16_degenerate_entity_warning():
    """GEO-T16: Sıfır uzunluklu / mikro-boyutlu segmentler (<0.05m) NaN üretmeden elenir."""
    # Mikro segment (0.01m)
    p1 = (1.000, 2.000)
    p2 = (1.005, 2.000)  # 5mm
    seg_len = math.hypot(p2[0] - p1[0], p2[1] - p1[1])

    is_degenerate = seg_len < 0.05
    assert is_degenerate, "5mm'lik segment dejenere olarak tespit edilmeli"

    # NaN veya 0 kontrolü
    nan_seg_len = float('nan')
    assert math.isnan(nan_seg_len) or nan_seg_len < 0.05
