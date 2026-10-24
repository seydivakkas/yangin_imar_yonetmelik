import React, { useRef } from 'react';
import { Play, Upload, FileCode, Flame, CheckCircle2, AlertTriangle, Image as ImageIcon, Layers } from 'lucide-react';
import { ActiveTab, DiagramYonetmelikPipelineOutput } from '../types/pipeline';

interface HeaderProps {
  data: DiagramYonetmelikPipelineOutput | null;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isLoading: boolean;
  onRunAudit: () => void;
  onRunHighRiseAudit?: () => void;
  onUploadDXF: (file: File) => void;
  onUploadImage: (file: File) => void;
}

export const Header: React.FC<HeaderProps> = ({
  data,
  activeTab,
  setActiveTab,
  isLoading,
  onRunAudit,
  onRunHighRiseAudit,
  onUploadDXF,
  onUploadImage,
}) => {
  const dxfInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const pipelineStages: { id: ActiveTab; step: string; label: string }[] = [
    { id: 'cad_polygon', step: '①', label: 'CAD Poligon' },
    { id: 'building_graph', step: '②', label: '3B RAG Grafı' },
    { id: 'spminer', step: '③', label: 'SPMiner Modül' },
    { id: 'fire_audit', step: '④', label: 'GNN+VF2 Yangın' },
    { id: 'basement_audit', step: '⑤', label: 'Bodrum Denetim' },
    { id: 'evacuation', step: '⑥', label: 'Tahliye Sim' },
    { id: 'optimization', step: '⑦', label: 'Optimizasyon' },
    { id: 'dxf_preview', step: '⑧', label: 'DXF Pafta' },
    { id: 'regulatory_report', step: '⑨', label: 'Mevzuat Raporu' },
  ];

  return (
    <header className="h-16 border-b border-white/10 bg-[#070A11]/90 backdrop-blur-md px-4 flex items-center justify-between z-30 select-none">
      {/* Brand & Project Info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-white font-mono">DiagramYönetmelik</span>
              <span className="badge badge-cyan text-[10px]">v1.0-RC</span>
            </div>
            <p className="text-[11px] text-gray-400">Nöro-Sembolik 3B Yangın & İmar Denetim Motoru</p>
          </div>
        </div>

        <div className="h-8 w-px bg-white/10 mx-1" />

        {/* Project Selector Badge */}
        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-xs">
          <span className="font-semibold text-gray-200">
            {typeof data?.metadata?.title === 'string'
              ? data.metadata.title
              : 'Çok Katlı Konut Yapısı (BYKHY/PAİY/Sığınak)'}
          </span>
          {data ? (
            <span className="flex items-center gap-1 text-emerald-400 text-[11px] ml-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Denetlendi
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-400 text-[11px] ml-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Hazır
            </span>
          )}
        </div>
      </div>

      {/* 9-Stage Pipeline Status Bar */}
      <nav className="hidden xl:flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
        {pipelineStages.map((stage) => {
          const isActive = activeTab === stage.id;
          return (
            <button
              key={stage.id}
              onClick={() => setActiveTab(stage.id)}
              className={`px-2.5 py-1 rounded text-xs font-mono transition-all duration-150 flex items-center gap-1.5 ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/20 font-semibold'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }`}
            >
              <span className="text-[11px] opacity-75">{stage.step}</span>
              <span>{stage.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Action Controls */}
      <div className="flex items-center gap-2">
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
          className="btn-secondary hidden sm:inline-flex"
          title="DXF Dosyası Yükle"
        >
          <Upload className="w-3.5 h-3.5 text-gray-300" />
          <span>DXF Yükle</span>
        </button>

        <button
          onClick={() => imgInputRef.current?.click()}
          className="btn-secondary hidden md:inline-flex"
          title="Kat Planı Görseli Yükle (OpenCV Analizi)"
        >
          <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
          <span>Plan Görseli</span>
        </button>

        {onRunHighRiseAudit && (
          <button
            onClick={onRunHighRiseAudit}
            disabled={isLoading}
            className="px-2.5 py-1.5 rounded-lg border border-purple-500/40 bg-purple-950/30 text-purple-300 hover:bg-purple-900/40 hover:text-white text-xs font-mono transition-all flex items-center gap-1.5"
            title="12 Katlı Yüksek Bina Paftasını Otomatik Üretip Tüm Yönetmelik Maddelerini Her Katta Denetle"
          >
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>12 Katlı Bina</span>
          </button>
        )}

        <button
          onClick={onRunAudit}
          disabled={isLoading}
          className="btn-primary"
          title="Örnek 3 Katlı Projeyi Denetle"
        >
          <Play className={`w-3.5 h-3.5 fill-current ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'Denetleniyor...' : 'Canlı Denetle'}</span>
        </button>
      </div>
    </header>
  );
};
