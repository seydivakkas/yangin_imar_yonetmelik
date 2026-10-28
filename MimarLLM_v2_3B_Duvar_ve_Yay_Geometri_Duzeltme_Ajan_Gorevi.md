# MimarLLM_v2 — 3B Duvar Yerleşimi ve Yay Geometrisi Düzeltme Görevi

> **Öncelik:** P0 — 3B geometri doğruluğu  
> **Çalışma alanı:** Yerel proje kaynak kodundaki 3B bina/model görüntüleyicisi  
> **Girdi:** `image(20261025-152753).png` ekran görüntüsü ve yerel çalışan uygulama  
> **Yöntem:** Kök neden analizi → başarısızlığı yeniden üretme → hedefli kod düzeltmesi → test → görsel doğrulama  
> **GitHub:** **İNCELEME YAPMA.** Remote erişimi, GitHub araması, PR, issue, fetch, pull, push ve merge yok. Sadece yerel proje dosyalarını incele ve düzelt.

## 0. Ajanın görevi ve zorunlu sınırlar

Sen MimarLLM_v2'nin **3B bina geometri üretimi ve görselleştirmesi** için görevlendirilmiş bir kodlama ajanısın.

Ekran görüntüsünde bazı duvarlar gerçek oda sınırlarını izlemiyor; diyagonal, üçgensi veya üst üste binen paneller gibi görünüyor. Ayrıca çok sayıda açık mavi **yay biçimli çizgi** odalar, zemin ve duvarların üzerinden geçiyor.

**Bu görüntü yalnızca arıza belirtisidir; kök neden kanıtı değildir.** Geometrinin CAD kaynağından mı, dönüşümden mi, duvar mesh üretiminden mi yoksa bir overlay katmanından mı kaynaklandığını kod ve deterministik testlerle doğrula.

**Kesin sınırlar:**

- Yalnızca ilgili yerel 3B geometri, CAD dönüştürücü, duvar üretici, render katmanları ve bu bileşenlerin doğrudan testlerini değiştir.
- GitHub deposunu, uzak dalları, PR'ları, issue'ları **inceleme**. GitHub web/API/CLI kullanma.
- Çalışan CAD/PDF yükleme, mevzuat, analiz, rapor, Tel Ali tahliye ve diğer modülleri yeniden yazma.
- Yalnızca görüntüyü makyajlayarak problemi kapatma; **geometrik konum ve yön** doğru olmalı.
- Geçerli mimari duvar, kavisli duvar, kapı açılım yayı veya ölçülendirme elemanını kanıtsız silme.
- Dış LLM veya bulut API'si, API anahtarı ve gereksiz yeni ağır bağımlılık kullanma.
- Yerel kod tabanında mevcut yapıları ve konvansiyonları esas al; dosya/fonksiyon isimlerini **uydurma**.
- Normal yazılar, açıklamalar ve raporlar **Türkçe** olsun; mevcut kod sözleşmesi, alan adları ve teknik sabitler korunsun.
- Kullanıcıdan her aşamada onay istemeden sırayla ilerle; doğrulanamayan adımları `HOLD` olarak belirt.
- Gerçek Windows/Edge ve fiziksel GPU doğrulamasını yapılmadan PASS gösterme.

## 1. Görseldeki anormallikleri ayrı hata kayıtlarına ayır

### GEO-WALL-01 — Duvarların yanlış yön/konumda olması

Gözlenen belirtiler:

- Bazı paneller olağan duvar hizasına göre çapraz veya eğik duruyor.
- Bazı duvar yüzeyleri olması gereken oda sınırlarının içine taşıyor gibi görünüyor.
- Tekrarlayan ince/dik elemanlar, duvar kalınlığı veya mesh bileşenlerinin yanlış üretildiği izlenimini veriyor.
- Ekstrüzyon/triangulation kaynaklı üçgensi, tek yüzlü veya kopuk parçalar olasılık dahilinde.

Kontrol edilecek **hipotezler** (kanıtlanmadan bulgu yazma):

