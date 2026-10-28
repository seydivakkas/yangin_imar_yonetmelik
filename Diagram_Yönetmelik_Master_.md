# MİMARLLM V2 — MASTER TEKNİK GELİŞTİRME VE ORKESTRASYON REHBERİ

**Belge kodu:** MİMARLLM-V2-ARCH-TECH-001  
**Sürüm:** 1.0 / Teknik tasarım ve uygulama sözleşmesi  
**Tarih:** 23 Ekim 2026  
**Dil:** Türkçe (Python/JSON sınıf ve anahtar adları değişmeden korunur)  
**Hedef:** Windows-first, çevrimdışı çalışma, yerel modeller, kaynak-koruyan mimari CAD denetimi  
**Bağlam:** `seydivakkas/MimarLLM_v2` (özel depo)  
**Statü:** **HEDEF MİMARİ / TASARIM ŞARTNAMESİ**. Burada belirtilen 11 gelişmiş modülün tamamı mevcut `main` dalında uygulanmış veya saha koşullarında doğrulanmış kabul edilmez.

> **Mühendislik sınırı:** Bu belge yazılım tasarımını, doğrulama kapılarını ve araştırma algoritmalarını tanımlar. Yazılımın çıktısı ruhsat, yangın güvenliği, statik proje, mimari proje onayı veya hukukî uygunluk belgesi değildir. Yetkili uzman ve güncel mevzuat incelemesi gerekir. Gerçek fiziksel Windows/Edge, CAD, GPU ve proje dosyası kabulü son kabul aşamasına bırakılır; sentetik test ve CI kontrolleri geliştirme boyunca zorunludur.

## 1. Amaç, kapsam ve başarı tanımı

MimarLLM V2, DXF ve mevcut sistemde desteklenen PDF çizimlerini **kaynak kanıtıyla** ayrıştırır; oda, kapı, merdiven, koridor, yangın holü ve dış çıkış ilişkilerini graf üzerinde temsil eder; mevzuata bağlı kural adaylarını sembolik olarak değerlendirir; belirsiz geometriyi *uygun* diye sınıflandırmaz; zaman adımlı tahliye ve tadilat müdahalelerinin etkisini deneysel olarak karşılaştırır; orijinal CAD katmanlarına dokunmadan türetilmiş DXF ve denetlenebilir rapor üretir.

**Birincil çıktılar:** `denetlenmis_revizyonlu_pafta.dxf`, `Resmi_Teknik_Rapor.md`, `audit_trail.json`. Ek makine çıktıları: `run_manifest.json`, `diagnostics.json`, `evacuation_report.json`, `source_evidence_index.json`, `optimization_result.json`, isteğe bağlı statik görseller.

**Korunacak çalışma kuralları:** haricî LLM API / API anahtarı yok; varsayılan işlem `127.0.0.1` ve yerel kaynaklar; gerçek fiziksel veri kabulü nihai aşamada; GitHub geliştirme açıklamaları Türkçe; kaynak CAD üzerine yazma yok; öneri çizgisi ile inşaat onayı birbirinden ayrılır.

### 1.1 Depoda mevcut olan ile hedeflenen mimarinin ayrımı

23 Ekim 2026'da deponun `main` README'sinden doğrulanan mevcut temel: `src/mimarllm/core/ir.py`, `units.py`; `importers/dxf.py`, `pdf.py`, `pdf_ir.py`; `geometry/spatial.py`, `walls.py`, `topology.py`, `repair.py`; `rules/`; `legal/`; `rag/`; `reports/`; `pipeline.py`; `cli.py`; `app/`. Mevcut belgeler bu çekirdeği çoğunlukla **KISMİ** ve hukukî doğrulama bakımından **HOLD** olarak tanımlar. Aşağıdaki yeni alt paketler **öneridir**; gerçek depodaki dosya varlıkları, test statüsü ve dallar yeniden kontrol edilmeden “mevcut” yazılmamalıdır.

**Entegrasyon kararı:** İkinci bir `src` kökü veya ayrı backend oluşturma. Yeni modüller `src/mimarllm/` altında kalır; mevcut `DrawingIR`, `SourceRef`, `RuleEngine`, `LegalAST`, `PipelineManifest` ve PDF/CLI/dashboard sözleşmelerini adapter katmanıyla kullanır. Eski arayüzler sırf yeni isim isteniyor diye silinmez.

## 2. Tam önerilen dosya ve klasör ağacı

`[M]` mevcut README'de anılan modül/klasör, `[Y]` yeni önerilen dosya; gerçek uygulamaya başlamadan depodaki son HEAD ile fark kontrolü yapılır.

