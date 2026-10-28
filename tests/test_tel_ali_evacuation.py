"""
Tel Ali Tahliye Simülasyonu Otomatik Test Paketi (TEST 01 - TEST 08)
Telif Hakkı (c) 2026 Seydi Eryılmaz (@seydivakkas) - ÖZEL LİSANS — TÜM HAKLAR SAKLIDIR
"""

import math
import pytest
from diagram_yonetmelik.tel_ali_navigation import (
    TelAliNavigationEngine,
    EvacuationSimulationController,
    NavRoom,
    NavDoor,
    EvacuationState,
    EvacuationErrorCode,
    WaypointType,
)


def test_01_single_room_single_door_to_exit():
    """
    TEST 01 — Tek oda ve tek kapı:
    Tel Ali odadan kapı yoluyla çıkar, koridora girer ve bina dışındaki güvenli çıkışa ulaşır.
    Her geçişin kapı eşiğinden (portal) geçtiği doğrulanır.
    """
    engine = TelAliNavigationEngine(run_speed_mps=3.0)
    rooms = [
        NavRoom(id="room_1", name="Yatak Odası", room_type="oda", floor_level=0, pos=(2.0, 0.0, 5.0)),
        NavRoom(id="corridor_1", name="Kat Koridoru", room_type="kat_koridoru", floor_level=0, pos=(8.0, 0.0, 5.0)),
        NavRoom(id="exit_1", name="Ana Dış Çıkış", room_type="dis_cikis", floor_level=0, pos=(14.0, 0.0, 5.0), is_exit=True),
    ]
    doors = [
        NavDoor(id="D1", source="room_1", target="corridor_1", door_width_cm=90.0, portal_pos=(5.0, 0.0, 5.0)),
        NavDoor(id="D2", source="corridor_1", target="exit_1", door_width_cm=110.0, portal_pos=(11.0, 0.0, 5.0)),
    ]

    engine.build_graph(rooms, doors)
    route = engine.compute_route(start_room_id="room_1")

    assert route.success is True
    assert route.state == EvacuationState.ROUTE_READY
    assert len(route.waypoints) >= 5

    # Rota noktalarının sırası: Oda Merkezi -> D1 Kapısı -> Koridor Merkezi -> D2 Kapısı -> Çıkış -> Toplanma Alanı
    types = [wp.wp_type for wp in route.waypoints]
    assert types[0] == WaypointType.ROOM_CENTROID
    assert types[1] == WaypointType.DOOR_PORTAL
    assert route.waypoints[1].pos == (5.0, 0.0, 5.0)  # D1 kapı eşiği
    assert types[2] == WaypointType.ROOM_CENTROID
    assert types[3] == WaypointType.DOOR_PORTAL
    assert route.waypoints[3].pos == (11.0, 0.0, 5.0)  # D2 kapı eşiği
    assert types[-1] == WaypointType.MUSTER_POINT


