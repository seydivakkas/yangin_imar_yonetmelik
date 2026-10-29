"""
Binaların Yangından Korunması Hakkında Yönetmelik (BYKHY) ve İlgili Mevzuat Kapsamında
Bina Kullanım Sınıfları, Kaçış Yolları ve Merdivenleri Kural Motoru ve Kontrol Listesi

Telif Hakkı (c) 2026 Seydi Eryılmaz (@seydivakkas) - ÖZEL LİSANS — TÜM HAKLAR SAKLIDIR
"""

import math
from enum import Enum
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field


class BuildingOccupancyType(str, Enum):
    RESIDENTIAL = "konut"                      # Konut Binaları
    HEALTHCARE = "hastane_saglik"             # Sağlık Yapıları (Yataklı Hastane, Huzurevi vb.)
    EDUCATIONAL = "egitim_okul"               # Eğitim Tesisleri (Okul, Anaokulu, Üniversite)
    ACCOMMODATION = "otel_konaklama"          # Otel, Motel, Yurt, Pansiyon
    ASSEMBLY_COMMERCIAL = "toplanma_ticari"   # AVM, Tiyatro, Sinema, Restoran, Ofis
    INDUSTRIAL_STORAGE = "endustri_depo"      # Fabrika, Atölye, Depo, Otopark


@dataclass
class OccupancyFireProfile:
    occupancy_type: BuildingOccupancyType
    title_tr: str
    description_tr: str
    user_load_factor_m2_per_person: float   # Birim kullanıcı alanı (m²/kişi)
    
    # 1. Kaçış Uzaklıkları (BYKHY Ek-5/B & Madde 52-53)
    max_dead_end_non_sprinkler_m: float      # Çıkmaz koridor (sprinklersiz)
    max_dead_end_sprinkler_m: float          # Çıkmaz koridor (sprinklerli)
    max_travel_distance_non_sprinkler_m: float # Azami kaçış mesafesi (sprinklersiz)
    max_travel_distance_sprinkler_m: float     # Azami kaçış mesafesi (sprinklerli)
    
    # 2. Genişlik ve Yükseklik Kriterleri (BYKHY Madde 33, 41, 42)
    min_exit_door_width_cm: float            # Min kaçış kapısı (Genel 80 cm, >50 kişide 100 cm)
    min_exit_door_over_50_cm: float          # 100 cm
    min_corridor_width_cm: float             # Normal koridor (110 cm) veya sedye/eğitim (200 cm)
    min_corridor_height_cm: float            # Koridor net tavan yüksekliği (210 cm)
    min_stair_flight_width_cm: float         # Merdiven kolu genişliği (120 cm veya 140 cm)
    split_stair_width_threshold_cm: float    # 200 cm üzerindeki merdivenler bölünür
    min_clear_headroom_cm: float             # Baş kurtarma dik yüksekliği (210 cm)
    
    # 3. Merdiven Geometrisi ve Fiziksel Ölçütler (BYKHY Madde 40, PAİY Madde 36)
    max_stair_riser_cm: float                # Azami rıht yüksekliği (17.5 cm, kamuda/sağlıkta 16.0 cm)
    min_stair_tread_cm: float                # Asgari basamak basış genişliği (25 cm, kamuda 30 cm)
    min_landing_step_interval: int           # Sahanlık en az kaç basamakta bir (4 basamak)
    max_landing_step_interval: int           # Sahanlık en çok kaç basamakta bir (17 basamak)
    max_landing_elevation_diff_cm: float     # Sahanlıklar arası azami kot farkı (300 cm)
    allow_spiral_stairs: bool                # Dairesel merdivene izin var mı (kullanıcı <= 25, H <= 9.5m)
    allow_balanced_stairs: bool              # Dengelenmiş merdiven izni (H <= 15.5m ve kullanıcı <= 100)
    
    # 4. Yangın Dayanımı ve Korunum (BYKHY Madde 34, 38, 89)
    fire_wall_rating_minutes: int            # Merdiven yuvası duvar dayanımı (120 dakika)
    fire_door_rating_minutes: int            # Merdiven kapısı dayanımı (90 dakika duman sızdırmaz)
    safety_hall_door_rating_minutes: int     # Yangın güvenlik holü kapısı (60 dakika)
    min_safety_hall_area_m2: float           # Asgari yangın güvenlik holü alanı (3.0 m²)
    pressurization_threshold_height_m: float # Pozitif basınçlandırma zorunluluk eşiği (m)
    pressurization_pressure_pa: float        # Basınçlandırma değeri (50 Pa)
    min_natural_vent_window_m2: float        # Tabii havalandırma pencere alanı (1.0 m²)
    
    # 5. Konumlandırma ve Tahliye Güvenliği (BYKHY Madde 48, 51)
    diagonal_ratio_non_sprinkler: float      # Köşegen ayrım oranı (sprinklersiz 0.50)
    diagonal_ratio_sprinkler: float          # Köşegen ayrım oranı (sprinklerli 0.33)
    min_direct_exterior_exit_ratio: float    # Doğrudan dışarı açılan merdiven oranı (%50)
    max_ground_floor_exit_distance_non_sprinkler_m: float # Zemin lobi tahliye mesafesi (10 m)
    max_ground_floor_exit_distance_sprinkler_m: float     # Zemin lobi tahliye mesafesi (15 m)
    requires_horizontal_compartment: bool    # Yatay tahliye alanı zorunluluğu (Hastaneler için True)