```text
MimarLLM_v2/
├── README.md                                  [M]
├── pyproject.toml                             [M/Doğrula]
├── AGENTS.md                                  [Y] Türkçe ajan sınırları
├── .github/workflows/                         [M/Doğrula]
│   ├── zorunlu-ubuntu.yml                     [Y/Mevcut iş akışına uyumla]
│   ├── zorunlu-windows.yml                    [Y/Mevcut iş akışına uyumla]
│   └── zorunlu-edge.yml                       [Y/Mevcut iş akışına uyumla]
├── src/mimarllm/
│   ├── __init__.py
│   ├── cli.py                                 [M]
│   ├── pipeline.py                            [M]
│   ├── core/                                  [M]
│   │   ├── ir.py                              DrawingIR ve kaynak kimlikleri
│   │   └── units.py                           Birim/kalibrasyon
│   ├── importers/                             [M] dxf.py, pdf.py, pdf_ir.py
│   ├── geometry/                              [M] spatial.py, walls.py, topology.py, repair.py
│   ├── rules/                                 [M] base.py, engine.py
│   ├── legal/                                 [M] sürümlü kaynak, LegalAST
│   ├── rag/                                   [M] SQLite FTS5/BM25 ve arama
│   ├── reports/                               [M] mevcut kaynaklı rapor üretimi
│   ├── app/                                   [M] yerel dashboard
│   ├── denetim_cekirdegi/                    [Y]
│   │   ├── __init__.py
│   │   ├── sozlesmeler.py                     Pydantic/dataclass/TypedDict şemaları
│   │   ├── kodlar.py                         ihlal, uyarı ve durum kodları
│   │   ├── kanit.py                          SourceRef, hash, bbox, lineage
│   │   ├── birim_kontrolu.py                 DXF -> metre dönüşümü kapısı
│   │   ├── calisma_baglam.py                konfigürasyon, sürüm, iş kimliği
│   │   ├── durum_makinesi.py                 PASS/HOLD/PARTIAL/FAIL
│   │   └── denetim_izi.py                    append-only audit günlüğü
│   ├── cad_ayristirma/                       [Y / K1]
│   │   ├── dxf_kat_plani_ayristirici.py      DXFFloorplanParser
│   │   ├── cizgi_poligon_kurtarma.py         WallLinePolygonizer
│   │   ├── kat_adasi_ayirici.py              yan yana çizilmiş katları ayır
│   │   ├── mimari_etiket_siniflandirici.py   Türkçe etiket eşlemesi
│   │   ├── kapi_geometrisi.py                INSERT/ARC/bulge/kapı adayları
│   │   └── kaynak_eslestirme.py              STRtree metin -> oda
│   ├── uc_boyutlu_graf/                       [Y / K2]
│   │   ├── cok_katli_graf_kurucu.py          MultiFloor3DRAGBuilder
│   │   ├── dusay_baglanti.py                 merdiven/asansör/şaft kimliği
│   │   ├── mimari_oruntu_madenciligi.py      ArchitecturalSPMiner
│   │   ├── grafin_sikistirilmasi.py          ArchitecturalGraphCoarsener
│   │   └── graf_dogrulama.py                bileşen/çıkış/kat kontrolleri
│   ├── norosembolik_denetim/                  [Y / K3A]
│   │   ├── gnn_oznitellikleri.py             17 veya 23 boyut encoder
│   │   ├── mekansal_sirali_gnn.py            SpatialOrderGNN
│   │   ├── vf2_dogrulayici.py                kesin aday eşleştirme
│   │   ├── aciklanabilir_vf2.py              ExplainableVF2Analyzer
│   │   ├── yangin_sablonlari.py              mevzuat graf motifleri
│   │   └── eslestirme_kaniti.py              q_id -> u_id kanıtları
│   ├── bodrum_denetimi/                       [Y / K3B]
│   │   ├── siginak_kurallari.py              bağlamlı sığınak kontrolleri
│   │   ├── otopark_kurallari.py              bağlamlı otopark kontrolleri
│   │   └── bodrum_denetcisi.py              BasementComplianceAuditor
│   ├── tahliye_simulasyonu/                   [Y / K4]
│   │   ├── yonlu_tahliye_agi.py              çıkış odaklı DAG, mesafeler
│   │   ├── kapasite_modeli.py                debi, doluluk, parametre
│   │   ├── hucre_iletim.py                   zaman adımlı hücre/kenar akışı
│   │   ├── darbogaz_analizi.py               statik min-cut + kuyruk
│   │   ├── uc_boyutlu_tahliye.py             Building3DEvacuationSimulator
│   │   └── kalibrasyon.py                    yoğunluk/debi senaryo setleri
│   ├── karsi_olgusal_optimizasyon/            [Y / K4]
│   │   ├── mudahale_adaylari.py              kapı/hol/şaft seçenekleri
│   │   ├── maliyet_fonksiyonu.py             maliyet ve fayda
│   │   ├── mudahale_dogrulama.py             sembolik ve statik engel
│   │   ├── eniyileme_motoru.py               CounterfactualEvacuationOptimizer
│   │   └── fazlalik_budamasi.py              geri yönde kaldırma
│   ├── cad_geri_yazim/                        [Y / K5]
│   │   ├── ihlal_isaretleyici.py             DXFViolationAnnotator
│   │   ├── oneri_isaretleyici.py             DXFOptimizationAnnotator
│   │   ├── katman_politikasi.py              yalnız yeni katmanlar
│   │   └── dxf_butunluk_testi.py             kaynağın geometrisini koru
│   ├── mevzuat_rag/                           [Y / K5, mevcut rag/legal adapter]
│   │   ├── mevzuat_baglami.py                yapı/parsel/yürürlük
│   │   ├── hibrit_mevzuat_getirici.py        HybridRegulatoryRetriever
│   │   ├── madde_kanit_kilidi.py             RuleCitation doğrulayıcı
│   │   ├── yerel_rapor_uretici.py            LocalMimarLLMReportGenerator
│   │   └── sablonlar/teknik_rapor.md.j2      salt kaynaklı rapor taslağı
│   └── orkestrasyon/                          [Y]
│       ├── master_orkestrator.py             bütün K1–K5 sırası
│       ├── hata_yonetimi.py                  fail-fast ve kısmi kapsam
│       ├── rapor_oncesi_kapi.py              consistency gate
│       └── disari_aktarma.py                atomik rapor ve DXF
├── config/
│   ├── mimari_siniflar.v1.yaml                [Y] 15 kanonik oda türü
│   ├── gnn_oznitellik_haritasi.v1.yaml        [Y] 15->9 eski model eşlemesi
│   ├── geometri_toleranslari.yaml            [Y] toleranslar, gerekçeler
│   ├── tahliye_senaryolari.yaml              [Y] ölçülü kalibrasyon
│   ├── mevzuat_surumleri.yaml                [Y] belge hash/yürürlük
│   └── rapor_seviyeleri.yaml                 [Y] kod şiddetleri
├── tests/
│   ├── sentetik/k1_*.py ... k5_*.py          [Y]
│   ├── sozlesme/test_*.py                    [Y]
│   ├── guvenlik/test_kaynak_katmanlari.py     [Y]
│   ├── metamorfik/test_birim_ve_rotasyon.py  [Y]
│   ├── ozellik/test_graf_degiskenligi.py     [Y]
│   └── kabul/                                [Y] gerçek veri/fiziksel: son aşama
├── docs/
│   ├── teknik/MimarLLM_V2_Master_Teknik_Gelistirme_Rehberi.md [Y]
│   ├── adr/                                  karar kayıtları
│   └── algoritma_dipnotlari.md              [Y]
├── ornek_veri/sentetik/                      [Y] lisanssız çizim yok
└── sonuclar/                                [Y] .gitignore kapsamı
```

**Not:** Dosya sistemi ve Python import uyumluluğu için yeni klasör/dosya adları ASCII `snake_case` tutulur; Türkçe anlatım belgelerde ve arayüzde kalır. Var olan `importers`, `geometry`, `rag`, `reports` klasörleri korunur.

## 3. Veri sözleşmeleri ve değişmez alanlar

### 3.1 Kanıt zinciri (her nesnenin ortak metaverisi)

