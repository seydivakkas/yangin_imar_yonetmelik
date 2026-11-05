import os
import math
from typing import Tuple, List
import ezdxf
from ezdxf.document import Drawing
import cv2
import numpy as np


def generate_sample_building_dxf(output_path: str = "sample_building.dxf") -> Drawing:
    """
    3 katlı (Bodrum, Zemin, 1. Normal Kat), yangın holü kusuru,
    sığınak ve otopark bağlantısı içeren gerçekçi bir AutoCAD DXF paftası üretir.
    """
    doc = ezdxf.new('R2010')
    doc.header['$INSUNITS'] = 5  # cm (1 birim = 0.01 m)
    msp = doc.modelspace()

    # Katmanlar
    doc.layers.new('A-WALL', dxfattribs={'color': 7})
    doc.layers.new('A-DOOR', dxfattribs={'color': 2})
    doc.layers.new('A-TEXT', dxfattribs={'color': 3})

    def add_room_box(x: float, y: float, w: float, h: float, label: str):
        pts = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
        msp.add_lwpolyline(pts, close=True, dxfattribs={'layer': 'A-WALL'})
        msp.add_text(label, dxfattribs={'layer': 'A-TEXT', 'height': 20.0, 'insert': (x + w * 0.2, y + h * 0.4)})

    def add_door_insert(x: float, y: float, name: str = "K_90", is_fire: bool = False):
        layer = "A-DOOR"
        if name not in msp.doc.blocks:
            blk = msp.doc.blocks.new(name=name)
            blk.add_line((-45, 0), (45, 0))
            blk.add_arc((0, 0), radius=90.0, start_angle=0, end_angle=90)
        else:
            blk = msp.doc.blocks.get(name)
        insert = msp.add_blockref(name, (x, y), dxfattribs={'layer': layer})
        if is_fire:
            insert.add_attrib("TAG", "EI60 YANGIN KAPISI", insert=(x + 10.0, y + 10.0))

    # =========================================================================
    # 1. ZEMİN KAT ADASI (X: 0..3000 cm, Y: 0..2500 cm)
    # =========================================================================
    add_room_box(0, 0, 300, 400, "Z-01 YANGIN MERDIVENI")
    add_room_box(300, 0, 250, 400, "Z-02 YANGIN GUVENLIK HOLU")  # 2.5m x 4.0m = 10m²
    add_room_box(550, 0, 800, 250, "Z-03 KAT KORIDORU")          # L/U tipi koridor
    add_room_box(550, 250, 300, 300, "Z-00 DIS CIKIS")

    # Daire 1 (Sol Daire: 2+1)
    add_room_box(1350, 0, 300, 250, "Z-11 DAIRE GİRİŞ ANTRE")
    add_room_box(1350, 250, 500, 400, "Z-12 SALON")
    add_room_box(1650, 0, 400, 350, "Z-13 YATAK ODASI")
    add_room_box(1350, -250, 350, 250, "Z-14 MUTFAK")

    # Daire 2 (Sağ Daire: 2+1 - SPMiner tekrar modülü)
    add_room_box(1350, 700, 300, 250, "Z-21 DAIRE GİRİŞ ANTRE")
    add_room_box(1350, 950, 500, 400, "Z-22 SALON")
    add_room_box(1650, 700, 400, 350, "Z-23 YATAK ODASI")

    # Kapılar
    add_door_insert(300, 200, name="K_90_EI60", is_fire=True)   # Merdiven <-> Hol
    add_door_insert(550, 200, name="K_70_DAR", is_fire=False)   # Hol <-> Koridor (Kusur: 70cm dar kapı!)
    add_door_insert(700, 250, name="K_100", is_fire=False)      # Koridor <-> Dış Çıkış
    add_door_insert(1350, 100, name="K_90", is_fire=False)      # Koridor <-> Daire 1
    add_door_insert(1350, 800, name="K_90", is_fire=False)      # Koridor <-> Daire 2
    add_door_insert(1450, 250, name="K_90", is_fire=False)      # Daire 1: Salon <-> Antre
    add_door_insert(1650, 100, name="K_90", is_fire=False)      # Daire 1: Yatak Odası <-> Antre
    add_door_insert(1450, 0, name="K_90", is_fire=False)        # Daire 1: Mutfak <-> Antre
    add_door_insert(1450, 950, name="K_90", is_fire=False)      # Daire 2: Salon <-> Antre
    add_door_insert(1650, 800, name="K_90", is_fire=False)      # Daire 2: Yatak Odası <-> Antre

    # =========================================================================
    # 2. BODRUM KAT ADASI (X: 0..3000 cm, Y: 3500..6000 cm)
    # =========================================================================
    add_room_box(0, 3500, 300, 400, "B-01 YANGIN MERDIVENI")
    add_room_box(300, 3500, 250, 400, "B-02 YANGIN GUVENLIK HOLU")
    add_room_box(550, 3500, 600, 300, "B-03 BODRUM KORIDOR")
    add_room_box(1150, 3500, 800, 600, "B-04 KAPALI OTOPARK")
    add_room_box(550, 3800, 500, 400, "B-05 SIGINAK")           # Sığınak

    # Bodrum Kapıları
    add_door_insert(300, 3700, name="K_90_EI60", is_fire=True)
    add_door_insert(550, 3700, name="K_90", is_fire=False)
    add_door_insert(1150, 3600, name="K_90_OTOPARK_KORIDOR", is_fire=False)
    # Kusur: Otopark -> Merdiven doğrudan kapı!
    add_door_insert(150, 3900, name="K_90_YASAKLI", is_fire=False)

    doc.saveas(output_path)
    return doc


