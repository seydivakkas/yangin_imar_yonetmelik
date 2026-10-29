import React, { useState } from 'react';
import { Image as ImageIcon, Upload, Eye, Cpu, Zap, Layers, Play, CheckCircle2, AlertCircle } from 'lucide-react';
import { DiagramYonetmelikPipelineOutput } from '../../types/pipeline';

interface CvImagePanelProps {
  data: DiagramYonetmelikPipelineOutput | null;
  onUploadImage: (file: File) => void;
  onRunSampleImage?: () => void;
}

export const CvImagePanel: React.FC<CvImagePanelProps> = ({ data, onUploadImage, onRunSampleImage }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cvInfo = data?.cv_image_analysis;
  const isImageMode = cvInfo?.is_image_mode ?? false;
  const [activeVisTab, setActiveVisTab] = useState<'heatmap' | 'contours'>('heatmap');
  const [testingSample, setTestingSample] = useState(false);

  const handleSampleClick = async () => {
    if (onRunSampleImage) {
      onRunSampleImage();
      return;
    }
    setTestingSample(true);
    try {
      const res = await fetch('/api/audit/sample-image', { method: 'POST' });
      if (res.ok) {
        window.location.reload();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTestingSample(false);
    }
  };

  return (
    <div className="space-y-4 text-[14px] leading-relaxed text-[var(--ui-text)] w-full">
      {/* Banner */}
      <div className="p-4 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] flex items-center justify-between gap-3.5">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-[var(--ui-primary)]/15 border border-[var(--ui-primary)]/30 flex items-center justify-center text-[var(--ui-primary)] shrink-0">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-[var(--ui-text)] text-[16px]">Görü İşleme: OpenCV Kat Planı Analizi</h4>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                isImageMode 
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                  : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
              }`}>
                {isImageMode ? 'OpenCV Raster Modeli Aktif' : 'CAD/DXF Vektörel Model Aktif'}
              </span>
            </div>
            <p className="text-[13px] text-[var(--ui-text-muted)] mt-0.5">
              Bilateral Filtreleme · Adaptif Otsu · Morfolojik Kapı Tespiti · 2B Jet Isı Haritası
            </p>
          </div>
        </div>
      </div>

      {/* Upload Zone & Sample Test Button */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
          className="md:col-span-2 border-2 border-dashed border-[var(--ui-border)] hover:border-[var(--ui-primary)] rounded-lg p-5 text-center cursor-pointer transition-all bg-[var(--ui-surface)] hover:bg-[var(--ui-surface-raised)] space-y-2"
        >
          <div className="w-9 h-9 rounded-lg bg-[var(--ui-primary)]/15 text-[var(--ui-primary)] border border-[var(--ui-primary)]/30 flex items-center justify-center mx-auto">
            <Upload className="w-4 h-4" />
          </div>
          <div className="font-bold text-[var(--ui-text)] text-[14px]">Raster Kat Planı Görseli Yükle (PNG / JPG)</div>
          <p className="text-[12px] text-[var(--ui-text-muted)] max-w-sm mx-auto">
            OpenCV mimari duvar çizgilerini, oda sınırlarını ve kapı boşluklarını otomatik tespit eder.
          </p>
        </div>

        {/* Sample Run Button */}
        <div className="card p-4 flex flex-col justify-between border border-[var(--ui-border)] bg-[var(--ui-surface)]">
          <div>
            <div className="text-[13px] font-bold text-[var(--ui-text)] flex items-center gap-1.5">
              <Play className="w-4 h-4 text-emerald-400" />
              <span>Hızlı OpenCV Testi</span>
            </div>
            <p className="text-[12px] text-[var(--ui-text-muted)] mt-1">
              Yapay zeka görü motorunu test etmek için örnek mimari raster kat planını anında işler.
            </p>
          </div>
          <button
            onClick={handleSampleClick}
            disabled={testingSample}
            className="btn btn-secondary mt-3 w-full py-2 text-[12px] flex items-center justify-center gap-1.5 font-semibold text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10"
          >
            {testingSample ? 'İşleniyor...' : 'Örnek Görseli Tara'}
          </button>
        </div>
      </div>

      {/* Analysis Metrics */}
      <div className="card p-4 space-y-3">
        <h5 className="font-bold text-[var(--ui-text)] text-[15px] flex items-center justify-between border-b border-[var(--ui-border)] pb-2">
          <span className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[var(--ui-primary)]" /> OpenCV Görü İşleme Durumu
          </span>
          <span className="text-[12px] text-[var(--ui-text-muted)] font-mono">
            {isImageMode ? 'Gerçek OpenCV Piksel Analizi' : 'Vektörel CAD Modeli'}
          </span>
        </h5>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-md bg-[var(--ui-surface-raised)] border border-[var(--ui-border)]">
            <div className="text-[12px] text-[var(--ui-text-muted)] font-medium">Tespit Edilen Mekan</div>
            <div className="text-xl font-bold font-mono text-[var(--ui-text)] mt-1">
              {cvInfo?.detected_rooms_count ? cvInfo.detected_rooms_count : `${data?.nodes?.length || 0} Mahal`}
            </div>
          </div>
          <div className="p-3 rounded-md bg-[var(--ui-surface-raised)] border border-[var(--ui-border)]">
            <div className="text-[12px] text-[var(--ui-text-muted)] font-medium">Tespit Edilen Kapı</div>
            <div className="text-xl font-bold font-mono text-[var(--ui-text)] mt-1">
              {cvInfo?.detected_doors_count ? cvInfo.detected_doors_count : `${data?.edges?.length || 0} Geçit`}
            </div>
          </div>
          <div className="p-3 rounded-md bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] col-span-2 md:col-span-1">
            <div className="text-[12px] text-[var(--ui-text-muted)] font-medium">Algoritma Motoru</div>
            <div className="text-[13px] font-bold font-mono text-cyan-400 mt-2">
              Bilateral + Otsu + RDP
            </div>
          </div>
        </div>

        {/* 2B Isı Haritası ve Görsel Çıktı */}
        {(cvInfo?.heatmap_base64 || cvInfo?.debug_vis_base64) ? (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveVisTab('heatmap')}
                  className={`text-[12px] font-semibold px-3 py-1 rounded transition-all ${
                    activeVisTab === 'heatmap'
                      ? 'bg-[var(--ui-primary)] text-white'
                      : 'bg-[var(--ui-surface-raised)] text-[var(--ui-text-muted)] border border-[var(--ui-border)]'
                  }`}
                >
                  🔥 2B Jet Tahliye Isı Haritası
                </button>
                <button
                  onClick={() => setActiveVisTab('contours')}
                  className={`text-[12px] font-semibold px-3 py-1 rounded transition-all ${
                    activeVisTab === 'contours'
                      ? 'bg-[var(--ui-primary)] text-white'
                      : 'bg-[var(--ui-surface-raised)] text-[var(--ui-text-muted)] border border-[var(--ui-border)]'
                  }`}
                >
                  📐 Algılanan Kontur & Kapılar
                </button>
              </div>
              <span className="text-[11px] text-emerald-400 font-mono font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> OpenCV Tarafından Üretildi
              </span>
            </div>

            <div className="rounded-lg overflow-hidden border border-[var(--ui-border)] bg-black/40 flex items-center justify-center p-2">
              <img
                src={activeVisTab === 'heatmap' ? (cvInfo.heatmap_base64 || cvInfo.debug_vis_base64!) : cvInfo.debug_vis_base64!}
                alt="OpenCV Çıktısı"
                className="max-h-[380px] w-auto object-contain rounded"
              />
            </div>
            <p className="text-[12px] text-[var(--ui-text-muted)] italic text-center">
              {activeVisTab === 'heatmap'
                ? 'Koridor ve kapı geçiş yoğunlukları OpenCV COLORMAP_JET gradyanıyla piksel bazında termal olarak haritalanmıştır.'
                : 'Yeşil çizgiler Ramer-Douglas-Peucker ile sadeleştirilmiş oda poligonlarını, kırmızı çizgiler tespit edilen kapı eşiklerini göstermektedir.'}
            </p>
          </div>
        ) : (
          <div className="p-3 rounded-md bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] space-y-1.5">
            <div className="flex items-center justify-between text-[13px] text-cyan-400 font-semibold">
              <span className="flex items-center gap-1.5">
                <Zap className="w-4 h-4" /> 2B Bilgisayarlı Görü Motoru
              </span>
              <span className="badge badge-info text-[12px]">Hazır</span>
            </div>
            <p className="text-[13px] text-[var(--ui-text-muted)] leading-relaxed">
              {cvInfo?.description || 'OpenCV `COLORMAP_JET` gradyanı ve morfolojik filtreler kat planı görseli yüklendiğinde otomatik aktive olur.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

