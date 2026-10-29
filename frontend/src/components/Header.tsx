import React, { useRef } from 'react';
import { Play, Upload, Flame, CheckCircle2, AlertTriangle, Image as ImageIcon, Layers, FileText, ShieldCheck, Loader2 } from 'lucide-react';
import { ActiveTab, DiagramYonetmelikPipelineOutput } from '../types/pipeline';

interface HeaderProps {
  data: DiagramYonetmelikPipelineOutput | null;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isLoading: boolean;
  loadingAction?: 'sample' | 'high_rise' | 'compliant_8' | 'upload' | null;
  onRunAudit: () => void;
  onRunHighRiseAudit?: () => void;
  onRunCompliant8StoryAudit?: () => void;
  onUploadDXF: (file: File) => void;
  onUploadImage: (file: File) => void;
}

export const Header: React.FC<HeaderProps> = ({
  data,
  activeTab,
  setActiveTab,
  isLoading,
  loadingAction,
  onRunAudit,
  onRunHighRiseAudit,
  onRunCompliant8StoryAudit,
  onUploadDXF,
  onUploadImage,
}) => {
  const dxfInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  // Tab adını Türkçe okunabilir formata dönüştür
  const getTabLabel = (tab: ActiveTab): string => {
    switch (tab) {
      case 'overview': return 'Genel Bakış';
      case 'cad_polygon': return 'CAD & Poligon Geometrisi';
      case 'building_graph': return '3B RAG Grafı & Mekânsal Topoloji';
      case 'spminer': return 'SPMiner Mekânsal Madencilik';
      case 'fire_audit': return 'Yangın Mevzuatı Denetimi (BYKHY)';
      case 'fire_checklist': return 'Kaçış Yolları & Merdiven Kontrol Listesi (BYKHY)';
      case 'basement_audit': return 'Bodrum & Sığınak Denetimi (PAİY/Sığınak)';
      case 'evacuation': return 'Tahliye & Güvenli Kaçış Simülasyonu';
      case 'optimization': return 'Karşı-Olgusal Tasarım Optimizasyonu';
      case 'dxf_preview': return 'Revize DXF Pafta Çıktısı';
      case 'regulatory_library': return 'Mevzuat Kütüphanesi (4 Temel Yönetmelik)';
      case 'regulatory_report': return 'Mevzuat Denetim Raporu';
      case 'cv_image': return 'OpenCV Kat Planı Görü Analizi';
      default: return 'Genel Bakış';
    }
  };

  return (
    <header className="h-16 border-b border-[var(--ui-border)] bg-[var(--ui-surface)] px-5 flex items-center justify-between z-30 select-none shadow-sm">
      {/* Brand & Project Info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-[var(--ui-primary)] text-white flex items-center justify-center font-bold shadow-sm">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-base font-semibold tracking-tight text-[var(--ui-text)]">
                DiagramYönetmelik
              </span>
              <span className="badge badge-neutral text-xs">v1.0 Professional</span>
            </div>
            <p className="text-xs text-[var(--ui-text-dim)]">
              Nöro-Sembolik 3B Yangın & İmar Mevzuat Denetimi
            </p>
          </div>
        </div>

        <div className="h-8 w-px bg-[var(--ui-border)] mx-1" />

        {/* Project Context & Status */}
        <div className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 rounded-md bg-[var(--ui-bg)] border border-[var(--ui-border)] text-sm">
          <span className="text-[var(--ui-text-dim)] text-xs font-medium">Proje:</span>
          <span className="font-medium text-[var(--ui-text)]">
            {typeof data?.metadata?.title === 'string'
              ? data.metadata.title
              : 'Çok Katlı Konut Yapısı (BYKHY/PAİY/Sığınak)'}
          </span>
          {data?.metadata?.total_floors && (
            <span className="badge badge-neutral text-xs font-mono ml-1">
              {data.metadata.total_floors} Kat
            </span>
          )}
          <div className="w-px h-3.5 bg-[var(--ui-border)] mx-1" />
          {data ? (
            <span className="flex items-center gap-1.5 text-[var(--ui-success)] text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Denetim Başarılı
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[var(--ui-warning)] text-xs font-medium">
              <AlertTriangle className="w-3.5 h-3.5" /> Analiz Bekleniyor
            </span>
          )}
        </div>
      </div>

      {/* Center: Current Module Badge (No duplicate 9-tab spam) */}
      <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-md bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] text-sm">
        <span className="text-[var(--ui-text-dim)] text-xs">Aktif Modül:</span>
        <span className="font-semibold text-[var(--ui-primary)]">{getTabLabel(activeTab)}</span>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2.5">
        <input
          ref={dxfInputRef}
          type="file"
          accept=".dxf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) onUploadDXF(e.target.files[0]);
          }}
        />
        <input
          ref={imgInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) onUploadImage(e.target.files[0]);
          }}
        />

        <button
          onClick={() => dxfInputRef.current?.click()}
          className="btn btn-secondary btn-sm hidden sm:inline-flex"
          title="CAD DXF Paftası Yükle ve Analiz Et"
        >
          <Upload className="w-4 h-4 text-[var(--ui-text-muted)]" />
          <span>DXF Yükle</span>
        </button>

        <button
          onClick={() => imgInputRef.current?.click()}
          className="btn btn-secondary btn-sm hidden md:inline-flex"
          title="Kat Planı Görseli Yükle (OpenCV Görü Analizi)"
        >
          <ImageIcon className="w-4 h-4 text-[var(--ui-text-muted)]" />
          <span>Plan Görseli</span>
        </button>

        {onRunHighRiseAudit && (
          <button
            onClick={onRunHighRiseAudit}
            disabled={isLoading}
            className="btn btn-secondary btn-sm inline-flex items-center gap-1.5"
            title="12 Katlı Yüksek Yapı Analiz Şablonunu Çalıştır (312 İhlalli Başlangıç Senaryosu)"
          >
            {loadingAction === 'high_rise' ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
            ) : (
              <Layers className="w-4 h-4 text-[var(--ui-text-muted)]" />
            )}
            <span>{loadingAction === 'high_rise' ? 'Hesaplanıyor...' : '12 Katlı (312 İhlal)'}</span>
          </button>
        )}

        {onRunCompliant8StoryAudit && (
          <button
            onClick={onRunCompliant8StoryAudit}
            disabled={isLoading}
            className="btn btn-sm inline-flex items-center gap-1.5 font-semibold px-3.5 py-1.5 rounded-md text-white shadow-sm transition-all hover:brightness-110 active:scale-95"
            style={{
              backgroundColor: '#059669',
              border: '1px solid #047857',
            }}
            title="312 İhlalin Tümü Çözümlenmiş Kusursuz 8 Katlı Paftayı Yükle ve Canlı İncele"
          >
            {loadingAction === 'compliant_8' ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-white" />
            )}
            <span>{loadingAction === 'compliant_8' ? '8 Kat Doğrulanıyor...' : '8 Katlı Kusursuz Pafta'}</span>
          </button>
        )}

        <button
          onClick={onRunAudit}
          disabled={isLoading}
          className="btn btn-primary btn-sm"
          title="Örnek Proje Üzerinde Tam Mevzuat Denetimini Çalıştır"
        >
          <Play className={`w-4 h-4 fill-current ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'Analiz Sürüyor...' : 'Canlı Denetle'}</span>
        </button>
      </div>
    </header>
  );
};