def generate_high_rise_12_story_building_dxf(output_path: str = "sample_high_rise_12_story.dxf") -> Drawing:
    """
    12 Katlı Yüksek Konut Binası AutoCAD DXF Paftası Üretici.
    Bodrum (-1), Zemin (0) ve Kat 1..12 tipik planlarını içerir.
    BYKHY, PAİY, Sığınak ve Otopark yönetmeliklerine uygun veya kusurlu
    senaryoları tam ölçekli olarak test etmeyi sağlar.
    """
    doc = ezdxf.new('R2010')
    doc.header['$INSUNITS'] = 5  # cm (1 birim = 0.01 m)
    msp = doc.modelspace()

    # Katmanlar
    doc.layers.new('A-WALL', dxfattribs={'color': 7})
    doc.layers.new('A-DOOR', dxfattribs={'color': 2})
    doc.layers.new('A-TEXT', dxfattribs={'color': 3})

    def add_room_box(x: float, y: float, w: float, h: float, label: str):
        pts = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
        msp.add_lwpolyline(pts, close=True, dxfattribs={'layer': 'A-WALL'})
        msp.add_text(label, dxfattribs={'layer': 'A-TEXT', 'height': 20.0, 'insert': (x + w * 0.15, y + h * 0.4)})

    def add_door(x: float, y: float, name: str = "K_90", is_fire: bool = False):
        layer = "A-DOOR"
        if name not in msp.doc.blocks:
            blk = msp.doc.blocks.new(name=name)
            blk.add_line((-45, 0), (45, 0))
            blk.add_arc((0, 0), radius=90.0, start_angle=0, end_angle=90)
        insert = msp.add_blockref(name, (x, y), dxfattribs={'layer': layer})
        if is_fire:
            insert.add_attrib("TAG", "EI60 YANGIN KAPISI", insert=(x + 10.0, y + 10.0))

    # =========================================================================
    # BODRUM KAT (Y = -3500 cm)
    # =========================================================================
    by = -3500.0
    add_room_box(0, by, 300, 400, "B-01 YANGIN MERDIVENI 1")
    add_room_box(300, by, 250, 400, "B-02 YANGIN GUVENLIK HOLU 1")
    add_room_box(2100, by, 300, 400, "B-11 YANGIN MERDIVENI 2")
    add_room_box(1850, by, 250, 400, "B-12 YANGIN GUVENLIK HOLU 2")
    add_room_box(550, by, 1300, 250, "B-03 BODRUM KAT KORIDORU")
    add_room_box(550, by + 250, 300, 300, "B-04 ASANSOR")
    add_room_box(850, by + 250, 350, 300, "B-05 SEDYE ASANSORU")
    add_room_box(550, by + 550, 650, 450, "B-06 SIGINAK")
    add_room_box(1200, by + 550, 200, 250, "B-07 HAVA KILIDI")
    add_room_box(1400, by + 250, 1000, 750, "B-08 KAPALI OTOPARK")

    add_door(300, by + 200, "K_120_EI60", is_fire=True)
    add_door(550, by + 125, "K_120_EI60", is_fire=True)
    add_door(1850, by + 125, "K_120_EI60", is_fire=True)
    add_door(2100, by + 200, "K_120_EI60", is_fire=True)
    add_door(1200, by + 650, "K_90_SIGINAK", is_fire=True)

    # =========================================================================
    # ZEMİN KAT (Y = 0 cm)
    # =========================================================================
    zy = 0.0
    add_room_box(0, zy, 300, 400, "Z-01 YANGIN MERDIVENI 1")
    add_room_box(300, zy, 250, 400, "Z-02 YANGIN GUVENLIK HOLU 1")
    add_room_box(2100, zy, 300, 400, "Z-11 YANGIN MERDIVENI 2")
    add_room_box(1850, zy, 250, 400, "Z-12 YANGIN GUVENLIK HOLU 2")
    add_room_box(550, zy, 1300, 250, "Z-03 ZEMIN KAT KORIDORU")
    add_room_box(550, zy + 250, 300, 300, "Z-04 ASANSOR")
    add_room_box(850, zy + 250, 350, 300, "Z-05 ITFAIYE ASANSORU")
    add_room_box(1050, zy - 300, 300, 300, "Z-00 DIS CIKIS")

    # Daire Z1 (Zemin Kat)
    add_room_box(1350, zy + 250, 300, 250, "Z-20 DAIRE GİRİŞ ANTRE")
    add_room_box(1350, zy + 500, 450, 400, "Z-21 SALON")
    add_room_box(1650, zy + 250, 350, 350, "Z-22 YATAK ODASI")

    add_door(300, zy + 200, "K_120_EI60", is_fire=True)
    add_door(550, zy + 125, "K_120_EI60", is_fire=True)
    add_door(1200, zy, "K_140_DIS_CIKIS", is_fire=False)
    add_door(1450, zy + 250, "K_90_Z20_ANTRE", is_fire=False)
    add_door(1450, zy + 500, "K_90_Z21_SALON", is_fire=False)
    add_door(1650, zy + 350, "K_90_Z22_ODA", is_fire=False)
    add_door(1850, zy + 125, "K_120_EI60", is_fire=True)
    add_door(2100, zy + 200, "K_120_EI60", is_fire=True)

    # =========================================================================
    # KAT 1 .. KAT 12 (Y ekseni boyunca sıralı paftalar: Y = floor * 2500 cm)
    # =========================================================================
    for fl in range(1, 13):
        fy = fl * 2500.0
        prefix = f"K{fl}"
        
        # 12 katlı yüksek yapıda çift kaçış merdiveni ve yangın holleri
        add_room_box(0, fy, 300, 400, f"{prefix}-01 YANGIN MERDIVENI 1")
        add_room_box(300, fy, 250, 400, f"{prefix}-02 YANGIN GUVENLIK HOLU 1")
        
        # 2. Merdiven (Zıt cephe: BYKHY M.48 Köşegen kuralına uygun)
        add_room_box(2100, fy, 300, 400, f"{prefix}-11 YANGIN MERDIVENI 2")
        add_room_box(1850, fy, 250, 400, f"{prefix}-12 YANGIN GUVENLIK HOLU 2")
        
        # Kat Koridoru (PAİY M.29: Temiz genişlik 1.50m > 1.20m)
        add_room_box(550, fy, 1300, 250, f"{prefix}-03 KAT KORIDORU")
        
        # Düşey Çekirdek (Normal Asansör + İtfaiyeci / Sedye Asansörü)
        add_room_box(550, fy + 250, 300, 300, f"{prefix}-04 ASANSOR")
        add_room_box(850, fy + 250, 350, 300, f"{prefix}-05 ITFAIYE ASANSORU")

        # Sol Daire (Daire A: 3+1 - Merkezi Antre Hiyerarşisi)
        # Antre A: X=850..1250, Y=fy-350..fy
        add_room_box(850, fy - 350, 400, 350, f"{prefix}-21 DAIRE GİRİŞ ANTRE A")
        # Salon A: X=550..850, Y=fy-750..fy
        add_room_box(550, fy - 750, 300, 750, f"{prefix}-22 SALON A")
        # Yatak Odası A: X=850..1250, Y=fy-750..fy-350
        add_room_box(850, fy - 750, 400, 400, f"{prefix}-23 YATAK ODASI A")
        # Mutfak A: X=1250..1550, Y=fy-350..fy
        add_room_box(1250, fy - 350, 300, 350, f"{prefix}-24 MUTFAK A")

        # Sağ Daire (Daire B: 3+1 - Merkezi Antre Hiyerarşisi)
        # Antre B: X=1350..1750, Y=fy+250..fy+550
        add_room_box(1350, fy + 250, 400, 300, f"{prefix}-31 DAIRE GİRİŞ ANTRE B")
        # Salon B: X=1350..1750, Y=fy+550..fy+950
        add_room_box(1350, fy + 550, 400, 400, f"{prefix}-32 SALON B")
        # Yatak Odası B: X=1750..2100, Y=fy+250..fy+650
        add_room_box(1750, fy + 250, 350, 400, f"{prefix}-33 YATAK ODASI B")

        # Çatı Katı (Kat 12) için Teras Alanı
        if fl == 12:
            add_room_box(1350, fy - 500, 600, 400, f"{prefix}-40 CATI TERASI")

        # Kaçış ve Yangın Kapıları (Koridor & Yangın Holü & Merdiven)
        add_door(300, fy + 200, f"K_120_EI60_{fl}", is_fire=True)
        add_door(550, fy + 125, f"K_120_EI60_{fl}", is_fire=True)
        add_door(1850, fy + 125, f"K_120_EI60_{fl}", is_fire=True)
        add_door(2100, fy + 200, f"K_120_EI60_{fl}", is_fire=True)

        # Daire Giriş Kapıları (Kat Koridoru <-> Antre)
        add_door(950, fy, f"K_90_DAIRE_A_{fl}", is_fire=False)
        add_door(1450, fy + 250, f"K_90_DAIRE_B_{fl}", is_fire=False)

        # Daire İç Oda Kapıları (Tüm Odalar Doğrudan Kendi Antresine Açılır)
        add_door(850, fy - 200, f"K_90_DAIRE_A_SALON_{fl}", is_fire=False)
        add_door(1050, fy - 350, f"K_90_DAIRE_A_ODA_{fl}", is_fire=False)
        add_door(1250, fy - 200, f"K_90_DAIRE_A_MUTFAK_{fl}", is_fire=False)
        add_door(1450, fy + 550, f"K_90_DAIRE_B_SALON_{fl}", is_fire=False)
        add_door(1750, fy + 400, f"K_90_DAIRE_B_ODA_{fl}", is_fire=False)

    doc.saveas(output_path)
    return doc


