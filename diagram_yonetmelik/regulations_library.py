"""
DiagramYönetmelik - 4 Temel İmar ve Yangın Mevzuatı Hukuki Kütüphanesi.
BYKHY, PAİY, Sığınak ve Otopark Yönetmeliklerinin tüm maddeleri,
resmi kanun metinleri, sayısal parametreleri, mimari kontrol listeleri
ve resmi gazete bağlantılarıyla indekslenmiştir.
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict


@dataclass
class RegulationArticleDetail:
    article_id: str                   # örn: 'BYKHY-M31'
    regulation_code: str              # 'BYKHY', 'PAIY', 'SIGINAK', 'OTOPARK'
    regulation_name: str              # 'Binaların Yangından Korunması Hakkında Yönetmelik'
    article_number: str               # 'Madde 31'
    article_title: str                # 'Çıkış ve Kaçış Merdiveni Sayısı'
    chapter: str                      # 'Üçüncü Kısım / Kaçış Yolları ve Kaçış Merdivenleri'
    official_gazette: str             # 'R.G. 19.12.2007 - Sayı: 26735 (B.K.K. 2007/12937)'
    official_url: str                 # 'https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=12937&MevzuatTur=3&MevzuatTertip=5'
    full_text_tr: str
    mandatory_status: str             # 'ZORUNLU', 'TAVSİYE'
    numerical_parameters: Dict[str, Any] = field(default_factory=dict)
    architectural_checklist: List[str] = field(default_factory=list)
    design_guidance_tr: str = ""
    associated_violation_codes: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)


REGULATIONS_METADATA = {
    "BYKHY": {
        "code": "BYKHY",
        "name": "Binaların Yangından Korunması Hakkında Yönetmelik",
        "short_desc": "Yangın güvenliği, kaçış yolları, yangın merdivenleri, yangın güvenlik holleri ve duman kontrolü standartları.",
        "enacted_date": "19.12.2007",
        "official_gazette_no": "26735",
        "decree_no": "2007/12937 (Son Değişiklik: 2021)",
        "official_url": "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=12937&MevzuatTur=3&MevzuatTertip=5",
        "color": "red"
    },
    "PAIY": {
        "code": "PAIY",
        "name": "Planlı Alanlar İmar Yönetmeliği",
        "short_desc": "Mekân boyutları, kat koridorları, merdiven sahanlıkları, asansörler ve engelli erişilebilirliği ölçüleri.",
        "enacted_date": "03.07.2017",
        "official_gazette_no": "30113",
        "decree_no": "Çevre, Şehircilik ve İklim Değişikliği Bakanlığı",
        "official_url": "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=23773&MevzuatTur=7&MevzuatTertip=5",
        "color": "cyan"
    },
    "SIGINAK": {
        "code": "SIGINAK",
        "name": "3194 Sayılı İmar Kanununa Göre Sığınak Yönetmeliği",
        "short_desc": "Serpinti sığınakları ayrılma zorunluluğu, kişi başı taban alanı hesabı, çift kapılı gaz sızdırmaz hava kilidi ve imdat bacaları.",
        "enacted_date": "25.08.1988",
        "official_gazette_no": "19910",
        "decree_no": "İçişleri ve Bayındırlık Bakanlığı",
        "official_url": "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=4427&MevzuatTur=7&MevzuatTertip=5",
        "color": "amber"
    },
    "OTOPARK": {
        "code": "OTOPARK",
        "name": "Otopark Yönetmeliği",
        "short_desc": "Otopark kapasiteleri, araç park cebi ve manevra yolu boyutları, kapalı otopark yangın izolasyonu ve geçiş kuralları.",
        "enacted_date": "22.02.2018",
        "official_gazette_no": "30340",
        "decree_no": "Çevre ve Şehircilik Bakanlığı",
        "official_url": "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=24341&MevzuatTur=7&MevzuatTertip=5",
        "color": "purple"
    }
}


ALL_REGULATION_ARTICLES: List[RegulationArticleDetail] = [
    # =========================================================================
    # 1. BYKHY - BİNALARIN YANGINDAN KORUNMASI HAKKINDA YÖNETMELİK
    # =========================================================================
    RegulationArticleDetail(
        article_id="BYKHY-M30",
        regulation_code="BYKHY",
        regulation_name="Binaların Yangından Korunması Hakkında Yönetmelik",
        article_number="Madde 30",
        article_title="Kaçış Yolları Tanımı ve Sürekliliği",
        chapter="Üçüncü Kısım: Kaçış Yolları, Kaçış Merdivenleri ve Çıkışlar",
        official_gazette="R.G. 19.12.2007 - Sayı: 26735",
        official_url="https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=12937&MevzuatTur=3&MevzuatTertip=5",
        full_text_tr=(
            "Kaçış yolları, bir yapının herhangi bir noktasından yer seviyesindeki cadde veya sokağa "
            "kadar olan engellenmemiş ve kesintisiz yoldur. Kaçış yollarının bütün elemanlarının "
            "yangına dayanıklılığı, yapının yangın yüküne ve kullanıcı yüküne uygun olmalıdır.\n\n"
            "Hiçbir kaçış yolu üzerinde kilitli kapı, geçişi engelleyen veya genişliği daraltan mobilya, "
            "bölme veya tahliyeyi kesintiye uğratacak mimari çıkmaz düzenleme bulunamaz. "
            "Kaçış yolları acil durum yönlendirme ve aydınlatma armatürleri ile donatılmalıdır."
        ),
        mandatory_status="ZORUNLU",
        numerical_parameters={
            "kesintisizlik": "100% zorunlu",
            "acil_aydinlatma_suresi_dakika": 60.0,
            "min_aydinlatma_lux": 10.0
        },
        architectural_checklist=[
            "Her bağımsız bölümden en az bir kaçış koridoruna veya merdivenine kesintisiz erişim sağlanmalı.",
            "Kaçış yollarında daralma oluşturan kolon veya tesisat şaftı çıkıntıları olmamalı.",
            "Çıkmaz koridor veya geçişi kilitleyen ara bölme tasarlanmamalı."
        ],
        design_guidance_tr="Plan çiziminde daire girişlerinden ana merdiven çekirdeğine giden koridor aksları boyunca hiçbir kilitli kapı veya eşya depolama alanı oluşturulmamalıdır.",
        associated_violation_codes=["BYKHY_M30_KACIS_YOLU_KESINTILI"],
        tags=["kaçış yolu", "tahliye rotası", "kesintisizlik", "yangın güvenliği"]
    ),

    RegulationArticleDetail(
        article_id="BYKHY-M31",
        regulation_code="BYKHY",
        regulation_name="Binaların Yangından Korunması Hakkında Yönetmelik",
        article_number="Madde 31 & Madde 48",
        article_title="Çıkış ve Kaçış Merdiveni Sayısı (Yüksek Binalar)",
        chapter="Üçüncü Kısım: Kaçış Yolları ve Kaçış Merdivenleri",
        official_gazette="R.G. 19.12.2007 - Sayı: 26735",
        official_url="https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=12937&MevzuatTur=3&MevzuatTertip=5",
        full_text_tr=(
            "Yapı yüksekliği 21.50 m'yi aşan veya kat adedi 8 ve üzeri olan konut ve kamu binalarında, "
            "her katta en az 2 adet birbirinden bağımsız, korunumlu kaçış merdiveni düzenlenmesi mecburidir.\n\n"
            "Kullanıcı yükü 500 kişiyi aşan binalarda en az 3 adet, 1000 kişiyi aşan binalarda ise en az "
            "4 adet bağımsız kaçış merdiveni bulunmalıdır. İki kaçış merdiveni arasındaki mesafe, "
            "kat diyagonalinin en az 1/3'ü (sprinklerli) veya 1/2'si (sprinklersiz) kadar olmalıdır."
        ),
        mandatory_status="ZORUNLU",
        numerical_parameters={
            "yuksek_bina_esigi_m": 21.50,
            "yuksek_bina_kat_esigi": 8,
            "asgari_merdiven_sayisi": 2,
            "kullanici_yuku_500_uzeri_merdiven": 3,
            "kullanici_yuku_1000_uzeri_merdiven": 4
        },
        architectural_checklist=[
            "Bina yüksekliği 21.50 m veya 8 kat üzeri ise her katta en az 2 bağımsız yangın merdiveni yerleştirilmeli.",
            "İki yangın merdiveni kovanı kesinlikle dip dibe olmamalı; zıt akslarda konumlandırılmalı.",
            "Her iki merdivene de kat koridorundan yangın güvenlik holü üzerinden erişilebilmeli."
        ],
        design_guidance_tr="8 kat ve üzeri binalarda blok ortasında tek çekirdek yerine, bloğun doğu-batı veya kuzey-güney zıt uçlarında iki bağımsız çekirdek çözülmelidir.",
        associated_violation_codes=["BYKHY_M31_KACIS_MERDIVEN_SAYISI_YETERSIZ"],
        tags=["yangın merdiveni", "çift merdiven", "yüksek bina", "kaçış sayısı"]
    ),

    RegulationArticleDetail(
        article_id="BYKHY-M32",
        regulation_code="BYKHY",
        regulation_name="Binaların Yangından Korunması Hakkında Yönetmelik",
        article_number="Madde 32 & Madde 89",
        article_title="Kaçış Merdiveni Kovanı Havalandırması ve Basınçlandırma",
        chapter="Üçüncü Kısım: Kaçış Merdiveni Korunumu",
        official_gazette="R.G. 19.12.2007 - Sayı: 26735",
        official_url="https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=12937&MevzuatTur=3&MevzuatTertip=5",
        full_text_tr=(
            "Kaçış merdiveni kovanlarının dış cepheden en az 1.0 m² açılabilir pencere ile tabii olarak "
            "havalandırılması veya mekanik duman tahliyesi sağlanması zorunludur.\n\n"
            "Yapı yüksekliği 21.50 m'yi aşan yüksek binalarda, kaçış merdiveni kovasında yangın anında "
            "duman dolmasını önlemek üzere mekanik pozitif basınçlandırma sistemi yapılması mecburidir. "
            "Basınçlandırma sistemi kapılar kapalı iken en az 50 Pa pozitif basınç oluşturmalıdır."
        ),
        mandatory_status="ZORUNLU",
        numerical_parameters={
            "tabii_pencere_alani_m2": 1.0,
            "pozitif_basinc_pa": 50.0,
            "kapi_acikken_hiz_m_s": 1.0
        },
        architectural_checklist=[
            "Alçak binalarda merdiven sahanlıklarında dış cepheye bakan min 1.0 m² pencere bırakılmalı.",
            "Yüksek binalarda mekanik basınçlandırma dikey şaftı ve üfleme menfezleri şaft projesinde ayrılmalı.",
            "Basınçlandırma fanı jeneratör destekli acil durum panosuna bağlanmalı."
        ],
        design_guidance_tr="İç çekirdekte kalan penceresiz merdivenlerde en az 0.50 m² kesitli dikey betonarme basınçlandırma şaftı mimari projede ayrılmalıdır.",
        associated_violation_codes=["BYKHY_M32_MERDIVEN_BASINCLANDIRMA_EKSIK", "BYKHY_M32_MERDIVEN_HAVALANDIRMASI_YOK"],
        tags=["basınçlandırma", "havalandırma", "duman tahliyesi", "merdiven kovanı"]
    ),

    RegulationArticleDetail(
        article_id="BYKHY-M33",
        regulation_code="BYKHY",
        regulation_name="Binaların Yangından Korunması Hakkında Yönetmelik",
        article_number="Madde 33 & Madde 34",
        article_title="Kaçış Kapıları Boyutları, Açılış Yönü ve Yangın Dayanımı",
        chapter="Üçüncü Kısım: Kaçış Yolu Kapıları",
        official_gazette="R.G. 19.12.2007 - Sayı: 26735",
        official_url="https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=12937&MevzuatTur=3&MevzuatTertip=5",
        full_text_tr=(
            "Kaçış kapılarının temiz geçiş genişliği tek kanatta 90 cm'den (0.90 m), çift kanatta 140 cm'den az olamaz. "
            "Yüksek binalarda ve yangın güvenlik holü kapılarında temiz geçiş genişliği asgari 120 cm (1.20 m) olmalıdır.\n\n"
            "Kaçış kapıları kaçış yönünde dışa doğru açılmalı, kilitli tutulmamalı, panik anında kolayca açılan "
            "panik bar mekanizması ile donatılmalıdır. Eşik yüksekliği en fazla 1.5 cm olabilir ve pahlı yapılmalıdır. "
            "Hole veya merdivene açılan kapılar yangına ve dumana en az 60 dakika dayanıklı (EI60) olmalıdır."
        ),
        mandatory_status="ZORUNLU",
        numerical_parameters={
            "min_kapi_genisligi_cm": 90.0,
            "min_kapi_yuksek_bina_cm": 120.0,
            "cift_kanat_min_cm": 140.0,
            "azami_esik_cm": 1.5,
            "yangin_dayanim_dakika": 60.0
        },
        architectural_checklist=[
            "Kapı kanadı kaçış yönünde dışa doğru açılmalı (ters açılış kesinlikle yasak).",
            "Kapı net kasadan kasaya temiz boşluğu en az 120 cm olarak çizilmeli.",
            "Kapı detayı EI60 kendiliğinden kapanan yangın kapısı olarak lejantta belirtilmeli.",
            "Tekerlekli sandalye takılmasını önlemek için eşik yüksekliği sıfır kotta veya max 1.5 cm pahlı olmalı."
        ],
        design_guidance_tr="Kapı çizilirken CAD bloklarında 120 cm yay çizilmeli ve koridor sirkülasyonunu tıkamayacak şekilde güvenlik holü içine açılmalıdır.",
        associated_violation_codes=["BYKHY_M33_KACIS_KAPISI_GENISLIK_DEFICIT", "BYKHY_M33_KAPI_YANGINA_DAYANIKSIZ"],
        tags=["kaçış kapısı", "kapı genişliği", "EI60", "panik bar", "açılış yönü"]
    ),

    RegulationArticleDetail(
        article_id="BYKHY-M34",
        regulation_code="BYKHY",
        regulation_name="Binaların Yangından Korunması Hakkında Yönetmelik",
        article_number="Madde 34",
        article_title="Yangın Güvenlik Holü Ölçüleri ve İzolasyonu",
        chapter="Üçüncü Kısım: Yangın Güvenlik Holleri",
        official_gazette="R.G. 19.12.2007 - Sayı: 26735",
        official_url="https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=12937&MevzuatTur=3&MevzuatTertip=5",
        full_text_tr=(
            "Yangın güvenlik holleri; kaçış merdivenlerine ve acil durum asansörlerine duman ve zehirli gazların "
            "geçişini engellemek amacıyla düzenlenir. Koridordan yangın merdivenine doğrudan kapı açılamaz.\n\n"
            "Yangın güvenlik holü taban alanı 3.0 m²'den az, 6.0 m²'den fazla olamaz (konut yapılarında). "
            "Hole açılan kapılar yangına ve dumana en az 60 dakika dayanıklı (EI60), kendiliğinden kapanan "
            "duman sızdırmaz nitelikte olmalıdır. Hol tabanında hiçbir yanıcı malzeme ve tesisat geçişi bulunamaz."
        ),
        mandatory_status="ZORUNLU",
        numerical_parameters={
            "asgari_hol_alani_m2": 3.0,
            "azami_hol_alani_m2": 6.0,
            "kapi_dayanimi_dakika": 60.0
        },
        architectural_checklist=[
            "Koridor ile yangın merdiveni arasına min 3.0 m² net alanlı yangın holü eklenmeli.",
            "Hem koridor kapısı hem de merdiven kapısı duman fitilli ve yangına dayanıklı olmalı.",
            "Hol alanı 6.0 m²'den büyük tutularak yangın yükü artırılmamalı."
        ],
        design_guidance_tr="Yangın güvenlik holü ebadı en az 1.80 m x 1.70 m = 3.06 m² net ölçülerde planlanmalı; kapıların süpürme yayları birbirine çarpmamalıdır.",
        associated_violation_codes=["BYKHY_M34_YANGIN_GUVENLIK_HOLU_EKSIK", "BYKHY_M34_YANGIN_HOLU_ALAN_YETERSIZ"],
        tags=["yangın holü", "duman sızdırmazlık", "3 m2", "ara geçiş"]
    ),

    RegulationArticleDetail(
        article_id="BYKHY-M40",
        regulation_code="BYKHY",
        regulation_name="Binaların Yangından Korunması Hakkında Yönetmelik",
        article_number="Madde 40 & PAİY Madde 36",
        article_title="Merdiven Basamak ve Rıht Ölçüleri (Blondel Kuralı)",
        chapter="Üçüncü Kısım: Merdiven Geometrisi",
        official_gazette="R.G. 19.12.2007 - Sayı: 26735",
        official_url="https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=12937&MevzuatTur=3&MevzuatTertip=5",
        full_text_tr=(
            "Kaçış merdivenlerinde basamak basma genişliği 28 cm'den (0.28 m) az, rıht yüksekliği ise "
            "17.5 cm'den (0.175 m) fazla olamaz. Kamu binalarında rıht yüksekliği en fazla 16.0 cm alınır.\n\n"
            "Merdiven ergonomisi için basamak ve rıht boyutları 2R + B = 60..64 cm Blondel formülünü sağlamak zorundadır. "
            "Döner merdivenler ve rıhtsız açık basamaklar yangın kaçış merdiveni olarak kabul edilemez."
        ),
        mandatory_status="ZORUNLU",
        numerical_parameters={
            "azami_riht_cm": 17.5,
            "asgari_basamak_cm": 28.0,
            "blondel_min_cm": 60.0,
            "blondel_max_cm": 64.0
        },
        architectural_checklist=[
            "Rıht yüksekliği: h <= 17.5 cm.",
            "Basamak genişliği: b >= 28 cm.",
            "Blondel formülü: 2*h + b değeri 60 ile 64 cm arasında olmalı.",
            "Döner basamak kullanılmamalı, basamak genişliği kol boyunca sabit kalmalı."
        ],
        design_guidance_tr="3.00 metre kat yüksekliği için 17 basamak x 17.64 cm rıht yerine; 18 basamak x 16.66 cm rıht ve 30 cm basamak basma genişliği idealdir (2*16.66 + 30 = 63.3 cm).",
        associated_violation_codes=["BYKHY_M40_MERDIVEN_RIHT_BASAMAK_UYUMSUZ"],
        tags=["rıht", "basamak", "Blondel", "merdiven ergonomisi"]
    ),

    RegulationArticleDetail(
        article_id="BYKHY-M41",
        regulation_code="BYKHY",
        regulation_name="Binaların Yangından Korunması Hakkında Yönetmelik",
        article_number="Madde 41 & PAİY Madde 36",
        article_title="Kaçış Merdiveni Kolu ve Sahanlık Temiz Genişliği",
        chapter="Üçüncü Kısım: Merdiven Kol ve Sahanlıkları",
        official_gazette="R.G. 19.12.2007 - Sayı: 26735",
        official_url="https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=12937&MevzuatTur=3&MevzuatTertip=5",
        full_text_tr=(
            "Kaçış merdivenlerinde merdiven kolu temiz genişliği hiçbir noktada 1.20 m'den az olamaz. "
            "Merdiven ara sahanlığı ve kat sahanlığı genişliği, merdiven kolu genişliğinden az olamaz (min 1.20 m).\n\n"
            "Kesintisiz bir merdiven kolunda rıht sayısı 17 basamaktan fazla olamaz; 17 basamaktan sonra en az "
            "kol genişliği kadar bir ara sahanlık yapılması mecburidir."
        ),
        mandatory_status="ZORUNLU",
        numerical_parameters={
            "min_kol_genisligi_m": 1.20,
            "min_sahanlik_genisligi_m": 1.20,
            "azami_kesintisiz_basamak": 17
        },
        architectural_checklist=[
            "Korkuluktan duvara net temiz geçiş en az 1.20 m olmalı.",
            "Sahanlık derinliği en az merdiven kol genişliği (1.20 m) kadar olmalı.",
            "17 basamaktan fazla kesintisiz iniş yapılmamalı, ara sahanlık konulmalı."
        ],
        design_guidance_tr="Merdiven kovanı çizilirken kova genişliği en az (2 x 1.20 m kol) + (0.10 m kova boşluğu) = 2.50 m olarak akslandırılmalıdır.",
        associated_violation_codes=["BYKHY_M41_MERDIVEN_KOL_VEYA_SAHANLIK_DAR"],
        tags=["merdiven kolu", "sahanlık", "1.20m", "basamak sayısı"]
    ),

    RegulationArticleDetail(
        article_id="BYKHY-M48",
        regulation_code="BYKHY",
        regulation_name="Binaların Yangından Korunması Hakkında Yönetmelik",
        article_number="Madde 48",
        article_title="Kaçış Merdivenleri Arasındaki Mesafe (Köşegen / Diyagonal Kuralı)",
        chapter="Üçüncü Kısım: Kaçış Merdivenlerinin Konumu",
        official_gazette="R.G. 19.12.2007 - Sayı: 26735",
        official_url="https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=12937&MevzuatTur=3&MevzuatTertip=5",
        full_text_tr=(
            "Bir katta iki kaçış merdiveni bulunması gerektiğinde; merdivenlerin giriş kapıları arasındaki "
            "kuş uçuşu mesafe, kat planının en uzak iki köşesi arasındaki diyagonal mesafenin en az 1/3'ünden "
            "(otomatik sprinkler sistemi varsa) veya 1/2'sinden (sprinkler sistemi yoksa) az olamaz.\n\n"
            "Kaçış merdivenlerinin birbirine bitişik veya aynı duman zonu içinde çözülmesi kesinlikle yasaktır. "
            "Amaç, bir merdiven yangın veya dumanla bloke olduğunda diğer merdivenin güvenle kullanılabilmesidir."
        ),
        mandatory_status="ZORUNLU",
        numerical_parameters={
            "oran_sprinklerli": 0.333,
            "oran_sprinklersiz": 0.500
        },
        architectural_checklist=[
            "Katın en uzak iki köşesi belirlenip diyagonal uzunluk hesaplanmalı.",
            "İki merdiven kapısı arası kuş uçuşu mesafe diyagonalin 1/3'ünden büyük olmalı.",
            "Merdivenler bloğun zıt uçlarına yerleştirilmeli."
        ],
        design_guidance_tr="Örneğin 45 metre diyagonal mesafesi olan bir blokta, iki merdiven arası mesafe sprinklerli binada en az 15 metre, sprinklersiz binada en az 22.5 metre olmalıdır.",
        associated_violation_codes=["BYKHY_M48_MERDIVENLER_ARASI_MESAFE_YETERSIZ"],
        tags=["köşegen kuralı", "diyagonal", "merdiven mesafesi", "zıt aks"]
    ),

    RegulationArticleDetail(
        article_id="BYKHY-M52",
        regulation_code="BYKHY",
        regulation_name="Binaların Yangından Korunması Hakkında Yönetmelik",
        article_number="Madde 52 & Madde 53",
        article_title="Çıkmaz Koridor ve Azami Kaçış Mesafesi Sınırları",
        chapter="Üçüncü Kısım: Kaçış Uzaklıkları",
        official_gazette="R.G. 19.12.2007 - Sayı: 26735",
        official_url="https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=12937&MevzuatTur=3&MevzuatTertip=5",
        full_text_tr=(
            "Kaçış koridorlarında tek yönde kaçış imkanı veren çıkmaz koridor mesafesi; sprinklersiz binalarda "
            "en fazla 15.0 m, sprinkler sistemi bulunan binalarda en fazla 20.0 m olabilir.\n\n"
            "İki yönde kaçış imkanı bulunan koridorlarda mekanın en uzak noktasından bir çıkışa veya yangın "
            "merdivenine olan yürüyüş mesafesi sprinklersiz binalarda en fazla 30.0 m, sprinkler sistemi "
            "bulunan binalarda ise en fazla 45.0 m (konutlarda 60.0 m) olabilir."
        ),
        mandatory_status="ZORUNLU",
        numerical_parameters={
            "azami_cikmaz_sprinklersiz_m": 15.0,
            "azami_cikmaz_sprinklerli_m": 20.0,
            "azami_kacis_sprinklersiz_m": 30.0,
            "azami_kacis_sprinklerli_m": 45.0,
            "konut_kacis_sprinklerli_m": 60.0
        },
        architectural_checklist=[
            "Koridorda tek yönde çıkmaz cep oluşuyorsa en uç daire kapısından hol kapısına mesafe <= 15m olmalı.",
            "İki yönde kaçış olan koridorda en uzak noktadan merdivene yürüme mesafesi <= 30m olmalı.",
            "Mesafe hesaplarında kuş uçuşu değil, gerçek yürüme hattı (geodezik) esas alınmalı."
        ],
        design_guidance_tr="Uzun blok koridorlarında çekirdekten 15 metreden fazla uzaklaşan çıkmaz koridor hatlarında koridor sonuna ilave bir yangın kaçış merdiveni eklenmelidir.",
        associated_violation_codes=["BYKHY_M52_CIKMAZ_KORIDOR_MESAFESI_ASILDI", "BYKHY_M53_AZAMI_KACIS_MESAFESI_ASILDI"],
        tags=["çıkmaz koridor", "kaçış mesafesi", "15m", "30m", "sprinkler avantajı"]
    ),

    RegulationArticleDetail(
        article_id="BYKHY-M60",
        regulation_code="BYKHY",
        regulation_name="Binaların Yangından Korunması Hakkında Yönetmelik",
        article_number="Madde 60 & Otopark Yönetmeliği Madde 6",
        article_title="Kapalı Otopark Yangın İzolasyonu ve Geçiş Yasağı",
        chapter="Dördüncü Kısım: Otoparklar ve Yangın Kompartımanları",
        official_gazette="R.G. 19.12.2007 - Sayı: 26735",
        official_url="https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=12937&MevzuatTur=3&MevzuatTertip=5",
        full_text_tr=(
            "Kapalı otopark alanlarından kaçış merdivenlerine, asansör kovalarına ve bina ortak sirkülasyon "
            "hollerine doğrudan kapı açılamaz. Geçişler mutlaka yangına en az 60 dakika dayanıklı (EI60) "
            "kapılarla teçhiz edilmiş, duman sızdırmaz bir yangın güvenlik holü üzerinden yapılmalıdır.\n\n"
            "Otopark içinde herhangi bir noktadan yangın çıkış kapısına olan yürüme mesafesi sprinklersiz binalarda "
            "en fazla 40.0 m, sprinklerli binalarda en fazla 60.0 m olabilir."
        ),
        mandatory_status="ZORUNLU",
        numerical_parameters={
            "kapi_yangin_dayanimi_dakika": 60.0,
            "otopark_kacis_sprinklersiz_m": 40.0,
            "otopark_kacis_sprinklerli_m": 60.0
        },
        architectural_checklist=[
            "Otoparktan merdiven kovanına doğrudan açılan kapı bulunmamalı.",
            "Otopark ile düşey çekirdek arasına duman tahliyeli yangın güvenlik holü yerleştirilmeli.",
            "Otopark içi kaçış mesafesi sprinklersiz 40m, sprinklerli 60m'yi aşmamalı."
        ],
        design_guidance_tr="Bodrum katta otoparktan asansör veya merdiven çekirdeğine girerken 1.50m x 2.00m ebadında bir yangın holü ve EI60 çift kapı tasarlanmalıdır.",
        associated_violation_codes=["BYKHY_M60_OTOPARK_DOGRADAN_MERDIVEN_BAGLANTISI"],
        tags=["kapalı otopark", "yangın güvenlik holü", "doğrudan geçiş yasağı", "bodrum"]
    ),

    RegulationArticleDetail(
        article_id="BYKHY-M62",
        regulation_code="BYKHY",
        regulation_name="Binaların Yangından Korunması Hakkında Yönetmelik",
        article_number="Madde 62",
        article_title="Acil Durum ve İtfaiyeci Asansörü Zorunluluğu",
        chapter="Dördüncü Kısım: Acil Durum Asansörleri",
        official_gazette="R.G. 19.12.2007 - Sayı: 26735",
        official_url="https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=12937&MevzuatTur=3&MevzuatTertip=5",
        full_text_tr=(
            "Yapı yüksekliği 51.50 m'yi aşan veya 10 kat ve üzeri olan tüm binalarda, yangın anında "
            "itfaiyenin üst katlara hızlıca erişmesini sağlayan en az 1 adet Acil Durum / İtfaiyeci Asansörü "
            "bulunması zorunludur.\n\n"
            "İtfaiyeci asansörünün kuyusu basınçlandırmalı olmalı, elektrik beslemesi yangına dayanıklı kablolarla "
            "acil durum jeneratöründen sağlanmalı ve kabin önünde her katta yangın güvenlik holü bulunmalıdır."
        ),
        mandatory_status="ZORUNLU",
        numerical_parameters={
            "yapı_yuksekligi_esigi_m": 51.50,
            "kat_adedi_esigi": 10,
            "asgari_asansor_adedi": 1,
            "kuyu_basinclandirma_pa": 50.0
        },
        architectural_checklist=[
            "Bina 10 kat veya 51.50m üzeri ise en az 1 itfaiyeci asansörü ayrılmalı.",
            "Asansör kapısı önünde yangın güvenlik holü tasarlanmalı.",
            "Asansör kuyusu betonarme perde ile yangına en az 120 dk dayanıklı izole edilmeli."
        ],
        design_guidance_tr="10 kat ve üzeri binalarda ana çekirdeğe en az 800 kg / 10 kişilik, sedye taşımaya da uygun bir itfaiyeci asansörü eklenmelidir.",
        associated_violation_codes=["BYKHY_M62_ACIL_DURUM_YANGIN_ASANSORU_YOK"],
        tags=["itfaiyeci asansörü", "acil durum asansörü", "10 kat", "51.5m"]
    ),

    RegulationArticleDetail(
        article_id="BYKHY-M74",
        regulation_code="BYKHY",
        regulation_name="Binaların Yangından Korunması Hakkında Yönetmelik",
        article_number="Madde 74",
        article_title="Yangın Dolapları ve Sabit Boru Tesisatı Dağılımı",
        chapter="Yedinci Kısım: Sulu Söndürme Sistemleri",
        official_gazette="R.G. 19.12.2007 - Sayı: 26735",
        official_url="https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=12937&MevzuatTur=3&MevzuatTertip=5",
        full_text_tr=(
            "Yüksek binalarda ve toplam kapalı alanı 1000 m²'den fazla olan binalarda her katta en az "
            "bir yangın dolabı yerleştirilmelidir. Yangın dolapları arasındaki mesafe 30 metreden fazla olamaz.\n\n"
            "Yangın dolapları kat hollerinde ve kaçış yollarında kolayca görülebilecek ve erişilebilecek "
            "noktalara konulmalı, hortum boyu 20-30 metre kabul edilerek katın her noktasına su ulaştırılabilecek "
            "kapsama sağlanmalıdır."
        ),
        mandatory_status="ZORUNLU",
        numerical_parameters={
            "azami_dolap_araligi_m": 30.0,
            "hortum_boyu_m": 30.0,
            "alan_esigi_m2": 1000.0
        },
        architectural_checklist=[
            "Her katta kat holünde en az 1 adet yangın dolabı yeri gösterilmeli.",
            "Koridor uzunluğu 30m'yi aşıyorsa 30m aralıklarla ilave dolap nişi bırakılmalı.",
            "Dolap kapağı kaçış yolunu daraltmayacak şekilde duvara gömme tasarlanmalı."
        ],
        design_guidance_tr="Koridor duvarında 80x80x25 cm ebatlarında gömme yangın dolabı nişleri mimari planda şaft yanında işaretlenmelidir.",
        associated_violation_codes=["BYKHY_M74_YANGIN_DOLABI_MESAFE_ASIMI"],
        tags=["yangın dolabı", "hortum mesafesi", "30m", "söndürme"]
    ),

    RegulationArticleDetail(
        article_id="BYKHY-M96",
        regulation_code="BYKHY",
        regulation_name="Binaların Yangından Korunması Hakkında Yönetmelik",
        article_number="Madde 96",
        article_title="Otomatik Yağmurlama (Sprinkler) Sistemi Zorunluluğu",
        chapter="Yedinci Kısım: Yağmurlama Sistemleri",
        official_gazette="R.G. 19.12.2007 - Sayı: 26735",
        official_url="https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=12937&MevzuatTur=3&MevzuatTertip=5",
        full_text_tr=(
            "Yapı yüksekliği 21.50 m'yi aşan konut binalarında, toplam inşaat alanı 5000 m²'den fazla olan yapılarda, "
            "20'den fazla araç kapasiteli kapalı otoparklarda ve birden fazla bodrum katı bulunan yapılarda "
            "tüm bağımsız bölümleri ve kaçış yollarını koruyan otomatik sprinkler sistemi zorunludur."
        ),
        mandatory_status="ZORUNLU",
        numerical_parameters={
            "yapı_yuksekligi_m": 21.50,
            "toplam_insaat_alani_m2": 5000.0,
            "otopark_arac_esigi": 20
        },
        architectural_checklist=[
            "Bina yüksekliği >= 21.50 m ise asma tavan sprinkler kotu projede öngörülmeli.",
            "Tavan net yüksekliği sprinkler başlığı payı (min 15 cm) düşüldükten sonra 2.40m'yi sağlamalı.",
            "Kapalı otoparkta sprinkler borulama güzergahı kiriş altı kotlarına uygun çözülmeli."
        ],
        design_guidance_tr="Sprinkler tesisatı binanın kaçış mesafesi toleransını 15m'den 20m'ye, 30m'den 45m'ye genişletir.",
        associated_violation_codes=["BYKHY_M96_OTOMATIK_SPRINKLER_ZORUNLULUGU"],
        tags=["sprinkler", "yağmurlama", "otomatik söndürme", "yüksek bina"]
    ),

    # =========================================================================
    # 2. PAİY - PLANLI ALANLAR İMAR YÖNETMELİĞİ
    # =========================================================================
    RegulationArticleDetail(
        article_id="PAIY-M5",
        regulation_code="PAIY",
        regulation_name="Planlı Alanlar İmar Yönetmeliği",
        article_number="Madde 5",
        article_title="Genel İlkeler ve Engelli Erişilebilirliği Standartları",
        chapter="Birinci Kısım: Genel İlkeler",
        official_gazette="R.G. 03.07.2017 - Sayı: 30113",
        official_url="https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=23773&MevzuatTur=7&MevzuatTertip=5",
        full_text_tr=(
            "Bina girişleri, ortak kat koridorları ve hollerde tekerlekli sandalyenin serbestçe dönüş "
            "yapabilmesi için en az Ø 1.50 m çapında bir manevra dairesi alanı sağlanmalıdır.\n\n"
            "Kapı eşik yüksekliği sıfır kotta veya azami 1.5 cm pahlı olmalı, engelli rampalarında eğim "
            "azami %6 (istisnai kısa mesafede %8) olmalı ve rampalarda çift taraflı küpeşte bulunmalıdır."
        ),
        mandatory_status="ZORUNLU",
        numerical_parameters={
            "tekerlekli_sandalye_manevra_capi_m": 1.50,
            "azami_esik_cm": 1.5,
            "azami_rampa_egimi_yuzde": 6.0
        },
        architectural_checklist=[
            "Kat koridorunun en az bir noktasında 1.50m x 1.50m engelli dönüş cebi bırakılmalı.",
            "Bina ana girişinde rampa eğimi %6'yı geçmemeli.",
            "Tüm oda ve daire girişlerinde sıfır kot eşik uygulanmalı."
        ],
        design_guidance_tr="Koridor dönüşlerinde ve asansör önlerinde 150 cm çapında hayali daire çizilerek hiçbir duvarın bu daireyi kesmediği teyit edilmelidir.",
        associated_violation_codes=["PAIY_M5_ENGELLI_MANEVRA_ALANI_YETERSIZ"],
        tags=["engelli erişimi", "tekerlekli sandalye", "manevra çapı", "1.50m"]
    ),

    RegulationArticleDetail(
        article_id="PAIY-M29",
        regulation_code="PAIY",
        regulation_name="Planlı Alanlar İmar Yönetmeliği",
        article_number="Madde 29 & Madde 30",
        article_title="Kat Holü ve Koridor Asgari Temiz Boyutları",
        chapter="Dördüncü Kısım: Bina İçi Mekân Boyutları",
        official_gazette="R.G. 03.07.2017 - Sayı: 30113",
        official_url="https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=23773&MevzuatTur=7&MevzuatTertip=5",
        full_text_tr=(
            "Bağımsız bölümlere ulaşan ortak kat koridorlarının net temiz genişliği hiçbir noktada "
            "1.20 m'den az olamaz. Kat koridorunda tavan temiz yüksekliği en az 2.40 m olmalıdır.\n\n"
            "Konut bağımsız bölümlerinde oturma odası en az 12.00 m² (dar kenar en az 3.00 m), "
            "yatak odası en az 9.00 m² (dar kenar en az 2.50 m) ve mutfak en az 3.30 m² olmalıdır."
        ),
        mandatory_status="ZORUNLU",
        numerical_parameters={
            "min_koridor_genisligi_m": 1.20,
            "min_tavan_yuksekligi_m": 2.40,
            "min_salon_alani_m2": 12.0,
            "min_yatak_odasi_alani_m2": 9.0
        },
        architectural_checklist=[
            "Ortak kat koridoru duvar aksları arasındaki temiz mesafe >= 1.20 m olmalı.",
            "Tesisat şaftı veya kolon koridoru 1.20m altına daraltmamalı.",
            "Tavan asma tavan altı net yüksekliği en az 2.40 m olarak bırakılmalı."
        ],
        design_guidance_tr="Sıva payı (2 x 2.5 cm = 5 cm) düşülerek kaba inşaat aks genişliği en az 1.30 m olarak çizilmelidir.",
        associated_violation_codes=["PAIY_M29_KAT_KORIDORU_GENISLIK_YETERSIZ"],
        tags=["kat koridoru", "koridor genişliği", "1.20m", "tavan yüksekliği"]
    ),

    RegulationArticleDetail(
        article_id="PAIY-M30",
        regulation_code="PAIY",
        regulation_name="Planlı Alanlar İmar Yönetmeliği",
        article_number="Madde 30",
        article_title="Işıklıklar ve Hava Bacaları Boyutları",
        chapter="Dördüncü Kısım: Havalandırma ve Işıklıklar",
        official_gazette="R.G. 03.07.2017 - Sayı: 30113",
        official_url="https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=23773&MevzuatTur=7&MevzuatTertip=5",
        full_text_tr=(
            "Doğrudan dış cepheye penceresi açılmayan banyo, WC ve benzeri ıslak hacimler için taban alanı "
            "en az 0.45 m² ve dar kenarı en az 0.60 m olan havalandırma bacası yapılması zorunludur.\n\n"
            "Işıklık boyutları ise binanın kat adedine göre belirlenir; 4 kata kadar en az 3.0 m² ve dar kenarı "
            "en az 1.50 m olmalıdır."
        ),
        mandatory_status="ZORUNLU",
        numerical_parameters={
            "min_hava_bacasi_m2": 0.45,
            "min_hava_bacasi_dar_kenar_m": 0.60,
            "min_isiklik_alani_m2": 3.0
        },
        architectural_checklist=[
            "Dış cepheye bakmayan banyo/WC yanına min 0.60m x 0.75m hava bacası konulmalı.",
            "Hava bacası çatıya kadar kesintisiz devam etmeli.",
            "Mekanik emiş menfezi hava bacasına bağlanmalı."
        ],
        design_guidance_tr="İç banyolarda 60x75 cm ebadında dikey hava bacası şaftı kolon aralarına yerleştirilmelidir.",
        associated_violation_codes=["PAIY_M30_HAVALANDIRMA_BACASI_YETERSIZ"],
        tags=["hava bacası", "ışıklık", "banyo havalandırması", "ıslak hacim"]
    ),

    RegulationArticleDetail(
        article_id="PAIY-M34",
        regulation_code="PAIY",
        regulation_name="Planlı Alanlar İmar Yönetmeliği",
        article_number="Madde 34",
        article_title="Asansör Sayısı ve Kat Holü Bekleme Derinlikleri",
        chapter="Dördüncü Kısım: Asansörler",
        official_gazette="R.G. 03.07.2017 - Sayı: 30113",
        official_url="https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=23773&MevzuatTur=7&MevzuatTertip=5",
        full_text_tr=(
            "Kat adedi 4 ve üzeri olan binalarda en az 1 adet asansör yapılması mecburidir. "
            "Kat adedi 10 ve üzeri olan binalarda en az 2 adet asansör (biri sedye taşımaya uygun) yapılmalıdır.\n\n"
            "Asansör kapısı önündeki ortak kat holü bekleme derinliği; konutlarda en az 1.50 m, "
            "sedye asansöründe ve yüksek binalarda ise en az 1.80 m olmalıdır."
        ),
        mandatory_status="ZORUNLU",
        numerical_parameters={
            "asansor_zorunlu_kat": 4,
            "cift_asansor_zorunlu_kat": 10,
            "min_hol_derinligi_konut_m": 1.50,
            "min_hol_derinligi_sedye_m": 1.80
        },
        architectural_checklist=[
            "4+ kat binalarda asansör kuyusu çizilmeli.",
            "10+ kat binalarda en az 2 asansör (biri sedye için 1.80m derinlikli) konulmalı.",
            "Asansör kapısı önündeki hol derinliği yüksek binalarda min 1.80 m olmalı."
        ],
        design_guidance_tr="Asansör kapısı karşısındaki duvar ile asansör kapısı arasında 1.80 metre serbest açıklık bırakılmalıdır.",
        associated_violation_codes=["PAIY_M34_ASANSOR_KAT_HOLU_DAR"],
        tags=["asansör holü", "sedye asansörü", "1.80m", "10 kat"]
    ),

    RegulationArticleDetail(
        article_id="PAIY-M40",
        regulation_code="PAIY",
        regulation_name="Planlı Alanlar İmar Yönetmeliği",
        article_number="Madde 40",
        article_title="Çatı Terasları, Parapet ve Korkuluk Güvenlik Yükseklikleri",
        chapter="Beşinci Kısım: Çatılar ve Teraslar",
        official_gazette="R.G. 03.07.2017 - Sayı: 30113",
        official_url="https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=23773&MevzuatTur=7&MevzuatTertip=5",
        full_text_tr=(
            "Çatı teraslarında, balkonlarda ve ortak kullanılan açık teras alanlarında düşme tehlikesini "
            "önlemek amacıyla yapılacak parapet veya korkuluk yüksekliği döşeme kaplama üst kotundan "
            "itibaren en az 1.10 m (110 cm) olmalıdır."
        ),
        mandatory_status="ZORUNLU",
        numerical_parameters={
            "min_korkuluk_yuksekligi_m": 1.10
        },
        architectural_checklist=[
            "Çatı terası parapet ve küpeşte kotu döşeme üzerinden min 1.10 m olmalı.",
            "Korkuluk parmaklıkları arası açıklık azami 11 cm olmalı (çocuk güvenliği)."
        ],
        design_guidance_tr="Çatı katı kesitinde teras döşemesi üzerinden 110 cm yükseklik kuralı kontrol edilmelidir.",
        associated_violation_codes=["PAIY_M40_TERAS_PARAPET_YUKSEKLIK_DEFICIT"],
        tags=["parapet", "korkuluk", "çatı terası", "1.10m"]
    ),

    # =========================================================================
    # 3. SIĞINAK YÖNETMELİĞİ
    # =========================================================================
    RegulationArticleDetail(
        article_id="SIGINAK-M9",
        regulation_code="SIGINAK",
        regulation_name="3194 Sayılı İmar Kanununa Göre Sığınak Yönetmeliği",
        article_number="Madde 4, 8 ve 9",
        article_title="Serpinti Sığınağı Ayrılma Zorunluluğu ve Alan Hesabı",
        chapter="İkinci Kısım: Serpinti Sığınakları",
        official_gazette="R.G. 25.08.1988 - Sayı: 19910",
        official_url="https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=4427&MevzuatTur=7&MevzuatTertip=5",
        full_text_tr=(
            "12 veya daha fazla bağımsız bölümü bulunan konut yapılarında, toplam inşaat alanı 800 m²'yi "
            "aşan kamu ve işyeri binalarında bodrum katında serpinti sığınağı ayrılması mecburidir.\n\n"
            "Sığınak alanı; konutlarda daire başına 4 kişi kabulü ile kişi başına en az 1.0 m² net taban alanı "
            "esas alınarak hesaplanır. Net sığınak alanı WC, lavabo ve hava kilidi hariç 12.0 m²'den az olamaz."
        ),
        mandatory_status="ZORUNLU",
        numerical_parameters={
            "daire_basi_kisi": 4,
            "kisi_basi_min_alan_m2": 1.0,
            "asgari_siginak_alani_m2": 12.0,
            "daire_esigi": 12
        },
        architectural_checklist=[
            "12 daire üzeri konutlarda bodrum katta sığınak ayrılmalı.",
            "Alan formülü: Daire Sayısı x 4 kişi x 1.0 m² net alan karşılanmalı.",
            "Sığınak içinde en az 1 kadın, 1 erkek WC ve lavabo tasarlanmalı."
        ],
        design_guidance_tr="Örneğin 20 daireli bir binada: 20 x 4 x 1.0 m² = en az 80 m² net sığınak alanı tahsis edilmelidir.",
        associated_violation_codes=["SIGINAK_M9_SIGINAK_ALANI_BULUNAMADI", "SIGINAK_M9_SIGINAK_ALANI_YETERSIZ"],
        tags=["sığınak", "serpinti sığınağı", "kişi başı 1 m2", "bodrum"]
    ),

    RegulationArticleDetail(
        article_id="SIGINAK-M13",
        regulation_code="SIGINAK",
        regulation_name="3194 Sayılı İmar Kanununa Göre Sığınak Yönetmeliği",
        article_number="Madde 13",
        article_title="Sığınak Girişi Gaz Sızdırmazlık Hava Kilidi (Airlock) ve İmdat Bacası",
        chapter="İkinci Kısım: Sığınak Giriş ve Çıkışları",
        official_gazette="R.G. 25.08.1988 - Sayı: 19910",
        official_url="https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=4427&MevzuatTur=7&MevzuatTertip=5",
        full_text_tr=(
            "Sığınak girişleri mutlaka iki kapılı bir hava kilidi (gaz sızdırmazlık holü - airlock) "
            "üzerinden yapılmalıdır. Hava kilidi taban alanı en az 1.50 m² olmalıdır. Kapılar gaz sızdırmaz "
            "ve yangına dayanıklı çelik sığınak kapısı niteliğinde olmalıdır.\n\n"
            "Ayrıca ana girişin yıkıntı ile kapanması ihtimaline karşı bina dışına menfezle açılan "
            "en az 80 cm x 80 cm ebadında bir acil kaçış imdat bacası bulunması zorunludur."
        ),
        mandatory_status="ZORUNLU",
        numerical_parameters={
            "min_hava_kilidi_alani_m2": 1.50,
            "imdat_bacasi_min_cm": 80.0
        },
        architectural_checklist=[
            "Sığınak giriş kapısı önüne min 1.50 m² çift kapılı hava kilidi yerleştirilmeli.",
            "Hava kilidi kapıları gaz sızdırmaz contalı çelik kapı olmalı.",
            "Bina dışına açılan en az 80x80cm acil kaçış menfezi (imdat bacası) çizilmeli."
        ],
        design_guidance_tr="Hava kilidi ebadı en az 1.20 m x 1.30 m = 1.56 m² olmalı ve sığınak içine açılmalıdır.",
        associated_violation_codes=["SIGINAK_M13_HAVA_KILIDI_EKSIK"],
        tags=["hava kilidi", "airlock", "imdat bacası", "gaz sızdırmaz"]
    ),

    # =========================================================================
    # 4. OTOPARK YÖNETMELİĞİ
    # =========================================================================
    RegulationArticleDetail(
        article_id="OTOPARK-M5",
        regulation_code="OTOPARK",
        regulation_name="Otopark Yönetmeliği",
        article_number="Madde 5 & Madde 6",
        article_title="Otopark Boyutları, Araç Başı Alan ve Manevra Yolları",
        chapter="İkinci Kısım: Otopark Standartları",
        official_gazette="R.G. 22.02.2018 - Sayı: 30340",
        official_url="https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=24341&MevzuatTur=7&MevzuatTertip=5",
        full_text_tr=(
            "Konut yapılarında her 3 daire için en az 1 adet otopark yeri ayrılması zorunludur "
            "(büyükşehirlerde her daire için 1 araç). Araç başına manevra yolları dahil brüt otopark "
            "alanı en az 20.0 m² kabul edilir.\n\n"
            "Net araç park cebi boyutları en az 2.50 m x 5.00 m (engelli araçları için 3.50 m x 5.00 m) olmalıdır. "
            "İki yönlü araç sirkülasyon yolu genişliği en az 6.00 m, tek yönlü yolda en az 3.50 m olmalıdır. "
            "Otopark rampası eğimi kapalı otoparklarda azami %15 (tadilatlarda azami %20) olabilir."
        ),
        mandatory_status="ZORUNLU",
        numerical_parameters={
            "brut_arac_alani_m2": 20.0,
            "net_park_cebi_en_m": 2.50,
            "net_park_cebi_boy_m": 5.00,
            "engelli_park_en_m": 3.50,
            "cift_yonlu_yol_genisligi_m": 6.00,
            "tek_yonlu_yol_genisligi_m": 3.50,
            "azami_rampa_egimi_yuzde": 15.0
        },
        architectural_checklist=[
            "Her araç park cebi net 2.50 m x 5.00 m çizilmeli.",
            "İki yönlü araç geçiş koridoru genişliği en az 6.00 m olmalı.",
            "Otopark rampa eğimi %15'i aşmamalı.",
            "Otoparktan merdivene yangın güvenlik holü üzerinden geçilmeli (BYKHY M.60 ile koordineli)."
        ],
        design_guidance_tr="Bodrum otopark kolon aksları 7.50 metreye oturtularak iki kolon arasına 3 araç (3 x 2.50m) rahatça sığdırılabilir.",
        associated_violation_codes=["OTOPARK_M5_OTOPARK_KAPASITE_DEFICIT", "BYKHY_M60_OTOPARK_DOGRADAN_MERDIVEN_BAGLANTISI"],
        tags=["otopark", "park cebi", "manevra yolu", "6 metre", "rampa eğimi"]
    ),
]


def get_all_regulations_summary() -> List[Dict[str, Any]]:
    """Tüm 4 yönetmeliğin özetini ve madde sayılarını döner."""
    result = []
    for code, meta in REGULATIONS_METADATA.items():
        arts = [a for a in ALL_REGULATION_ARTICLES if a.regulation_code == code]
        item = dict(meta)
        item["total_articles"] = len(arts)
        item["articles_list"] = [
            {
                "article_id": a.article_id,
                "article_number": a.article_number,
                "article_title": a.article_title,
                "mandatory_status": a.mandatory_status,
                "tags": a.tags
            }
            for a in arts
        ]
        result.append(item)
    return result


def get_articles_by_regulation(reg_code: str) -> List[Dict[str, Any]]:
    """Belirli bir yönetmeliğin (BYKHY, PAIY, SIGINAK, OTOPARK) tüm maddelerini döner."""
    code_upper = reg_code.upper()
    articles = [a for a in ALL_REGULATION_ARTICLES if a.regulation_code == code_upper]
    return [asdict(a) for a in articles]


def get_article_by_id(article_id: str) -> Optional[Dict[str, Any]]:
    """Madde kimliğine göre (örn: 'BYKHY-M31' veya 'PAIY-M29') tam detay döner."""
    clean_id = article_id.strip().upper().replace("_", "-")
    for a in ALL_REGULATION_ARTICLES:
        if a.article_id.upper() == clean_id or a.article_id.upper().replace("-", "_") == clean_id:
            return asdict(a)
    return None


def search_articles(query: str) -> List[Dict[str, Any]]:
    """Mevzuat maddeleri içinde anahtar kelime, madde no veya konu araması yapar."""
    q = query.strip().lower()
    matches = []
    for a in ALL_REGULATION_ARTICLES:
        score = 0
        if q in a.article_id.lower(): score += 10
        if q in a.article_number.lower(): score += 8
        if q in a.article_title.lower(): score += 6
        if any(q in t.lower() for t in a.tags): score += 5
        if any(q in v.lower() for v in a.associated_violation_codes): score += 7
        if q in a.full_text_tr.lower(): score += 2
        
        if score > 0:
            matches.append((score, asdict(a)))
            
    matches.sort(key=lambda x: x[0], reverse=True)
    return [m[1] for m in matches]


def find_article_for_violation_code(violation_code: str) -> Optional[Dict[str, Any]]:
    """Bir ihlal kodunu ilgili mevzuat maddesiyle eşler."""
    code_upper = violation_code.upper()
    for a in ALL_REGULATION_ARTICLES:
        if any(code_upper == v.upper() or v.upper() in code_upper for v in a.associated_violation_codes):
            return asdict(a)
    # Madde numarası çıkarımı yap (örn: BYKHY_M31 -> BYKHY-M31)
    for a in ALL_REGULATION_ARTICLES:
        base_id = a.article_id.replace("-", "_").upper()
        if base_id in code_upper:
            return asdict(a)
    return None
