import React, { useState } from 'react';
import { FileText, Copy, Check, Scale, BookOpen } from 'lucide-react';
import { DiagramYonetmelikPipelineOutput } from '../../types/pipeline';

interface RegulatoryReportPanelProps {
  data: DiagramYonetmelikPipelineOutput | null;
  onOpenArticle?: (articleId: string) => void;
}

export const RegulatoryReportPanel: React.FC<RegulatoryReportPanelProps> = ({ data, onOpenArticle }) => {
  const [copied, setCopied] = useState(false);

  const reportText = data?.report_markdown || data?.regulatory_official_report || '';

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
          disabled={!reportText}
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
        {reportText || 'Rapor için önce bir pafta denetleyin.'}
      </div>
    </div>
  );
};

