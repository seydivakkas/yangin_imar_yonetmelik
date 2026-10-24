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
    <div className="space-y-4 p-4 text-xs font-sans text-gray-200 overflow-y-auto max-h-full">
      {/* Banner */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-950/40 via-cyan-950/40 to-slate-900 border border-blue-500/30">
        <div className="flex items-center gap-2.5">
          <Layers className="w-5 h-5 text-blue-400" />
          <div>
            <h4 className="font-bold text-white text-xs">Aşama 1: DXF Çizgi Çorbası & Poligonlaşma</h4>
            <p className="text-[10px] text-gray-400">Kapı Köprüleme · Morfolojik Aşındırma · Türkçe Etiket Sınıflandırma</p>
          </div>
        </div>
      </div>

      {/* Summary Chips */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="glass-panel p-2">
          <div className="text-[10px] text-gray-400">Toplam Mekan</div>
          <div className="text-sm font-bold font-mono text-cyan-400">{data?.rooms_analyzed || 28}</div>
        </div>
        <div className="glass-panel p-2">
          <div className="text-[10px] text-gray-400">Kapı / Geçit</div>
          <div className="text-sm font-bold font-mono text-cyan-400">{data?.doors_analyzed || 26}</div>
        </div>
        <div className="glass-panel p-2">
          <div className="text-[10px] text-gray-400">Kat Sayısı</div>
          <div className="text-sm font-bold font-mono text-cyan-400">{data?.floors_analyzed?.length || 3}</div>
        </div>
      </div>

      {/* Rooms Table */}
      <div className="glass-panel p-3 space-y-2">
        <h5 className="font-semibold text-gray-300 text-xs flex items-center gap-1.5">
          <Square className="w-3.5 h-3.5 text-cyan-400" /> Çıkarılan Mekan Poligonları
        </h5>

        <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
          {rooms.map((r) => (
            <div key={r.id} className="p-2 rounded bg-slate-900/40 border border-white/5 flex items-center justify-between">
              <div>
                <span className="font-mono text-white text-[11px] font-semibold">{r.id}</span>
                <span className="text-[10px] text-gray-400 ml-2">({r.name})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-cyan text-[9px]">Kat {r.floor}</span>
                <span className="font-mono text-gray-300 text-[11px]">{r.area} m²</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
