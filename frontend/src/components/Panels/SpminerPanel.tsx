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
    <div className="space-y-4 text-[14px] leading-relaxed text-[var(--ui-text)] w-full">
      {/* Banner */}
      <div className="p-4 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-lg bg-[var(--ui-primary)]/15 border border-[var(--ui-primary)]/30 flex items-center justify-center text-[var(--ui-primary)] shrink-0">
          <Boxes className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-bold text-[var(--ui-text)] text-[16px]">SPMiner Modül Keşfi & Graf İriliştirme</h4>
          <p className="text-[13px] text-[var(--ui-text-muted)] mt-0.5">
            Açgözlü Büyüme · WL-Hash Tekilleştirme · İç Kaçış Derinliği Korunumu
          </p>
        </div>
      </div>

      {/* Discovered Architectural Macro-Nodes */}
      <div className="card p-4 space-y-3">
        <h5 className="font-bold text-[var(--ui-text)] text-[15px] flex items-center gap-2 border-b border-[var(--ui-border)] pb-2">
          <Box className="w-4 h-4 text-[var(--ui-primary)]" /> Keşfedilen Mimari Makro-Düğümler (Bileşen Kümeleri)
        </h5>

        <div className="space-y-2.5">
          {macroNodes.map((m) => (
            <div key={m.macro_id} className="p-3.5 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[var(--ui-primary)] font-bold text-[14px]">{m.macro_id}</span>
                <span className="badge badge-neutral text-[12px] font-mono">Kat {m.floor_level}</span>
              </div>
              <div className="text-[13px] text-[var(--ui-text-muted)]">
                Oda Üyeleri: <span className="text-[var(--ui-text)] font-mono">{m.member_rooms.join(', ')}</span>
              </div>
              <div className="flex items-center justify-between text-[13px] pt-1.5 border-t border-[var(--ui-border)]">
                <span>
                  İç Kaçış Derinliği:{' '}
                  <strong className={m.internal_exit_depth_m > 15 ? 'text-[var(--ui-danger)]' : 'text-[var(--ui-success)]'}>
                    {m.internal_exit_depth_m}m
                  </strong>
                </span>
                <span>
                  Sınır Kapısı: <code className="text-[var(--ui-text)] font-mono">{m.boundary_portals.join(', ')}</code>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

