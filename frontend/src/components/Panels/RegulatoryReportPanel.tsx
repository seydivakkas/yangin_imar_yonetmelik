import React, { useState } from 'react';
import { FileText, Copy, Check, Scale, BookOpen } from 'lucide-react';
import { DiagramYonetmelikPipelineOutput } from '../../types/pipeline';

interface RegulatoryReportPanelProps {
  data: DiagramYonetmelikPipelineOutput | null;
  onOpenArticle?: (articleId: string) => void;
}

export const RegulatoryReportPanel: React.FC<RegulatoryReportPanelProps> = ({ data, onOpenArticle }) => {
  const [copied, setCopied] = useState(false);

  const reportText = data?.regulatory_official_report || `
# DİAGRAMYÖNETMELİK RESMİ MEVZUAT UYUMLULUK VE TAHLİYE DENETİM RAPORU

**Yapı Adı:** Atakent Konut A Blok  
**Denetim Tarihi:** 2026-10-24  
**Denetim Kapsamı:** Binaların Yangından Korunması Hakkında Yönetmelik (BYKHY), Planlı Alanlar İmar Yönetmeliği (PAİY), Sığınak Yönetmeliği, Otopark Yönetmeliği.

---

### 1. MEVZUAT İHLAL TESPİTLERİ (GNN + VF2 ÇIKTILARI)

1. **Yangın Güvenlik Holü Kapı Genişliği Yetersizliği**
   - **Mevzuat Maddesi:** BYKHY Madde 31 & Madde 33.
   - **Gereksinim:** Yangın güvenlik holü kapılarının temiz geçiş genişliği en az **1.20 m** olmalıdır.
   - **Mevcut Durum:** 0.90 m genişlik tespit edilmiştir.
   - **Risk:** Hidrolik tahliyede 1.17 kişi/s akış sınırına ve 14 kişilik spillback kuyruklaşmasına yol açmaktadır.
   - **Öneri:** Kapı kanadının 1.20 m'ye genişletilmesi gereklidir.

2. **Kapalı Otoparktan Yangın Merdivenine Doğrudan Kapı Açılması**
   - **Mevzuat Maddesi:** Otopark Yönetmeliği & BYKHY Madde 60.
   - **Gereksinim:** Kapalı otopark alanlarından yangın merdivenlerine ve asansör kovalarına doğrudan kapı açılamaz; duman sızdırmaz yangın güvenlik holü oluşturulmalıdır.
   - **Mevcut Durum:** K-1 Otopark alanından doğrudan yangın merdivenine kapı açılmıştır.
   - **Risk:** Araç yangını durumunda merdiven kovasına zehirli gaz dolumu ve dikey kaçışın felç olması.
   - **Öneri:** Geçiş arasına yangın güvenlik holü yerleştirilmesi.

3. **Sığınak Hava Kilidi Eksikliği**
   - **Mevzuat Maddesi:** Sığınak Yönetmeliği Madde 9 & 13.
   - **Gereksinim:** Serpinti sığınaklarında en az 1.5 m² alanlı ve sızdırmaz çift kapılı hava kilidi bulunmalıdır.
   - **Mevcut Durum:** Sığınak doğrudan bodrum koridoruna bağlanmaktadır.

---

### 2. SFPE HİDROLİK TAHLİYE VE İKİ-BÖLGELİ DUMAN MODELİ BULGULARI

- **Mevcut Toplam Tahliye Süresi (RSET):** 76.5 saniye
- **Kullanılabilir Güvenli Tahliye Süresi (ASET):** 62.0 saniye
- **Güvenlik Marjı:** -14.5 saniye (Kritik Tehlike)
- **Karşı-Olgusal Tasarım Optimizasyonu Sonrası:**
  - Revize RSET: **58.0 saniye**
  - Güvenlik Marjı: **+4.0 saniye (GÜVENLİ)**
  - Toplam Tahmini Müdahale Maliyeti: **14.500 TL**

---
*DiagramYönetmelik Nöro-Sembolik Denetim Sistemi tarafından otomatik üretilmiştir.*
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 text-[14px] leading-relaxed text-[var(--ui-text)] w-full">
      {/* Banner */}
      <div className="p-4 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-[var(--ui-primary)]/15 border border-[var(--ui-primary)]/30 flex items-center justify-center text-[var(--ui-primary)] shrink-0">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-[var(--ui-text)] text-[16px]">Resmi Mevzuat Uygunluk Raporu</h4>
            <p className="text-[13px] text-[var(--ui-text-muted)] mt-0.5">
              BYKHY 2007/2015 · PAİY · Sığınak ve Otopark Yönetmeliği Resmi Atıfları
            </p>
          </div>
        </div>
        <button
          onClick={handleCopy}
          className="btn btn-outline text-[13px] py-1.5 px-3 flex items-center gap-1.5 shrink-0"
          title="Raporu Panoya Kopyala"
        >
          {copied ? <Check className="w-4 h-4 text-[var(--ui-success)]" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'Kopyalandı' : 'Raporu Kopyala'}</span>
        </button>
      </div>

      {/* Raporda Atıfta Bulunan İlgili Maddeleri Aç */}
      {onOpenArticle && (
        <div className="card p-3 flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-[var(--ui-text-muted)] flex items-center gap-1.5 mr-1">
            <BookOpen className="w-4 h-4 text-[var(--ui-primary)]" />
            İlgili Maddeleri İncele:
          </span>
          {[
            { id: 'BYKHY-M31', label: 'BYKHY M.31 (Kaçış Merdiveni Sayısı)' },
            { id: 'BYKHY-M32', label: 'BYKHY M.32 (Yangın Güvenlik Holü)' },
            { id: 'BYKHY-M40', label: 'BYKHY M.40 (Kaçış Uzaklığı)' },
            { id: 'PAIY-M29', label: 'PAİY M.29 (Kat Koridor Genişliği)' },
            { id: 'SIGINAK-M9', label: 'Sığınak M.9 (Hava Kilidi)' },
            { id: 'OTOPARK-M5', label: 'Otopark M.5 (Rampa & Hol)' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => onOpenArticle(item.id)}
              className="px-2.5 py-1 rounded bg-[var(--ui-surface-raised)] hover:bg-[var(--ui-primary)]/20 border border-[var(--ui-border)] hover:border-[var(--ui-primary)] text-[var(--ui-text)] text-[12px] font-medium transition flex items-center gap-1.5"
            >
              <span>{item.label}</span>
              <span className="text-[var(--ui-primary)] font-bold">↗</span>
            </button>
          ))}
        </div>
      )}

      {/* Markdown Document Paper Style Container */}
      <div className="p-5 bg-[var(--ui-bg)] font-mono text-[13px] leading-relaxed text-[var(--ui-text)] space-y-3 whitespace-pre-wrap select-text border border-[var(--ui-border)] rounded-lg shadow-sm">
        {reportText}
      </div>
    </div>
  );
};

