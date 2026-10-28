# MimarLLM_v2 / DiagramYönetmelik — UI/UX Yeniden Tasarım Ana Ajan Görev Planı

> **Belge türü:** AI kodlama ajanı için uygulanabilir ana görev ve kabul sözleşmesi  
> **Öncelik:** P1 — Okunabilirlik, tasarım tutarlılığı, kullanım akışı  
> **Hedef:** Mevcut işlevleri ve mühendislik hesaplarını koruyarak profesyonel, sakin, erişilebilir bir CAD/BIM analiz arayüzü elde etmek  
> **Uygulama sırası:** Tipografi → Renk/tasarım tokenları → Üç panelli çalışma alanı → Mevzuat Kütüphanesi → Analiz panelleri → Kullanıcı akışları → Kalite ve entegrasyon  
> **Dil:** Kod sabitleri, API alanları ve mevcut sözleşmeler hariç Türkçe dokümantasyon, PR açıklaması ve rapor  
> **Çalışma ilkesi:** Çevrimdışı-öncelikli; harici LLM API veya API anahtarı kullanılmayacak.

---

## 0. AJANA VERİLEN KESİN TALİMAT

Sen bu projenin **UI/UX refaktöründen sorumlu uygulayıcı yazılım ajanısın**. Görevin fikir listesi üretmek değil, mevcut depoda değişiklikleri **aşağıdaki sırayla gerçekten uygulamak**, her iş paketini doğrulamak ve eksikleri raporlamaktır.

1. İşe **gerçek depo ağacını inceleyerek** başla. Projenin repo/ürün adı farklıysa mevcut kimliği değiştirme; doğru uygulama ve web arayüzünü bul. Dosya, bileşen, rota veya komut isimlerini varsayma.
2. **Kullanıcıdan her aşamada yeniden onay istemeden** ve yalnızca gerçek engellerde durarak `UI-00` → `UI-09` sırasını uygula. Her aşamanın kapanış koşulunu kontrol etmeden sonraki aşamayı başarılı sayma.
3. Çalışan CAD/PDF, 2B/3B geometri, mevzuat kanıt zinciri, Tel Ali tahliye mantığı, kayıt/rapor, kimlik doğrulama ve backend sözleşmelerini **koru**. UI düzenlemesi bahanesiyle bunları yeniden tasarlama.
4. **Önce hatayı/iyileştirme ihtiyacını gösteren mevcut durumu kaydet; sonra değiştir; sonra karşılaştır.** Test geçmeden PASS yazma.
5. Gereksiz bağımlılık, framework değişimi, yeni ağır model, servis veya API ekleme. Önce mevcut CSS/token/bileşen sistemini kullan.
6. Yeni stilin ilkesi: **sadelik, iyi metin hiyerarşisi, ölçülü renk, açık iş akışı, görünür durum ve yüksek bilgi kullanılabilirliği**. Neon/cyberpunk, aşırı gradient, yoğun gölge ve dekoratif rozet eğilimini durdur.
7. Bir adım başarısızsa başarısızlığı gizleme: kök nedeni düzeltip yeniden çalıştır. Gerçek ortam gerektiren veya erişilemeyen kontrolleri `HOLD` olarak belirt; sahte ekran görüntüsü, sahte PASS, gerçek olmayan veri üretme.
8. Git üzerinde çalışırken kullanıcının mevcut değişikliklerini silme veya ezme. Korunmuş `main` dalına doğrudan push yapma. Tek geliştiricili projede bağımsız inceleme zorunluluğu uydurma; mevcut zorunlu CI ve dal koruma kurallarına uy.
9. Uygulama boyunca her paket sonunda kısa bir durum raporu oluştur; **belge yazıp durma, kodu da değiştir**. Çalışma yetkisi veya kod erişimi yoksa yapılmış gibi gösterme ve eksikliği açıkça bildir.
10. **Bu dosyayı izleyen ajan için çalışma modu:** önce keşif, ardından küçük ve geri alınabilir commit'lerle kontrollü uygulama, otomatik testler ve kanıtla bitirme.

### Kullanıcı tarafından onaylanmış öncelik

> **Birinci sıra:** Fontlar, renk sistemi ve ana üç panelli çalışma alanı.  
> **İkinci sıra:** Mevzuat Kütüphanesi, analiz panelleri ve kullanıcı akışları.  
> **Son sıra:** Kapsamlı regresyon, görsel kabul, gerçek Windows/Edge fiziksel kabulü.

### Değiştirilemez teknik sınırlar