OCCUPANCY_PROFILES: Dict[BuildingOccupancyType, OccupancyFireProfile] = {
    BuildingOccupancyType.RESIDENTIAL: OccupancyFireProfile(
        occupancy_type=BuildingOccupancyType.RESIDENTIAL,
        title_tr="Çok Katlı Konut Yapısı",
        description_tr="Apartman, rezidans ve konut blokları. Bağımsız bölümler ve ortak kat holleri.",
        user_load_factor_m2_per_person=20.0,
        max_dead_end_non_sprinkler_m=15.0,
        max_dead_end_sprinkler_m=20.0,
        max_travel_distance_non_sprinkler_m=30.0,
        max_travel_distance_sprinkler_m=60.0,
        min_exit_door_width_cm=80.0,
        min_exit_door_over_50_cm=100.0,
        min_corridor_width_cm=110.0,
        min_corridor_height_cm=210.0,
        min_stair_flight_width_cm=120.0,
        split_stair_width_threshold_cm=200.0,
        min_clear_headroom_cm=210.0,
        max_stair_riser_cm=17.5,
        min_stair_tread_cm=25.0,
        min_landing_step_interval=4,
        max_landing_step_interval=17,
        max_landing_elevation_diff_cm=300.0,
        allow_spiral_stairs=True,
        allow_balanced_stairs=True,
        fire_wall_rating_minutes=120,
        fire_door_rating_minutes=90,
        safety_hall_door_rating_minutes=60,
        min_safety_hall_area_m2=3.0,
        pressurization_threshold_height_m=21.50,
        pressurization_pressure_pa=50.0,
        min_natural_vent_window_m2=1.0,
        diagonal_ratio_non_sprinkler=0.50,
        diagonal_ratio_sprinkler=0.33,
        min_direct_exterior_exit_ratio=0.50,
        max_ground_floor_exit_distance_non_sprinkler_m=10.0,
        max_ground_floor_exit_distance_sprinkler_m=15.0,
        requires_horizontal_compartment=False,
    ),

    BuildingOccupancyType.HEALTHCARE: OccupancyFireProfile(
        occupancy_type=BuildingOccupancyType.HEALTHCARE,
        title_tr="Sağlık Yapısı / Yataklı Hastane",
        description_tr="Yataklı tedavi kurumları, huzurevleri, diyaliz ve doğum merkezleri. Sedye ve hareket kısıtlı hasta tahliyesi.",
        user_load_factor_m2_per_person=15.0,
        max_dead_end_non_sprinkler_m=10.0,
        max_dead_end_sprinkler_m=15.0,
        max_travel_distance_non_sprinkler_m=15.0,
        max_travel_distance_sprinkler_m=25.0,
        min_exit_door_width_cm=100.0,
        min_exit_door_over_50_cm=120.0,
        min_corridor_width_cm=200.0,             # Sedye trafiği için asgari 2.00 metre
        min_corridor_height_cm=240.0,
        min_stair_flight_width_cm=140.0,         # Sedye taşınmasına elverişli merdiven kolu
        split_stair_width_threshold_cm=200.0,
        min_clear_headroom_cm=220.0,
        max_stair_riser_cm=16.0,                 # Kamu ve hastane standardı (max 16 cm)
        min_stair_tread_cm=30.0,                 # Asgari 30 cm basış yüzeyi
        min_landing_step_interval=4,
        max_landing_step_interval=17,
        max_landing_elevation_diff_cm=280.0,
        allow_spiral_stairs=False,               # Hastanelerde dairesel merdiven kaçış yolu olamaz
        allow_balanced_stairs=False,             # Dengelenmiş basamak kesinlikle yasak
        fire_wall_rating_minutes=120,
        fire_door_rating_minutes=90,
        safety_hall_door_rating_minutes=60,
        min_safety_hall_area_m2=6.0,             # Sedye manevrası için genişletilmiş hol
        pressurization_threshold_height_m=15.50, # Hastanelerde daha alçak yükseklikte zorunlu
        pressurization_pressure_pa=50.0,
        min_natural_vent_window_m2=1.5,
        diagonal_ratio_non_sprinkler=0.50,
        diagonal_ratio_sprinkler=0.33,
        min_direct_exterior_exit_ratio=0.50,
        max_ground_floor_exit_distance_non_sprinkler_m=10.0,
        max_ground_floor_exit_distance_sprinkler_m=15.0,
        requires_horizontal_compartment=True,    # Katta en az 2 bağımsız yangın zonu zorunlu
    ),

    BuildingOccupancyType.EDUCATIONAL: OccupancyFireProfile(
        occupancy_type=BuildingOccupancyType.EDUCATIONAL,
        title_tr="Eğitim Tesisi / Okul",
        description_tr="İlk, orta, lise ve üniversite binaları, derslikler ve amfiler. Ani toplu tahliye ve yüksek yoğunluk.",
        user_load_factor_m2_per_person=1.5,      # Dersliklerde kişi başı 1.5 - 2 m²
        max_dead_end_non_sprinkler_m=10.0,
        max_dead_end_sprinkler_m=15.0,
        max_travel_distance_non_sprinkler_m=20.0,
        max_travel_distance_sprinkler_m=35.0,
        min_exit_door_width_cm=90.0,
        min_exit_door_over_50_cm=120.0,
        min_corridor_width_cm=200.0,             # Teneffüs yığılmaları için ana koridor min 2.00m
        min_corridor_height_cm=240.0,
        min_stair_flight_width_cm=140.0,         # Hızlı iniş için geniş merdiven kolu
        split_stair_width_threshold_cm=200.0,
        min_clear_headroom_cm=220.0,
        max_stair_riser_cm=16.0,                 # Okullarda basamak yüksekliği max 16 cm
        min_stair_tread_cm=30.0,                 # Basamak genişliği min 30 cm
        min_landing_step_interval=4,
        max_landing_step_interval=17,
        max_landing_elevation_diff_cm=280.0,
        allow_spiral_stairs=False,               # Okullarda dairesel merdiven yasaktır
        allow_balanced_stairs=False,
        fire_wall_rating_minutes=120,
        fire_door_rating_minutes=90,
        safety_hall_door_rating_minutes=60,
        min_safety_hall_area_m2=4.0,
        pressurization_threshold_height_m=21.50,
        pressurization_pressure_pa=50.0,
        min_natural_vent_window_m2=1.0,
        diagonal_ratio_non_sprinkler=0.50,
        diagonal_ratio_sprinkler=0.33,
        min_direct_exterior_exit_ratio=0.50,
        max_ground_floor_exit_distance_non_sprinkler_m=10.0,
        max_ground_floor_exit_distance_sprinkler_m=15.0,
        requires_horizontal_compartment=False,
    ),

    BuildingOccupancyType.ACCOMMODATION: OccupancyFireProfile(
        occupancy_type=BuildingOccupancyType.ACCOMMODATION,
        title_tr="Otel / Konaklama Tesisi",
        description_tr="Otel, motel, tatil köyü, pansiyon ve öğrenci yurtları. Uyuyan kullanıcı yükü ve mekan oryantasyon eksikliği.",
        user_load_factor_m2_per_person=15.0,
        max_dead_end_non_sprinkler_m=10.0,
        max_dead_end_sprinkler_m=15.0,
        max_travel_distance_non_sprinkler_m=20.0,
        max_travel_distance_sprinkler_m=35.0,
        min_exit_door_width_cm=90.0,
        min_exit_door_over_50_cm=100.0,
        min_corridor_width_cm=150.0,             # Çift sıra oda koridoru min 1.50 m
        min_corridor_height_cm=220.0,
        min_stair_flight_width_cm=120.0,
        split_stair_width_threshold_cm=200.0,
        min_clear_headroom_cm=210.0,
        max_stair_riser_cm=17.5,
        min_stair_tread_cm=28.0,
        min_landing_step_interval=4,
        max_landing_step_interval=17,
        max_landing_elevation_diff_cm=300.0,
        allow_spiral_stairs=False,
        allow_balanced_stairs=False,
        fire_wall_rating_minutes=120,
        fire_door_rating_minutes=90,
        safety_hall_door_rating_minutes=60,
        min_safety_hall_area_m2=3.0,
        pressurization_threshold_height_m=21.50,
        pressurization_pressure_pa=50.0,
        min_natural_vent_window_m2=1.0,
        diagonal_ratio_non_sprinkler=0.50,
        diagonal_ratio_sprinkler=0.33,
        min_direct_exterior_exit_ratio=0.50,
        max_ground_floor_exit_distance_non_sprinkler_m=10.0,
        max_ground_floor_exit_distance_sprinkler_m=15.0,
        requires_horizontal_compartment=False,
    ),

    BuildingOccupancyType.ASSEMBLY_COMMERCIAL: OccupancyFireProfile(
        occupancy_type=BuildingOccupancyType.ASSEMBLY_COMMERCIAL,
        title_tr="Toplanma ve Ticari Amaçlı Yapılar",
        description_tr="AVM, sinema, tiyatro, spor salonu, restoran ve çok ofisli iş merkezleri. Hızlı panik riski ve yüksek kütle akışı.",
        user_load_factor_m2_per_person=2.5,
        max_dead_end_non_sprinkler_m=10.0,
        max_dead_end_sprinkler_m=15.0,
        max_travel_distance_non_sprinkler_m=25.0,
        max_travel_distance_sprinkler_m=45.0,
        min_exit_door_width_cm=100.0,
        min_exit_door_over_50_cm=140.0,          # Çift kanat panik barlı kapı
        min_corridor_width_cm=200.0,
        min_corridor_height_cm=240.0,
        min_stair_flight_width_cm=140.0,
        split_stair_width_threshold_cm=200.0,
        min_clear_headroom_cm=220.0,
        max_stair_riser_cm=16.5,
        min_stair_tread_cm=28.0,
        min_landing_step_interval=4,
        max_landing_step_interval=17,
        max_landing_elevation_diff_cm=300.0,
        allow_spiral_stairs=False,
        allow_balanced_stairs=False,
        fire_wall_rating_minutes=120,
        fire_door_rating_minutes=90,
        safety_hall_door_rating_minutes=60,
        min_safety_hall_area_m2=4.0,
        pressurization_threshold_height_m=21.50,
        pressurization_pressure_pa=50.0,
        min_natural_vent_window_m2=1.0,
        diagonal_ratio_non_sprinkler=0.50,
        diagonal_ratio_sprinkler=0.33,
        min_direct_exterior_exit_ratio=0.50,
        max_ground_floor_exit_distance_non_sprinkler_m=10.0,
        max_ground_floor_exit_distance_sprinkler_m=15.0,
        requires_horizontal_compartment=False,
    ),

    BuildingOccupancyType.INDUSTRIAL_STORAGE: OccupancyFireProfile(
        occupancy_type=BuildingOccupancyType.INDUSTRIAL_STORAGE,
        title_tr="Endüstriyel Yapı ve Depo",
        description_tr="Fabrika, üretim atölyesi, kapalı otopark ve lojistik depolar. Yüksek yangın yükü ve duman emisyonu.",
        user_load_factor_m2_per_person=10.0,
        max_dead_end_non_sprinkler_m=15.0,
        max_dead_end_sprinkler_m=20.0,
        max_travel_distance_non_sprinkler_m=25.0,
        max_travel_distance_sprinkler_m=45.0,
        min_exit_door_width_cm=90.0,
        min_exit_door_over_50_cm=120.0,
        min_corridor_width_cm=150.0,
        min_corridor_height_cm=240.0,
        min_stair_flight_width_cm=120.0,
        split_stair_width_threshold_cm=200.0,
        min_clear_headroom_cm=210.0,
        max_stair_riser_cm=17.5,
        min_stair_tread_cm=25.0,
        min_landing_step_interval=4,
        max_landing_step_interval=17,
        max_landing_elevation_diff_cm=300.0,
        allow_spiral_stairs=False,
        allow_balanced_stairs=False,
        fire_wall_rating_minutes=120,
        fire_door_rating_minutes=90,
        safety_hall_door_rating_minutes=60,
        min_safety_hall_area_m2=3.0,
        pressurization_threshold_height_m=21.50,
        pressurization_pressure_pa=50.0,
        min_natural_vent_window_m2=1.0,
        diagonal_ratio_non_sprinkler=0.50,
        diagonal_ratio_sprinkler=0.33,
        min_direct_exterior_exit_ratio=0.50,
        max_ground_floor_exit_distance_non_sprinkler_m=10.0,
        max_ground_floor_exit_distance_sprinkler_m=15.0,
        requires_horizontal_compartment=False,
    ),
}


