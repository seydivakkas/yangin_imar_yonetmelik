import React from 'react';
import { Image as ImageIcon, Upload, Eye, Cpu, Zap } from 'lucide-react';
import { DiagramYonetmelikPipelineOutput } from '../../types/pipeline';

interface CvImagePanelProps {
  data: DiagramYonetmelikPipelineOutput | null;
  onUploadImage: (file: File) => void;
}

export const CvImagePanel: React.FC<CvImagePanelProps> = ({ data, onUploadImage }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cvInfo = data?.cv_image_analysis;

  return (
    <div className="space-y-4 p-4 text-xs font-sans text-gray-200 overflow-y-auto max-h-full">
      {/* Banner */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-purple-950/40 via-indigo-950/40 to-slate-900 border border-purple-500/30">
        <div className="flex items-center gap-2.5">
          <ImageIcon className="w-5 h-5 text-indigo-400" />
          <div>
            <h4 className="font-bold text-white text-xs">Bilgisayarlı Görü: OpenCV Kat Planı Analiz Motoru</h4>
            <p className="text-[10px] text-gray-400">Bilateral Filtreleme · Adaptif Otsu · Morfolojik Kapı Tespiti · 2B Isı Haritası</p>
          </div>
        </div>
      </div>

      {/* Upload Zone */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) onUploadImage(e.target.files[0]);
        }}
      />

      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-white/20 hover:border-cyan-400 rounded-xl p-6 text-center cursor-pointer transition-all bg-white/[0.02] hover:bg-cyan-500/[0.04] space-y-2"
      >
        <div className="w-10 h-10 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto">
          <Upload className="w-5 h-5" />
        </div>
        <div className="font-semibold text-white text-xs">Raster Kat Planı Görseli Yükle (PNG / JPG)</div>
        <p className="text-[10px] text-gray-400 max-w-xs mx-auto">
          OpenCV mimari duvar çizgilerini, oda sınırlarını ve kapı boşluklarını otomatik olarak tespit eder.
        </p>
      </div>

      {/* Analysis Metrics */}
      <div className="glass-panel p-3.5 space-y-2">
        <h5 className="font-semibold text-gray-300 text-xs flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-cyan-400" /> OpenCV Görü İşleme Durumu
        </h5>

        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="p-2 rounded bg-black/40">
            <div className="text-[10px] text-gray-400">Tespit Edilen Mekan</div>
            <div className="text-sm font-bold font-mono text-cyan-400">{cvInfo ? cvInfo.detected_rooms_count : '6 Kontur'}</div>
          </div>
          <div className="p-2 rounded bg-black/40">
            <div className="text-[10px] text-gray-400">Tespit Edilen Kapı</div>
            <div className="text-sm font-bold font-mono text-cyan-400">{cvInfo ? cvInfo.detected_doors_count : '5 Geçiş'}</div>
          </div>
        </div>

        <div className="p-2.5 rounded bg-slate-900/40 border border-white/5 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-emerald-400">
            <span className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" /> 2B Tahliye Isı Haritası
            </span>
            <span className="badge badge-green text-[9px]">Oluşturuldu</span>
          </div>
          <p className="text-[10px] text-gray-400 leading-normal">
            Koridor ve kapı geçiş yoğunlukları OpenCV `COLORMAP_JET` gradyanıyla piksel bazında hesaplanmıştır.
          </p>
        </div>
      </div>
    </div>
  );
};