- Mevcut uygulamanın gerçek modüllerini ve rotalarını koru; görünürde kullanılmıyor diye işlev silme.
- Veri modellerinin/JSON alanlarının, test referanslarının ve backend API sözleşmelerinin adlarını değiştirmen gerekirse önce uyumluluk analizini yap; salt UI işi için bunları değiştirme.
- Raporlama ve kanıt zincirinde mevzuat hükmü, madde, belge, sayfa, geometri, koşul ve doğrulama verilerini kaybetme.
- Üç boyutlu görüntüleyici ve simülasyon mantığının koordinat/durum hesaplarına gereksiz dokunma.
- Arayüz farklı göründüğü için algoritmalar doğrulanmış sayılamaz; özellikle Tel Ali'nin odadan çıkma sorununun bu görevde çözülmüş olduğunu iddia etme.
- Gerçek ölçü, geometri, sonuç, mevzuat hükmü, risk ve tahliye başarısı **uydurma**.
- Windows/Edge nihai kabulü gerçek kullanıcının ortamında yapılacaksa, ajan kendi bilgisayarında geçirdiği testleri bunun yerine koymasın.

---

## 1. HEDEF GÖRSEL SİSTEM

### 1.1 Deneyim ilkeleri

1. **İçerik önce gelir:** Önce çizim, sonuç, tablo, mevzuat ve karar; sonra süs.
2. **Bir ekranda birincil eylem net olmalı:** Kullanıcı nereye tıklayacağını anlamalı.
3. **Nötr yüzeyler baskın:** Renk yalnızca aktif durum, kontrol veya semantik uyarı için kullanılır.
4. **Yüksek okunabilirlik:** Sıkışık ve küçük teknik yazı varsayılan kabul edilmez.
5. **Bağlamsal yoğunluk:** İleri ayarlar istenince açılır; varsayılan ekran gereksiz veriyle doldurulmaz.
6. **Kanıta dayalı mühendislik:** UI özeti gerçek analiz durumunu, kaynaklarını ve sınırlamalarını doğru yansıtır.
7. **Tutarlı gezinme:** Aynı işlem farklı modüllerde aynı bileşen davranışını kullanır.

### 1.2 Tasarım tokenları — başlangıç paleti

Aşağıdakileri tek tek sabit CSS değerleri olarak bileşenlere dağıtma. Öncelikle projede zaten kullanılan token/tema sistemini incele; uygun merkezî değişkenlere taşı.

| Token | Başlangıç değeri | Kullanım |
|---|---|---|
| `--ui-bg` | `#11151B` | Uygulama ana zemini |
| `--ui-surface` | `#1C232D` | Yan panel, kart, araç çubuğu |
| `--ui-surface-raised` | `#252E3A` | Açılır panel ve seçili yüzey |
| `--ui-border` | `#354150` | İnce ayrım çizgileri |
| `--ui-text` | `#E8EDF4` | Ana metin |
| `--ui-text-muted` | `#A9B5C5` | İkincil metin |
| `--ui-primary` | `#6592E6` | Birincil buton / aktif navigasyon |
| `--ui-success` | `#49B891` | Başarı |
| `--ui-warning` | `#E5AC55` | Uyarı |
| `--ui-danger` | `#E36B73` | Kritik hata ve ihlal |

**Not:** Bunlar başlangıç referansıdır; gerçek metin/zemin kombinasyonları kontrast testinden sonra ayarlanacaktır. Her semantik renk için uygun ön plan/yüzey varyantları ayrıca tanımlansın. Tek bir ham renk her yerde kullanılmasın.

### 1.3 Tipografi ölçeği — varsayılan rahat mod

| Öğenin türü | Hedef boyut | Not |
|---|---:|---|
| Ana sayfa başlığı | 24–28 px | Gereksiz büyük harf yok |
| Bölüm başlığı | 18–20 px | Açık hiyerarşi |
| Kart başlığı | 16–18 px | Gerekli olduğunda iki satır |
| Normal metin | 15–16 px | Satır yüksekliği yaklaşık 1.5 |
| Gezinme ve buton | 14–15 px | Açık, görünür etiket |
| Teknik etiket | 13–14 px | Ölçü ve birim korunur |
| Yardımcı metadata | 12–13 px | Yalnız ikincil bilgi |

- Font tercihi: Önce mevcut okunabilir fontu değerlendir; uygunsa **Inter** veya işletim sistemi font yığını. Ek font indirmek/çevrimiçi font servisine bağlanmak zorunlu olmayacak.
- 11 px ve altı gövde yazısı kullanma; çok sıkışık tablolar için bile açıklayıcı alternatif görünüm sun.
- Font büyüklüğüyle birlikte satır yüksekliği, metin genişliği, iç boşluk, hizalama ve başlık kırılımını düzelt.
- Türkçe `İ ı Ş ş Ğ ğ Ç ç Ö ö Ü ü` karakterlerini tüm UI ve testlerde denetle.
- Uzun dosya adlarını, mevzuat başlıklarını ve hata açıklamalarını bilgi kaybetmeden açılabilir/kaydırılabilir biçimde göster.