```python
@dataclass(frozen=True)
class SourceEvidence:
    source_sha256: str
    source_type: Literal['DXF', 'PDF', 'USER_DECLARATION']
    entity_handle: str | None
    layout_name: str | None
    block_insert_path: tuple[str, ...]
    page_number: int | None
    source_bbox: tuple[float, float, float, float] | None
    floor_id: str | None
    coordinate_frame_id: str
    unit_scale_to_meters: float | None
    calibration_state: Literal['CONFIRMED', 'HYPOTHESIS', 'UNKNOWN']
    provenance_status: Literal['SOURCE', 'INFERRED', 'REVIEWED']
```

**Kurallar:** `source_sha256` bütün giriş için zorunlu; kaynak koordinatı ve normalize metre koordinatı birbirine karıştırılmaz; otomatik sanal kapı çizgisi gerçek `DoorGeometryInput` sayılamaz; `INFERRED` / `HYPOTHESIS` veriden kesin ihlal çıkarılmaz. Yetersiz kanıtta `HOLD`.

### 3.2 Ana iş sözleşmeleri

| Veri nesnesi | Zorunlu alanlar | Değişmez karar |
|---|---|---|
| `RoomPolygonInput` | `room_id`, `floor_id`, `polygon_m`, `room_type`, `source_refs`, `geometry_confidence` | `area_m2` koordinat birimi doğrulanmadan kullanılamaz. |
| `DoorGeometryInput` | `door_id`, `floor_id`, `segment_m`, `room_ids`, `clear_width_m`, `fire_rating`, `source_refs` | Kanat çizim genişliği temiz net genişlik değildir. |
| `Building3DRAGResult` | `graph`, `floors`, `exits`, `unit_state`, `source_registry` | `nx.Graph` fiziksel geçiş grafıdır; yönlü tahliye ağı ayrı türetilir. |
| `BuildingProgramSummary` | `floor_areas`, `room_count_by_type`, `occupancy_basis` | Kişi sayısı dayanak olmadan otomatik kesinleştirilmez. |
| `DiscoveredArchitecturalMotif` | `wl_hash`, `matched_instances`, `exact_vf2_support`, `provenance` | WL hash kesin izomorfizm kanıtı değildir. |
| `CoarsenedBuildingResult` | `coarse_graph`, `macro_registry`, `internal_max_escape_m` | Makro grafın metrikleri, özgün graf üzerinde kontrol edilir. |
| `CandidateDiagnosticReport` | `anchor`, `stage`, `violations`, `mapping`, `evidence` | Aday veya gevşetilmiş eşleşme uygunluk anlamına gelmez. |
| `RuleViolationItem` | `code`, `severity`, `floor_id`, `room_ids`, `measured`, `required`, `regulation_ref`, `source_refs`, `status` | İhlal ve öneriler tam kanıt + yürürlük zincirine dayanır. |
| `BuildingEvacuationReport` | `scenario_id`, `time_sec`, `spillback_blocked_sec`, `bottlenecks`, `assumptions` | Simülasyon sonucu sertifikalı güvenli süre değildir. |
| `DesignInterventionStep` | `type`, `affected_ids`, `parameter_delta`, `cost_estimate`, `predicted_delta_time`, `constraint_checks` | Yapısal tadilat, uzman inceleme adayıdır. |
| `CounterfactualOptimizationResult` | `interventions`, `total_cost`, `before_after`, `feasibility`, `pareto_candidates` | Yerel açgözlü seçimden küresel optimum iddiası yapılamaz. |
| `RunAuditEntry` | `step`, `input_hashes`, `config_hash`, `code_sha`, `duration_ms`, `status`, `outputs`, `warnings` | Günlük yalnız sona eklenir; tekrar çalıştırma ayrı run alır. |

### 3.3 Boyut, adlandırma ve belirsizlik standardı

- CAD ham birimleri: **kaynak DXF birimi**; tüm algoritmik uzunluklar **m**, alanlar **m²**, zaman **s**, akış **kişi/s**, maliyet **para birimi + tarih**.
- `floor_id`: tekil ve kalıcı kimlik; `floor_elevation_m` ve `floor_label` ayrı. Yan yana DXF planlarının X/Y koordinatını gerçek bina konumu sayma: `global_dxf_pos` ile `local_floor_pos` ayrı tutulmalı.
- Alan ve kapı ölçümünde `measured.value`, `unit`, `method`, `uncertainty`, `source_refs`, `review_status` birlikte dönmeli.
- `RuleViolationItem.status`: `CONFIRMED_VIOLATION`, `COMPLIANT_FOR_CHECKED_RULE`, `INSUFFICIENT_EVIDENCE`, `HUKUKI_HOLD`, `NOT_APPLICABLE`. Rapordaki **nihai uygunluk** tüm ilgili kontrollerden ve insan incelemesinden bağımsız olarak ilan edilmez.
- `15 kanonik oda sınıfı` ile `x:[N,17]` **doğrudan uyuşmaz**: 17 = 9 grup one-hot + alan 1 + RWPE 6 + çapa 1. Seçenek A, 15 sınıfı sürümlü `15→9` eşleyiciyle koru; seçenek B, modeli yeniden eğiterek `x:[N,23]` (15+1+6+1) yap. Eğitimde, çıkarımda ve model ağırlığında farklı sürüm karıştırmak **FAIL**.

Önerilen 15 kanonik semantik etiketi `living_room`, `bedroom`, `kitchen`, `bathroom`, `wc`, `corridor`, `stair`, `fire_lobby`, `elevator`, `shelter`, `parking`, `mechanical_room`, `storage`, `balcony`, `other` biçiminde **taslak** olarak sürümle. Nihai eşleme gerçek eğitim sınıflarıyla karşılaştırılmadan kilitlenmez. `unknown` zorunlu ayrı durumdur; `other` yerine gizlenmez.

## 4. K1 — DXF ayrıştırma ve poligon kurtarma

**Sınıflar:** `DXFFloorplanParser`, `WallLinePolygonizer`, `TurkishArchitecturalLabelClassifier`.

**Akış:** dosya SHA → güvenli `ezdxf.readfile` → model/paper layout kontrolü → `$INSUNITS` ve bağımsız kalibrasyon → `INSERT` içi dönüşümler (rotation/scale/nested block) → `LWPOLYLINE` (bulge yayları ölçülü discretize) / `LINE` / `ARC` → kat adası ayrımı → kapalı geometriler → etiket-oda STRtree → kapı semantiği → oda ve kapı listeleri.

