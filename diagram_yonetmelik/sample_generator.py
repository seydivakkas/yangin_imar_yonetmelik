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
        blk = msp.doc.blocks.new(name=name) if name not in msp.doc.blocks else msp.doc.blocks.get(name)
        blk.add_line((-45, 0), (45, 0))
        blk.add_arc((0, 0), radius=90.0, start_angle=0, end_angle=90)
        insert = msp.add_blockref(name, (x, y), dxfattribs={'layer': layer})
        if is_fire:
            insert.add_attrib("TAG", "EI60 YANGIN KAPISI")

    # =========================================================================
    # 1. ZEMİN KAT ADASI (X: 0..3000 cm, Y: 0..2500 cm)
    # =========================================================================
    # Yangın Çekirdeği
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

    # =========================================================================
    # 2. BODRUM KAT ADASI (X: 0..3000 cm, Y: 3500..6000 cm)
    # =========================================================================
    add_room_box(0, 3500, 300, 400, "B-01 YANGIN MERDIVENI")
    add_room_box(300, 3500, 250, 400, "B-02 YANGIN GUVENLIK HOLU")
    add_room_box(550, 3500, 600, 300, "B-03 BODRUM KORIDOR")
    add_room_box(1150, 3500, 800, 600, "B-04 KAPALI OTOPARK")
    add_room_box(550, 3800, 500, 400, "B-05 SIGINAK")           # Sığınak

    # Bodrum Kapıları (Yasaklı kapı testi: Otoparktan doğrudan merdivene açılan kapı)
    add_door_insert(300, 3700, name="K_90_EI60", is_fire=True)
    add_door_insert(550, 3700, name="K_90", is_fire=False)
    add_door_insert(1150, 3600, name="K_90_OTOPARK_KORIDOR", is_fire=False)
    # Kusur: Otopark -> Merdiven doğrudan kapı!
    add_door_insert(150, 3900, name="K_90_YASAKLI", is_fire=False)

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