### 1.4 Boşluk ve boyut kuralları

- Temel boşluk ritmi: 4 / 8 / 12 / 16 / 24 / 32 px; sabitleri mevcut token ölçeğine uyarla.
- Normal tıklanabilir hedefler yeterli yüksekliğe sahip olsun; küçük ikonların açıklayıcı erişilebilir adları olsun.
- Birbiriyle yarışan renkli kartlar, çok sayıda rozet, yoğun parlama, aşırı yuvarlatılmış köşeler ve gereksiz blur/gölge **kullanma**.
- Animasyon yalnız durum değişimini açıklasın; tipik süre 150–200 ms; `prefers-reduced-motion` desteklensin.
- Aydınlık tema mevcutsa bozmadan koru; yoksa yalnız karanlık temayı düzgün çalıştırmak yeterli, ikinci bir tema bu görev için zorunlu değil.

---

## 2. UYGULAMA İŞ PAKETLERİ — BU SIRAYI KORU

Aşağıdaki paketler **sıralı ve bağımlıdır**. Önceki aşamanın kalite kapısı kapanmadan bir sonrakini `PASS` ilan etme.

### UI-00 — Depo, ekran ve risk envanteri

**Amaç:** Ne üzerinde değişiklik yapıldığını kanıtlamak ve mevcut davranışı korumak.

**Uygula:**

1. Git dalı, çalışma ağacı durumu, proje giriş noktaları, frontend framework, UI kütüphanesi ve build/test araçlarını keşfet.
2. Varsa mevcut tasarım becerisi veya otomatik üretilmiş stilleri incele; **UI UX Pro Max'i yeniden çağırma**.
3. Uygulamanın gerçek rotalarını çıkar: Genel Bakış, CAD/PDF, 2B/3B, Analizler, Mevzuat, Tel Ali, Raporlar ve diğer modüller.
4. UI bileşen haritasını oluştur: üst çubuk, sol menü, sağ panel, içerik, tablolar, modallar, toast, grafik, 3B araçlar.
5. Tekrarlanan renkler, 11–12 px yoğun metinler, kesilen başlıklar, neon vurgular, dar kartlar ve çakışan kontrolleri tespit et.
6. Mümkünse uygulamayı mevcut yöntemle çalıştır ve seçilen ekranların **önce** görüntülerini al. Browser/GUI yoksa görüntü alınamadığını dürüstçe not et; kaynak-kod incelemesiyle devam et.
7. Mevcut testleri başlangıç referansı olarak çalıştır veya neden çalışamadığını belgele.
8. Git değişikliklerini koruyan ayrı bir görev dalında çalış; onaylanmamış kullanıcı değişikliklerini taşıma/silme.

**Çıktı:** Mevcut ekran listesi, gerçek dosya yolu haritası, risk listesi, başlangıç test/görsel kanıtı.

**Kalite kapısı:** En azından uygulamanın giriş dosyaları, ortak stil kaynakları, modül rotaları ve temel test komutları doğrulanmış olmalı.

### UI-01 — Tipografi ve okunabilirlik (ilk kod değişikliği)

**Amaç:** Tüm uygulamada metinleri rahat okunur kılmak.

**Uygula:**

1. Font ailesi, `font-size`, `line-height`, `font-weight` ve başlık hiyerarşisini merkezi tokenlarda tanımla.
2. Navigation, buton, input, select, sekme, kart, açıklama, hata ve tablo yazılarını hedef ölçeğe taşı.
3. Tek satıra zorlanan açıklamalarda uygun satır kaydırma, maksimum genişlik veya ayrıntı gösterimi ekle.
4. Teknik gösterimleri bozma: mevzuat madde kodu, ölçü birimi, koordinat, kaynak referansı ve rapor verisi aynen korunmalı.
5. Türkçe metin kırılımını ve Windows sistem fontu geri dönüşünü test et.
6. Tasarım kararı gerektiren içerik azaltımlarını rastgele otomatik silme; yalnızca alternatif görünümle gizle/göster.

**Test:** En az 1366×768 ve 1920×1080 genişlikte kritik metinler okunabiliyor, üst üste binme yok, teknik bilgi kaybolmuyor.

**Kalite kapısı:** Metin tasarımı tekil bileşen istisnaları dışında merkezi olarak yönetiliyor; normal gövde metninde aşırı küçük punto kalmıyor.