1. CAD çizgi ekseni, oda sınırı ve gerçek duvar yüzü birbirine karıştırılmış olabilir.
2. DXF/PDF kaynak koordinatından dünya koordinatına dönüşüm sırasında eksen değişimi, ölçek, işaret, origin veya rotasyon yanlış olabilir.
3. Duvar `start/end` uç noktaları, yön vektörleri, normal vektörleri, kalınlık ofseti veya pivot yanlış olabilir.
4. Lokal ve global transform iki kez uygulanıyor olabilir.
5. Extrusion/triangulation, polygon winding veya vertex indisleri hatalı olabilir.
6. Kavisli/çok segmentli duvarlardan düzlemsel yüzey üretimi yanlış olabilir.
7. Aynı eleman yinelenerek veya farklı katlarda üst üste çiziliyor olabilir.
8. Hatalı geometri yerine **yardımcı debug mesh** gerçek duvar gibi görüntüleniyor olabilir.

### GEO-ARC-02 — Yay biçimli çizgilerin yanlış konum/gösterimi

Gözlenen belirtiler: Çok sayıda açık mavi yay/çember kesiti binanın farklı kısımlarında ve oda sınırları boyunca görünüyor; sahnede kafa karıştırıyor.

Önce çizgilerin **kaynağını sınıflandır**:

- CAD `ARC`, `CIRCLE`, `LWPOLYLINE` bulge veya spline eğrisinden mi geliyor?
- Kapı kanadı açılım yönünü gösteren mimari çizim mi?
- Navigasyon, görüş alanı, sensör, mesafe, 3B grafik ya da başka bir analiz/debug overlay'i mi?
- Kamera/orbit veya sahne yardımcı çizimleri mi?
- Hatalı tessellation, world transform veya yanlış `z`/kot sonucu başka alana taşan yaylar mı?

**Kritik kural:** Yayların tamamını global olarak silmek, sırf görünmesin diye rengi arka planla aynı yapmak veya veri katmanını yok etmek **çözüm değildir**. Kaynağa göre doğru dönüşüm, katman, kapsam ve görünürlük mantığını uygula. Kaynak CAD'de gerçekten kavisli duvar varsa düzgün kavisli yüzey üret; kapı açılım yayıysa uygun çizim/overlay katmanında göster; debug çizimiyse varsayılan görünümde kapalı tut.

## 2. GEO-00 — Yerel kod envanteri ve hata üreten hattı bul

**Bu adım bitmeden rastgele kod değiştirme.**

1. Çalışan 3B görüntüleyicinin giriş bileşenini bul.
2. Model yükleme ve CAD→ara veri→3B mesh dönüşüm hattını izle.
3. Duvarların kaynak verisini ve dönüşüm sonrası koordinatlarını tespit et.
4. `wall`, `mesh`, `extrude`, `polygon`, `geometry`, `transform`, `matrix`, `rotation`, `arc`, `curve`, `overlay`, `layer` benzeri kavramlarla **yalnız yerel dosyalarda** arama yap.
5. Sahnedeki mavi yayları oluşturan render nesnelerini, materyali, layer kimliğini ve kaynak veri tipini tanımla.
6. Aktif 3B grafik kütüphanesini belirle (ör. Three.js ise mevcut Three.js sözleşmelerine göre ilerle; kütüphane varsayma).
7. İlgili veri modellerini ve mevcut testleri tespit et.
8. Görselde görünmeyen kaynak çizim/yapısal veri mevcut değilse önce sentetik sahnede yeniden üret; gerçek referansın yokluğunu açıkça belirt.

**Çıktı:**

| Belirti | Yerel dosya | Fonksiyon/sınıf | Kaynak veri tipi | Hata hipotezi | Kanıt/test |
|---|---|---|---|---|---|
| Duvar yönü | Gerçek dosyayı yaz | Gerçek sembolü yaz | ... | ... | ... |
| Yay çizimleri | Gerçek dosyayı yaz | Gerçek sembolü yaz | ... | ... | ... |

## 3. GEO-01 — Hatanın tekrar üretimini kanıtla

**Önce başarısız test/görsel kayıt, sonra düzeltme.**