def test_02_multi_room_navigation_and_stair_traversal():
    """
    TEST 02 — Birden fazla oda ve çok katlı geçiş:
    Bodrum (Kat -1) odasından çıkan karakter sırasıyla:
    Oda -> Kapı -> Koridor -> Kapı -> Yangın Holü -> Kapı -> Yangın Merdiveni ->
    (Dikey basamak geçişi) -> Zemin Kat Merdiveni -> Kapı -> Zemin Holü -> Dış Çıkış -> Dış Güvenli Alan
    güzergâhını takip eder.
    """
    engine = TelAliNavigationEngine(run_speed_mps=3.5)
    rooms = [
        NavRoom(id="B_oda", name="Bodrum Sığınak", room_type="siginak", floor_level=-1, pos=(2.0, -3.2, 8.0)),
        NavRoom(id="B_hol", name="Bodrum Yangın Holü", room_type="yangin_holu", floor_level=-1, pos=(6.0, -3.2, 8.0)),
        NavRoom(id="B_stair", name="Bodrum Yangın Merdiveni", room_type="yangin_merdiveni", floor_level=-1, pos=(10.0, -3.2, 8.0)),
        NavRoom(id="Z_stair", name="Zemin Yangın Merdiveni", room_type="yangin_merdiveni", floor_level=0, pos=(10.0, 0.0, 8.0)),
        NavRoom(id="Z_hol", name="Zemin Yangın Holü", room_type="yangin_holu", floor_level=0, pos=(6.0, 0.0, 8.0)),
        NavRoom(id="Z_exit", name="Zemin Dış Çıkış", room_type="dis_cikis", floor_level=0, pos=(2.0, 0.0, 8.0), is_exit=True),
    ]
    doors = [
        NavDoor(id="D_B1", source="B_oda", target="B_hol", portal_pos=(4.0, -3.2, 8.0)),
        NavDoor(id="D_B2", source="B_hol", target="B_stair", portal_pos=(8.0, -3.2, 8.0)),
        NavDoor(id="D_Z1", source="Z_stair", target="Z_hol", portal_pos=(8.0, 0.0, 8.0)),
        NavDoor(id="D_Z2", source="Z_hol", target="Z_exit", portal_pos=(4.0, 0.0, 8.0)),
    ]

    engine.build_graph(rooms, doors, auto_link_stairs=True)
    route = engine.compute_route(start_room_id="B_oda")

    assert route.success is True
    assert route.path_nodes == ["B_oda", "B_hol", "B_stair", "Z_stair", "Z_hol", "Z_exit"]
    # Merdiven basamakları üretilmeli
    stair_wps = [wp for wp in route.waypoints if wp.wp_type == WaypointType.STAIR_STEP]
    assert len(stair_wps) >= 2


def test_03_blocked_door_rerouting():
    """
    TEST 03 — Kapalı / geçilemeyen geçiş (usable_in_fire=False):
    Ana koridor kapısı alev/duman nedeniyle kapalıysa karakter o kapıdan geçmez;
    graf üzerindeki alternatif ikinci kaçış kapısını ve koridorunu kullanarak tahliye olur.
    """
    engine = TelAliNavigationEngine()
    rooms = [
        NavRoom(id="R1", name="Oda 1", room_type="oda", floor_level=0, pos=(0.0, 0.0, 0.0)),
        NavRoom(id="C_MAIN", name="Ana Koridor", room_type="kat_koridoru", floor_level=0, pos=(5.0, 0.0, 0.0)),
        NavRoom(id="C_ALT", name="Acil Durum Koridoru", room_type="kat_koridoru", floor_level=0, pos=(0.0, 0.0, 5.0)),
        NavRoom(id="EXIT", name="Dış Çıkış", room_type="dis_cikis", floor_level=0, pos=(5.0, 0.0, 5.0), is_exit=True),
    ]
    doors = [
        NavDoor(id="D_BLOCKED", source="R1", target="C_MAIN", portal_pos=(2.5, 0.0, 0.0), usable_in_fire=False),  # Bloke
        NavDoor(id="D_OPEN", source="R1", target="C_ALT", portal_pos=(0.0, 0.0, 2.5), usable_in_fire=True),     # Açık alternatif
        NavDoor(id="D_EXIT_M", source="C_MAIN", target="EXIT", portal_pos=(5.0, 0.0, 2.5), usable_in_fire=True),
        NavDoor(id="D_EXIT_A", source="C_ALT", target="EXIT", portal_pos=(2.5, 0.0, 5.0), usable_in_fire=True),
    ]

    engine.build_graph(rooms, doors)
    route = engine.compute_route(start_room_id="R1")

    assert route.success is True
    # Bloke kapıdan geçilmemeli!
    door_ids = [wp.door_id for wp in route.waypoints if wp.door_id]
    assert "D_BLOCKED" not in door_ids
    assert "D_OPEN" in door_ids
    assert "C_ALT" in route.path_nodes