### UI-02 — Renkler ve ortak tasarım tokenları

**Amaç:** Sakin, tutarlı ve mühendislik ürünü niteliğinde görünüm.

**Uygula:**

1. Bölüm 1.2'deki paleti mevcut tema sistemine entegre et.
2. İlgisiz camgöbeği/mor/yeşil renk atamalarını semantik tokenlarla değiştir.
3. Normal kartlarda neon kenarlık, parlama, yoğun gradient ve dekoratif gölgeleri kaldır.
4. Birincil buton, ikincil buton, tehlikeli işlem, disabled, hover, focus ve selected durumlarını ayrı tasarla.
5. Kritik hata, uyarı ve başarı renklerini **anlamları için sakla**, sıradan bileşenlerde kullanma.
6. Metin ve etkileşim kontrastını denetle; normal metin hedefi **4.5:1**, büyük metin **3:1**, temel kontrol sınırı/ikon gibi metin dışı öğeler için uygun durumda **3:1**.
7. Renk körlüğünde yalnız renge dayalı durum anlamı üretme; ikon ve anlamlı durum metni kullan.

**Test:** Farklı sayfalarda aynı tokenlar; okunabilir aktif/pasif durumlar; önemli durumlar ayırt ediliyor.

**Kalite kapısı:** UI'da ana vurgu rengi baskın tek etkileşim rengi; semantik renkler belirli durumlar için kullanılıyor.

### UI-03 — Ana uygulama kabuğu ve üç panelli çalışma alanı

**Amaç:** Görsel alanı koruyarak navigasyon ve inceleme kontrollerini düzenlemek.

