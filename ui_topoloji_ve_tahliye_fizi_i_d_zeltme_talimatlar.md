# UI/UX Layout, Mekansal Topoloji (Kapı/Duvar Çarpışması) ve Resizable Panel Görevi

Aşağıdaki görsel, fiziksel (pathfinding) ve yerleşim (layout) sorunlarını, tarayıcıyı %100 varsayılan yakınlaştırma oranında kusursuz çalışacak ve gerçekçi mimari kurallara uyacak şekilde düzelt.

---

## 1. Tel Ali Tahliye Simülasyonu: Duvar İçinden Geçme (Clipping) Sorunu ve Kapı Zorunluluğu

* **Sorun:** Tel Ali tahliye simülasyonunda rota hesaplanırken (Dijkstra / A* / 3B RAG Grafı) sadece oda merkezleri (centroid) birbirine kuş uçuşu düz çizgilerle bağlanıyor. Bu yüzden Tel Ali ve mavi/yeşil tahliye rotası çizgisi **duvarların içinden geçiyor**. Ayrıca bazı odaların ve dairelerin kapı boşlukları veya bağlı bulundukları daire/ev hiyerarşisi eksik.
* **Çözüm (Mimari Topoloji & Pathfinding):**
  1. **Oda - Daire (Ev) - Bina Hiyerarşisi:** Sistemdeki her bir oda (`Salon`, `Oda`, `Mutfak`, `Banyo`) mutlaka bir `Daire / Ev` birimine (`Antre / Koridor` merkezli) bağlı olmalı. Her odanın kendi daire içi antresine açılan **en az 1 iç kapısı**, her dairenin kat holüne/koridoruna açılan **1 daire giriş kapısı** ve her binanın zemin katta dışarıya açılan **en az 1 ana bina çıkış kapısı (ve acil çıkış kapısı)** bulunmalıdır.
  2. **3B Duvar Geometrisinde Kapı Boşlukları:** Odaları birbirine bağlayan duvar mesh'lerinde kapıların olduğu noktalarda gerçek boşluklar (portal/doorway) açılmalı ve görsel olarak kapı kasası/kanadı (veya belirgin bir kapı ikonu/çerçevesi) render edilmelidir.
  3. **Portal (Kapı) Tabanlı Rota Algoritması:**
     * Graf düğümleri (Nodes) sadece oda merkezlerinden ibaret olmamalı; **her kapı (Door/Portal) birer ara geçiş düğümü (Waypoint Node)** olarak grafa eklenmelidir.
     * Rota çizilirken `Oda A Merkezi -> Oda A-B Kapı Düğümü -> Oda B Merkezi -> Daire Kapısı Düğümü -> Kat Koridoru -> Merdiven Kapısı` sırası takip edilmelidir.
     * **Duvar Çarpışma Engeli (Wall Collision / NavMesh):** İki nokta arasında doğrudan duvar varsa o kenar (edge) geçersiz sayılmalı; Tel Ali kesinlikle duvar mesh'lerinin içinden geçmemeli, yalnızca tanımlı kapı düğümlerinin koordinatlarından geçerek hareket etmelidir.

---

## 2. Sağ Panelin Sürüklenerek Boyutlandırılması (Resizable Right Sidebar)

* **Sorun:** Sağdaki analiz ve mevzuat paneli sabit genişlikte olduğu için dar ekranlarda sıkışıyor veya geniş ekranlarda yeterince büyütülemiyor.
* **Çözüm:**
  * Sağ panelin sol kenarına fare ile tutulup sola/sağa çekilebilen **4px - 6px genişliğinde bir boyutlandırma tutamacı (Resize Handle / Splitter)** ekle (`cursor: col-resize`).
  * Kullanıcı bu kenarı sola doğru çektiğinde sağ panel genişlemeli, sağa doğru çektiğinde daralmalıdır (`min-width: 280px`, `max-width: 650px`).
  * Boyutlandırma sırasında orta 3B Canvas alanı (`flex: 1`) otomatik olarak kalan boşluğa uyum sağlamalı ve `ResizeObserver` ile Three.js / WebGL renderer boyutu anlık güncellenmelidir.
  * Tutamaç üzerine gelindiğinde (`hover` veya `active` durumunda) mavi/parlak bir vurgu çizgisi (`background: #3b82f6`) görünerek kullanıcıya sürüklenebilir olduğunu belli etmelidir.

---

## 3. Sağ Panel Kartları ve Rozet/Bubble Aralıkları (Spacing & Breathing Room)

* **Sorun:** Sağ paneldeki metrik kartları (`RSET`, `Optimizasyon Kazancı`, `Toplam Yapı Alanı`, `Kullanıcı Yükü`), içlerindeki küçük bilgi balonları (bubble/badge) ve altındaki `Öncelikli Mevzuat Bulguları` (`BYKHY M.31`, `OTOPARK M.6`, `SIĞINAK M.9`) kartları birbirine çok yapışık duruyor.
* **Çözüm:**
  * Sağ panel içindeki tüm ana bölümler ve kart listeleri arasına net bir boşluk (`display: flex; flex-direction: column; gap: 12px;` veya `14px`) tanımla.
  * Üstteki 2x2 metrik grid yapısına `gap: 10px;` ve her bir metrik kartının iç dolgularına `padding: 12px 14px;` uygula.
  * Mevzuat bulgu kartlarının (`BYKHY M.31` vb.) kendi aralarındaki dikey boşluğu `margin-bottom: 10px;` (veya flex `gap: 10px;`) yap, iç dolgularını `padding: 12px;` olarak rahatlat.
  * Kartların içindeki rozet/bubble elemanları (`BYKHY M.31` etiketi ile yanındaki başlık metni ve alt açıklama satırları) arasına `gap: 8px;` ve satır yüksekliğine `line-height: 1.45;` ekleyerek yazıların birbirine girmesini önle.

---

## 4. Önceki Layout, Taşma ve Kontrast Kurallarının Korunması

* **Orta Sahne Üst/Alt Barları:** 3B sahne üzerindeki üst kontrol çubukları, **"Tel Ali Tahliye Simülasyonu"** penceresi ve alttaki **Timeline / Kamera** barları birbirinin üstüne binmemeli; cam efekti (`backdrop-filter: blur(8px)`) ve `white-space: nowrap` korunmalıdır.
* **Kart Kontrastları:** Sağ paneldeki uyarı kartlarında koyu zemin (`rgba(20, 24, 33, 0.9)`) ve sol kenarlık vurgusu (`border-left: 4px solid <renk>`) kullanılarak yüksek okunabilirlik sağlanmalıdır.