1. Ekrandaki hataya benzer bir yerel model veya minimal fixture hazırla.
2. Kaynak çizim verisini değiştirmeden aşağıdaki verileri kaydet:
   - Kaynak entite kimliği ve tipi (`LINE`, `LWPOLYLINE`, `ARC` vb.).
   - Kaynak başlangıç/bitiş noktaları, kat bilgisi ve birim.
   - Kullanılan origin/transform/ölçek ve dünya koordinatları.
   - Üretilen mesh AABB sınırları, segment yönü, kalınlık ve yükseklik.
   - Yaylar için merkez, yarıçap, başlangıç/bitiş açısı, yön ve oluşturulan render noktaları.
3. Aynı kamera açısından **düzeltme öncesi** ekran görüntüsü alabiliyorsan kaydet.
4. Lokal overlay'leri sırayla aç/kapat: CAD çizgileri, kapı açılımı, analiz grafiği, debug yardımcıları. Hangi katmanın yayları ürettiğini göster.
5. Hatanın en az bir testte veya yeniden üretim kaydında gözlenmesini sağla.
6. Test yeniden üretilemiyorsa nedenini yaz; kaynak CAD verisini tahmin ederek oluşturup bunu gerçek veri olarak sunma.

## 4. GEO-02 — Duvar mesh üretimindeki kök nedeni düzelt

Yalnızca doğrulanan nedenin bulunduğu kodu hedefle. Doğrulanan hatanın türüne göre şu denetimleri uygula:

### 4.1 Koordinat dönüşümü

- Kaynak CAD koordinatı → yerel model koordinatı → dünya koordinatı hattını tek kaynakta tanımla.
- Birim dönüşümü (mm/cm/m) tek yerde ve test edilebilir olsun.
- 2B CAD `(x,y)` eksenlerinin 3B sahnedeki zemin düzlemiyle eşleştiğinden emin ol.
- Kat kotu (yükseklik) yatay plan koordinatlarına karıştırılmasın.
- Parent transform ve child mesh transform'un iki kez uygulanmasını önle.
- Matrix dönüşümünde negatif determinant/mirror etkisi varsa polygon winding/normal yönünü kontrol et.

### 4.2 Düz duvar segmenti üretimi

- Segment uzunluğunu **gerçek uç noktalarından** hesapla: `L = sqrt((x2-x1)^2 + (y2-y1)^2)`.
- Dönüşü segment yönüne uygun hesapla (örneğin `atan2(Δy, Δx)`; kullanılan koordinat düzlemine uyarlayarak).
- Kalınlığı duvar ekseninin normal yönünde uygula; başlangıç/bitiş noktalarını yanlışlıkla sağa/sola kaydırma.
- Duvar yüksekliğini düşey eksende ekstrüde et.
- Degenerate (sıfır uzunluklu) ve eksik ölçülü segmentleri sessizce render etme; kontrollü uyarı üret.
- Topolojik olarak birleşen duvarlarda toleranslı uç nokta birleştirme uygula; toleransı veri ölçeğine göre belgeli seç.
- Duvar kapı/pencere boşluklarını kapatmasın; açıklık geometrisini koru.

### 4.3 Çokgen, yüzey ve mesh bütünlüğü

- Polygon winding, yüzey normal vektörü ve triangulation indislerini doğrula.
- Self-intersection, duplicate vertex, ters üçgen ve tek yüzlü kırık panelleri test et.
- Birbirine bağlı olmayan üçgenlerin oluştuğu hatalı extrusion'ı düzelt.
- Ayrı yapı elemanlarının kimliklerini koru; tüm duvarları tek mesh içine körlemesine birleştirme.
- İç içe geçmiş yinelenen mesh'leri kaynak ID ve instance anahtarları üzerinden denetle.
- 2B plan gösterimini düzeltmek adına 3B geometriye rastgele `offset`, `rotation` veya sabit düzeltme ekleme.

### 4.4 Geometrik referansın doğruluğu

- Kaynak CAD/plan verisi mevcutsa duvarların 3B izdüşümünü 2B kaynak segmentlerle karşılaştır.
- Ölçü birimini koruyarak uç nokta, açı, uzunluk, duvar kalınlığı ve kat kotu sapmasını raporla.
- Toleransları çizim ölçeğine ve veri hassasiyetine göre gerekçelendir; evrensel ve keyfî eşik dayatma.
- Kaynakta olmayan duvar veya kapı ekleme.

