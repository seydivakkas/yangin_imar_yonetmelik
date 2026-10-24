import React from 'react';
import { Boxes, Box, Compass, Hash } from 'lucide-react';
import { DiagramYonetmelikPipelineOutput } from '../../types/pipeline';

interface SpminerPanelProps {
  data: DiagramYonetmelikPipelineOutput | null;
}

export const SpminerPanel: React.FC<SpminerPanelProps> = ({ data }) => {
  const macroNodes = data?.spminer_macro_nodes || [
    {
      macro_id: 'MACRO_K1_DAIRE_A',
      floor_level: 1,
      member_rooms: ['K1_oda_1', 'K1_oda_2'],
      internal_exit_depth_m: 18.4,
      boundary_portals: ['D_1_1'],
    },
    {
      macro_id: 'MACRO_K1_DAIRE_B',
      floor_level: 1,
      member_rooms: ['K1_oda_3', 'K1_oda_4'],
      internal_exit_depth_m: 14.2,
      boundary_portals: ['D_1_2'],
    },
    {
      macro_id: 'MACRO_K0_DAIRE_A',
      floor_level: 0,
      member_rooms: ['K0_oda_1', 'K0_oda_2'],
      internal_exit_depth_m: 16.5,
      boundary_portals: ['D_0_1'],
    },
  ];

  return (
    <div className="space-y-4 p-4 text-xs font-sans text-gray-200 overflow-y-auto max-h-full">
      {/* Banner */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-950/40 via-purple-950/40 to-slate-900 border border-indigo-500/30">
        <div className="flex items-center gap-2.5">
          <Boxes className="w-5 h-5 text-indigo-400" />
          <div>
            <h4 className="font-bold text-white text-xs">Aşama 3: SPMiner Modül Keşfi & Graf İriliştirme</h4>
            <p className="text-[10px] text-gray-400">Açgözlü Büyüme · WL-Hash Tekilleştirme · İç Kaçış Derinliği Korunumu</p>
          </div>
        </div>
      </div>

      {/* Discovered Architectural Macro-Nodes */}
      <div className="glass-panel p-3.5 space-y-2.5">
        <h5 className="font-semibold text-gray-300 text-xs flex items-center gap-1.5">
          <Box className="w-3.5 h-3.5 text-indigo-400" /> Keşfedilen Mimari Makro-Düğümler (Bileşen Kümeleri)
        </h5>

        <div className="space-y-2">
          {macroNodes.map((m) => (
            <div key={m.macro_id} className="p-2.5 rounded bg-slate-900/50 border border-white/5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-cyan-300 font-bold text-[11px]">{m.macro_id}</span>
                <span className="badge badge-purple text-[9px]">Kat {m.floor_level}</span>
              </div>
              <div className="text-[10px] text-gray-400">
                Oda Üyeleri: <span className="text-gray-200 font-mono">{m.member_rooms.join(', ')}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] pt-1 border-t border-white/5">
                <span>İç Kaçış Derinliği: <strong className={m.internal_exit_depth_m > 15 ? 'text-red-400' : 'text-emerald-400'}>{m.internal_exit_depth_m}m</strong></span>
                <span>Sınır Kapısı: <code className="text-gray-300">{m.boundary_portals.join(', ')}</code></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