**Fallback:** *Kaynaklı ve güvenilir* kapalı oda poligonu sayısı 2'den azsa çizgi poligonlama adayına geç. Bu eşik algoritmik **çalıştırma koşuludur**, kalite güvencesi değil. Önce uç noktaları metre uzayında toleransla ilişkilendir; kesişimleri düğümle (`unary_union`); `polygonize` ile yüzey adaylarını çıkar; duvar kalınlığı kaynaklıysa geometriyi sınıflandır. 4 cm snap / 35 cm köprü / negatif tampon gibi değerler **genel-geçer mimari gerçek değildir**; aday üretirken sürümlü tolerans olarak kaydet, otomatik kapı ilişkisine dönüştürme. Özellikle `buffer(-r)` ile kaybolan ince odalar için geriye dönüş ve alan farkı testi yap.

**Kontroller:** kendini kesen polygon, zero-area, overlap, duplicate room; katlar arası yanlış bağ; `unknown / toplam etiket` > %15 olduğunda *uyarı* (otomatik red değil). 0 etiket varsa payda belirsiz; `UNKNOWN_LABEL_RATIO_UNDEFINED`. Kaynaklı net alan doğrulaması bağımsızdır.

**İlgili kodlar:** `CAD_UNIT_UNCONFIRMED`, `UNCLASSIFIED_ROOM_LABEL`, `POLYGON_REPAIR_UNVERIFIED`, `DOOR_GEOMETRY_AMBIGUOUS`, `FLOOR_CLUSTER_AMBIGUOUS`.

## 5. K2 — çok katlı topoloji, motif madenciliği ve hiyerarşik graf

### 5.1 MultiFloor3DRAGBuilder

Oda/hol/merdiven düğümleri; kapı, geçiş, merdiven, şaft türlerinde kenarlar. `pos_3d=(local_x_m,local_y_m,elevation_m)`; orijinal DXF konumu ayrı. Yan yana çizilmiş planlar koordinat uyuşması değildir. Merdivenler kat kimliği, antet, çekirdek aday geometrisi ve kullanıcının kat eşleştirmesiyle bağlanır; yalnız geometrik yakınlıkla **kesin dikey bağlantı üretilemez**. `usable_in_fire` asansörler için genel tahliye senaryosunda `False`; varsa özel kurtarma senaryosu bağımsız, uzman onaylı.

**Durdurma kapıları:** dış çıkış yok → `NO_VALID_GROUND_EXIT` ve tahliye durur. Bağlantısız bileşen mevcut → hangi odaların kaçışa erişemediği yazılır; otomatik tüm binayı tek graf sayma. Şaftların her biri geçilebilir merdiven değildir.

### 5.2 ArchitecturalSPMiner

Bir yapısal motif, bağlı ve tür kısıtlı alt graf adayıdır. Kademeli büyütme → izomorfizm için WL tabanlı hash ile aday tekilleştirme → NetworkX VF2 **kesin** doğrulaması. `matched_instances: List[Set[int]]`, eşleme kanıtı ve arama bütçesi. `exact_vf2_support = count of verified matches`; yalnız hash aynı diye eşleşti sayma. Daire sayı/alanları bina programına kaydedilir; kapalı graf olmayan alanlarda `HOLD`.

### 5.3 ArchitecturalGraphCoarsener

Bağımsız birimleri makro düğüme indirirken `macro_registry` içinde orijinal düğümler, kapılar, iç erişim derinliği, kaynak ve sınır düğümleri saklanır. Makro kenar uzunluğunu yalnız merkezler arası Öklid mesafesiyle verme. En kötü durum için erişim yolu üst sınırını özgün graf ve kapıdan çıkış yoluyla hesapla. Optimizasyon son kontrolünde **orijinal graf** üzerinde yeniden çalış.

## 6. K3A — nöro-sembolik yangın denetimi

### 6.1 GNN öznitelikleri

Çapa merkezli k-hop ego-graflar için `x_v=[onehot(room_group_9), area_m2/100, diag(P^1)_v ... diag(P^6)_v, is_anchor]`, `P=D^{-1}A`. İzole düğümlerde sıfır derece kuralı belirlenir. Kaynak düğüm sırası, kenar yönü ve RWPE üretimi deterministik kalır. Kenar özniteliği `edge_attr=[clear_width_m, distance_m/20, fire_resistance_indicator]` yalnız gerçekten ölçülmüş ve sınıf olarak doğrulanmış alanlardan oluşur; eksiklik ayrı `mask`/durumla işlenmelidir (0 = bilinmiyor değildir).

`SpatialOrderGNN`: 3×GINEConv + residual + anchor embedding ve graph pooling → Softplus → `z∈R_+^{64}`. `E(z_q,z_u)=||ReLU(z_q-z_u)||_2²` küçük olan adaylar sembolik doğrulamaya gönderilir. **Önemli:** `z_q <= z_u` yalnız **öğrenilmiş temsil için adaylık sezgisidir**; grafik monomorfizminin matematiksel çift yönlü eşdeğerliği değildir. Model doğrulama recall, false-negative ve aday budama oranıyla ölçülür. Kritik kapsam için en azından baseline VF2 ile çapraz doğrulama veya güvenli geri-düşme yolu olmalı; düşük enerji doğruluğu kanıtlamaz.

### 6.2 VF2 ve 3 aşamalı teşhis

`GraphMatcher(target_graph, query_graph).subgraph_is_monomorphic()` ile **hedef önce, şablon sonra**. Kısmi komşuluk alt grafı monomorfizmi, zorunlu tüm yasal koşulların doğrulandığı anlamına gelmez. Çapa kilidi, tür eşleşmesi, kapı semantiği, kaynak bazlı ölçüm aralıkları, yangın dayanımı ve toplam yol uzunluğu **ayrı sembolik kural fonksiyonlarında** kontrol edilir. Eşlemenin `q_id→u_id` haritası döndürülür. `EI60` ve `30 m` sabit uygulama değerleri değil, **ilgili yapı ve madde koşulundan gelen parametreler** olmalıdır.

| Teşhis seviyesi | Gevşetilen koşul | Bulgular | Statü |
|---|---|---|---|
| 1 | Sayısal özellikler, topoloji ve oda türü sabit | `DOOR_WIDTH_DEFICIT`, `FIRE_DOOR_MISSING`, `ROOM_AREA_DEFICIT`, `TOTAL_ROUTE_EXCEEDED` | `DIAGNOSTIC_ONLY` |
| 2 | Oda tipi gevşetilir | `ROOM_TYPE_MISMATCH` | `DIAGNOSTIC_ONLY` |
| 3 | Çapadan BFS ile kısmi hizalama | `MISSING_DOOR_CONNECTION`, `MISSING_ROOM_NODE` | `DIAGNOSTIC_ONLY` |