## 5. GEO-03 — Yay, çember ve eğrileri doğru işle

**Ön koşul:** Her görünen eğrinin geldiği kaynak katman ve entite tipi tanımlanmış olsun.

### 5.1 Kaynak CAD eğrisi ise

- `ARC` için merkez/yarıçap/açı aralığı/bitiş yönünü doğru okuyup dünyaya dönüştür.
- `LWPOLYLINE` bulge bulunuyorsa bulge işaretinden yön ve yay geometrisini doğru üret; bulge'ı sıradan doğrusal segment olarak yorumlama.
- `CIRCLE` ve spline'ı `ARC` ile karıştırma; kapsam dışında ise sessiz bozmak yerine açık uyarı üret.
- Açı birimi (derece/radyan), koordinat eksenlerinin yönü ve saat yönü/ters yön dönüşümlerini test et.
- Uyarlanabilir eğri tessellation kullan; eğrilik/ekran ve dünya hassasiyetini gözet, gereksiz binlerce segment oluşturma.
- Kavisli duvar söz konusuysa çizgiyi gizlemek yerine doğru yüzey hacmine dönüştür.
- Kapı açılım yayıysa doğru kapıya bağlı, uygun yükseklikte ve ilgili görüntüleme modunda göster.

### 5.2 Yardımcı/analiz overlay'i ise

- Kaynak duvar geometrisiyle karıştırma: sahne katmanlarını ayrı tut.
- `CAD çizgileri`, `Kapı açılımları`, `Analiz/rota overlay'leri`, `Debug geometrisi` için ayrı görünürlük anahtarları oluştur veya mevcutlarını düzelt.
- Debug yardımcılarını varsayılan kullanıcı görünümünde kapalı tut; geliştirici modu ile açılabilsin.
- Etiket, yay ve rota çizgilerinin yanlış kat kotuna veya yanlış orijine çizilmesini düzelt.
- Görünürlüğü kapatmak veri kaybına, eksik geometriye veya analiz hesaplarının değişmesine neden olmasın.

### 5.3 Render kaynaklı görünüm bozukluğu ise

- Derinlik testi, depth write, z-fighting, render order, line/material ayarlarını incele.
- Transparency ve X-Ray/Duman gibi modların geometriyi yanlış görünür kılmadığını doğrula.
- Doğru geometriyi render materyali ayarıyla maskelemek yerine, öncelikle sahne geometrisini doğrula.

## 6. GEO-04 — 2B–3B karşılaştırma ve geliştirici tanılama modu

Geliştiriciye yönelik, son kullanıcı arayüzünü kirletmeyen **isteğe bağlı** tanılama ekle veya mevcut debug seçeneğini iyileştir:

- 2B kaynak duvar segmentleri ve 3B izdüşümü farklı katmanlarda karşılaştırılabilsin.
- Bir duvar seçildiğinde kaynak `entity_id`, segment uçları, kalınlık, açı, kat ve dünya koordinatları görülebilsin.
- Yay seçildiğinde kaynak entite, layer, geometrik parametreler ve neden görünür olduğu gösterilebilsin.
- `Düz duvar`, `kavisli duvar`, `kapı açılımı`, `debug/analiz çizgisi` birbirine karıştırılmasın.
- Hatalı veri için `GEOMETRY_INVALID`, `TRANSFORM_MISMATCH`, `ARC_PARAMETER_INVALID`, `DUPLICATE_MESH` gibi anlaşılır hata kayıtları üret; mevcut hata kodu sözleşmesi varsa onu kullan.

Tanılama paneli kalıcı ve dikkat dağıtan yeni neon katmanlara dönüşmemeli. Bu görev genel UI/UX revizyonu değildir.

## 7. GEO-05 — Birim ve bütünleşik testler

Mevcut test altyapısına uyacak şekilde **deterministik, küçük sentetik geometri fixture'ları** oluştur.

