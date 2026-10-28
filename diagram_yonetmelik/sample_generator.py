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
            insert.add_attrib("TAG", "EI60 YANGIN KAPISI")

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
            insert.add_attrib("TAG", "EI60 YANGIN KAPISI")

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