Stage 1 başarısız olduğunda Stage 2; Stage 2 başarısız olduğunda Stage 3. *En az ihlalli dal* seçimi `(kritik ihlal sayısı, desteklenen ihlal sayısı, sapma büyüklüğü, deterministik kimlik)` ile kararlı sıralanır; kanıtsız “uygun” üretilmez. İhlal yoksa bile kapsam dışı şablonlar ayrıca raporlanır.

## 7. K3B — bodrum, sığınak ve otopark denetimi

`BasementComplianceAuditor` önce bodrum grafını, yapı kullanım sınıfını, ruhsat/uygulanabilir tarih ve kapasite dayanaklarını ister. Sığınak alanı, giriş/çıkış, hava kilidi/hol, WC, havalandırma, otopark adedi, rampa ve tahliye bağlantısı kural **kütüphanesine bağlı** denetlenir. `kişi × 1 m²`, `%20 rampa`, `otopark→merdiven yasak` gibi ifadeler **her bağlamda geçerli varsayılan sabitler olarak kullanılmaz**. Gerçek yasal hüküm, istisna, geçiş maddesi, kullanım türü ve denetim tarihine göre `required` doldurulur. Kaynak veya ruhsat bilgisi eksikse `HUKUKI_HOLD`.

Kapsam kodları: `SHELTER_AREA_DEFICIT`, `MISSING_AIRLOCK_LOBBY`, `SHELTER_EGRESS_EVIDENCE_MISSING`, `PARKING_COUNT_DEFICIT`, `PARKING_RAMP_GRADE_EXCEEDED`, `PARKING_DIRECT_STAIR_CONNECTION` (yalnız bağlamlı kuralla desteklenmişse kesin ihlal).

## 8. K4 — zaman adımlı tahliye simülasyonu

### 8.1 Yönlü tahliye ağı ve statik darboğaz

Fiziksel `G_3d` üzerinde çıkışa erişilebilirlik doğrulanır. Kullanılmayan asansör kenarları çıkarılır. Çoklu çıkışlardan **çok-kaynaklı Dijkstra** ile ters yönlü uzaklık (yönlü ağda gerekli ters yön adaptasyonu) hesaplanır. Mesafe kesin azalan seçilen kenarlar üzerinden yönlü çevrimsiz tahliye ağı (DAG) türetilebilir; döngü ve eşit mesafe bağları deterministik olarak çözülür. Her mekânda birden fazla güvenli seçenek gerekiyorsa çok-yollu yönlendirme politikası senaryoyla birlikte saklanır.

Statik `minimum_cut`, kapı/merdiven/koridor debi kapasitesiyle oluşturulan yardımcı `DiGraph` üzerinde, **süper kaynak (başlangıçlara bağlanmış), süper hedef (dış çıkışlara bağlanmış)** ile hesaplanır. Süper kenarlar gerçek kapasiteyi kısıtlamamalı; sonlu üst sınır seçimi gerekçeli olmalı. Min-cut `kişi/s` olarak **teorik üst sınırdır**; tek başına tahliye süresi, mevzuat uyumu veya sertifika değildir. Görsellerde `Q_min=42 kişi/sn` gibi rakamlar ancak kaynaklı örnek veriyle, aksi halde **temsili** etiketiyle verilebilir.

### 8.2 Hücre-iletim ve geri-tıkanma

`dt=0.5 s` örnek çözünürlüktür, kalibrasyon parametresi olarak tanımlanır. `C_hold(v)=A_usable(v)×rho_max(v)` kişi; yoğunluk üst sınırı (`3.5 kişi/m²` gibi) **ampirik senaryo parametresi**, mevzuat sabiti değildir. `Space(v,t)=max(0, C_hold(v)-N_v(t))`.

Her kenar için önerilen akış `phi(u,v,t) <= min(demand(u,t), Qmax(u,v)×dt, allocated_space(v,t))`. Bir hedef hücreye birden fazla kaynak girdiğinde toplam tahsis **tek hedef kapasitesini aşmayacak şekilde** atomik ve deterministik yapılır; `Space(v)×paylaşım_oranı` ifadesi ancak tüm oranların toplamı ≤1 ise geçerlidir. Önce bütün kenar akışları hesaplanır, **sonra eşzamanlı** `N_v(t+dt)=N_v(t)+Σin phi−Σout phi` uygulanır. Bir zaman adımı içinde yeniden gelen nüfus tekrar harcanamaz.

**Korunumluluk:** `initial_occupants = inside + exited (+ explicitly modeled casualties)`. Negatif kişi yok; kayan nokta yaklaşımı veya tamsayı ayrımı raporda belirtilir. Kuyruk, engellenen akış ve geri-tıkanma süreleri kenar/oda düzeyinde zaman serisiyle saklanır. Kuyruğun aşağı çıkıştaki dar kapıdan merdiven sahanlığına ve üst kata geriye yayılması, mimari kesitte **gerçek iniş kolları ve sahanlıklar** ile gösterilir.

**Kalibrasyon:** antropometri, yürüme hızı, iniş hızı, kişi dağılımı, engellilik/yardım senaryoları, duman varsayımları, kapı kapasite katsayısı ve kaynak verisi açıkça listelenir. Bu model duman/ısı CFD değildir; yangın yayılımını simüle ettiğini iddia etmez.

## 9. K4 — karşı-olgusal tadilat optimizasyonu

**Müdahaleler:** `DOOR_WIDEN`, `STAIR_CLEAR_WIDTH_WIDEN`, `HOLDING_AREA_EXPAND`, `ADD_PROTECTED_CONNECTION` yalnız mimari ve statik yapılabilirlik inceleme adayıdır. Taşıyıcı kolon/şaft/çekirdek değişikliği otomatik uygun tadilat kabul edilmez; `STRUCTURAL_REVIEW_REQUIRED`.

**Döngü:** ilk simülasyon → riskli darboğaz ve 3 kademe alt akış nedeni → adayların kaynaklı `G_3d` kopyasında uygulanması → aynı senaryo tohumlarıyla yeniden simülasyon → fayda/maliyet → en iyi **yasal ve fiziksel adayın** kabulü → tekrar → geriye dönük fazlalık budaması → özgün graf üzerinde son denetim.

Örnek skorlama: `eta(a)=(w_T·ΔT + w_K·Δkritik + w_S·Δskor)/cost(a)`. `18,40,1.5` gibi ağırlıklar **proje/deney parametreleri**, mevzuat değildir; farklı birimlerdeki faydalar normalize edilmeli ve senaryo duyarlılığı raporlanmalıdır. Maliyet sıfır veya belirsizse bölüm yapılmaz. `delta_time` iyileşme yönü açık: `T_before−T_after`.

