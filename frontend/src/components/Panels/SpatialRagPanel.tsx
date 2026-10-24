import React from 'react';
import { Network, ArrowUpDown, ShieldCheck, Compass, GitCommit } from 'lucide-react';
import { DiagramYonetmelikPipelineOutput } from '../../types/pipeline';

interface SpatialRagPanelProps {
  data: DiagramYonetmelikPipelineOutput | null;
}

export const SpatialRagPanel: React.FC<SpatialRagPanelProps> = ({ data }) => {
  const summary = data?.graph_3d_summary || {
    node_count: 32,
    edge_count: 48,
    floors: [-1, 0, 1],
    vertical_shafts: 2,
    fire_elevators_excluded: true,
  };

  return (
    <div className="space-y-4 p-4 text-xs font-sans text-gray-200 overflow-y-auto max-h-full">
      {/* Banner */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/40 via-blue-950/40 to-slate-900 border border-cyan-500/30">
        <div className="flex items-center gap-2.5">
          <Network className="w-5 h-5 text-cyan-400" />
          <div>
            <h4 className="font-bold text-white text-xs">Aşama 2: Çok Katlı 3B Mekansal Graf (3B RAG)</h4>
            <p className="text-[10px] text-gray-400">Dikey Çekirdek Bağlantıları · Merdiven Yürüme Faktörü (2.2x) · Yangın Asansörü İzolasyonu</p>
          </div>
        </div>
      </div>

      {/* Graph Metrics */}
      <div className="grid grid-cols-2 gap-2">
        <div className="glass-panel p-3">
          <div className="text-[10px] text-gray-400">Graf Düğümleri (Oda & Hol)</div>
          <div className="text-base font-bold font-mono text-cyan-400">{summary.node_count} Düğüm</div>
          <div className="text-[10px] text-gray-400 mt-1">3 Kat · 1 Dış Çıkış</div>
        </div>

        <div className="glass-panel p-3">
          <div className="text-[10px] text-gray-400">Graf Kenarları (Kapı & Şaft)</div>
          <div className="text-base font-bold font-mono text-cyan-400">{summary.edge_count} Kenar</div>
          <div className="text-[10px] text-gray-400 mt-1">42 Yatay · 6 Dikey Geçiş</div>
        </div>
      </div>

      {/* Special Engine Features */}
      <div className="glass-panel p-3.5 space-y-2.5">
        <h5 className="font-semibold text-gray-300 text-xs">3B RAG Mekansal Hesaplama Kuralları</h5>

        <div className="space-y-2">
          <div className="p-2.5 rounded bg-black/40 border border-white/5 space-y-1">
            <div className="flex items-center gap-2 text-cyan-300 font-semibold text-[11px]">
              <ArrowUpDown className="w-4 h-4 text-cyan-400" />
              <span>Merdiven Yürüme Direnci Faktörü (2.2x)</span>
            </div>
            <p className="text-[10px] text-gray-400 leading-normal">
              Düşey kaçışta merdiven basamakları düz koridor yürüyüşüne göre 2.2 kat daha fazla efor ve süre gerektirir (SFPE standardı).
            </p>
          </div>

          <div className="p-2.5 rounded bg-black/40 border border-white/5 space-y-1">
            <div className="flex items-center gap-2 text-emerald-300 font-semibold text-[11px]">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Yangın Asansörünün Kaçıştan Hariç Tutulması</span>
            </div>
            <p className="text-[10px] text-gray-400 leading-normal">
              BYKHY Madde 62 uyarınca, normal veya yangın asansörleri kaçış yolu hesabına dahil edilmez; grafa yalnızca itfaiyeci erişim düğümü olarak eklenir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