| Test | Fixture | Beklenen sonuç |
|---|---|---|
| GEO-T01 | Yatay duvar | Gerçek segment doğrultusu ve kalınlığı doğru |
| GEO-T02 | Dikey duvar | Dönüş ve uç noktalar doğru |
| GEO-T03 | 45° eğimli duvar | Rastgele döndürülmeden eksene oturuyor |
| GEO-T04 | Birleşen iki/üç duvar | Köşelerde açıklık/çakışma tolerans içinde |
| GEO-T05 | Duvar kapı boşluğu | Açıklık duvar mesh'iyle kapatılmıyor |
| GEO-T06 | mm/cm/m veri ölçeği | Dünya koordinatları eşdeğer |
| GEO-T07 | Çoklu kat | Yatay geometri korunurken düşey kot farklı |
| GEO-T08 | Kapalı polygon ekstrüzyon | Normaller ve triangulation geçerli |
| GEO-T09 | Tekrarlanan entite | Sahte çift duvar üretilmiyor |
| GEO-T10 | CAD ARC | Merkez/yarıçap/açı yönü doğru |
| GEO-T11 | LWPOLYLINE bulge ± | İki yönün geometrisi doğru |
| GEO-T12 | Kapı açılım yayı | İlgili kapıya bağlı ve seçili modda görünür |
| GEO-T13 | Debug/analiz overlay | Gizlendiğinde duvar mesh'i/ham CAD verisi değişmiyor |
| GEO-T14 | 2B→3B→plan izdüşümü | Uç noktalar ve boyutlar tolerans içinde |
| GEO-T15 | Kaynakta geçerli kavisli duvar | Yay silinmiyor, düzgün kavisli duvar üretiliyor |
| GEO-T16 | Sıfır uzunluklu/bozuk entite | Uyarı veriliyor; NaN mesh üretilmiyor |

**Ek regresyon:** Mevcut CAD yükleme, kat seçimi, 2B plan, 3B görünüm, X-Ray, kesit, kapı gösterimi ve mümkünse tahliye hareket/çarpışma testlerini çalıştır. Bir modül testini sırf ilgili değil diye silme.

Testlerde:

- Düzeltme öncesi **FAIL** ile düzeltme sonrası **PASS** kanıtını sakla.
- Önemli nokta ve ölçülerin karşılaştırmasında hesaplanan toleransı raporla.
- Çizgi sayısı azaldı diye başarı ilan etme; geometrik doğruluğu ölç.
- Derlenmeyen test dosyası veya atlanan test başarı sayılmaz.
- Gerçek CAD üzerinden doğrulama yapılamıyorsa `REAL_CAD_HOLD` yaz.

## 8. GEO-06 — Görsel kontrol ve kullanıcı kabulü

**Mümkün olan yerel ortamda** aynı veya yeniden üretilebilir kamerayla önce/sonra kanıt üret:

1. İzometrik üstten görünüm.
2. 2B plan görünümü.
3. Duvar köşelerine yakın detay görünümü.
4. Kapı/yay ilişkisini gösteren detay görünümü.
5. Açık ve kapalı overlay karşılaştırması.
6. Birden fazla kat varsa kat seçimi kontrolü.

Dikkat edilecekler:

- Duvarlar tanımlı plan eksenlerinde düzgün birleşiyor mu?
- Üçgensi/çapraz yanlış paneller giderildi mi?
- Kapılar, oda sınırları ve duvar açıklıkları korunuyor mu?
- Geçerli kavisli duvar geometrisi bozulmadan kalıyor mu?
- Yayların kaynağı doğru sınıflandırıldı ve kullanıcı görünümünde gereksiz karmaşa giderildi mi?
- 2B ve 3B geometri tutarlı mı?
- 3B görüntüleyicinin mevcut araçları bozulmadan çalışıyor mu?

**Görüntü iyi görünüyor ama geometrik test başarısızsa görev tamamlanmış sayılmaz.**

## 9. Uygulama sırası ve ilerleme kuralları

Aşamaları **sırayla ve gerçek kod değişikliği yaparak** yürüt:

- [ ] **GEO-00** — Yerel geometri hattını, kaynak entiteleri ve render overlay'lerini belirle.
- [ ] **GEO-01** — Duvar ve yay sorunlarını deterministik olarak yeniden üret; başlangıç kanıtlarını kaydet.
- [ ] **GEO-02** — Yanlış yerleştirilen duvarların doğrulanmış kök nedenini kodda düzelt.
- [ ] **GEO-03** — Yay/çizgi kaynaklarını sınıflandır; gerçek eğri ve overlay davranışını düzelt.
- [ ] **GEO-04** — 2B kaynak/3B dünya koordinat karşılaştırması ve gerekli minimal tanılamayı ekle.
- [ ] **GEO-05** — Sentetik geometri testlerini ve regresyonları çalıştır, başarısızlıkları çöz.
- [ ] **GEO-06** — Önce/sonra görselleriyle yerel görünümü doğrula ve raporla.

**Her aşama sonunda raporla:**

```text
AŞAMA: GEO-XX
DURUM: PASS | PARTIAL | FAIL | HOLD
DEĞİŞEN YEREL DOSYALAR: ...
KÖK NEDEN / KANIT: ...
TEST: ...
SONRAKİ AŞAMAYA GEÇİŞ: ...
```

`PASS`: İlgili kod değişikliği ve planlanan kanıt gerçekten tamamlandı.  
`PARTIAL`: Bazı alt şartlar sağlanmadı; tam olarak belirtilmeli.  
`HOLD`: Gerekli kaynak çizim/veri veya çalışma ortamı mevcut değil ve doğrulama yapılamıyor.  
`FAIL`: Testler başarısız; başarı taklidi yapma.

## 10. Kesin kabul kriterleri

Ajan görevi ancak şu şartlarla tamamlanmış ilan edebilir:

- [ ] Görünür yanlış duvar yerleşimleri **kaynak plan koordinatlarıyla tutarlı biçimde** düzeltildi.
- [ ] Duvarlar hatalı diyagonal/üçgensi parçalar üretmiyor.
- [ ] Duvar kalınlığı, yönü, kotu, kapı ve pencere açıklıkları korunuyor.
- [ ] Yayların hangi kaynak katmandan üretildiği belirlendi.
- [ ] Geçerli CAD/kavisli duvar geometrileri silinmeden, yanlış dönüştürme veya yanlış overlay düzeltildi.
- [ ] Yeni testlerde geometrik doğruluk ve 2B–3B eşleşme kanıtlandı.
- [ ] Mevcut görüntüleme ve komşu modüllerde regresyon bulunmadığı doğrulandı veya kalanlar açıklandı.
- [ ] Kullanılabilir önce/sonra görselleri ve test özetleri hazırlandı.
- [ ] GitHub üzerinde hiçbir inceleme, push, PR veya merge yapılmadı.

### Son teslim biçimi

```text
GEO-WALL-01: PASS / PARTIAL / FAIL / HOLD
GEO-ARC-02: PASS / PARTIAL / FAIL / HOLD
GEOMETRY_TESTS: <gerçek geçen>/<gerçek toplam>
REGRESSION_TESTS: <gerçek sonuç>
VISUAL_CHECK: PASS / PARTIAL / HOLD
REAL_CAD_CHECK: PASS / HOLD
WINDOWS_EDGE_PHYSICAL_CHECK: PASS / HOLD
GITHUB_ACTIONS: NONE

DOĞRULANMIŞ KÖK NEDENLER:
- ...

DÜZELTİLEN YEREL DOSYALAR:
- ...

KANITLAR:
- Düzeltme öncesi / sonrası kayıtları
- Test komutları ve çıkış kodları
- 2B–3B koordinat karşılaştırması

KALAN RİSKLER:
- ...
```

## 11. Ajana son talimat

**Önce duvar geometri üretimini doğrula ve düzelt; sonra yay biçimli nesnelerin kaynaklarını ayır ve gerekli kod düzeltmesini uygula.** Bu, MimarLLM_v2'nin yalnızca 3B geometri görünümüne ilişkin bir iş paketidir. Ürünün tamamını yeniden tasarlama, GitHub'ı inceleme, yeni özellikler ekleyerek kapsamı büyütme. Hedef, mevcut mimari kaynak veriyi koruyarak 3B bina modelini doğru üretmek ve gereksiz/yanlış görselleştirmeyi ortadan kaldırmaktır.