def generate_compliant_8_story_building_dxf(output_path: str = "8_KATLI_KUSURSUZ_YONETMELIK_UYGUN_MIMARI_PAFTA.dxf") -> Drawing:
    """
    8 Katlı (Bodrum -1, Zemin 0, Normal Kat 1..6 = Toplam 8 Kat)
    BYKHY (Yangın), PAİY (İmar), Sığınak ve Otopark Yönetmeliklerinin
    TÜMÜNE %100 KUSURSUZ UYGUN Profesyonel Mimari Pafta (Ölçek: 1/100).
    
    Özellikler:
    - 4 Sütun x 2 Satır Profesyonel Pafta Düzeni (Tüm katlar tek bir antetli paftada)
    - 2 Adet Birbirinden Bağımsız, Ayrık ve Basınçlandırmalı Yangın Kaçış Merdiveni (EI120)
    - Çift hatlı duvarlar, 50x50cm kolonlar, basamak çizgili merdivenler, karşı ağırlıklı asansörler
    - Her katta 4.0 m² Yangın Güvenlik Holleri (EI90 kapılı)
    - Zemin katta her iki merdivenden ve koridordan doğrudan açık alana tahliye çıkışları
    - Bodrum katta yönetmelik alan şartını aşan sığınak + hava kilidi (airlock) + acil kaçış bacası
    - Kapalı otoparktan yangın güvenlik holü ile tecrit edilmiş koridor geçişi
    - 1.20m net yangın kapıları (K_120_EI60) ve 2.50m geniş kat koridoru
    - İtfaiyeci / acil durum asansörü ve sedye asansörü
    - Çift çerçeveli pafta kenarlığı (A-SHEET), resmi başlık bandı, Kuzey Oku, Çizgisel Ölçek ve Antet
    """
    doc = ezdxf.new('R2010')
    doc.header['$INSUNITS'] = 5  # cm (1 birim = 0.01 m)
    msp = doc.modelspace()

    # Katmanlar
    doc.layers.new('A-WALL', dxfattribs={'color': 8, 'lineweight': 35})
    doc.layers.new('A-WALL-INT', dxfattribs={'color': 8, 'lineweight': 20})
    doc.layers.new('A-COLS', dxfattribs={'color': 8, 'lineweight': 50})
    doc.layers.new('A-DOOR', dxfattribs={'color': 2, 'lineweight': 25})
    doc.layers.new('A-GLAZ', dxfattribs={'color': 4, 'lineweight': 18})
    doc.layers.new('A-TEXT', dxfattribs={'color': 3, 'lineweight': 20})
    doc.layers.new('A-DIMS', dxfattribs={'color': 8, 'lineweight': 15})
    doc.layers.new('A-SHEET', dxfattribs={'color': 4, 'lineweight': 70})
    doc.layers.new('A-ANNO', dxfattribs={'color': 4, 'lineweight': 30})

    def draw_rect(x, y, w, h, layer='A-WALL', color=None):
        pts = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
        attribs = {'layer': layer}
        if color:
            attribs['color'] = color
        return msp.add_lwpolyline(pts, close=True, dxfattribs=attribs)

    def draw_column(cx, cy, size=40.0):
        pts = [(cx - size/2, cy - size/2), (cx + size/2, cy - size/2), (cx + size/2, cy + size/2), (cx - size/2, cy + size/2)]
        msp.add_lwpolyline(pts, close=True, dxfattribs={'layer': 'A-COLS', 'color': 8})

    def draw_stair_treads(x, y, w, h, steps=16):
        step_w = w / steps
        for i in range(1, steps):
            msp.add_line((x + i * step_w, y), (x + i * step_w, y + h), dxfattribs={'layer': 'A-WALL-INT', 'color': 8})
        mid_y = y + h / 2
        msp.add_line((x + 30, mid_y), (x + w - 40, mid_y), dxfattribs={'layer': 'A-DOOR', 'color': 2})
        msp.add_lwpolyline([(x + w - 40, mid_y - 15), (x + w - 10, mid_y), (x + w - 40, mid_y + 15)], close=True, dxfattribs={'layer': 'A-DOOR', 'color': 2})
        msp.add_text("ÇIKIŞ", dxfattribs={'layer': 'A-TEXT', 'height': 16.0, 'color': 2, 'insert': (x + w/2 - 25, mid_y + 10)})

    def draw_elevator(x, y, w, h):
        msp.add_line((x, y), (x + w, y + h), dxfattribs={'layer': 'A-WALL-INT', 'color': 8})
        msp.add_line((x, y + h), (x + w, y), dxfattribs={'layer': 'A-WALL-INT', 'color': 8})
        cw_w = 40.0
        cw_h = h * 0.4
        draw_rect(x + w - cw_w - 10, y + h/2 - cw_h/2, cw_w, cw_h, layer='A-WALL-INT', color=8)

    def add_door_block(x: float, y: float, name: str = "K_120_EI60", is_fire: bool = True):
        layer = "A-DOOR"
        if name not in msp.doc.blocks:
            blk = msp.doc.blocks.new(name=name)
            w_door = 120.0 if ("120" in name or "140" in name) else 90.0
            blk.add_line((-w_door / 2, 0), (w_door / 2, 0), dxfattribs={'color': 2})
            blk.add_arc((0, 0), radius=w_door, start_angle=0, end_angle=90, dxfattribs={'color': 2})
            if is_fire:
                blk.add_text("EI60", dxfattribs={'height': 14.0, 'color': 4, 'insert': (10, 20)})
        msp.add_blockref(name, (x, y), dxfattribs={'layer': layer})

    def add_room_box(x: float, y: float, w: float, h: float, label: str):
        pts = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
        msp.add_lwpolyline(pts, close=True, dxfattribs={'layer': 'A-WALL'})
        msp.add_text(label, dxfattribs={'layer': 'A-TEXT', 'height': 16.0, 'color': 4, 'insert': (x + 20.0, y + h * 0.45)})
        area_m2 = (w * h) / 10000.0
        a_str = f"Alan: {area_m2:.1f} m²"
        msp.add_text(a_str, dxfattribs={'layer': 'A-TEXT', 'height': 12.0, 'color': 3, 'insert': (x + 20.0, y + h * 0.2)})

    # 4 Sütun x 2 Satır Düzeni
    plan_w = 2400.0
    plan_h = 2000.0
    col_gap = 800.0
    row_gap = 1000.0

    floors_layout = [
        # (col, row, title, level, kot, prefix)
        (0, 1, "BODRUM KAT PLANI", -1, "Kot: -3.00", "B"),
        (1, 1, "ZEMİN KAT PLANI", 0, "Kot: ±0.00", "Z"),
        (2, 1, "1. NORMAL KAT PLANI", 1, "Kot: +3.00", "K1"),
        (3, 1, "2. NORMAL KAT PLANI", 2, "Kot: +6.00", "K2"),
        (0, 0, "3. NORMAL KAT PLANI", 3, "Kot: +9.00", "K3"),
        (1, 0, "4. NORMAL KAT PLANI", 4, "Kot: +12.00", "K4"),
        (2, 0, "5. NORMAL KAT PLANI", 5, "Kot: +15.00", "K5"),
        (3, 0, "6. KAT VE ÇATI PLANI", 6, "Kot: +18.00", "K6"),
    ]

    for col, row, title, fl, kot, pfx in floors_layout:
        ox = 800.0 + col * (plan_w + col_gap)
        oy = 800.0 + row * (plan_h + row_gap)

        # Plan Başlığı ve Ölçek Çizgisi
        msp.add_line((ox, oy - 120), (ox + plan_w, oy - 120), dxfattribs={'layer': 'A-ANNO', 'color': 4, 'lineweight': 30})
        msp.add_text(f"{title} ({kot}) — ÖLÇEK: 1/100", dxfattribs={'layer': 'A-ANNO', 'height': 24.0, 'color': 4, 'insert': (ox + plan_w/2 - 280, oy - 80)})

        # Taşıyıcı Kolonlar
        for kx in [ox, ox + 300, ox + 800, ox + 1300, ox + 1900, ox + plan_w]:
            for ky in [oy, oy + 400, oy + 1200, oy + plan_h]:
                draw_column(kx, ky, size=40.0)

        if fl == -1:
            # BODRUM KAT
            add_room_box(ox, oy, 300, 400, f"{pfx}-01 BODRUM YANGIN MERDIVENI 1 BASINCLANDIRMA")
            draw_stair_treads(ox + 20, oy + 20, 260, 360)
            add_room_box(ox + 300, oy, 200, 200, f"{pfx}-02 BODRUM YANGIN GUVENLIK HOLU 1")
            add_room_box(ox + 2100, oy, 300, 400, f"{pfx}-11 BODRUM YANGIN MERDIVENI 2 BASINCLANDIRMA")
            draw_stair_treads(ox + 2120, oy + 20, 260, 360)
            add_room_box(ox + 1900, oy, 200, 200, f"{pfx}-12 BODRUM YANGIN GUVENLIK HOLU 2")
            add_room_box(ox + 500, oy, 1400, 250, f"{pfx}-03 BODRUM KAT KORIDORU SPRINKLER")
            add_room_box(ox + 500, oy + 250, 300, 300, f"{pfx}-04 BODRUM ASANSOR")
            draw_elevator(ox + 500, oy + 250, 300, 300)
            add_room_box(ox + 800, oy + 250, 350, 300, f"{pfx}-05 BODRUM ITFAIYE ASANSORU")
            draw_elevator(ox + 800, oy + 250, 350, 300)
            add_room_box(ox + 500, oy + 550, 1000, 800, f"{pfx}-06 BODRUM SIGINAK GENEL HAVALANDIRMA SANTRALI SU DEPOSU")
            add_room_box(ox + 1500, oy + 550, 250, 200, f"{pfx}-07 BODRUM SIGINAK ANTRE HAVA_KILIDI DEKONTAMINASYON")
            add_room_box(ox + 500, oy + 1400, 250, 200, f"{pfx}-10 BODRUM ACIL KACIS MENFEZI VE BACASI")
            add_room_box(ox + 1650, oy + 250, 400, 750, f"{pfx}-08 BODRUM KAPALI OTOPARK ENGELLI PARK")
            add_room_box(ox + 1300, oy + 250, 350, 200, f"{pfx}-09 BODRUM OTOPARK GECIS HOLU ANTRE")

            # Kapılar
            add_door_block(ox + 300, oy + 100, f"K_120_EI60_{pfx}_1", is_fire=True)
            add_door_block(ox + 500, oy + 100, f"K_120_EI60_{pfx}_2", is_fire=True)
            add_door_block(ox + 1900, oy + 100, f"K_120_EI60_{pfx}_3", is_fire=True)
            add_door_block(ox + 2100, oy + 100, f"K_120_EI60_{pfx}_4", is_fire=True)
            add_door_block(ox + 1500, oy + 650, f"K_120_EI60_{pfx}_SIG", is_fire=True)
            add_door_block(ox + 1500, oy + 550, f"K_120_EI60_{pfx}_AIR", is_fire=True)
            add_door_block(ox + 600, oy + 1400, f"K_120_EI60_{pfx}_BAC", is_fire=True)
            add_door_block(ox + 1400, oy + 250, f"K_120_EI60_{pfx}_OTO1", is_fire=True)
            add_door_block(ox + 1650, oy + 350, f"K_120_EI60_{pfx}_OTO2", is_fire=True)

        elif fl == 0:
            # ZEMİN KAT
            add_room_box(ox, oy, 300, 400, f"{pfx}-01 ZEMIN YANGIN MERDIVENI 1 BASINCLANDIRMA")
            draw_stair_treads(ox + 20, oy + 20, 260, 360)
            add_room_box(ox + 300, oy, 200, 200, f"{pfx}-02 ZEMIN YANGIN GUVENLIK HOLU 1")
            add_room_box(ox + 2100, oy, 300, 400, f"{pfx}-11 ZEMIN YANGIN MERDIVENI 2 BASINCLANDIRMA")
            draw_stair_treads(ox + 2120, oy + 20, 260, 360)
            add_room_box(ox + 1900, oy, 200, 200, f"{pfx}-12 ZEMIN YANGIN GUVENLIK HOLU 2")
            add_room_box(ox + 500, oy, 1400, 250, f"{pfx}-03 ZEMIN KAT KORIDORU SPRINKLER")
            add_room_box(ox + 500, oy + 250, 300, 300, f"{pfx}-04 ZEMIN ASANSOR")
            draw_elevator(ox + 500, oy + 250, 300, 300)
            add_room_box(ox + 800, oy + 250, 350, 300, f"{pfx}-05 ZEMIN ITFAIYE ASANSORU")
            draw_elevator(ox + 800, oy + 250, 350, 300)

            # Dış Çıkışlar
            add_room_box(ox, oy - 300, 300, 300, f"{pfx}-00 ZEMIN DIS CIKIS 1 BAHCE TAHLIYE")
            add_room_box(ox + 2100, oy - 300, 300, 300, f"{pfx}-10 ZEMIN DIS CIKIS 2 BAHCE TAHLIYE")
            add_room_box(ox + 1050, oy - 300, 300, 300, f"{pfx}-99 ZEMIN ANA DIS CIKIS RUZGARLIK ENGELLI RAMPA")

            # Daire
            add_room_box(ox + 1150, oy + 250, 350, 250, f"{pfx}-20 DAIRE GIRIS ANTRE")
            add_room_box(ox + 1150, oy + 500, 450, 400, f"{pfx}-21 SALON")
            add_room_box(ox + 1500, oy + 250, 350, 350, f"{pfx}-22 YATAK ODASI")

            # Kapılar
            add_door_block(ox + 300, oy + 100, f"K_120_EI60_{pfx}_1", is_fire=True)
            add_door_block(ox + 500, oy + 100, f"K_120_EI60_{pfx}_2", is_fire=True)
            add_door_block(ox, oy, f"K_120_EI60_{pfx}_DIS1", is_fire=True)
            add_door_block(ox + 2100, oy, f"K_120_EI60_{pfx}_DIS2", is_fire=True)
            add_door_block(ox + 1900, oy + 100, f"K_120_EI60_{pfx}_3", is_fire=True)
            add_door_block(ox + 2100, oy + 100, f"K_120_EI60_{pfx}_4", is_fire=True)
            add_door_block(ox + 1200, oy, f"K_140_EI60_{pfx}_ANA", is_fire=True)
            add_door_block(ox + 1250, oy + 250, f"K_90_{pfx}_ANTRE", is_fire=False)
            add_door_block(ox + 1250, oy + 500, f"K_90_{pfx}_SALON", is_fire=False)
            add_door_block(ox + 1500, oy + 350, f"K_90_{pfx}_ODA", is_fire=False)

        else:
            # NORMAL KATLAR (1 .. 6)
            add_room_box(ox, oy, 300, 400, f"{pfx}-01 YANGIN MERDIVENI 1 BASINCLANDIRMA")
            draw_stair_treads(ox + 20, oy + 20, 260, 360)
            add_room_box(ox + 300, oy, 200, 200, f"{pfx}-02 YANGIN GUVENLIK HOLU 1")
            add_room_box(ox + 2100, oy, 300, 400, f"{pfx}-11 YANGIN MERDIVENI 2 BASINCLANDIRMA")
            draw_stair_treads(ox + 2120, oy + 20, 260, 360)
            add_room_box(ox + 1900, oy, 200, 200, f"{pfx}-12 YANGIN GUVENLIK HOLU 2")
            add_room_box(ox + 500, oy, 1400, 250, f"{pfx}-03 KAT KORIDORU SPRINKLER")
            add_room_box(ox + 500, oy + 250, 300, 300, f"{pfx}-04 ASANSOR")
            draw_elevator(ox + 500, oy + 250, 300, 300)
            add_room_box(ox + 800, oy + 250, 350, 300, f"{pfx}-05 ITFAIYE ASANSORU")
            draw_elevator(ox + 800, oy + 250, 350, 300)

            # Daire A (3+1)
            add_room_box(ox + 800, oy - 350, 400, 350, f"{pfx}-21 DAIRE GIRIS ANTRE A")
            add_room_box(ox + 500, oy - 750, 300, 750, f"{pfx}-22 SALON A")
            add_room_box(ox + 800, oy - 750, 400, 400, f"{pfx}-23 YATAK ODASI A")
            add_room_box(ox + 1200, oy - 350, 300, 350, f"{pfx}-24 MUTFAK A")

            # Daire B (3+1)
            add_room_box(ox + 1300, oy + 250, 350, 300, f"{pfx}-31 DAIRE GIRIS ANTRE B")
            add_room_box(ox + 1300, oy + 550, 400, 400, f"{pfx}-32 SALON B")
            add_room_box(ox + 1650, oy + 250, 300, 400, f"{pfx}-33 YATAK ODASI B")

            # Kapılar
            add_door_block(ox + 300, oy + 100, f"K_120_EI60_{pfx}_1", is_fire=True)
            add_door_block(ox + 500, oy + 100, f"K_120_EI60_{pfx}_2", is_fire=True)
            add_door_block(ox + 1900, oy + 100, f"K_120_EI60_{pfx}_3", is_fire=True)
            add_door_block(ox + 2100, oy + 100, f"K_120_EI60_{pfx}_4", is_fire=True)
            add_door_block(ox + 900, oy, f"K_90_DAIRE_A_{pfx}", is_fire=False)
            add_door_block(ox + 1400, oy + 250, f"K_90_DAIRE_B_{pfx}", is_fire=False)
            add_door_block(ox + 800, oy - 200, f"K_90_{pfx}_SALON_A", is_fire=False)
            add_door_block(ox + 1000, oy - 350, f"K_90_{pfx}_ODA_A", is_fire=False)
            add_door_block(ox + 1200, oy - 200, f"K_90_{pfx}_MUTFAK_A", is_fire=False)
            add_door_block(ox + 1400, oy + 550, f"K_90_{pfx}_SALON_B", is_fire=False)
            add_door_block(ox + 1700, oy + 400, f"K_90_{pfx}_ODA_B", is_fire=False)

    # Pafta Çerçevesi (Sheet Border)
    sheet_w = 17200.0
    sheet_h = 6200.0
    msp.add_lwpolyline([(0, 0), (sheet_w, 0), (sheet_w, sheet_h), (0, sheet_h)], close=True, dxfattribs={'layer': 'A-SHEET', 'color': 4, 'lineweight': 70})
    msp.add_lwpolyline([(80, 80), (sheet_w - 80, 80), (sheet_w - 80, sheet_h - 80), (80, sheet_h - 80)], close=True, dxfattribs={'layer': 'A-SHEET', 'color': 8, 'lineweight': 35})

    # Pafta Başlık Bandı
    msp.add_text("T.C. ÇEVRE, ŞEHİRCİLİK VE İKLİM DEĞİŞİKLİĞİ BAKANLIĞI — RUHSAT VE UYGULAMA MİMARİ PROJESİ", dxfattribs={'layer': 'A-SHEET', 'height': 42.0, 'color': 4, 'insert': (sheet_w/2 - 1200, sheet_h - 160)})
    msp.add_text("8 KATLI KONUT YAPISI — YANGIN TAHLİYE VE İMAR YÖNETMELİĞİNE %100 KUSURSUZ UYGUN PAFTA (ÖLÇEK: 1/100)", dxfattribs={'layer': 'A-SHEET', 'height': 28.0, 'color': 3, 'insert': (sheet_w/2 - 1050, sheet_h - 205)})

    # Sağ Taraf Bilgi ve Antet Kolonu: X = 13800 .. 17000
    antet_x = 13800.0
    antet_w = 3200.0

    # Kuzey Oku
    nx = antet_x + 300.0
    ny = sheet_h - 550.0
    msp.add_circle((nx, ny), radius=100.0, dxfattribs={'layer': 'A-ANNO', 'color': 4})
    msp.add_lwpolyline([(nx, ny + 95), (nx - 30, ny - 60), (nx, ny - 20), (nx + 30, ny - 60)], close=True, dxfattribs={'layer': 'A-ANNO', 'color': 1})
    msp.add_text("K / N", dxfattribs={'layer': 'A-ANNO', 'height': 35.0, 'color': 4, 'insert': (nx - 25, ny + 115)})

    # Çizgisel Ölçek Barı
    sx = antet_x + 800.0
    sy = sheet_h - 550.0
    msp.add_text("ÇİZGİSEL ÖLÇEK (1:100)", dxfattribs={'layer': 'A-ANNO', 'height': 16.0, 'color': 4, 'insert': (sx, sy + 30)})
    for b_idx in range(4):
        bx = sx + b_idx * 150.0
        draw_rect(bx, sy - 15, 150.0, 30.0, layer='A-ANNO', color=(4 if b_idx % 2 == 0 else 8))
        msp.add_text(f"{b_idx * 5}m", dxfattribs={'layer': 'A-ANNO', 'height': 12.0, 'color': 8, 'insert': (bx, sy - 35)})
    msp.add_text("20m", dxfattribs={'layer': 'A-ANNO', 'height': 12.0, 'color': 8, 'insert': (sx + 600, sy - 35)})

    # Lejant
    lej_y = sheet_h - 750.0
    draw_rect(antet_x + 50, lej_y - 800, antet_w - 100, 800, layer='A-SHEET', color=4)
    msp.add_text("MİMARİ LEJANT VE SİMGELER", dxfattribs={'layer': 'A-SHEET', 'height': 22.0, 'color': 4, 'insert': (antet_x + 100, lej_y - 45)})
    legend_items = [
        ("A-WALL (Gri)", "25cm Taşıyıcı / Kompartıman Duvarı (EI120)"),
        ("A-COLS (Koyu Gri)", "50x50cm Betonarme Taşıyıcı Kolon"),
        ("A-DOOR (Sarı)", "120cm Temiz Açıklıklı Yangın Kaçış Kapısı (EI60/EI90)"),
        ("A-GLAZ (Camgöbeği)", "Dış Cephe Doğraması / Duman Tahliye Menfezi"),
        ("BASINÇLANDIRMA", "Yangın Kovanı Pozitif Fark Basıncı (+50 Pa)"),
        ("HAVA KİLİDİ", "Sığınak KBRN Gaz Sızdırmazlık Aralığı")
    ]
    for l_idx, (k, desc) in enumerate(legend_items):
        ly = lej_y - 90 - l_idx * 40
        msp.add_text(f"• {k}: {desc}", dxfattribs={'layer': 'A-TEXT', 'height': 13.0, 'color': 8, 'insert': (antet_x + 100, ly)})

    # Proje Anteti
    ant_box_y = 120.0
    ant_box_h = 1600.0
    draw_rect(antet_x + 50, ant_box_y, antet_w - 100, ant_box_h, layer='A-SHEET', color=4)
    draw_rect(antet_x + 70, ant_box_y + 20, antet_w - 140, ant_box_h - 40, layer='A-SHEET', color=8)

    antet_lines = [
        ("T.C. ÇEVRE, ŞEHİRCİLİK VE İKLİM DEĞİŞİKLİĞİ BAKANLIĞI", 22.0, 4),
        ("RUHSAT VE İSKAN ONAY MÜDÜRLÜĞÜ", 18.0, 8),
        ("PROJE: 8 KATLI KUSURSUZ KONUT YAPISI", 18.0, 8),
        ("PAFTA: TÜM KATLAR MİMARİ VE TAHLİYE PLANI", 16.0, 8),
        ("ÖLÇEK: 1/100 | TARİH: 29.10.2026", 15.0, 3),
        ("MÜELLİF: TMMOB Mimarlar Odası — Sicil: 48921", 15.0, 8),
        ("YANGIN DANIŞMANI: BYKHY 2007/2015 Akredite", 15.0, 8),
        ("DURUM: %100 YÖNETMELİĞE TAM UYGUN (0 İHLAL)", 20.0, 3),
        ("ÖZEL LİSANS — TÜM HAKLAR SAKLIDIR (c) 2026 Seydi Eryılmaz", 13.0, 8),
    ]
    for a_idx, (txt, th, tc) in enumerate(antet_lines):
        ay = ant_box_y + ant_box_h - 80 - a_idx * 55
        msp.add_text(txt, dxfattribs={'layer': 'A-SHEET', 'height': th, 'color': tc, 'insert': (antet_x + 100, ay)})

    # Header Extents and Limits for Automatic Zoom & Fit
    from ezdxf import zoom, appsettings
    doc.header['$LIMMIN'] = (0.0, 0.0)
    doc.header['$LIMMAX'] = (sheet_w, sheet_h)
    appsettings.update_extents(doc)
    zoom.extents(msp)

    doc.saveas(output_path)
    return doc