@dataclass
class ChecklistVerificationItem:
    item_id: str
    category_id: str
    title_tr: str
    legal_basis: str
    mandatory_rule: str
    target_value_str: str
    actual_value_str: str
    is_compliant: bool
    severity: str                   # 'CRITICAL', 'MAJOR', 'WARNING', 'INFO'
    design_remedy_tr: str
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ComprehensiveBuildingChecklistReport:
    building_occupancy: BuildingOccupancyType
    occupancy_title: str
    sprinkler_enabled: bool
    building_height_m: float
    total_floors: int
    is_high_rise: bool
    total_checks: int
    passed_checks: int
    failed_checks: int
    compliance_score_percent: float
    categories: Dict[str, List[ChecklistVerificationItem]]
    critical_violations: List[ChecklistVerificationItem]


def evaluate_building_checklist(
    occupancy_type: BuildingOccupancyType,
    sprinkler_enabled: bool,
    building_height_m: float,
    total_floors: int,
    floor_area_m2: float = 650.0,
    measured_data: Optional[Dict[str, Any]] = None
) -> ComprehensiveBuildingChecklistReport:
    """
    Belirli bir bina kullanım sınıfı ve ölçülen/topolojik parametrelere göre
    BYKHY 5 ana tasarım kriteri üzerinden tam teşekküllü denetim listesi üretir.
    """
    profile = OCCUPANCY_PROFILES.get(occupancy_type, OCCUPANCY_PROFILES[BuildingOccupancyType.RESIDENTIAL])
    is_high_rise = (building_height_m >= profile.pressurization_threshold_height_m) or (total_floors >= 8)
    data = measured_data or {}

    # Ölçülen veya varsayılan değerler
    actual_stairs_count = int(data.get("stairs_count", 2 if is_high_rise else 1))
    actual_dead_end_m = float(data.get("dead_end_m", 12.0))
    actual_travel_dist_m = float(data.get("travel_distance_m", 24.5))
    actual_corridor_w_cm = float(data.get("corridor_width_cm", 120.0))
    actual_corridor_h_cm = float(data.get("corridor_height_cm", 220.0))
    actual_door_w_cm = float(data.get("door_width_cm", 95.0))
    actual_stair_flight_w_cm = float(data.get("stair_flight_width_cm", 125.0))
    actual_riser_cm = float(data.get("stair_riser_cm", 16.5))
    actual_tread_cm = float(data.get("stair_tread_cm", 28.5))
    actual_headroom_cm = float(data.get("headroom_cm", 215.0))
    actual_landing_steps = int(data.get("landing_steps", 16))
    actual_has_spiral = bool(data.get("has_spiral_stairs", False))
    actual_has_balanced = bool(data.get("has_balanced_stairs", False))
    actual_fire_wall_minutes = int(data.get("fire_wall_minutes", 120))
    actual_fire_door_minutes = int(data.get("fire_door_minutes", 90))
    actual_has_safety_hall = bool(data.get("has_safety_hall", True))
    actual_safety_hall_area_m2 = float(data.get("safety_hall_area_m2", 3.2))
    actual_has_pressurization = bool(data.get("has_pressurization", True if is_high_rise else False))
    actual_has_banned_equipment = bool(data.get("has_banned_equipment_in_shaft", False))
    actual_stairs_distance_ratio = float(data.get("stairs_distance_ratio", 0.38))
    actual_direct_exterior_exit_ratio = float(data.get("direct_exterior_exit_ratio", 0.50))
    actual_ground_floor_exit_m = float(data.get("ground_floor_exit_distance_m", 9.2))
    actual_doors_unlocked_outward = bool(data.get("doors_unlocked_and_outward", True))
    actual_has_horizontal_comp = bool(data.get("has_horizontal_compartment", True if profile.requires_horizontal_compartment else False))

    categories: Dict[str, List[ChecklistVerificationItem]] = {
        "1_genel_parametreler": [],
        "2_genislik_yukseklik": [],
        "3_merdiven_geometrisi": [],
        "4_yangin_dayanimi_tesisat": [],
        "5_konumlandirma_tahliye": []
    }

    # =========================================================================
    # KATEGORİ 1: GENEL TASARIM VE KULLANICI YÜKÜ ESASLARI
    # =========================================================================
    calculated_user_load = math.ceil(floor_area_m2 / profile.user_load_factor_m2_per_person)
    required_stairs = 1
    if is_high_rise or calculated_user_load > 100:
        required_stairs = 2
    if calculated_user_load > 500:
        required_stairs = 3
    if calculated_user_load > 1000:
        required_stairs = 4

    # 1.1 Merdiven Sayısı
    c1_1 = ChecklistVerificationItem(
        item_id="CHK-1.1",
        category_id="1_genel_parametreler",
        title_tr="Asgari Bağımsız Kaçış Merdiveni Sayısı",
        legal_basis="BYKHY Madde 31 & Madde 48",
        mandatory_rule=f"Yüksek bina ({building_height_m:.1f}m) veya kat kullanıcı yükü ({calculated_user_load} kişi) esaslarına göre en az {required_stairs} adet bağımsız yangın merdiveni zorunludur.",
        target_value_str=f"En az {required_stairs} adet",
        actual_value_str=f"{actual_stairs_count} adet tespit edildi",
        is_compliant=actual_stairs_count >= required_stairs,
        severity="CRITICAL" if actual_stairs_count < required_stairs else "INFO",
        design_remedy_tr="Kat planına duman sızdırmaz, zıt aksta konumlandırılmış ilave bir kaçış merdiveni kovanı eklenmelidir."
    )
    categories["1_genel_parametreler"].append(c1_1)

    # 1.2 Çıkmaz Koridor Mesafesi
    allowed_dead_end = profile.max_dead_end_sprinkler_m if sprinkler_enabled else profile.max_dead_end_non_sprinkler_m
    c1_2 = ChecklistVerificationItem(
        item_id="CHK-1.2",
        category_id="1_genel_parametreler",
        title_tr=f"Tek Yönlü Kaçış / Çıkmaz Koridor Sınırı ({profile.title_tr})",
        legal_basis="BYKHY Madde 52 & Ek-5/B",
        mandatory_rule=f"{'Sprinklerli' if sprinkler_enabled else 'Sprinklersiz'} sistemde {profile.title_tr} için çıkmaz koridor derinliği azami {allowed_dead_end:.1f} m olabilir.",
        target_value_str=f"≤ {allowed_dead_end:.1f} m",
        actual_value_str=f"{actual_dead_end_m:.1f} m",
        is_compliant=actual_dead_end_m <= allowed_dead_end,
        severity="CRITICAL" if actual_dead_end_m > allowed_dead_end else "INFO",
        design_remedy_tr=f"Çıkmaz koridor ucundaki mekanlar için alternatif çıkış kapısı açılmalı veya koridor derinliği {allowed_dead_end:.1f}m altına çekilmelidir."
    )
    categories["1_genel_parametreler"].append(c1_2)

    # 1.3 Azami Kaçış Mesafesi
    allowed_travel_m = profile.max_travel_distance_sprinkler_m if sprinkler_enabled else profile.max_travel_distance_non_sprinkler_m
    c1_3 = ChecklistVerificationItem(
        item_id="CHK-1.3",
        category_id="1_genel_parametreler",
        title_tr="En Uzak Noktadan Yangın Merdivenine Azami Kaçış Mesafesi",
        legal_basis="BYKHY Madde 52 & Madde 53",
        mandatory_rule=f"{profile.title_tr} kullanım sınıfında en uzak noktadan korunumlu merdiven kapısına geodezik yürüyüş mesafesi en fazla {allowed_travel_m:.1f} m olabilir.",
        target_value_str=f"≤ {allowed_travel_m:.1f} m",
        actual_value_str=f"{actual_travel_dist_m:.1f} m",
        is_compliant=actual_travel_dist_m <= allowed_travel_m,
        severity="CRITICAL" if actual_travel_dist_m > allowed_travel_m else "INFO",
        design_remedy_tr="Kaçış hattı boyunca koridor aksları kısaltılmalı veya bloğun uzak aksına ilave bir acil çıkış merdiveni yerleştirilmelidir."
    )
    categories["1_genel_parametreler"].append(c1_3)

    # =========================================================================
    # KATEGORİ 2: GENİŞLİK VE YÜKSEKLİK KRİTERLERİ (NET GEÇİŞLER)
    # =========================================================================
    # 2.1 Kapı Genişliği
    req_door_w = profile.min_exit_door_over_50_cm if calculated_user_load > 50 else profile.min_exit_door_width_cm
    c2_1 = ChecklistVerificationItem(
        item_id="CHK-2.1",
        category_id="2_genislik_yukseklik",
        title_tr="Kaçış Kapıları Net (Temiz) Geçiş Genişliği",
        legal_basis="BYKHY Madde 33",
        mandatory_rule=f"Hiçbir çıkış kapısı 80 cm'den dar olamaz. Kat kullanıcısı >50 ({calculated_user_load} kişi) veya {profile.title_tr} standardında en az {req_door_w:.0f} cm temiz genişlik aranır.",
        target_value_str=f"≥ {req_door_w:.0f} cm",
        actual_value_str=f"{actual_door_w_cm:.1f} cm",
        is_compliant=actual_door_w_cm >= req_door_w,
        severity="CRITICAL" if actual_door_w_cm < req_door_w else "INFO",
        design_remedy_tr=f"Kapı kanadı ve kasası net temiz açıklığı {req_door_w:.0f} cm sağlayacak şekilde mimari paftada genişletilmelidir."
    )
    categories["2_genislik_yukseklik"].append(c2_1)

    # 2.2 Koridor Genişliği ve Yüksekliği
    c2_2 = ChecklistVerificationItem(
        item_id="CHK-2.2",
        category_id="2_genislik_yukseklik",
        title_tr="Genel Koridor Temiz Genişliği ve Net Tavan Yüksekliği",
        legal_basis="BYKHY Madde 42 & PAİY Madde 36",
        mandatory_rule=f"{profile.title_tr} yapısında koridor temiz genişliği en az {profile.min_corridor_width_cm:.0f} cm, net asma tavan altı yüksekliği en az {profile.min_corridor_height_cm:.0f} cm olmalıdır.",
        target_value_str=f"Genişlik ≥ {profile.min_corridor_width_cm:.0f} cm, Yükseklik ≥ {profile.min_corridor_height_cm:.0f} cm",
        actual_value_str=f"Genişlik: {actual_corridor_w_cm:.1f} cm, Yükseklik: {actual_corridor_h_cm:.1f} cm",
        is_compliant=(actual_corridor_w_cm >= profile.min_corridor_width_cm and actual_corridor_h_cm >= profile.min_corridor_height_cm),
        severity="MAJOR" if actual_corridor_w_cm < profile.min_corridor_width_cm else "INFO",
        design_remedy_tr=f"Koridor duvarları çekilmeli, asma tavan ve tesisat kanalları net 210+ cm bırakılacak şekilde revize edilmelidir."
    )
    categories["2_genislik_yukseklik"].append(c2_2)

    # 2.3 Merdiven Kol Genişliği ve Bölünme
    c2_3 = ChecklistVerificationItem(
        item_id="CHK-2.3",
        category_id="2_genislik_yukseklik",
        title_tr="Kaçış Merdiveni Kolu Temiz Genişliği",
        legal_basis="BYKHY Madde 41",
        mandatory_rule=f"Merdiven kolu temiz genişliği {profile.title_tr} standardında en az {profile.min_stair_flight_width_cm:.0f} cm olmalıdır. 200 cm'yi aşan merdivenler korkulukla bölünmelidir.",
        target_value_str=f"≥ {profile.min_stair_flight_width_cm:.0f} cm (Maks tek parça 200 cm)",
        actual_value_str=f"{actual_stair_flight_w_cm:.1f} cm",
        is_compliant=actual_stair_flight_w_cm >= profile.min_stair_flight_width_cm,
        severity="CRITICAL" if actual_stair_flight_w_cm < profile.min_stair_flight_width_cm else "INFO",
        design_remedy_tr=f"Merdiven kova aksı ve kol genişliği net {profile.min_stair_flight_width_cm:.0f} cm olacak biçimde açılmalıdır."
    )
    categories["2_genislik_yukseklik"].append(c2_3)

    # =========================================================================
    # KATEGORİ 3: MERDİVEN GEOMETRİSİ VE FİZİKSEL ÖLÇÜTLER
    # =========================================================================
    # 3.1 Rıht ve Basış Ölçüleri
    blondel = 2 * actual_riser_cm + actual_tread_cm
    blondel_ok = 60.0 <= blondel <= 64.0
    geom_ok = (actual_riser_cm <= profile.max_stair_riser_cm) and (actual_tread_cm >= profile.min_stair_tread_cm) and blondel_ok
    c3_1 = ChecklistVerificationItem(
        item_id="CHK-3.1",
        category_id="3_merdiven_geometrisi",
        title_tr="Basamak Yüksekliği (Rıht) ve Basış Genişliği (Blondel)",
        legal_basis="BYKHY Madde 40 & PAİY Madde 36",
        mandatory_rule=f"Rıht ≤ {profile.max_stair_riser_cm:.1f} cm, Basış ≥ {profile.min_stair_tread_cm:.1f} cm ve 2R+B = 60..64 cm Blondel ergonomi formülü sağlanmalıdır.",
        target_value_str=f"R ≤ {profile.max_stair_riser_cm:.1f} cm, B ≥ {profile.min_stair_tread_cm:.1f} cm",
        actual_value_str=f"R={actual_riser_cm:.1f} cm, B={actual_tread_cm:.1f} cm (2R+B={blondel:.1f} cm)",
        is_compliant=geom_ok,
        severity="MAJOR" if not geom_ok else "INFO",
        design_remedy_tr="Basamak rıht ve basış ölçüleri kat yüksekliği basamak sayısına bölünerek yeniden modüllendirilmelidir."
    )
    categories["3_merdiven_geometrisi"].append(c3_1)

    # 3.2 Baş Kurtarma Yüksekliği
    c3_2 = ChecklistVerificationItem(
        item_id="CHK-3.2",
        category_id="3_merdiven_geometrisi",
        title_tr="Merdiven Baş Kurtarma Yüksekliği",
        legal_basis="BYKHY Madde 40",
        mandatory_rule="Basamak üzerinden ölçülen dik baş kurtarma yüksekliği en az 210 cm olmalıdır.",
        target_value_str="≥ 210.0 cm",
        actual_value_str=f"{actual_headroom_cm:.1f} cm",
        is_compliant=actual_headroom_cm >= 210.0,
        severity="CRITICAL" if actual_headroom_cm < 210.0 else "INFO",
        design_remedy_tr="Üst merdiven kolu veya döşeme plağı yırtığı açılarak dik yükseklik en az 210 cm seviyesine yükseltilmelidir."
    )
    categories["3_merdiven_geometrisi"].append(c3_2)

    # 3.3 Sahanlık Düzenlemesi ve Basamak Sayısı
    landing_ok = (profile.min_landing_step_interval <= actual_landing_steps <= profile.max_landing_step_interval)
    c3_3 = ChecklistVerificationItem(
        item_id="CHK-3.3",
        category_id="3_merdiven_geometrisi",
        title_tr="Sahanlık Düzenlemesi ve Basamak Sayısı Sınırı",
        legal_basis="BYKHY Madde 41",
        mandatory_rule="Merdiven kollarında her döşeme düzeyinde en az 4, en çok 17 basamakta bir ara sahanlık düzenlenmeli; sahanlıklar arası kot farkı en çok 300 cm olmalıdır.",
        target_value_str="4 - 17 basamak / Kot farkı ≤ 300 cm",
        actual_value_str=f"{actual_landing_steps} basamakta bir sahanlık",
        is_compliant=landing_ok,
        severity="MAJOR" if not landing_ok else "INFO",
        design_remedy_tr="17 basamağı aşan kollara en az kol genişliği (120+ cm) kadar derinliğe sahip bir ara sahanlık ilave edilmelidir."
    )
    categories["3_merdiven_geometrisi"].append(c3_3)

    # 3.4 Özel Merdiven Tipleri Yasağı (Dengelenmiş ve Dairesel)
    special_stair_ok = True
    special_stair_msg = "Uygun (Düz Kollu Merdiven)"
    if actual_has_balanced and (is_high_rise or calculated_user_load > 100 or not profile.allow_balanced_stairs):
        special_stair_ok = False
        special_stair_msg = "YASAK: Yüksek bina / >100 kullanıcı / Kamu yapısında dengelenmiş merdiven tespit edildi"
    elif actual_has_spiral and not profile.allow_spiral_stairs:
        special_stair_ok = False
        special_stair_msg = "YASAK: Bu kullanım sınıfında dairesel merdiven kaçış yolu olarak kullanılamaz"

    c3_4 = ChecklistVerificationItem(
        item_id="CHK-3.4",
        category_id="3_merdiven_geometrisi",
        title_tr="Dengelenmiş ve Dairesel Merdiven Kısıtlaması",
        legal_basis="BYKHY Madde 43",
        mandatory_rule=f"Bina yüksekliği >15.50m veya kullanıcı >100 kişide dengelenmiş merdiven yasaktır. {profile.title_tr} yapısında düz sahanlıklı merdiven mecburidir.",
        target_value_str="Dengelenmiş/dairesel yasak, düz kollu sahanlıklı",
        actual_value_str=special_stair_msg,
        is_compliant=special_stair_ok,
        severity="CRITICAL" if not special_stair_ok else "INFO",
        design_remedy_tr="Döner basamaklar iptal edilmeli, dik sahanlıklı betonarme kaçış merdiveni geometrisine geçilmelidir."
    )
    categories["3_merdiven_geometrisi"].append(c3_4)

    # =========================================================================
    # KATEGORİ 4: YANGIN DAYANIMI, KORUNMA VE TESİSAT KRİTERLERİ
    # =========================================================================
    # 4.1 Merdiven Kovanı Yangın Dayanımı (120 dk duvar, 90 dk kapı)
    fire_rating_ok = (actual_fire_wall_minutes >= 120 and actual_fire_door_minutes >= 90)
    c4_1 = ChecklistVerificationItem(
        item_id="CHK-4.1",
        category_id="4_yangin_dayanimi_tesisat",
        title_tr="Merdiven Kovanı ve Kapılarının Yangın / Duman Dayanımı",
        legal_basis="BYKHY Madde 38 & Madde 34",
        mandatory_rule="Merdiven yuvaları en az 120 dakika (REI120) yangına dayanıklı duvarlarla ve en az 90 dakika (EI90) duman sızdırmaz kapılarla ayrılmalıdır.",
        target_value_str="Duvar ≥ 120 dk, Kapı ≥ 90 dk duman sızdırmaz",
        actual_value_str=f"Duvar: {actual_fire_wall_minutes} dk, Kapı: {actual_fire_door_minutes} dk",
        is_compliant=fire_rating_ok,
        severity="CRITICAL" if not fire_rating_ok else "INFO",
        design_remedy_tr="Merdiven kovanı duvarları REI120 betonarme/gazbeton olarak etiketlenmeli, kapılar EI90 sertifikalı duman fitilli panik barlı kapıya dönüştürülmelidir."
    )
    categories["4_yangin_dayanimi_tesisat"].append(c4_1)

    # 4.2 Yangın Güvenlik Holü ve Basınçlandırma
    req_safety_hall = is_high_rise or profile.requires_horizontal_compartment
    safety_hall_ok = True
    if req_safety_hall:
        if not actual_has_safety_hall or actual_safety_hall_area_m2 < profile.min_safety_hall_area_m2:
            safety_hall_ok = False

    c4_2 = ChecklistVerificationItem(
        item_id="CHK-4.2",
        category_id="4_yangin_dayanimi_tesisat",
        title_tr="Yangın Güvenlik Holü ve Pozitif Basınçlandırma (50 Pa)",
        legal_basis="BYKHY Madde 34 & Madde 89",
        mandatory_rule=f"Yüksek binalarda ({building_height_m:.1f}m ≥ {profile.pressurization_threshold_height_m}m) yangın merdiveni önünde min {profile.min_safety_hall_area_m2:.1f} m² yangın holü ve kovanda 50 Pa pozitif basınçlandırma zorunludur.",
        target_value_str=f"Hol ≥ {profile.min_safety_hall_area_m2:.1f} m², Basınçlandırma = 50 Pa",
        actual_value_str=f"Hol: {actual_safety_hall_area_m2:.1f} m² ({'Var' if actual_has_safety_hall else 'YOK'}), Basınçlandırma: {'Aktif' if actual_has_pressurization else 'YOK'}",
        is_compliant=safety_hall_ok and (not is_high_rise or actual_has_pressurization),
        severity="CRITICAL" if not (safety_hall_ok and (not is_high_rise or actual_has_pressurization)) else "INFO",
        design_remedy_tr="Merdiven girişi önüne min 3.0 m² güvenlik holü çizilmeli ve mekanik duman tahliyesi/basınçlandırma şaftı ayrılmalıdır."
    )
    categories["4_yangin_dayanimi_tesisat"].append(c4_2)

    # 4.3 Kaçış Yollarında Yasaklı Cihazlar
    c4_3 = ChecklistVerificationItem(
        item_id="CHK-4.3",
        category_id="4_yangin_dayanimi_tesisat",
        title_tr="Kaçış Merdiveni ve Holünde Yasaklı Cihaz / Sayaç Denetimi",
        legal_basis="BYKHY Madde 41 & Madde 34",
        mandatory_rule="Kaçış merdiveni yuvasına ve yangın güvenlik holüne sayaçlar, kombi, iklimlendirme dış üniteleri, elektrik ve mekanik tesisat şaft kapakları yerleştirilemez.",
        target_value_str="Sıfır sayaç/cihaz/şaft kapağı geçişi",
        actual_value_str="Yasaklı cihaz veya tesisat kapağı tespit edildi" if actual_has_banned_equipment else "Temiz kovan (İhlal yok)",
        is_compliant=not actual_has_banned_equipment,
        severity="CRITICAL" if actual_has_banned_equipment else "INFO",
        design_remedy_tr="Sayaç ve tesisat şaft kapakları merdiven kovanı ve holünün dışına, genel kat koridoruna taşınmalıdır."
    )
    categories["4_yangin_dayanimi_tesisat"].append(c4_3)

    # 4.4 Yatay Yangın Kompartımanı (Sağlık Yapıları vb.)
    if profile.requires_horizontal_compartment:
        c4_4 = ChecklistVerificationItem(
            item_id="CHK-4.4",
            category_id="4_yangin_dayanimi_tesisat",
            title_tr="Yataklı Sağlık Yapılarında Yatay Yangın Kompartımanı",
            legal_basis="BYKHY Madde 49 & Madde 62",
            mandatory_rule="Hastanelerde hasta yatak katları her biri en az 30 m² alana sahip en az iki bağımsız yangın kompartımanına (zonuna) bölünmelidir.",
            target_value_str="Katta en az 2 bağımsız yangın kompartımanı",
            actual_value_str="Yatay yangın kompartımanı mevcut" if actual_has_horizontal_comp else "Eksik / Tek yangın zonu",
            is_compliant=actual_has_horizontal_comp,
            severity="CRITICAL" if not actual_has_horizontal_comp else "INFO",
            design_remedy_tr="Kat planı duman sızdırmaz EI60 çift kanatlı otomatik kapanan manyetik kapılarla iki bağımsız tahliye zonuna bölünmelidir."
        )
        categories["4_yangin_dayanimi_tesisat"].append(c4_4)

    # =========================================================================
    # KATEGORİ 5: KONUMLANDIRMA VE TAHLİYE GÜVENLİĞİ
    # =========================================================================
    # 5.1 Alternatif Konumlandırma (Köşegen Kuralı)
    req_ratio = profile.diagonal_ratio_sprinkler if sprinkler_enabled else profile.diagonal_ratio_non_sprinkler
    diag_ok = actual_stairs_distance_ratio >= req_ratio
    c5_1 = ChecklistVerificationItem(
        item_id="CHK-5.1",
        category_id="5_konumlandirma_tahliye",
        title_tr="Merdivenlerin Birbirine Alternatif Olması (Köşegen / Diyagonal Kuralı)",
        legal_basis="BYKHY Madde 48",
        mandatory_rule=f"İki kaçış merdiveni arasındaki kuş uçuşu mesafe, kat köşegeninin en az {'1/3' if sprinkler_enabled else '1/2'}'i ({req_ratio:.2f}) kadar olmalı; merdivenler yan yana yapılamaz.",
        target_value_str=f"Mesafe Oranı ≥ {req_ratio:.2f} (Diyagonalin {'1/3' if sprinkler_enabled else '1/2'}'i)",
        actual_value_str=f"Ölçülen oran: {actual_stairs_distance_ratio:.2f}",
        is_compliant=diag_ok,
        severity="MAJOR" if not diag_ok else "INFO",
        design_remedy_tr="Merdiven çekirdekleri bloğun tek bir aksına toplanmamalı; doğu-batı veya kuzey-güney zıt uçlarına dağıtılmalıdır."
    )
    categories["5_konumlandirma_tahliye"].append(c5_1)

    # 5.2 Doğrudan Dışarı Açılma Oranı (Min %50)
    ext_exit_ok = actual_direct_exterior_exit_ratio >= profile.min_direct_exterior_exit_ratio
    c5_2 = ChecklistVerificationItem(
        item_id="CHK-5.2",
        category_id="5_konumlandirma_tahliye",
        title_tr="Merdivenlerin Doğrudan Bina Dışına Açılma Oranı",
        legal_basis="BYKHY Madde 41",
        mandatory_rule="Kaçış merdivenlerinin kapasite ve sayı bakımından en az yarısının (≥%50) doğrudan bina dışına açılması şarttır.",
        target_value_str=f"≥ %{profile.min_direct_exterior_exit_ratio*100:.0f} doğrudan dış açık alan",
        actual_value_str=f"%{actual_direct_exterior_exit_ratio*100:.0f} dışarı açılıyor",
        is_compliant=ext_exit_ok,
        severity="CRITICAL" if not ext_exit_ok else "INFO",
        design_remedy_tr="En az bir yangın merdiveninin zemin katta lobiye uğramadan doğrudan bahçeye/sokağa çıkışı sağlanmalıdır."
    )
    categories["5_konumlandirma_tahliye"].append(c5_2)

    # 5.3 Zemin Kat Lobi Tahliye Mesafesi (10 m / 15 m)
    allowed_ground_exit = profile.max_ground_floor_exit_distance_sprinkler_m if sprinkler_enabled else profile.max_ground_floor_exit_distance_non_sprinkler_m
    ground_exit_ok = actual_ground_floor_exit_m <= allowed_ground_exit
    c5_3 = ChecklistVerificationItem(
        item_id="CHK-5.3",
        category_id="5_konumlandirma_tahliye",
        title_tr="Zemin Kat Hol / Lobi Tahliye Mesafesi",
        legal_basis="BYKHY Madde 41 & Madde 53",
        mandatory_rule=f"Merdiven zemin kattaki lobiye iniyorsa, merdiven ayağı ile dış açık alan arasındaki uzaklık en fazla {allowed_ground_exit:.0f} m olabilir.",
        target_value_str=f"≤ {allowed_ground_exit:.0f} m",
        actual_value_str=f"{actual_ground_floor_exit_m:.1f} m",
        is_compliant=ground_exit_ok,
        severity="MAJOR" if not ground_exit_ok else "INFO",
        design_remedy_tr="Zemin lobi koridoru kısaltılmalı veya merdiven kovanına dış duvardan doğrudan bahçe çıkış kapısı açılmalıdır."
    )
    categories["5_konumlandirma_tahliye"].append(c5_3)

    # 5.4 Engelsiz ve Kilitsiz Geçiş (Kaçış Yönünde Açılma)
    c5_4 = ChecklistVerificationItem(
        item_id="CHK-5.4",
        category_id="5_konumlandirma_tahliye",
        title_tr="Engelsiz ve Geçişe Uygun Olma (Kilit Yasağı ve Panik Bar)",
        legal_basis="BYKHY Madde 33",
        mandatory_rule="Kaçış yolları ve kapıları üzerinde kilit veya sürgü bulunmamalı, kapılar kaçış yönüne doğru kolayca açılabilecek panik barlı tasarlanmalıdır.",
        target_value_str="Kilit/sürgü yok, kaçış yönünde açılış, panik bar",
        actual_value_str="Panik barlı kaçış kapısı standardı sağlandı" if actual_doors_unlocked_outward else "Kilit veya ters açılış riski",
        is_compliant=actual_doors_unlocked_outward,
        severity="CRITICAL" if not actual_doors_unlocked_outward else "INFO",
        design_remedy_tr="Tüm kaçış kapıları dışa doğru açılmalı ve elektromanyetik panik bar mekanizması ile teçhiz edilmelidir."
    )
    categories["5_konumlandirma_tahliye"].append(c5_4)

    # Özetleme
    all_items: List[ChecklistVerificationItem] = []
    for cat_items in categories.values():
        all_items.extend(cat_items)

    total_checks = len(all_items)
    passed_checks = sum(1 for it in all_items if it.is_compliant)
    failed_checks = total_checks - passed_checks
    score = round((passed_checks / max(1, total_checks)) * 100.0, 1)
    critical_viols = [it for it in all_items if not it.is_compliant and it.severity in ("CRITICAL", "MAJOR")]

    return ComprehensiveBuildingChecklistReport(
        building_occupancy=occupancy_type,
        occupancy_title=profile.title_tr,
        sprinkler_enabled=sprinkler_enabled,
        building_height_m=building_height_m,
        total_floors=total_floors,
        is_high_rise=is_high_rise,
        total_checks=total_checks,
        passed_checks=passed_checks,
        failed_checks=failed_checks,
        compliance_score_percent=score,
        categories=categories,
        critical_violations=critical_viols
    )
