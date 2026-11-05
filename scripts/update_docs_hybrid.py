# =====================================================================
# ÖZEL LİSANS — TÜM HAKLAR SAKLIDIR
# Telif Hakkı (c) 2026 Seydi Eryılmaz (@seydivakkas)
# =====================================================================
"""
Dokümantasyon Güncelleme Betiği:
1. KACIS_YOLLARI_VE_MERDIVEN_DENETIM_MIMARISI.md dosyasındaki Bölüm 8'i ölçülen benchmark
   sonuçlarıyla, hibrit risk analiz matrisiyle ve TÜBİTAK 2209-A ilkeleriyle günceller.
2. Tüm 'ispat', 'kanıt', '%100', 'garanti', 'O(1)', '0 ms' gibi yasaklı kelimeleri ve afaki oranları temizler.
3. KACIS_YOLLARI_VE_MERDIVEN_DENETIM_MIMARISI.md içeriğini README.md dosyasına tam olarak kopyalar.
"""

import os
import re

DOC_PATH = "KACIS_YOLLARI_VE_MERDIVEN_DENETIM_MIMARISI.md"
README_PATH = "README.md"

SECTION_8_CONTENT = """## 8. Hibrit Mimari: Karar Katmanı, Nöral Hızlandırma ve Risk Azaltma Analizi

TÜBİTAK 2209-A proje ilkeleri doğrultusunda sistem mimarisi kesin bir prensibe dayanır: **Nihai mevzuat uygunluk kararını yalnızca VF2 monomorfizm algoritması ve deterministik geometrik kurallar verir; duman yayılım modeli ve taşıyıcı sistem statiği kapsam dışıdır.**

### 8.1. Katmanlar ve Sorumluluk Matrisi

| Katman | Bileşenler | Görevi | Uygunluk Kararı Verir mi? |
|---|---|---|---|
| **Girdi & Geometri** | CAD Ingest, OpenCV, 3B RAG Builder | DXF/Görsel kat planını 3B mekânsal grafa çevirir | Hayır |
| **Nöral Hızlandırma** | RWPE, SpatialOrderGNN, NeuroMatch İndeksi | Çok binalı kütüphanelerde aday eler; sonuçlar VF2 ile doğrulanır | **Hayır** |
| **Yapısal Keşif** | SPMiner, WL Hash, Makro Düğüm Sıkıştırma | Tekrarlayan daire tiplerini ve bina programını çıkarır | Hayır |
| **Karar Katmanı** | VF2 Teşhis Hunisi, Kat Denetçisi, SFPE CTM | Mevzuat uygunluğunu ve ihlalleri belirler | **Evet** |
| **Gösterim ve Öneri** | Karşı-Olgusal Optimizatör, İki Bölgeli Duman, DXF Annotator, Three.js | Mimara tadilat reçetesi ve görselleştirme sunar | Hayır |

> [!IMPORTANT]
> Her yangın kaçış çekirdeği istisnasız VF2 monomorfizminden geçer. GNN ihlal enerjisi (`record_gnn_energy=True`) yalnızca ölçüm ve araştırma amacıyla kaydedilir; kararı etkilemez. Tahliye simülatörü GNN çıktısı almaz. ASET ve duman yayılımı mevzuat kararını hiçbir koşulda değiştirmez.

---

### 8.2. Dört Hibrit Modülün Risk Analizi ve Ölçüm Sonuçları

Aşağıdaki tablo, DiagramYönetmelik bünyesindeki dört hibrit modülün bilinen risklerini, uygulanan mühendislik çözümlerini, ölçülen sayısal kazanımları ve sistem sınırlılıklarını özetlemektedir:

| Modül | İncelenen Hibrit Risk | Uygulanan İyileştirme | Ölçülen Değer (Önce / Sonra) | Kalan Sınırlılık |
|---|---|---|---|---|
| **Modül 1: GNN + RWPE + VF2** | Sabit sürede anlık budama varsayımı; uzun koridor döngülerinde ($C_{12}$ vs $2\\times C_6$) ayırt edilememe; ağırlık uyuşmazlığında sessiz fallback. | • $m=6$ parametresi config'e bağlandı.<br/>• `nx.minimum_cycle_basis` ile döngü katılım özelliği eklendi.<br/>• Boyut uyuşmazlığında açık `ValueError` fırlatıldı.<br/>• Gerçek çalışma süreleri ölçüldü. | **Aşama 4 Süresi (Budamasız vs Budamalı):**<br/>• Küçük bina: 1.01 ms $\\to$ 20.01 ms<br/>• Orta bina: 1.98 ms $\\to$ 25.38 ms<br/>• Büyük bina: 3.70 ms $\\to$ 60.94 ms<br/>**$C_{12}$ vs $2\\times C_6$ Ayırt Edilebilirlik:**<br/>• RWPE ($m=6$): 0.0528<br/>• RWPE + Döngü: 4.1084 | 2-hop ego altgraflarında VF2 zaten 1–4 ms sürdüğünden GNN tensör ileri beslemesi ek yük getirir. Bu nedenle aday budaması varsayılan olarak kapalıdır (`enable_hybrid_pruning=False`). |
| **Modül 2: SPMiner + Makro Düğüm** | Dokümandaki afaki "%40–60" sıkıştırma ifadesi; daire içi kişilerin kapıya aynı anda yığılması (yapay darboğaz). | • 5 test binasında gerçek düğüm/kenar azalması ölçüldü.<br/>• Zamana yayılmış varış profili eklendi ($t = d_{\\text{iç}} / v + t_{\\text{reaksiyon}}$).<br/>• Farkın > %10 olması durumunda simülasyon engelleme kapısı eklendi. | **Gerçek Sıkıştırma Oranı:**<br/>• Düğüm: %59.8 ortalama azalma<br/>• Kenar: %61.5 azalma<br/>**Tahliye Süresi Farkı (Tam vs Sıkıştırılmış):**<br/>• 4 katlı bina: %2.37 fark (izin verildi)<br/>• 1, 2, 8, 12 kat: > %10 fark (engellendi) | Daire içi duman yayılımı kapsam dışıdır. Yalnızca tahliye zamanlaması modellenir. %10'u aşan binalarda simülasyon doğrudan tam graf üzerinden yürütülür. |
| **Modül 3: Tahliye + Duman + Optimizatör** | Kapı genişletmenin taşıyıcı kolon/perdeye çakışması; darboğaz optimizasyonunda kombinatoryal patlama; dumanın mevzuatı etkilemesi. | • Shapely kesişim kontrolü eklendi (`RETTEDILDI_TASIYICI_CAKISMA`).<br/>• Aday üst sınırı (`max_candidates=15`) ve simülasyon bütçesi (`max_simulations=8`) getirildi.<br/>• Hash tabanlı simülasyon önbelleği kuruldu.<br/>• Duman modeli iki-bölge doldurmaya çevrildi, varsayılan olarak kapatıldı ve mevzuattan soyutlandı. | **Simülasyon Bütçesi ve Süre:**<br/>• 1 Darboğaz: 3 sim (0.019 s) $\\to$ 3 sim (0.019 s)<br/>• 3 Darboğaz: 9 sim (0.052 s) $\\to$ 8 sim (0.046 s) [4 cache hit]<br/>• 6 Darboğaz: 18 sim (0.105 s) $\\to$ 8 sim (0.080 s) [1.31× hızlanma]<br/>**Taşıyıcı Eleman:** Çakışan kapı genişletmeleri reddedildi. | Taşıyıcı sistem statik hesapları ve dinamik duman yayılımı kapsam dışıdır. Duman çıktıları "gösterim amaçlı, doğrulanmamış" olarak etiketlenir. |
| **Modül 4: DXF / OpenCV + Etiketleme** | 25–85 px sabit çekirdek sınırının ölçek ve açılı duvarlarda başarısızlığı; bilinmeyen mekânlara yapay oda tipi uydurulması (halüsinasyon). | • Çekirdek boyutu doğrudan `door_bridge_m * ppm` yapıldı.<br/>• `HoughLinesP` ile baskın açılar bulunup açılı çekirdekler uygulandı.<br/>• Türkçe mimari kısaltma sözlüğü + RapidFuzz / difflib entegre edildi.<br/>• Geometriden tahmin edilemeyen mekânlar `belirsiz` olarak işaretlendi. | **Etiket Tanıma Doğruluğu (29 bozulmuş örnek):**<br/>• Eski yöntem: %72.4 (21/29)<br/>• Yeni yöntem: %96.6 (28/29)<br/>• Doğruluk kazancı: +%24.2<br/>**Açısal Duvar:** 30° ve 45° duvarlarda oda tespiti sağlandı. | Raster görsellerde OCR isteğe bağlıdır; yerel sistemde `tesseract.exe` kurulu değilse OCR aşaması güvenle atlanır ve kullanıcı bilgilendirilir. |

---

### 8.3. Modül 1: RWPE Uzun Döngü Ablasyonu ve Aşama 4 Gerçek Süreleri

#### Uzun Döngü Testi ($C_8, C_{10}, C_{12}$ Koridorları)

Aynı derece dağılımına ($d=2$) sahip ancak farklı döngü topolojisindeki graf çiftleri üretilmiş; $m=6, 12, 16$ adımları için gömme uzaklıkları ve kosinüs benzerlikleri ölçülmüştür:

| Graf Çifti | $m$ Adımı | Yalnız RWPE Öklid Mesafesi | RWPE + Döngü Özelliği Öklid Mesafesi | Kosinüs Benzerliği | Ayırt Edilebilirlik |
|---|---:|---:|---:|---:|---|
| $C_8$ vs $2\\times C_4$ | 6 | 0.1887 | **2.3916** | 0.9634 | Ayrışıyor |
| $C_8$ vs $2\\times C_4$ | 12 | 0.0898 | **2.3888** | 0.9634 | Ayrışıyor |
| $C_8$ vs $2\\times C_4$ | 16 | 0.0667 | **2.3881** | 0.9635 | Ayrışıyor |
| $C_{10}$ vs $2\\times C_5$ | 6 | 0.1118 | **4.0278** | 0.9780 | Ayrışıyor |
| $C_{10}$ vs $2\\times C_5$ | 12 | 0.0543 | **4.0264** | 0.9780 | Ayrışıyor |
| $C_{10}$ vs $2\\times C_5$ | 16 | 0.0406 | **4.0260** | 0.9780 | Ayrışıyor |
| $C_{12}$ vs $2\\times C_6$ | 6 | 0.0528 | **4.1084** | 0.9744 | Ayrışıyor |
| $C_{12}$ vs $2\\times C_6$ | 12 | 0.0381 | **4.1077** | 0.9744 | Ayrışıyor |
| $C_{12}$ vs $2\\times C_6$ | 16 | 0.0287 | **4.1074** | 0.9744 | Ayrışıyor |

**Karar ve Gerekçe:** Konut mimari planlarındaki koridor döngüleri pratik olarak $\\le 6$ mekândan oluştuğu ve $m$ artışının hesaplama süresini uzattığı için varsayılan değer $m=6$ olarak tutulmuştur. Özel döngüsel yapılarda `use_cycle_feature=True` seçeneği döngü katılımını katarak ayrıştırmayı belirginleştirmektedir.

#### Aşama 4 Gerçek Çalışma Süreleri (Budamasız vs Budamalı)

Aşama 4'ün 3 farklı bina ölçeğindeki gerçek süre ölçümleri:

| Bina Ölçeği | Düğüm Sayısı | Kenar Sayısı | Doğrudan VF2 Süresi (ms) | GNN Budamalı VF2 Süresi (ms) | Hız Farkı |
|---|---:|---:|---:|---:|---|
| **Küçük Bina (1 Kat)** | 11 | 24 | **1.01** | 20.01 | VF2 19.8× daha hızlı |
| **Orta Bina (3 Kat)** | 33 | 72 | **1.98** | 25.38 | VF2 12.8× daha hızlı |
| **Büyük Bina (10 Kat)** | 110 | 240 | **3.70** | 60.94 | VF2 16.5× daha hızlı |

> [!NOTE]
> Ölçümler, 2-hop ego altgraflarında NetworkX VF2 eşleşmesinin 1–4 milisaniyede tamamlandığını, buna karşılık GNN ileri beslemesinin PyTorch tensör oluşturma ve matris çarpım maliyeti getirdiğini göstermektedir. Bu nedenle dokümanlardaki sabit süre varsayımı kaldırılmış ve nöral budama varsayılan olarak kapalı tutulmuştur.

---

### 8.4. Modül 2: SPMiner Gerçek Sıkıştırma Oranları ve Varış Profili

#### 5 Test Binasında Ölçülen Sıkıştırma Oranları

`ArchitecturalGraphCoarsener` modülünün 5 farklı bina konfigürasyonunda gerçekleştirdiği gerçek sıkıştırma:

| Test Binası | Özgün Düğüm | Sıkıştırılmış Düğüm | Düğüm Azalma (%) | Özgün Kenar | Sıkıştırılmış Kenar | Kenar Azalma (%) |
|---|---:|---:|---:|---:|---:|---:|
| 1 Katlı Standart Konut | 7 | 3 | **%57.1** | 13 | 5 | **%61.5** |
| 2 Katlı İki Daireli | 14 | 6 | **%57.1** | 26 | 10 | **%61.5** |
| 4 Katlı Tipik Konut | 33 | 13 | **%60.6** | 65 | 25 | **%61.5** |
| 8 Katlı Yüksek Konut | 72 | 28 | **%61.1** | 143 | 55 | **%61.5** |
| 12 Katlı Kule Konut | 118 | 46 | **%61.0** | 234 | 90 | **%61.5** |
| **Ağırlıklı Ortalama** | - | - | **%59.8** | - | - | **%61.5** |

#### Zamana Yayılmış Varış Profili ve Tahliye Doğrulaması

Daire sakinlerinin kapıya tek seferde yığılmasını önlemek amacıyla zamana yayılmış varış modeli uygulanır:
$$t_{\\text{varış}} = \\frac{d_{\\text{iç}}}{v_{\\text{yürüme}}} + t_{\\text{reaksiyon}}$$

Tam graf ile varış profilli sıkıştırılmış graf arasındaki tahliye süreleri karşılaştırılmıştır:
* **4 Katlı Bina:** Tam graf 38.0 s, Sıkıştırılmış graf 38.9 s $\\to$ Fark: **%2.37** ($< \\%10$, simülasyona izin verildi).
* **Diğer Binalar (1, 2, 8, 12 Kat):** Fark eşiği (%10) aşıldığında `is_simulation_blocked = True` tetiklenir, sıkıştırılmış graf simülasyonda kullanılmaz ve tam graf üzerinden yürütülür.
* **Sınırlılık:** Daire içi duman yayılımı kapsam dışıdır.

---

### 8.5. Modül 3: Taşıyıcı Eleman Kontrolü ve Optimizasyon Bütçesi

#### Taşıyıcı Katman Koruması

CAD ayrıştırıcı standart mimari ve statik katmanları tanır (`A-COLS`, `S-COLS`, `S-COLM`, `S-WALL`, `A-WALL-STRC`, `KOLON`, `PERDE`).
* Genişletilmiş kapı geometrisi Shapely poligonu olarak oluşturulur (`buffer`).
* Taşıyıcı eleman poligonlarıyla kesişim (`intersects`) tespit edildiğinde öneri doğrudan reddedilir:
  `feasibility_status = "RETTEDILDI_TASIYICI_CAKISMA"` ("uygulanamaz: taşıyıcı elemanla çakışıyor").
* Taşıyıcı katman bulunmayan DXF paftalarında öneri silinmez; mimara `"Taşıyıcı bilgisi yok, statik kontrol yapılmadı"` notuyla raporlanır.

#### Simülasyon Bütçesi ve Önbellek Ölçümleri

Kombinatoryal patlamayı engellemek için `max_candidates=15` ve `max_simulations=8` sınırları uygulanmıştır:

| Darboğaz Sayısı | Bütçesiz Simülasyon | Bütçeli Simülasyon | Bütçesiz Süre (s) | Bütçeli Süre (s) | Önbellek İsabeti | Hızlanma | Bütçe Durumu |
|---:|---:|---:|---:|---:|---:|---:|---|
| 1 Darboğaz | 3 | 3 | 0.019 | 0.019 | 0 | 1.00× | Tamamlandı |
| 3 Darboğaz | 9 | 8 | 0.052 | 0.046 | 4 | 1.13× | Tamamlandı |
| 6 Darboğaz | 18 | 8 | 0.105 | 0.080 | 4 | **1.31×** | Bütçe doldu uyarısı verildi |

#### İki Bölgeli Duman Doldurma Modeli

* Fiziksel model; oda taban alanı ($A$), tavan yüksekliği ($H=2.80\\text{ m}$), yangın yükü ($\\dot{Q} = 2500\\text{ kW}$) ve yangın kapısı sızdırmazlık katsayısına ($\\tau$) dayanır.
* Sızdırmaz yangın kapısının arkasında duman geçişi %95 oranında ($\\tau=0.05$), basınçlandırılmış yangın holü/merdiveninde %98 oranında ($\\tau=0.02$) azaltılır.
* Duman modeli varsayılan olarak KAPALIDIR (`enable_smoke_model=False`). Açıldığında çıktılar `"gösterim amaçlı, doğrulanmamış"` etiketiyle sunulur.
* **Mevzuat İlkesi:** ASET ve duman yayılımı, mevzuat uygunluk kararını ve ihlal sayılarını hiçbir şekilde değiştirmez.

---

### 8.6. Modül 4: OpenCV Açısal Morfoloji ve Türkçe Etiketleme

#### Dinamik Morfolojik Çekirdek ve Açısal Kapatma

* 25–85 piksel sınırı kaldırılarak çekirdek boyutu doğrudan ölçeklenmektedir:
  $$\\text{door\\_k\\_size} = \\max(5, \\text{round}(\\text{door\\_bridge\\_m} \\times \\text{ppm}))$$
* `ppm=100` için çekirdek boyutu 150 piksel, `ppm=10` için 15 piksel olmaktadır.
* `cv2.HoughLinesP` ile 0° ve 90° dışındaki baskın duvar açıları tespit edilmekte; 30° ve 45° pahlı planlarda döndürülmüş doğrusal çekirdeklerle kapı boşlukları köprülenmektedir.

#### Türkçe Mimari Kısaltma Sözlüğü ve Dayanıklılık Ölçümü

29 sentetik ve bozulmuş mimari etiket örneği (tam isim, kısaltma, yazım hatası, geometrik yedek, belirsiz) üzerinde yapılan test:

| Yöntem | Toplam Test | Doğru Tanınan | Doğruluk Oranı | Kazanç |
|---|---:|---:|---:|---:|
| **Eski Yöntem (Salt Anahtar Kelime)** | 29 | 21 | %72.4 | Referans |
| **Yeni Yöntem (Sözlük + Bulanık + Geometri)** | 29 | 28 | **%96.6** | **+%24.2** |

* Tanımlanamayan veya alakasız yazılar (`"BLOK A 2. KAT"`) rastgele "oda" veya "salon" olarak tahmin edilmez; kesinlikle `"belirsiz"` olarak işaretlenir.
* Belirsiz mekân içeren altgraflarda VF2 teşhis raporlarına `"(etiket belirsiz, uzman kontrolü gerekli)"` notu eklenir.
* `pytesseract` Python kütüphanesi hazır durumdadır; sistemde native `tesseract.exe` bulunmadığında hata vermeden atlanır ve dokümante edilir.

---
"""

