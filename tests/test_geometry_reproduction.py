"""
GEO-01: Duvar ve Yay Geometrisi Hata Yeniden Üretim Testleri.
Düzeltme öncesi kök nedenlerin başarısızlığını (FAIL) kanıtlar.
"""
import math
import pytest
import ezdxf
from shapely.geometry import Polygon, LineString, Point
from diagram_yonetmelik.cad_ingest import DXFFloorplanParser, WallLinePolygonizer
from diagram_yonetmelik.schemas import RoomPolygonInput, DoorGeometryInput


def test_cad_bulge_preservation_fails_in_unpatched_ingest():
    """
    GEO-T11: LWPOLYLINE içinde bulge (yay) olan kavisli duvarın
    düz çizgiye kırpılmadan eğrisel koordinatlarıyla poligonlaştırılması gerekir.
    Mevcut kod get_points('xy') çağırdığı için bulge'ı yok sayar.
    """
    doc = ezdxf.new('R2010')
    doc.header['$INSUNITS'] = 6  # metre
    msp = doc.modelspace()
    doc.layers.new('A-WALL')

    # Yarım daire çıkıntılı oda: (0,0) -> (4,0) [bulge=1.0: 180 derece yay] -> (4,4) -> (0,4)
    # bulge = 1.0 means a semicircle arc from (0,0) to (4,0)
    pts_with_bulge = [
        (0.0, 0.0, 0.0, 0.0, 1.0),
        (4.0, 0.0, 0.0, 0.0, 0.0),
        (4.0, 4.0, 0.0, 0.0, 0.0),
        (0.0, 4.0, 0.0, 0.0, 0.0),
    ]
    msp.add_lwpolyline(pts_with_bulge, close=True, dxfattribs={'layer': 'A-WALL'})
    msp.add_text("KAVISLI SALON", dxfattribs={'layer': 'A-TEXT', 'insert': (2.0, 2.0)})

    parser = DXFFloorplanParser()
    rooms, doors, scale = parser.parse_dxf_document(doc, default_scale_to_m=1.0)

    assert len(rooms) >= 1, "En az bir oda poligonu üretilmeli"
    room = rooms[0]
    coords = list(room.polygon.exterior.coords)

    # Düzeltilmemiş kodda 4 köşe noktası + kapanış = 5 nokta döner.
    # Bulge işlenmişse yay segmenti en az 8-16 ara nokta ile örneklenmeli (> 6 nokta olmalı).
    assert len(coords) > 6, f"Bulge yayı örneklenmedi, köşe sayısı: {len(coords)} (düz kirişle kesildi!)"


def test_cad_arc_wall_in_line_soup_fails_in_unpatched_ingest():
    """
    GEO-T10 / GEO-T15: DXF içinde serbest ARC entiteleriyle çizilen kavisli duvarlar
    line soup fallback modunda yok sayılmamalı, ayrık yaylar kırılmalıdır.
    """
    doc = ezdxf.new('R2010')
    doc.header['$INSUNITS'] = 6
    msp = doc.modelspace()
    doc.layers.new('A-WALL')

    # Ayrık çizgiler + yay:
    msp.add_line((0, 0), (0, 4), dxfattribs={'layer': 'A-WALL'})
    msp.add_line((0, 4), (4, 4), dxfattribs={'layer': 'A-WALL'})
    msp.add_line((4, 4), (4, 0), dxfattribs={'layer': 'A-WALL'})
    # Yay ile alt kenar kapatılıyor: merkez=(2,0), r=2, start=180 deg, end=360 deg
    msp.add_arc((2.0, 0.0), radius=2.0, start_angle=180.0, end_angle=360.0, dxfattribs={'layer': 'A-WALL'})
    msp.add_text("KAVISLI ODA", dxfattribs={'layer': 'A-TEXT', 'insert': (2.0, 2.0)})

    parser = DXFFloorplanParser()
    rooms, doors, scale = parser.parse_dxf_document(doc, default_scale_to_m=1.0)

    # Mevcut kodda msp.query('LINE') sadece LINE alır, ARC'ı görmez -> poligon kapanmaz!
    assert len(rooms) >= 1, "Ayrık ARC içeren kavisli oda poligonlaştırılamadı!"


def test_t_junction_overlapping_walls_detection():
    """
    GEO-T04 / GEO-T09: Koridor ile ona komşu iki odanın paylaştığı duvar
    T-junction birleşiminde kırılmalıdır. Naif eşleştirme 3 duvar üretir (biri diğer ikisinin üstüne biner).
    """
    # Koridor: (0,0) -> (10,0)
    # Oda 1: (0,0) -> (5,0)
    # Oda 2: (5,0) -> (10,0)
    corridor_seg = ((0.0, 0.0), (10.0, 0.0))
    room1_seg = ((0.0, 0.0), (5.0, 0.0))
    room2_seg = ((5.0, 0.0), (10.0, 0.0))

    # Naif anahtarlama
    def naive_key(p1, p2):
        k1 = f"{p1[0]:.2f},{p1[1]:.2f}"
        k2 = f"{p2[0]:.2f},{p2[1]:.2f}"
        return f"{k1}_{k2}" if k1 < k2 else f"{k2}_{k1}"

    keys = [naive_key(*corridor_seg), naive_key(*room1_seg), naive_key(*room2_seg)]
    # Naif yaklaşımda her üç anahtar da farklıdır ve 3 ayrı duvar üretilir!
    assert len(set(keys)) == 3, "Naif anahtarlama beklenen kusuru üretti (3 bağımsız anahtar)"