def test_04_unreachable_exit_produces_route_not_found():
    """
    TEST 04 — Ulaşılamayan çıkış:
    Odanın çıkışa giden hiçbir kapısı yoksa (veya tüm kapılar kapalıysa),
    simülasyon sonsuz döngüde çalışmaz; doğrudan ROUTE_NOT_FOUND hatası ile FAILED durumuna geçer.
    """
    engine = TelAliNavigationEngine()
    rooms = [
        NavRoom(id="ISOLATED", name="Kilitli Kiler", room_type="oda", floor_level=0, pos=(0.0, 0.0, 0.0)),
        NavRoom(id="EXIT", name="Dış Çıkış", room_type="dis_cikis", floor_level=0, pos=(10.0, 0.0, 0.0), is_exit=True),
    ]
    # Hiçbir kapı yok!
    doors = []

    engine.build_graph(rooms, doors)
    route = engine.compute_route(start_room_id="ISOLATED")

    assert route.success is False
    assert route.state == EvacuationState.FAILED
    assert route.error_code == EvacuationErrorCode.ROUTE_NOT_FOUND
    assert len(route.waypoints) == 0


def test_05_coordinate_transformation_preserves_geometry():
    """
    TEST 05 — Koordinat dönüşümü:
    CAD 2B düzleminden (X, Y) 3B sahneye (X, Y_kat, Z) yapılan koordinat aktarımında
    ve kat ofsetlerinde kapı ile oda mesafelerinin geometrik bütünlüğü korunur.
    """
    engine = TelAliNavigationEngine()
    floor_y = 1 * 3.20  # 1. Kat kotu 3.20m
    rooms = [
        NavRoom(id="K1_salon", name="1. Kat Salon", room_type="salon", floor_level=1, pos=(12.0, floor_y, 4.0)),
        NavRoom(id="K1_exit", name="1. Kat Yangın Merdiveni", room_type="yangin_merdiveni", floor_level=1, pos=(18.0, floor_y, 4.0), is_exit=True),
    ]
    doors = [
        NavDoor(id="D_K1", source="K1_salon", target="K1_exit", portal_pos=(15.0, floor_y, 4.0)),
    ]

    engine.build_graph(rooms, doors)
    route = engine.compute_route(start_room_id="K1_salon")

    assert route.success is True
    # Tüm waypoints Y kotu 3.20m olmalı (aynı kat)
    for wp in route.waypoints:
        assert abs(wp.pos[1] - floor_y) < 1e-4

    # Portal noktası tam olarak X=15, Z=4 olmalı
    portal_wp = next(w for w in route.waypoints if w.wp_type == WaypointType.DOOR_PORTAL)
    assert portal_wp.pos[0] == 15.0
    assert portal_wp.pos[2] == 4.0


def test_06_framerate_independence():
    """
    TEST 06 — Kare hızı bağımsızlığı:
    Aynı güzergâh üzerinde farklı FPS değerlerinde (15 FPS, 30 FPS, 60 FPS)
    karakterin kat ettiği toplam mesafe ve hedefe varış süresi delta-time entegrasyonuyla tutarlı kalır.
    """
    engine = TelAliNavigationEngine(run_speed_mps=4.0)
    rooms = [
        NavRoom(id="R_A", name="Oda A", room_type="oda", floor_level=0, pos=(0.0, 0.0, 0.0)),
        NavRoom(id="EXIT_B", name="Çıkış B", room_type="dis_cikis", floor_level=0, pos=(20.0, 0.0, 0.0), is_exit=True),
    ]
    doors = [
        NavDoor(id="D_AB", source="R_A", target="EXIT_B", portal_pos=(10.0, 0.0, 0.0)),
    ]
    engine.build_graph(rooms, doors)
    route = engine.compute_route(start_room_id="R_A")

    fps_list = [15.0, 30.0, 60.0]
    results = {}

    for fps in fps_list:
        ctrl = EvacuationSimulationController(route, run_speed_mps=4.0)
        ctrl.start_evacuation()
        dt = 1.0 / fps
        steps = 0
        while ctrl.current_state == EvacuationState.EVACUATING and steps < 2000:
            ctrl.step(dt)
            steps += 1
        results[fps] = (ctrl.elapsed_time_sec, ctrl.traveled_distance_m, ctrl.current_state)

    # Her FPS değerinde sonuç EVACUATED olmalı
    for fps, (time_s, dist_m, state) in results.items():
        assert state == EvacuationState.EVACUATED
        # Süreler birbirine çok yakın olmalı (maksimum %3 tolerans)
        assert abs(time_s - results[60.0][0]) < 0.25
        assert abs(dist_m - results[60.0][1]) < 0.15