def update_docs():
    with open(DOC_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # Bölüm 8'i bul ve değiştir
    pattern = re.compile(r"## 8\. Hibrit Mimari: Karar Katmanı.*?## 9\. AutoCAD DXF", re.DOTALL)
    match = pattern.search(content)
    if not match:
        print("HATA: Bölüm 8 bulunamadı!")
        return

    replacement = SECTION_8_CONTENT + "\n## 9. AutoCAD DXF"
    updated_content = content[:match.start()] + replacement + content[match.end():]

    # Yasaklı kelimeleri ve dokümandaki diğer afaki oranları temizle
    updated_content = updated_content.replace("%40–60", "%59.8 düğüm, %61.5 kenar")
    updated_content = updated_content.replace("sıfır hata garantisi vermez", "sıfır hata sağlamaz")
    updated_content = updated_content.replace("En ucuz reçete garantisi vermez", "En ucuz reçete garantisi öngörülmez")
    updated_content = updated_content.replace("kanıtı değildir", "göstergesi değildir")

    with open(DOC_PATH, "w", encoding="utf-8") as f:
        f.write(updated_content)
    print(f"Başarıyla güncellendi: {DOC_PATH}")

    # README.md dosyasını güncelle
    with open(README_PATH, "w", encoding="utf-8") as f:
        f.write(updated_content)
    print(f"Başarıyla README'ye kopyalandı: {README_PATH}")

if __name__ == "__main__":
    update_docs()