**Kısıtlar:** geçerli mevzuat alt sınırları; yangın dayanımlı kapı sınıfı; taşıyıcı sistem; sığınak ve otopark işlevi; kapı açılma yönü; erişilebilirlik; net alan ve kaçış sürekliliği. Her müdahale sonrası K3A/K3B kural kapsamı ve VF2 **yeniden** çalışır. Sadece `90 cm` sert engeli koyma: kapı genişliği, bina türü ve mevzuat kapsamına göre değişebilir (bkz. §12). `Pareto-optimal` ancak aday kümesi içinde domine edilmeyen sonuçlar gerçekten hesaplanmışsa; açgözlü + backward pruning tek başına küresel minimum maliyet kanıtlamaz. Ulaşılamayan hedef için `TARGET_UNREACHABLE`.

## 10. K5 — kaynak-koruyan DXF geri yazım

`DXFViolationAnnotator`: ayrı `DENETIM_IHLALLERI` katmanı, ACI 1 kırmızı; açık hat ve tarama işaretleri kaynak yüzeye *yorum* olarak bindirilir. `DXFOptimizationAnnotator`: `OPTIMIZASYON_ONERILERI`, ACI 3 yeşil, revizyon bulutu / öneri kapısı / ölçü çizgisi. Renk sadece görselleştirme etiketidir; **hukukî karar değildir**.

**Koruma:** giriş dosyasının SHA'sı; orijinal entity handle/layer geometry; blok tanımı; text; dimension; XREF referansları; katman renk/linetype. Çıkış ayrı yol, atomik `.tmp→.dxf` yazımı; orijinal dosya asla üzerine yazılmaz. Revizyon bulutu üretimi geçerli DXF polyline/bulge ile, kapalı sınır ve yön denetimiyle yapılır. Görselleştirme kodu başka katmanları güncelleyemez. `assert original_entity_fingerprint_subset_of_output` ve yeni entitylerin **yalnız iki izinli katmanda** bulunduğu testi şarttır. Kaynak çizime fiilen yeni kapı açılmaz; öneri katmanında gösterilir. Fiziksel çizim değiştirme ayrı insan onaylı CAD edit işidir.

## 11. Mevzuat RAG, yürürlük ve kanıt kilidi

Dört mantıksal indeks: `tr_yangin`, `tr_imar`, `tr_siginak`, `tr_otopark`. Mevcut `legal/` ve `rag/` çekirdeğini kullan. Belgelerin resmî erişim yeri, yayın/son değişiklik, yürürlük ve geçiş hükmü, PDF/SHA, sayfa/bölüm/alt bent, metin lisansı, elden geçirilen sürüm bilgisi kataloglanır. Kullanıcıya ait tam standardın lisanssız kopyasını pakete gömme.

**Retrieval:** kural kodu + bina türü/kat/parsel/yapı ruhsat tarihi filtreleri → sürümlü yasal indeks → BM25/FTS5 + Türkçe n-gram/lexicon adayları → kaynak sayfası → insan onayı veya doğrulanmış parser eşleşmesi. Yerel GGUF/LLM yalnız maddelerden **kaynaklı açıklama taslağı** oluşturabilir; kanıt boşluğunu dolduramaz. `regulation_ref` hiçbir zaman yalnız modelin serbest ürettiği madde numarası olamaz.

```json
{
  "regulation_ref": {
    "corpus": "tr_yangin",
    "document_title": "Binaların Yangından Korunması Hakkında Yönetmelik",
    "article_id": "47",
    "subsection": null,
    "effective_on_project_date": null,
    "document_sha256": "<gercek kaynak saglandiginda>",
    "source_url": "<dogrulanmis resmi adres>",
    "passage_id": "<yerel indeks kaydi>",
    "verification": "HOLD"
  },
  "rule_result": "INSUFFICIENT_EVIDENCE"
}
```

**Özel uyarı — kapı temiz genişliği:** Binaların Yangından Korunması Hakkında Yönetmelik Madde 47(1)'de kaçış yolu kapıları için örneğin **80 cm** temiz genişlik hükmü bulunmaktadır; başka hükümler (bina durumu, kişi yükü, merdiven/koridor ve mevcut yapı koşulları) farklı hesap veya istisna getirebilir. Bu nedenle önceki `her yangın kapısı en az 90 cm` kuralı **evrensel yasal ölçü olarak kullanılamaz**. Karar, uygulanabilir konsolide metin, ilgili fıkra ve proje bağlamıyla alınır. 2025–2026 mevzuat değişiklikleri görüldüğü için sabit rakamlar kod içine gömülmez.

**Mevzuat durumu:** 23.10.2026 itibarıyla kaynak taramasında Planlı Alanlar İmar Yönetmeliği için 01.07.2026 konsolide güncellemesi, Sığınak Yönetmeliği için 07.11.2025 değişikliği, Otopark Yönetmeliği için 27.12.2025 değişikliği görülmektedir; bu tarih bilgileri üretim öncesi resmî birincil kaynaktan tekrar doğrulanmalıdır. İlgili yapının ruhsat/geçiş tarihi bilinmiyorsa hukukî kesin karar `HOLD`.

### 11.1 Üretilecek resmî raporun kuralları

- **Yönetici özeti:** analiz kapsamı, ihlal adedi (kritik/önemli/bilgi), simülasyon durumu, süre/hedef, maliyetin para birimi ve belirsizliği.
- **İhlal tablosu:** kat, mekan, kod, ölçülen değerin kaynağı, gereken değerin madde/fıkrası, kanıtın kesinlik durumu; kanıt yoksa `mevzuat eşleşmesi bulunamadı`.
- **Tahliye:** graf sürümü, kişi sayısı dayanağı, çıkış sayısı, kritik kenarlar, min-cut/akış birimleri, geri-tıkanma ve tahliye süresi, senaryo sınırlamaları.
- **Tadilat:** sıra, değişen düğüm/kenarlar, çizim kanıtı, maliyet dayanağı, fayda, yeni ihlal olup olmadığı, statik inceleme koşulu.
- **Sınırlamalar:** tüm geçici toleranslar, bilinmeyen etiketler, kalibrasyon, eksik mevzuat ve kapsam dışı katlar.
- **Dosyalar ve audit:** 3 teslim dosyası + SHA256 + yazılım/konfigürasyon sürümleri.

## 12. Master orkestratör akışı ve hata semantiği

