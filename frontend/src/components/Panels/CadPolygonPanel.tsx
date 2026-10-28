import React from 'react';
import { Layers, Square, DoorOpen, Compass } from 'lucide-react';
import { DiagramYonetmelikPipelineOutput } from '../../types/pipeline';

interface CadPolygonPanelProps {
  data: DiagramYonetmelikPipelineOutput | null;
}

export const CadPolygonPanel: React.FC<CadPolygonPanelProps> = ({ data }) => {
  const rooms = [
    { id: 'K0_oda_1', name: 'Salon A', floor: 0, area: 30.0, category: 'oda' },
    { id: 'K0_oda_2', name: 'Oda B', floor: 0, area: 24.0, category: 'oda' },
    { id: 'K0_koridor', name: 'Kat Koridoru', floor: 0, area: 36.0, category: 'kat_koridoru' },
    { id: 'K0_yangin_holu', name: 'Yangın Güvenlik Holü', floor: 0, area: 16.0, category: 'yangin_holu' },
    { id: 'K0_merdiven', name: 'Yangın Merdiveni', floor: 0, area: 20.0, category: 'yangin_merdiveni' },
    { id: 'K0_dis_cikis', name: 'Ana Dış Çıkış', floor: 0, area: 16.0, category: 'dis_cikis' },
    { id: 'K-1_siginak', name: 'Sığınak Alanı', floor: -1, area: 20.0, category: 'siginak' },
    { id: 'K-1_otopark', name: 'Kapalı Otopark', floor: -1, area: 95.0, category: 'otopark' },
  ];

  return (
    <div className="space-y-4 text-[14px] leading-relaxed text-[var(--ui-text)] w-full">
      {/* Banner */}
      <div className="p-4 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-lg bg-[var(--ui-primary)]/15 border border-[var(--ui-primary)]/30 flex items-center justify-center text-[var(--ui-primary)] shrink-0">
          <Layers className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-bold text-[var(--ui-text)] text-[16px]">CAD Çizim & Mekan Poligonlaşması</h4>
          <p className="text-[13px] text-[var(--ui-text-muted)] mt-0.5">
            Kapı Köprüleme · Morfolojik Aşındırma · Türkçe Etiket Sınıflandırma
          </p>
        </div>
      </div>

      {/* Summary Chips */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="card p-3">
          <div className="text-[12px] text-[var(--ui-text-muted)] font-medium">Toplam Mekan</div>
          <div className="text-xl font-bold font-mono text-[var(--ui-text)] mt-1">{data?.rooms_analyzed || 28}</div>
        </div>
        <div className="card p-3">
          <div className="text-[12px] text-[var(--ui-text-muted)] font-medium">Kapı / Geçit</div>
          <div className="text-xl font-bold font-mono text-[var(--ui-text)] mt-1">{data?.doors_analyzed || 26}</div>
        </div>
        <div className="card p-3">
          <div className="text-[12px] text-[var(--ui-text-muted)] font-medium">Kat Sayısı</div>
          <div className="text-xl font-bold font-mono text-[var(--ui-text)] mt-1">{data?.floors_analyzed?.length || 3}</div>
        </div>
      </div>

      {/* Rooms Table */}
      <div className="card p-4 space-y-3">
        <h5 className="font-bold text-[var(--ui-text)] text-[15px] flex items-center gap-2 border-b border-[var(--ui-border)] pb-2">
          <Square className="w-4 h-4 text-[var(--ui-primary)]" /> Çıkarılan Mekan Poligonları
        </h5>

        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {rooms.map((r) => (
            <div key={r.id} className="p-3 rounded-md bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] flex items-center justify-between gap-2">
              <div>
                <span className="font-mono text-[var(--ui-text)] text-[14px] font-bold">{r.id}</span>
                <span className="text-[13px] text-[var(--ui-text-muted)] ml-2">({r.name})</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="badge badge-neutral text-[12px] font-mono">Kat {r.floor}</span>
                <span className="font-mono text-[var(--ui-text)] text-[13px] font-semibold">{r.area} m²</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