def test_07_false_success_prevention():
    """
    TEST 07 — Yanlış başarı engeli:
    Karakter henüz bina içindeyken veya son güvenli dış hedef noktasına (MUSTER_POINT)
    ulaşmadan kesinlikle EVACUATED durumuna geçemez.
    """
    engine = TelAliNavigationEngine(run_speed_mps=3.0)
    rooms = [
        NavRoom(id="R1", name="Salon", room_type="salon", floor_level=0, pos=(0.0, 0.0, 0.0)),
        NavRoom(id="EX", name="Dış Kapı", room_type="dis_cikis", floor_level=0, pos=(10.0, 0.0, 0.0), is_exit=True),
    ]
    doors = [
        NavDoor(id="D1", source="R1", target="EX", portal_pos=(5.0, 0.0, 0.0)),
    ]
    engine.build_graph(rooms, doors)
    route = engine.compute_route(start_room_id="R1")

    ctrl = EvacuationSimulationController(route, run_speed_mps=3.0)
    ctrl.start_evacuation()

    # Sadece 1 saniye ilerlet (henüz 3 metre gitti, toplam yol ~13m)
    ctrl.step(1.0)
    assert ctrl.current_state == EvacuationState.EVACUATING
    assert ctrl.current_state != EvacuationState.EVACUATED
    assert ctrl.current_pos[0] < 5.0  # Henüz ilk kapıyı bile geçmedi!


def test_08_ui_status_and_state_machine_alignment():
    """
    TEST 08 — Arayüz doğruluğu:
    Gerçek konum ve durum makinesi kullanıcıya gösterilen açıklamalarla tam uyuşur.
    Karakter odadayken 'Koridorda Koşuyor' yazmaz. Kapıdan geçerken kapı geçişi bilgisi verilir.
    """
    engine = TelAliNavigationEngine(run_speed_mps=2.0)
    rooms = [
        NavRoom(id="R_BED", name="Yatak Odası", room_type="oda", floor_level=0, pos=(0.0, 0.0, 0.0)),
        NavRoom(id="R_COR", name="Kat Koridoru", room_type="kat_koridoru", floor_level=0, pos=(6.0, 0.0, 0.0)),
        NavRoom(id="R_EXIT", name="Bina Çıkışı", room_type="dis_cikis", floor_level=0, pos=(12.0, 0.0, 0.0), is_exit=True),
    ]
    doors = [
        NavDoor(id="D_BED_COR", source="R_BED", target="R_COR", portal_pos=(3.0, 0.0, 0.0)),
        NavDoor(id="D_COR_EX", source="R_COR", target="R_EXIT", portal_pos=(9.0, 0.0, 0.0)),
    ]
    engine.build_graph(rooms, doors)
    route = engine.compute_route(start_room_id="R_BED")

    ctrl = EvacuationSimulationController(route, run_speed_mps=2.0)

    # Başlangıçta PLACED
    assert ctrl.current_state == EvacuationState.PLACED
    assert "Yatak Odası" in ctrl.status_text_tr

    ctrl.start_evacuation()
    assert ctrl.current_state == EvacuationState.EVACUATING
    # İlk hedef kapı
    assert "Kapı" in ctrl.status_text_tr

    # Kapıya kadar ilerlet
    ctrl.step(1.5)  # 3m ilerler, tam D_BED_COR portalına gelir
    assert ctrl.current_pos[0] >= 3.0
    # Kapıdan sonra koridor alanına ulaşıldığı yazmalı
    assert "Kat Koridoru" in ctrl.status_text_tr or "Kapı" in ctrl.status_text_tr