```python
async def run_mimarllm_v2(job: AuditJob) -> AuditOutputs:
    ctx = create_run_context(job)            # sabit sürümler, kaynak SHA, durum
    pre = check_input_file_and_units(ctx)     # eksikse HOLD, tahmin etme
    rooms, doors = run_k1(ctx, pre)          # poligon ve kanıt
    graph = run_k2(ctx, rooms, doors)        # çıkış yoksa STOP
    fire, basement = await bounded_parallel( # bağımsız, salt okunur
        run_k3a(ctx, graph), run_k3b(ctx, graph)
    )
    evacuation = run_k4_sim(ctx, graph) if can_simulate(ctx) else hold_result()
    interventions = run_k4_opt(ctx, graph, evacuation) if must_optimize(evacuation) else []
    consistency = revalidate_all(ctx, graph, fire, basement, interventions)
    return run_k5_atomic(ctx, consistency)  # kaynak değişmez, iz yazılır
```

**Çalışma sırası:** K0 kaynak doğrulama; K1 geometri; K2 çok katlı topoloji + miner/sıkıştırma; K3A/K3B bağımsız çalıştır; K4 statik min-cut + dinamik tahliye; K4 karşı-olgusal iyileştirme; yeniden sembolik inceleme; K5 DXF/RAG/rapor. Her aşama `stage_started`, `stage_finished` veya `stage_failed` olaylarıyla `audit_trail.json` üretir. `audit_trail` tek JSON dizi dosyası olarak kapanışta atomik üretilebilir; işlem sırasında ise idempotent ve hashli JSONL event-stream kalıcı yazılır, final JSON'a dönüştürülür.

**Hata durumları:** `PASS` (tekil teknik kontrolün kanıtı tamam), `HOLD` (yetersiz kanıt/ruhsat/mevzuat), `PARTIAL` (yalnız tanımlı alt kapsam), `FAIL` (tutarsız sözleşme/sistem hatası), `NOT_RUN` (bağımlılık eksik). `HOLD` hiçbir zaman `PASS` yerine geçmez. CAD ayrıştırma hata verirse sonraki raporda tahmini boş alan doldurulmaz. Basamak durumları tablosu raporda görünür.

**Güvenlik:** yerel dosya path traversal engeli; uzantı/format/byte sınırı; DXF bombası (aşırı entity/nested block) zaman/bellek limiti; geçersiz poligon sayısı üst sınırı; haricî URL'yi otomatik açmama; yerel modelden gelen metni kural komutu gibi yürütmeme; rapor yollarında atomik yazma; özel projeleri `git` dışına alma.

## 13. Örnek tam audit trail ve karar nesnesi

```json
{
  "schema_version": "1.0",
  "run_id": "<UUID>",
  "source_sha256": "<sha256>",
  "repository_commit": "<git-sha>",
  "config_sha256": "<sha256>",
  "regulation_catalog_version": "<version>",
  "started_at": "<ISO-8601>",
  "status": "HOLD",
  "stages": [
    {"name":"K0","status":"PASS","input_sha256":"<sha256>","output_ref":"source_manifest.json"},
    {"name":"K1","status":"HOLD","reason":"CAD_UNIT_UNCONFIRMED","output_ref":null},
    {"name":"K2","status":"NOT_RUN","blocked_by":"K1"}
  ],
  "counts": {"violations_confirmed":0,"unreviewed_candidates":0},
  "limitations": ["Metre kalibrasyonu doğrulanmadı"],
  "output_files": []
}
```

## 14. Test matrisi ve kabul kapıları

| Test türü | Şart | Başarısızlık örneği |
|---|---|---|
| Sözleşme testleri | pydantic/schema versiyonları, alan ve birimler | yanlış `[N,17]`/`[N,23]` model eşleşmesi |
| CAD sentetik | farklı $INSUNITS, bulge, nested INSERT, layer 0, poligon | açı veya ölçek yanlış, hayalî kapı |
| Metamorfik | tüm çizimi ötele/rotasyon uygula; normalleştirilmiş sonuç değişmesin | plan sayısı değişti |
| Kaynak bütünlüğü | giriş `entity_fingerprint` tümü korunur | orijinal katman silindi |
| Graf ve VF2 | hedef/sorgu argüman sırası; pozitif/negatif örnekler | yanlış monomorfizm |
| GNN | `recall@K`, false negative, seed determinismi, hold fallback | ihlal adayı atlandı |
| Tahliye | kütle korunumu, hedef depolama sınırı, negatif doluluk yok | 2 akış kapasiteyi aştı |
| Optimizasyon | mevzuat/regresyon kontrolü, maliyet >0, yapısal HOLD | yeni ihlal üretti |
| Mevzuat | yürürlük, madde/fıkra, kaynak SHA, ruhsat geçişi | sahte madde/yanlış tarih |
| Güvenlik | DXF/LLM kötü girdileri, yol ve dosya sınırı | kaynak üzerine yazma |
| CI | Ubuntu + Windows + Edge sözleşme smoke | herhangi zorunlu iş başarısız |
| Son fiziksel kabul | gerçek DXF/PDF + yerel Windows/Edge + RTX 4070 + offline kurulum + uzman | PENDING, yazılım PASS değil |

Ölçülecek araştırma metrikleri: CAD oda IoU ve kenar doğruluğu, kapı precision/recall, kat ayrımı doğruluğu, GNN aday recall, VF2 eşleştirme kalitesi, mevzuat `Recall@10` ve citation precision, kişi korunumu hatası, simülasyon çalışma zamanı, müdahale sonrası ihlal regresyonu, CPU/RAM/VRAM/latency ve yeniden üretilebilirlik. **Ölçülmemiş performans iddiası yazma:** “milisaniyelik budama”, “%80 graf küçültme” vb. yalnız gerçek benchmark varsa sonuç olur.

## 15. Uygulama sırası ve PR kapsamı

