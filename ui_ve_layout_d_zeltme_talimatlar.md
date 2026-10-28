# UI/UX Layout, Taşma (Overflow) ve Kontrast Düzeltme Görevi

Aşağıdaki görsel hataları ve yerleşim (layout) sorunlarını, tarayıcıyı %75 küçültmeye gerek kalmadan **%100 varsayılan yakınlaştırma (zoom)** oranında kusursuz çalışacak şekilde düzelt.

## 1. Orta 3B Sahne (Canvas) Üzerindeki Yüzen Elementlerin Çakışması
* **Sorun:** Orta panelin üst kısmındaki `BIM / Mimari LOD300 | Dollhouse | Tüm Katlar` bilgi kartı ile `İzometrik Açı | X-Ray / Tel Kafes | CAD Yayları` araç çubuğu ve hemen altındaki `Orbit / Pan | KÖŞELER:` filtre barı üst üste biniyor. Ayrıca sol üstteki **"Tel Ali Tahliye Simülasyonu"** açılır penceresi (modal/card) bu üst barların altına girerek okunaksız hale geliyor.
* **Çözüm:**
  * 3B Canvas üzerindeki tüm HUD (Heads-Up Display) kontrollerini `position: absolute` ile rastgele dağıtmak yerine, üstte tek bir esnek kapsayıcı (`display: flex; flex-wrap: wrap; gap: 8px;`) içine al veya net bir Grid/Stack yapısına oturt.
  * **"Tel Ali Tahliye Simülasyonu"** kartının `top` değerini üstteki kontrol barlarının yüksekliğini hesaba katarak aşağı kaydır (veya sol üstteki diğer barlarla dikey bir flex-column içinde hizala) ve `z-index` değerini düzenle.
  * "Yerleştir" butonu kapsayıcı kartın dışına taşıyor; bulunduğu satırı `display: flex; align-items: center; gap: 6px;` yap ve açılır menünün (`select`) genişliğini `flex: 1; min-width: 0;` ile sınırla.

## 2. Alt Zaman Çizelgesi (Timeline) ve Kamera Barı Taşmaları
* **Sorun:** Alt kısımdaki kamera/kat kontrol barı ile en alttaki video oynatıcı (timeline) barı, sol alt köşedeki alt bilgi (footer) metinlerinin (`WASD / Kontroller...`) üstüne biniyor. Metinler (`180.0 sn`) alt satıra kırılıyor.
* **Çözüm:**
  * Alt kontrol panellerini ortala ve genişliklerini `max-width: calc(100% - 40px)` ile sınırla.
  * Arka plantaki durum/kısayol metinlerini (`WASD` vb.) yüzen barların altında kalmayacak şekilde ya en üst köşeye taşı ya da timeline barının içine entegre et.
  * Süre göstergelerine (`0.0 sn`, `180.0 sn`) `white-space: nowrap;` ekle.

## 3. Kart Kontrastları, Renk Karışmaları ve Buton Taşmaları
* **Sorun:** 
  * Sağ paneldeki (`Öncelikli Mevzuat Bulguları` ve `3B RAG Mekansal Hesaplama Kuralları`) renkli uyarı kartlarının (kırmızı, turuncu, sarı, yeşil) arka plan şeffaflığı ve kenarlıkları birbirine çok yakın, metin/etiket kontrastı düşük ve renkler birbirine karışmış görünüyor.
  * Orta üstteki `Tüm Yapı` gibi bazı butonların içindeki metinler darlıktan dolayı iki satıra bölünüp buton dışına taşıyor.
* **Çözüm:**
  * **Kart Stilleri:** Uyarı kartlarında (`BYKHY M.31`, `OTOPARK M.6` vb.) arka plan opaklığını koyulaştır (`rgba(20, 24, 33, 0.85)` gibi koyu bir zemin) ve renk vurgusunu tüm arka plana yaymak yerine sadece sol kenarlıkta (`border-left: 4px solid <renk>`) ve rozet (badge) arka planında kullan. Kartlar arasına net bir `margin-bottom: 10px` ekle.
  * **Cam Efekti (Glassmorphism):** 3B sahne üzerindeki tüm yüzen panellere `backdrop-filter: blur(8px); background-color: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.12);` uygulayarak 3B modelin çizgileriyle arayüz metinlerinin birbirine karışmasını engelle.
  * **Buton ve Sekmeler:** Tüm kontrol butonlarına ve rozetlere `white-space: nowrap;`, `padding: 4px 10px;` ve `font-size: 12px;` (veya `0.75rem`) tanımlayarak metinlerin kırılmasını ve taşmasını önle.

## 4. Genel Responsive / Ölçekleme (100% Zoom Uyumu)
* Sol menü (`220px` sabit veya `15vw`) ve sağ analiz paneli (`320px - 360px` arası) genişliklerini optimize ederek orta 3B çalışma alanına (viewport) daha fazla yatay alan bırak.
* Sağ panelde içerik taştığında sayfanın tamamının değil, sadece sağ panelin kendi içinde kaydırılmasını (`overflow-y: auto; max-height: calc(100vh - <header_height>);`) sağla.