**Yerleşim:**

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Proje / Sayfa   | Durum ve bağlam                 | Birincil işlem   │
├───────────────┬───────────────────────────────┬──────────────────────┤
│ SOL PANEL     │ ANA ÇALIŞMA ALANI              │ SAĞ PANEL            │
│ Navigasyon    │ 2B/3B CAD, model, analiz       │ Seçili öğe           │
│ Gruplar       │ ve ilgili araç çubuğu          │ Bulgular             │
│              │                               │ Kanıt / ayarlar      │
├───────────────┴───────────────────────────────┴──────────────────────┤
│ Yalnız ilgili modülde zaman çizgisi / durum çubuğu                   │
└──────────────────────────────────────────────────────────────────────┘
```

**Uygula:**

1. Üst çubuğu sadeleştir: proje adı, açık modül, işlem durumu ve en önemli eylemler.
2. Sol navigasyonu işlevlere göre grupla; modül kaybı veya route değişimi olmadan menüleri yeniden düzenle.
3. Orta çalışma alanını CAD/2B/3B görüntüleyici için öncelikli yap.
4. Sağ paneli **seçili öğe veya modüle bağlı** hâle getir; ilgili bulgu/ayrıntı/yasal kaynak/parametreleri burada sun.
5. Yan panelleri daraltma, genişletme, gizleme ve gerektiğinde geri açma davranışlarını ekle; makul min/max genişlik belirle.
6. Üst/alt araç çubuklarını sahne üstüne yığma; önemli öğelerin üzerini kapatmasın.
7. Değişen panel genişliklerinde Three.js/Canvas/SVG varsa `resize` ve görünüm oranı düzgün güncellensin; geometri koordinatları değişmesin.
8. Seçili modül ve bağlam navigasyon sonrası korunsun; kullanıcı beklenmedik şekilde ana ekrana dönmesin.
9. Düşük genişlikte sağ panelin drawer veya alt sekmeye dönüşmesini değerlendir; ana çalışma alanı işlevsiz kalmasın.

**Test:** 1366×768 / 1440×900 / 1920×1080 düzenleri; panel aç-kapa; 3B görünüm yeniden boyutlandırma; route geçişleri.

**Kalite kapısı:** Navigasyon anlaşılır; 3B sahnenin kullanılabilir alanı korunuyor; menüler iç içe çakışmıyor.

### UI-04 — Mevzuat Kütüphanesi ve kanıt görüntüleme

**Amaç:** Uzun yönetmelik adlarını ve kanıtları okunabilir, filtrelenebilir, denetlenebilir sunmak.

**Uygula:**

1. Dar, çok sütunlu kart yoğunluğundan okunabilir liste veya tablo + ayrıntı paneli düzenine geç.
2. Arama, filtre, sıralama, boş sonuç, yükleniyor ve hata durumlarını tasarla.
3. Yönetmelik adı, yürürlük/sürüm, madde, kaynak, sayfa, kanıt ve doğrulama durumunu açık alanlarda göster.
4. Seçilen mevzuat kaydının ayrıntısını sağ panelde veya ayrı detay görünümünde aç.
5. `HOLD`, `Doğrulanmadı`, `İnceleme gerekli`, `Doğrulandı` gibi durumların gerçek veri sözleşmelerindeki karşılıklarını kullan; sahte kesinlik yaratma.
6. Kesilen başlıkları tooltip'e mahkûm etme; uygun yerde tam metin göster.
7. Arama/filtre kriterlerinin navigasyon ve detay aç-kapa sırasında beklenmedik sıfırlanmasını önle.

**Test:** Uzun mevzuat başlığı, boş veri, çok kayıt, belgesi eksik kayıt, doğrulanmamış madde, Türkçe arama.

**Kalite kapısı:** Kullanıcı bir mevzuat maddesinin ne olduğunu, hangi kaynağa dayandığını ve doğrulama durumunu kolaylıkla görebiliyor.

### UI-05 — Analiz panelleri ve Tel Ali görselleştirmesi

**Amaç:** Raporlanabilir bulguları ve simülasyon kontrollerini düzenli sunmak.

**Uygula:**

1. 3B RAG, SPMiner, Yangın, Bodrum, Optimizasyon, Tel Ali ve depoda bulunan diğer analiz araçlarının ekranlarını envanterle eşleştir.
2. Her modülde: başlık/amaç, giriş verisi, çalıştırma eylemi, ilerleme, sonuç, kaynak/kanıt, hata ve sonraki adım hiyerarşisi kur.
3. Teknik göstergeleri çok sayıda parlak KPI kartı yerine okunabilir metin + sade tablo + gerektiğinde grafik ile göster.
4. Bulguları ciddiyete göre grupla; mevzuat/kaynak referansını ve geometrik kanıtı koru.
5. Tel Ali arayüzünü sadeleştir: **başlat/duraklat/sıfırla**, geçerli rota, hareket durumu, süre, sağlık ve hata ayrı okunabilir alanlarda olsun.
6. Tel Ali için `IDLE/ROUTE_READY/EVACUATING/BLOCKED/REROUTING/EVACUATED/FAILED` gibi durumları **mevcut gerçek sistemin desteklediği ölçüde** doğru etiketle; backend'in üretmediği durumu UI'da uydurma.
7. Bir karakter odada duruyorsa 'Koridorda koşuyor' gibi yanıltıcı durum yazma; arayüz metni mevcut doğrulanmış hareket/konum verisinden gelsin. Eksik telemetri varsa `bilgi mevcut değil` göster ve teknik işlevsel düzeltme ihtiyacını ayrı iş olarak raporla.
8. Görüntüleme katmanları: rota, etiketler, X-Ray, duman ve tehlike opaklığı için var olan görünürlük kontrolünü basitleştir; gerçek geometri hesaplarını değiştirme.
9. Grafik, tablo ve görsel kontrollerin yükleniyor, boş ve hata durumlarını tutarlı yap.

**Test:** Modül geçişleri, veri yüklenmesi, gerçek hata durumları, 3B kontrollerin erişimi, analiz sonuçlarının tamlığı.

**Kalite kapısı:** Kullanıcı 'hangi analiz çalıştı, ne buldu, dayanağı ne, ne yapmalı?' sorularını bir ekrandan yanıtlayabiliyor.

### UI-06 — Baştan sona kullanıcı akışları

**Amaç:** İlk kullanımda ve tekrarlı kullanımda belirsizliği azaltmak.

**Ana akış:**

`Proje aç → CAD/PDF yükle → Modeli doğrula → Analizi seç → Çalıştır → Bulguları incele → Kanıtları kontrol et → Rapor oluştur`

**Uygula:**

1. Her adımın ön koşulu ve mümkün olan sonraki eylemi belirgin olsun.
2. Yükleme sürüyor, doğrulama bekliyor, analiz başarısız, analiz tamamlandı, rapor hazır gibi durumları gerçek işlem sonuçlarından türet.
3. Yanlış sıradaki eylemlerde açıklayıcı yönlendirme ver; sebepsiz disabled buton kullanma.
4. Form doğrulama, hata mesajları, geri dön, iptal, kapat ve tekrar dene davranışlarını netleştir.
5. Zorlayıcı kurulum sihirbazı ekleme; mevcut kullanıcı kısa yoldan ilgili modüle erişebilsin.
6. Temel kontroller görünür, ileri parametreler bağlamsal panel veya açılır bölümlerde olsun.
7. Boş ekranlara yönlendirici ama gereksiz süs içermeyen metin ekle.
8. İşlem başarı durumunu yalnız backend/istemci gerçek doğrulama sağladıktan sonra göster.
9. Kullanıcının girişleri, mevcut filtreleri, model seçimini ve kritik sayfa durumunu mümkün oldukça koru.

**Test senaryoları:** İlk proje, var olan proje, geçersiz dosya, eksik veri, başarısız analiz, uzun süren analiz, çok bulgu, rapor üretimi, geriye dönüş.

**Kalite kapısı:** Kullanıcı temel akışı eğitmen yardımı olmadan takip edebiliyor; işlem sonucu yanlış sunulmuyor.

### UI-07 — Erişilebilirlik, uyarlanabilirlik, dayanıklılık

**Amaç:** Ürün kalitesini farklı ekran/ölçekleme koşullarında korumak.

**Uygula:**

1. Klavyeyle temel gezinme ve `Tab`, `Enter`, `Esc` etkileşimlerini doğrula; odak halkasını görünür yap.
2. Form etiketleri, ikon butonları, modal başlıkları, hata açıklamaları ve durum metinleri için erişilebilir adları tamamla.
3. Gerekli alanlarda `aria-live` / semantik HTML kullan; canlı güncellemelerde gereksiz sesli bildirim üretme.
4. Metinler için WCAG 2.2 AA hedefini; anlamlı kontrollerde en az 3:1 metin dışı kontrastı denetle.
5. `prefers-reduced-motion` ve kullanıcı zoom davranışını test et.
6. `1366×768`, `1440×900`, `1920×1080` çözünürlüklerinde ekranı doğrula.
7. %125/%150 Windows ekran ölçeklemesi ve %200 tarayıcı zoom senaryolarını desteklenen test ortamında kontrol et; fiilen çalıştırılamayanları açık `HOLD` yap.
8. Uzun Türkçe/İngilizce hata mesajları, kod blokları ve dosya isimlerinde taşmayı önle.

**Kalite kapısı:** Kritik işlem engelleyici taşma, erişilemeyen kontrol veya okunamayan zorunlu metin kalmıyor.

### UI-08 — Test, regresyon ve mühendislik kanıtları

**Amaç:** Estetik değişikliklerin işlevsel bozulma üretmediğini kanıtlamak.

**Yapılacaklar:**

1. Mevcut build, lint, typecheck, unit ve integration testlerini projenin desteklediği biçimde çalıştır.
2. Mevcut test sayısını ve PASS/FAIL/SKIP değerlerini başlangıç ve son durumda raporla.
3. Tipografi/token, navigasyon, panel aç-kapa, mevzuat filtreleri, analiz durumları, dialog ve rapor akışlarına uygun otomatik test ekle.
4. Birden fazla ekran boyutunda görsel karşılaştırma yap; varsa mevcut screenshot/visual regression altyapısını kullan. Yeni ağır test yığını ekleme.
5. 3B render boyutlandırması, model seçimi, dosya yükleme, mevzuat kanıtı, modül geçişleri ve rapor girişlerini regresyonda kontrol et.
6. `git diff --check`, biçim denetimi ve güvenlik/bağımlılık kontrolleri mevcut araçlarla uygula.
7. Test edilemeyen kullanıcı deneyimlerini açık kabul listesine yaz.
8. **Sentetik test ve kaynak incelemesini gerçek DXF/PDF, gerçek GPU ve fiziksel Windows/Edge kabulüyle karıştırma.**

**Kalite kapısı:** Mevcut zorunlu CI kontrolleri PASS; regresyonlar belgelenmiş; açık fiziksel testler `HOLD` olarak ayrılmış.

### UI-09 — Son kontrol, PR ve teslim

**Amaç:** Değişiklikleri izlenebilir ve güvenli şekilde kapatmak.

**Uygula:**

1. Paketlerin tamamını tek tek `PASS / FAIL / HOLD / NOT_RUN` ile değerlendir.
2. Önce/sonra ekran görüntülerini aynı modül, aynı durum ve mümkün olduğunca aynı viewport ile eşleştir. Görsel alınamıyorsa yerine uydurma görsel koyma.
3. Kod diff'ini kontrol et: yanlışlıkla silinen modül, rota, bilgi, kaynak linki, ayar veya buton var mı?
4. Gereksiz CSS, yinelenen token ve boşa düşen bileşenleri temizle; büyük çaplı alakasız refaktörden kaçın.
5. Dosya değişikliklerini mantıklı commit'lerle kaydet, Türkçe PR açıklaması hazırla, mevcut dal koruması ve CI kurallarını uygula.
6. PR ve merge yalnız erişim, yetki, güncel zorunlu CI ve depo kuralları uygunsa yapılabilir; aksi hâlde `MERGE_HOLD` raporla. Bağımsız inceleme şartını tek geliştiricili depoya kendiliğinden ekleme.
7. Kullanıcıya okunabilir teslim özeti ve gerçek Windows/Edge son kabul adımlarını ver.

**Kalite kapısı:** UI refaktörü izlenebilir, mevcut işlevler korunmuş, açık riskler açıkça sınıflandırılmış.

---

## 3. GÖREV TAKİP TABLOSU

Ajan bu tabloyu başlangıçta `NOT_RUN` olarak ele almalı ve yalnız **kanıtla** ilerletmeli. Bu tablo planın bir parçasıdır; tamamlanmış çalışma beyanı değildir.

| Paket | Kapsam | Başlangıç | Kapanış kanıtı |
|---|---|---|---|
| UI-00 | Depo/sayfa envanteri | NOT_RUN | Dosya/rota haritası + baseline |
| UI-01 | Tipografi | NOT_RUN | Okunabilirlik kontrolü + test |
| UI-02 | Renkler/tokenlar | NOT_RUN | Token diff + kontrast testi |
| UI-03 | Üç panelli düzen | NOT_RUN | Responsive ve panel davranışları |
| UI-04 | Mevzuat Kütüphanesi | NOT_RUN | Arama/filtre/kanıt testleri |
| UI-05 | Analiz panelleri | NOT_RUN | Modül bazlı UI regresyonu |
| UI-06 | Kullanıcı akışı | NOT_RUN | Uçtan uca senaryolar |
| UI-07 | Erişilebilirlik | NOT_RUN | Kontrast/klavye/zoom kontrolü |
| UI-08 | Regresyon | NOT_RUN | Build/lint/test/CI raporu |
| UI-09 | Teslim | NOT_RUN | Diff/PR/kanıt/açık riskler |

### Paket bitirme şablonu

Her paketin sonunda aşağıdaki biçimde gerçek çıktıyı yaz:

```text
PAKET: UI-0X
DURUM: PASS | FAIL | HOLD | NOT_RUN
İNCELEDİĞİM DOSYALAR: <gerçek yollar>
DEĞİŞTİRDİĞİM DOSYALAR: <gerçek yollar>
NE DEĞİŞTİ: <kısa teknik açıklama>
ÇALIŞTIRILAN KOMUTLAR: <gerçek komutlar>
TEST SONUCU: <PASS/FAIL/SKIP ve sayılar>
KANIT: <mevcut görseller, test logları, PR/commit referansları>
AÇIK RİSKLER: <doğrulanmamışlar>
SONRAKİ PAKET: <sıradaki iş>
```

Ajan yalnızca **somut engel** varsa durmalı; olağan kod düzenleme ve sentetik test adımları için kullanıcıdan tekrar tekrar yönlendirme istememeli.

---

## 4. DETAYLI KABUL SENARYOLARI

### A. Okunabilirlik

- [ ] Başlıklar, gövde metni, etiket ve metadata birbirinden açıkça ayırt ediliyor.
- [ ] Normal metinler varsayılan görünümde büyüteç gerektirmiyor.
- [ ] Mevzuat adları ve hata mesajları açıklama kaybı olmadan okunabiliyor.
- [ ] Türkçe karakterler ve sayısal birimler doğru görüntüleniyor.
- [ ] İkincil metinler aşırı soluk değil; kontrast hedefleri sağlanıyor.

### B. Renk ve görsel sadelik

- [ ] Gereksiz neon, gradient, glow ve süs rozetleri kaldırılmış.
- [ ] Ana vurgu, uyarı, hata ve başarı renkleri tutarlı ayrılmış.
- [ ] İkon renkleri metinle uyumlu ve durum anlamı yalnız renge bağlı değil.
- [ ] Aynı bileşen farklı modüllerde aynı görsel davranışı sunuyor.

### C. Üç panelli çalışma alanı

- [ ] Sol menü bütün eski modüllere erişim sağlıyor.
- [ ] Orta çalışma alanı 3B/CAD içeriklerini kırpmıyor veya bozup yerinden oynatmıyor.
- [ ] Sağ panel seçime göre değişiyor, açılıp kapanıyor.
- [ ] Dar ekranlarda kritik kontroller kaybolmuyor.
- [ ] Üst menü ve sahne araç çubukları gereksiz tekrar içermiyor.

### D. Mevzuat ve analizler

- [ ] Uzun mevzuat başlığı, kaynak ve madde detayları düzgün görüntüleniyor.
- [ ] Arama/filtre/ayrıntı gezinmesi çalışıyor.
- [ ] Bulgunun kaynağı ve doğrulanma durumu korunuyor.
- [ ] Analiz işlem durumu gerçek yürütmeye dayanıyor; sahte başarı yok.
- [ ] Tel Ali paneli hareket ve tahliye durumunu yanlış göstermiyor; eksik veri açıkça belirtiliyor.

### E. Akış, erişilebilirlik ve regresyon

- [ ] Proje → dosya → doğrulama → analiz → inceleme → rapor akışı anlaşılır.
- [ ] Hatalı ve eksik veri için açıklayıcı geri bildirim var.
- [ ] Klavyeyle gezinme, görünür focus ve erişilebilir ikon etiketleri var.
- [ ] Gerekli çözünürlüklerde kırık yerleşim ve kritik yatay taşma yok.
- [ ] Mevcut testler ve zorunlu CI kapıları koşullarına uygun şekilde doğrulanmış.
- [ ] Gerçek Windows/Edge/GPU/DXF/PDF son kabulü yapılmadıysa dürüstçe `HOLD`.

---

## 5. TAMAMLAMA TANIMI VE SON DURUM RAPORU

**Görev yalnızca güzel bir ekran görüntüsü üretildiğinde tamamlanmış sayılmaz.** Gerçek kod değişiklikleri yapılmış, modüller çalışıyor, teknik bilgi korunuyor, arayüz daha okunabilir ve kritik kullanıcı akışları doğrulanmış olmalı.

Ajanın son raporu şu başlıkları içersin:

1. **Genel durum:** `UI_KOD_PASS/HOLD`, `OKUNABILIRLIK_PASS/HOLD`, `AKIS_PASS/HOLD`, `REGRESYON_PASS/HOLD`, `WINDOWS_EDGE_FIZIKSEL_KABUL_HOLD/PASS` (yalnız kanıt varsa PASS).
2. **Uygulanan iş paketleri:** UI-00–UI-09, her biri ayrı durum ve kanıtla.
3. **Kök tasarım sorunları ve çözüm:** Önce ne yanlıştı, şimdi neden daha iyi.
4. **Değiştirilen gerçek dosyalar:** Yollar ve ana farklılıklar.
5. **Test sonuçları:** Gerçek komut, sonuç, tarih/sürüm ve başarısızlıklar.
6. **Görsel karşılaştırma:** Eşleştirilmiş önce/sonra görseller veya neden elde edilemediği.
7. **İşlev koruma matrisi:** CAD, 3B, mevzuat, analizler, Tel Ali, rapor ve diğer modüller için PASS/FAIL/HOLD.
8. **Git teslim bilgisi:** Commit/PR/CI/merge durumu; var olmayan PR numarası uydurma.
9. **Kalan engeller:** Son kabulde kullanıcıdan gereken gerçek Windows/Edge/GPU/DXF/PDF kontrolleri.

### İşlev koruma matrisi için şablon

| Alan | Beklenen | Gerçek test | Durum |
|---|---|---|---|
| CAD/PDF | Yükleme ve görüntüleme bozulmamalı | Doldur | NOT_RUN |
| 2B/3B | Model, kamera, katman ve paneller doğru | Doldur | NOT_RUN |
| Mevzuat | Arama, kaynak ve kanıt zinciri korunmalı | Doldur | NOT_RUN |
| Analiz | Çalıştırma ve sonuç durumu tutarlı | Doldur | NOT_RUN |
| Tel Ali | Arayüz doğru telemetriyi göstermeli | Doldur | NOT_RUN |
| Rapor | Mevcut veri kaybı olmadan sunulmalı | Doldur | NOT_RUN |
| Windows/Edge | Son fiziksel kabul ayrı doğrulanmalı | Doldur | HOLD |

---

## 6. AJAN İÇİN BAŞLATMA KOMUTU

> **Bu dosyayı uygulama talimatı olarak kabul et.** Mevcut depoda önce `UI-00` envanterini ve başlangıç testlerini çıkar. Ardından **UI-01 tipografi → UI-02 renkler → UI-03 üç panelli düzen** değişikliklerini uygulayarak ilk kalite kapısını kapat. Sonra **UI-04 Mevzuat → UI-05 analizler → UI-06 kullanıcı akışları**, ardından UI-07–UI-09 doğrulama ve teslim aşamalarını sırasıyla tamamla. Her aşamada gerçek kodu düzenle, uygun testleri çalıştır, kanıt üret, hataları düzelt ve sonucu raporla. Yalnızca eksik erişim veya çözülemeyen somut engelde HOLD belirt. **Gösterişli AI dashboard'u değil; okunabilir, özgün ve güvenilir bir mühendislik çalışma alanı oluştur.**