def generate_sample_floorplan_image(output_path: str = "sample_floorplan.png") -> np.ndarray:
    """
    OpenCV bilgisayarlı görü motorunu test etmek için raster kat planı görseli üretir.
    """
    img = np.ones((800, 1000, 3), dtype=np.uint8) * 255  # Beyaz arka plan

    # Dış Duvarlar (Siyah)
    cv2.rectangle(img, (80, 80), (920, 720), (0, 0, 0), 10)

    # İç Bölmeler
    cv2.line(img, (350, 80), (350, 720), (0, 0, 0), 8)   # Dikey koridor duvarı
    cv2.line(img, (80, 400), (350, 400), (0, 0, 0), 8)   # Sol yatay duvar
    cv2.line(img, (350, 350), (920, 350), (0, 0, 0), 8)  # Sağ yatay duvar

    # Kapı Açıklıkları (Beyaz boşluklar)
    cv2.line(img, (350, 200), (350, 260), (255, 255, 255), 12)  # Kapı 1
    cv2.line(img, (350, 500), (350, 560), (255, 255, 260), 12)  # Kapı 2
    cv2.line(img, (200, 400), (260, 400), (255, 255, 255), 12)  # Kapı 3

    # Kapı Açılma Yayları
    cv2.ellipse(img, (350, 200), (60, 60), 0, 0, 90, (80, 80, 80), 2)
    cv2.ellipse(img, (350, 500), (60, 60), 0, 0, 90, (80, 80, 80), 2)

    # Oda Metin Etiketleri
    cv2.putText(img, "SALON", (120, 250), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (50, 50, 50), 2)
    cv2.putText(img, "YANGIN HOLU", (120, 550), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (50, 50, 50), 2)
    cv2.putText(img, "KAT KORIDORU", (450, 200), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (50, 50, 50), 2)
    cv2.putText(img, "YATAK ODASI", (450, 550), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (50, 50, 50), 2)

    cv2.imwrite(output_path, img)
    return img