1. **Paket-00 / temeller:** tek kaynak `src/mimarllm`, ADR, `AGENTS.md`, typed sözleşmeler, kanıt/durum/audit ve Türkçe PR şablonları. CI sentetik.
2. **Paket-01 / K1:** DXF normalizasyon, poligon fallback, kat adaları, kaynak izleri; agresif snap yalnız aday.
3. **Paket-02 / K2:** katlar arası graf, dış çıkış kapısı, motif ve sıkıştırma kanıtı.
4. **Paket-03 / K3:** mevzuat şablon registry + VF2 önce; GNN yalnız optimizasyon adayı; bodrum kural motoru.
5. **Paket-04 / K4:** yönlü tahliye ağı, min-cut, zaman-adımlı kütle korunumu, kaynaklı simülasyon parametreleri.
6. **Paket-05 / optimizasyon:** yalnız uygulanabilir müdahaleler, maliyet, yeniden sembolik doğrulama, Pareto adayları.
7. **Paket-06 / K5:** ikili DXF anotasyon, mevzuat referansı, rapor, hashli audit.
8. **Paket-07 / bütünleme:** Windows/Edge CI + tam sentetik regresyon + kilitli yük senaryoları.
9. **Paket-08 / son kabul:** gerçek CAD/PDF, yerel model/GPU, Windows/Edge, tamamen çevrimdışı paket, uzman kontrolü ve resmî mevzuat son sürüm doğrulaması. Son kabul `HOLD` iken bu görevlerin tamamlandığı iddia edilemez.

**Branch/merge:** küçük kapsamlı PR, mevcut required CI başarılı; tek geliştiricili proje için bağımsız inceleme zorunluluğu bir süreç politikası olarak kaldırılabilir, fakat otomatik CI/güvenlik ve bağlamlı mevzuat kanıt kapıları kaldırılamaz. Deponun `main` koruması ve required checks gerçek ayarı kontrol edilmeden doğrudan birleştirme talimatı verilmez.

## 16. Master ajan sistem yönergesi (kopyalanabilir sözleşme)

> Sen MimarLLM V2 Master Orkestratör'sün. Önce kaynak dosya, SHA256, kalibrasyon, kat bağlamı ve uygulanabilir mevzuat sürümünü doğrula. Yalnız izinli modülleri bağımlılık sırasıyla çalıştır. GNN bir aday üreticisidir; uygunluk yalnız kanıtlı sembolik kurallar, uygulanabilir mevzuat ve yeterli kaynak ölçümüyle alt kontrol düzeyinde değerlendirilir. Hiçbir eksik alanı tahmin etme. Modül durumunu PASS/HOLD/PARTIAL/FAIL/NOT_RUN olarak açık kaydet. Asansörü normal yangın tahliye grafından çıkar. Kaynağın DXF katmanlarına dokunma; yalnız DENETIM_IHLALLERI ve OPTIMIZASYON_ONERILERI ekle. Karşı-olgusal önerileri aynı geometri ve mevzuat kuralları altında tekrar denetle. Her sayısal iddiada kaynak, birim, senaryo ve belirsizlik belirt. Yerel LLM kesin mevzuat maddesi uyduramaz. Raporu Markdown, anotasyonu türetilmiş DXF ve işlemi hashli JSON audit olarak üret. Yetersiz hukukî kanıt halinde “mevzuat eşleşmesi bulunamadı” ve HOLD yaz.

## 17. Teknik dipnotlar, referanslar ve doğrulama kaynakları

1. **[CAD]** `ezdxf` belge ve entity API'leri: https://ezdxf.readthedocs.io/ ; block INSERT, bulge ve `$INSUNITS` için sürüm/dönüşüm doğrulaması gerekir.
2. **[GEOM]** Shapely kılavuzu: https://shapely.readthedocs.io/en/2.1.0/manual.html ; `unary_union` line noding, `polygonize`, geometri geçerliliği.
3. **[GRAPH]** NetworkX VF2 monomorfizm: https://networkx.org/documentation/stable/reference/algorithms/generated/networkx.algorithms.isomorphism.DiGraphMatcher.subgraph_is_monomorphic.html ; çağrıda hedef grafın önce verilmesine dikkat.
4. **[FLOW]** NetworkX akış/min-cut ve Dijkstra: https://networkx.org/documentation/stable/reference/algorithms/flow.html ; fiziksel kişi/s kapasitesi ve yönlü graf sözleşmesi.
5. **[PYG]** PyTorch Geometric GINEConv: https://pytorch-geometric.readthedocs.io/en/latest/generated/torch_geometric.nn.conv.GINEConv.html ; `edge_attr` tensör şekli model sürümüne bağlıdır.
6. **[BYKHY]** Binaların Yangından Korunması Hakkında Yönetmelik; özellikle Madde 31 ve 47, uygulanabilirliği proje türüne göre teyit: https://www.turofed.org.tr/TR/2025/180/Binalarin-Yangindan-Korunmasi-Hakkinda-Yonetmelik ; resmî metinle karşılaştırma zorunlu.
7. **[PAİY]** Planlı Alanlar İmar Yönetmeliği, 01.07.2026 tarihli konsolide sürüm bildirimi: https://www.lexpera.com.tr/mevzuat/yonetmelikler/planli-alanlar-imar-yonetmeligi-4 ; özgün Resmî Gazete değişikliklerini kontrol edin.
8. **[SIĞINAK]** 07.11.2025 tarihli 33070 sayılı Resmî Gazete değişikliği: https://resmigazete.gov.tr/eskiler/2025/11/20251107-2.htm ; geçiş ve yapı türü koşulları önemlidir.
9. **[OTOPARK]** 22.02.2018 tarihli 30340 sayılı Otopark Yönetmeliği: https://aile.gov.tr/eyhgm/mevzuat/ulusal-mevzuat/yonetmelikler/otopark-yonetmeligi/ ; 27.12.2025 değişiklikleri için https://www.resmigazete.gov.tr/eskiler/2025/12/20251227-6.htm .
10. **[GNN]** RWPE ve order embedding ifadeleri deneysel/öğrenilmiş model özellikleridir, yönetmelik kararı değil. Kabul raporunda *GNN recall* ayrı yayımlanmalı.
11. **[SIM]** Hücre iletim ve tıkanma modeli mühendislik simülasyon varsayımıdır. `rho_max`, `Q_max`, yürüyüş hızı ve hedef tahliye süresi saha/standart/uzman dayanağı olmadan kesin değildir.
12. **[LEGAL]** TS standartları ve tam korpuslar telif ve lisans kapsamına girebilir; otomatik internetten indirip depoda dağıtmayın.
13. **[STATUS]** Mevcut repo temel durumu (README, `main`): https://github.com/seydivakkas/MimarLLM_v2 ; özel erişim gerektirir. Bu belge önerilen hedefleri mevcut koddan bilinçli biçimde ayırır.

---

**Nihai mühendislik kararı:** `TEKNIK_TASARIM_HAZIR / MODUL_UYGULAMA_DOGRULAMASI_BEKLIYOR / GERCEK_MEVCUAT_KANITI_HOLD / FIZIKSEL_SON_KABUL_HOLD`. Bu değerler gerçek uygulama ve test kanıtları geldikçe, `audit_trail.json` ile değiştirilebilir.
