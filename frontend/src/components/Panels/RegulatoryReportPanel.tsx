import React, { useState } from 'react';
import { FileText, Copy, Check, Scale } from 'lucide-react';
import { DiagramYonetmelikPipelineOutput } from '../../types/pipeline';

interface RegulatoryReportPanelProps {
  data: DiagramYonetmelikPipelineOutput | null;
}

export const RegulatoryReportPanel: React.FC<RegulatoryReportPanelProps> = ({ data }) => {
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
    <div className="space-y-4 p-4 text-xs font-sans text-gray-200 overflow-y-auto max-h-full">
      {/* Banner */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-950/40 via-indigo-950/40 to-slate-900 border border-blue-500/30 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Scale className="w-5 h-5 text-cyan-400" />
          <div>
            <h4 className="font-bold text-white text-xs">Aşama 9: Resmi Mevzuat Uygunluk Raporu</h4>
            <p className="text-[10px] text-gray-400">BYKHY 2007/2015 · PAİY · Sığınak ve Otopark Yönetmeliği Madde Atıfları</p>
          </div>
        </div>
        <button
          onClick={handleCopy}
          className="btn-secondary text-[11px] py-1 px-2.5"
          title="Raporu Kopyala"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Kopyalandı' : 'Kopyala'}</span>
        </button>
      </div>

      {/* Markdown Document Paper Style Container */}
      <div className="glass-panel p-4 bg-[#0A0E1A]/90 font-mono text-[11px] leading-relaxed text-gray-300 space-y-3 whitespace-pre-wrap select-text border border-white/10 rounded-lg">
        {reportText}
      </div>
    </div>
  );
};
