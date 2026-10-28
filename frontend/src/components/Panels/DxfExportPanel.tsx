import React from 'react';
import { FileCode, Download, Check, Layers, AlertCircle } from 'lucide-react';
import { DiagramYonetmelikPipelineOutput } from '../../types/pipeline';

interface DxfExportPanelProps {
  data: DiagramYonetmelikPipelineOutput | null;
  onDownloadDXF: () => void;
}

export const DxfExportPanel: React.FC<DxfExportPanelProps> = ({ data, onDownloadDXF }) => {
  return (
    <div className="space-y-4 text-[14px] leading-relaxed text-[var(--ui-text)] w-full">
      {/* Banner */}
      <div className="p-4 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-lg bg-[var(--ui-primary)]/15 border border-[var(--ui-primary)]/30 flex items-center justify-center text-[var(--ui-primary)] shrink-0">
          <FileCode className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-bold text-[var(--ui-text)] text-[16px]">CAD Pafta & DXF Katman Entegrasyonu</h4>
          <p className="text-[13px] text-[var(--ui-text-muted)] mt-0.5">
            DENETIM_IHLALLERI (Kırmızı) · OPTIMIZASYON_ONERILERI (Yeşil Revcloud)
          </p>
        </div>
      </div>

      {/* Layer Explanation Cards */}
      <div className="space-y-3">
        <div className="p-4 rounded-lg bg-[#221A1D] border border-[var(--ui-danger)]/40 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[var(--ui-danger)] font-bold text-[14px]">DENETIM_IHLALLERI</span>
            <span className="badge badge-danger text-[12px] font-mono">ACI Renk: 1 (Kırmızı)</span>
          </div>
          <p className="text-[13px] text-[var(--ui-text)] leading-relaxed">
            Mimarın CAD çizimi üzerine eklenen kırmızı oklar, hedef kısıt kutuları ve mevzuat madde numaralarını içeren MTEXT lider çizgileri.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-[#182924] border border-[var(--ui-success)]/40 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[var(--ui-success)] font-bold text-[14px]">OPTIMIZASYON_ONERILERI</span>
            <span className="badge badge-success text-[12px] font-mono">ACI Renk: 3 (Yeşil)</span>
          </div>
          <p className="text-[13px] text-[var(--ui-text)] leading-relaxed">
            Native AutoCAD REVCLOUD uyumlu (0.55 yay bombeli) revizyon bulutları ve önerilen genişleme / hava kilidi sınır çizgileri.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[var(--ui-primary)] font-bold text-[14px]">DENETIM_OZET_TABLOSU</span>
            <span className="badge badge-primary text-[12px] font-mono">CAD Tablosu</span>
          </div>
          <p className="text-[13px] text-[var(--ui-text)] leading-relaxed">
            Pafta antetinin hemen yanına otomatik yerleştirilen, tespit edilen tüm ihlalleri ve revizyon durumlarını gösteren CAD tablosu.
          </p>
        </div>
      </div>

      {/* Download Action */}
      <div className="card p-5 text-center space-y-3">
        <div className="text-[var(--ui-text)] text-[14px] font-semibold">
          Denetlenmiş ve Katmanları İşlenmiş DXF Paftası Hazır
        </div>
        <button
          onClick={onDownloadDXF}
          className="btn btn-primary w-full justify-center py-3 text-[14px] flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          <span>İşlenmiş DXF Dosyasını İndir (.dxf)</span>
        </button>
      </div>
    </div>
  );
};

