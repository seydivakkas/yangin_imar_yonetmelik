import React from 'react';
import { FileCode, Download, Check, Layers, AlertCircle } from 'lucide-react';
import { DiagramYonetmelikPipelineOutput } from '../../types/pipeline';

interface DxfExportPanelProps {
  data: DiagramYonetmelikPipelineOutput | null;
  onDownloadDXF: () => void;
}

export const DxfExportPanel: React.FC<DxfExportPanelProps> = ({ data, onDownloadDXF }) => {
  return (
    <div className="space-y-4 p-4 text-xs font-sans text-gray-200 overflow-y-auto max-h-full">
      {/* Banner */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/40 via-cyan-950/40 to-slate-900 border border-emerald-500/30">
        <div className="flex items-center gap-2.5">
          <FileCode className="w-5 h-5 text-emerald-400" />
          <div>
            <h4 className="font-bold text-white text-xs">Aşama 8: CAD Pafta & DXF Katman Entegrasyonu</h4>
            <p className="text-[10px] text-gray-400">DENETIM_IHLALLERI (Kırmızı) · OPTIMIZASYON_ONERILERI (Yeşil Revcloud)</p>
          </div>
        </div>
      </div>

      {/* Layer Explanation Cards */}
      <div className="space-y-2">
        <div className="p-3 rounded-lg bg-red-950/25 border border-red-500/30 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-mono text-red-400 font-bold text-[11px]">DENETIM_IHLALLERI</span>
            <span className="badge badge-red text-[9px]">ACI Renk: 1 (Kırmızı)</span>
          </div>
          <p className="text-[10px] text-gray-300">
            Mimarın CAD çizimi üzerine eklenen kırmızı oklar, hedef kısıt kutuları ve mevzuat madde numaralarını içeren MTEXT lider çizgileri.
          </p>
        </div>

        <div className="p-3 rounded-lg bg-emerald-950/25 border border-emerald-500/30 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-mono text-emerald-400 font-bold text-[11px]">OPTIMIZASYON_ONERILERI</span>
            <span className="badge badge-green text-[9px]">ACI Renk: 3 (Yeşil)</span>
          </div>
          <p className="text-[10px] text-gray-300">
            Native AutoCAD REVCLOUD uyumlu (0.55 yay bombeli) revizyon bulutları ve önerilen genişleme / hava kilidi sınır çizgileri.
          </p>
        </div>

        <div className="p-3 rounded-lg bg-cyan-950/25 border border-cyan-500/30 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-mono text-cyan-400 font-bold text-[11px]">DENETIM_OZET_TABLOSU</span>
            <span className="badge badge-cyan text-[9px]">CAD Tablosu</span>
          </div>
          <p className="text-[10px] text-gray-300">
            Pafta antetinin hemen yanına otomatik yerleştirilen, tespit edilen tüm ihlalleri ve revizyon durumlarını gösteren CAD tablosu.
          </p>
        </div>
      </div>

      {/* Download Action */}
      <div className="glass-panel p-4 text-center space-y-3">
        <div className="text-gray-300 text-xs font-semibold">
          Denetlenmiş ve Katmanları İşlenmiş DXF Paftası Hazır
        </div>
        <button
          onClick={onDownloadDXF}
          className="btn-primary w-full justify-center py-2.5 text-xs shadow-lg shadow-cyan-500/30"
        >
          <Download className="w-4 h-4" />
          <span>İşlenmiş DXF Dosyasını İndir (.dxf)</span>
        </button>
      </div>
    </div>
  );
};
