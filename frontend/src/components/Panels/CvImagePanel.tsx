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
    <div className="space-y-4 text-[14px] leading-relaxed text-[var(--ui-text)] w-full">
      {/* Banner */}
      <div className="p-4 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-lg bg-[var(--ui-primary)]/15 border border-[var(--ui-primary)]/30 flex items-center justify-center text-[var(--ui-primary)] shrink-0">
          <ImageIcon className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-bold text-[var(--ui-text)] text-[16px]">Görü İşleme: OpenCV Kat Planı Analizi</h4>
          <p className="text-[13px] text-[var(--ui-text-muted)] mt-0.5">
            Bilateral Filtreleme · Adaptif Otsu · Morfolojik Kapı Tespiti · 2B Isı Haritası
          </p>
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
        className="border-2 border-dashed border-[var(--ui-border)] hover:border-[var(--ui-primary)] rounded-lg p-6 text-center cursor-pointer transition-all bg-[var(--ui-surface)] hover:bg-[var(--ui-surface-raised)] space-y-2.5"
      >
        <div className="w-10 h-10 rounded-lg bg-[var(--ui-primary)]/15 text-[var(--ui-primary)] border border-[var(--ui-primary)]/30 flex items-center justify-center mx-auto">
          <Upload className="w-5 h-5" />
        </div>
        <div className="font-bold text-[var(--ui-text)] text-[15px]">Raster Kat Planı Görseli Yükle (PNG / JPG)</div>
        <p className="text-[13px] text-[var(--ui-text-muted)] max-w-sm mx-auto">
          OpenCV mimari duvar çizgilerini, oda sınırlarını ve kapı boşluklarını otomatik olarak tespit eder.
        </p>
      </div>

      {/* Analysis Metrics */}
      <div className="card p-4 space-y-3">
        <h5 className="font-bold text-[var(--ui-text)] text-[15px] flex items-center gap-2 border-b border-[var(--ui-border)] pb-2">
          <Cpu className="w-4 h-4 text-[var(--ui-primary)]" /> OpenCV Görü İşleme Durumu
        </h5>

        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="p-3 rounded-md bg-[var(--ui-surface-raised)] border border-[var(--ui-border)]">
            <div className="text-[12px] text-[var(--ui-text-muted)] font-medium">Tespit Edilen Mekan</div>
            <div className="text-xl font-bold font-mono text-[var(--ui-text)] mt-1">
              {cvInfo ? cvInfo.detected_rooms_count : '6 Kontur'}
            </div>
          </div>
          <div className="p-3 rounded-md bg-[var(--ui-surface-raised)] border border-[var(--ui-border)]">
            <div className="text-[12px] text-[var(--ui-text-muted)] font-medium">Tespit Edilen Kapı</div>
            <div className="text-xl font-bold font-mono text-[var(--ui-text)] mt-1">
              {cvInfo ? cvInfo.detected_doors_count : '5 Geçiş'}
            </div>
          </div>
        </div>

        <div className="p-3 rounded-md bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] space-y-1.5">
          <div className="flex items-center justify-between text-[13px] text-[var(--ui-success)] font-semibold">
            <span className="flex items-center gap-1.5">
              <Zap className="w-4 h-4" /> 2B Tahliye Isı Haritası
            </span>
            <span className="badge badge-success text-[12px]">Oluşturuldu</span>
          </div>
          <p className="text-[13px] text-[var(--ui-text-muted)] leading-relaxed">
            Koridor ve kapı geçiş yoğunlukları OpenCV `COLORMAP_JET` gradyanıyla piksel bazında hesaplanmıştır.
          </p>
        </div>
      </div>
    </div>
  );
};