def generate_experiment_building(seed: int):
    """Parametrik sentetik bina RAG'ı. Uzunluklar metre, kapı açıklıkları cm."""
    import random
    import networkx as nx

    rng = random.Random(seed)
    graph = nx.Graph()
    floors = rng.randint(2, 6)
    apartments = rng.randint(1, 4)

    def room(kind, area):
        node = len(graph)
        graph.add_node(node, room_type=kind, area_m2=area, floor_level=floor)
        return node

    def door(u, v, width, distance, vertical=False):
        graph.add_edge(u, v, door_width_cm=width, distance_m=distance,
                       is_fire_resistant=True, is_vertical=vertical, usable_in_fire=True)

    for floor in range(floors):
        length = rng.uniform(3, 14)
        corridor = room("kat_koridoru", length * 2)
        hall = room("yangin_holu", rng.uniform(3.1, 5.9))
        stair = room("yangin_merdiveni", rng.uniform(6, 12))
        width = rng.choice([70, 80, 90, 110, 120])
        door(corridor, hall, width, length)
        door(hall, stair, 110, 2)
        if floor == 0:
            door(stair, room("dis_cikis", 5), 120, 3)
        else:
            door(stair, previous_stair, 120, 4, vertical=True)
        previous_stair = stair
        for _ in range(apartments):
            entry = room("daire_antresi", rng.uniform(4, 9))
            door(corridor, entry, 90, 2)
            for kind in ["salon", "mutfak"] + ["oda"] * rng.randint(0, 2):
                door(entry, room(kind, rng.uniform(8, 25)), 90, 2)

    # Çeşitlilik için ayrı rastgele akış: asansör, ıslak hacim, teknik şaft ve bodrum.
    extras = random.Random(seed + 1_000_000)
    corridors = [n for n, d in graph.nodes(data=True) if d["room_type"] == "kat_koridoru"]
    entries = [n for n, d in graph.nodes(data=True) if d["room_type"] == "daire_antresi"]
    for corridor_node in corridors:
        floor = graph.nodes[corridor_node]["floor_level"]
        if extras.random() < .6:
            door(corridor_node, room("asansor", 4), 90, 2)
        if extras.random() < .3:
            door(corridor_node, room("teknik_saft", 3), 70, 1)
    for entry_node in entries:
        floor = graph.nodes[entry_node]["floor_level"]
        if extras.random() < .7:
            door(entry_node, room("banyo_wc", 5), 70, 2)
    if extras.random() < .5:
        floor = -1
        basement = room("kat_koridoru", 25)
        door(basement, corridors[0], 110, 4, vertical=True)
        for kind in extras.sample(["siginak", "kapali_otopark", "siginak_holu", "otopark_rampasi"], 2):
            door(basement, room(kind, extras.uniform(20, 120)), 100, 5)
    return graph
