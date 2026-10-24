import React from 'react';
import { Flame, ShieldAlert, Cpu, Sparkles, CheckCircle2, ChevronRight } from 'lucide-react';
import { DiagramYonetmelikPipelineOutput } from '../../types/pipeline';

interface FireAuditPanelProps {
  data: DiagramYonetmelikPipelineOutput | null;
  onSelectViolation: (v: any) => void;
}

export const FireAuditPanel: React.FC<FireAuditPanelProps> = ({
  data,
  onSelectViolation,
}) => {
  const diagnostics = data?.vf2_diagnostics || [
    {
      query_name: 'yangin_guvenlik_holu_standarti',
      is_compliant: false,
      violation_energy: 1.84,
      candidate_subgraph_nodes: ['K1_yangin_holu', 'D_1_yangin_holu'],
      monomorphism_relaxation_stage: 1,
      root_cause_category: 'parametrik_kapi_genisligi_yetersiz',
      violated_constraints: ['door_width_min_1.20m', 'swing_direction_egress'],
    },
    {
      query_name: 'cikis_mesafesi_tek_yon_maks_15m',
      is_compliant: false,
      violation_energy: 1.42,
      candidate_subgraph_nodes: ['K1_oda_2', 'K1_koridor'],
      monomorphism_relaxation_stage: 1,
      root_cause_category: 'mesafe_siniri_asimi',
      violated_constraints: ['corridor_dead_end_max_15m (olculen: 18.4m)'],
    },
    {
      query_name: 'yangin_merdiveni_kesintisiz_cikis',
      is_compliant: true,
      violation_energy: 0.05,
      candidate_subgraph_nodes: ['K0_merdiven', 'K0_dis_cikis'],
      monomorphism_relaxation_stage: 0,
      root_cause_category: 'none',
      violated_constraints: [],
    },
  ];

  return (
    <div className="space-y-4 p-4 text-xs font-sans text-gray-200 overflow-y-auto max-h-full">
      {/* Header Engine Banner */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/40 via-blue-950/40 to-slate-900 border border-cyan-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <div>
              <h4 className="font-bold text-white text-xs">GNN Order Embedding + Açıklanabilir VF2 Teşhisi</h4>
              <p className="text-[10px] text-gray-400">1-WL RWPE Konumsal Kodlama · 3 Aşamalı Gevşetme Hunisi</p>
            </div>
          </div>
          <span className="badge badge-cyan text-[10px] font-mono">Stage 1: Parametrik</span>
        </div>
      </div>

      {/* 3-Stage Relaxation Funnel Legend */}
      <div className="glass-panel p-3">
        <h5 className="font-semibold text-gray-300 text-[11px] mb-2">VF2 Monomorfizm Gevşetme Aşamaları</h5>
        <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
          <div className="p-1.5 rounded bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 font-mono">
            Aşama 1<br /><span className="text-[9px] text-gray-400">Parametrik Boyut</span>
          </div>
          <div className="p-1.5 rounded bg-amber-950/30 border border-amber-500/20 text-amber-300 font-mono">
            Aşama 2<br /><span className="text-[9px] text-gray-400">Mekan Rol Uyuşmazlığı</span>
          </div>
          <div className="p-1.5 rounded bg-red-950/30 border border-red-500/20 text-red-300 font-mono">
            Aşama 3<br /><span className="text-[9px] text-gray-400">Topolojik Eksik Düğüm</span>
          </div>
        </div>
      </div>

      {/* Query Diagnostics List */}
      <div className="space-y-2.5">
        <h5 className="font-semibold text-gray-300 text-xs">Mevzuat Sorgu Teşhisleri ({diagnostics.length})</h5>

        {diagnostics.map((diag, idx) => (
          <div
            key={idx}
            onClick={() => onSelectViolation(diag)}
            className={`p-3 rounded-lg border transition-all cursor-pointer ${
              !diag.is_compliant
                ? 'bg-red-950/25 border-red-500/30 hover:border-red-400 hover:bg-red-950/40'
                : 'bg-slate-900/40 border-white/10 hover:border-emerald-500/30'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                {!diag.is_compliant ? (
                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                <div>
                  <h6 className="font-semibold text-white text-xs font-mono">{diag.query_name}</h6>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Alt-graf: {diag.candidate_subgraph_nodes.join(' → ')}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className={`badge ${!diag.is_compliant ? 'badge-red' : 'badge-green'} text-[9px]`}>
                  E_viol: {diag.violation_energy.toFixed(2)}
                </span>
              </div>
            </div>

            {!diag.is_compliant && (
              <div className="mt-2.5 pt-2 border-t border-white/5 space-y-1">
                <div className="text-[11px] text-red-300 font-medium">
                  Kök Neden: <span className="font-mono text-white">{diag.root_cause_category}</span>
                </div>
                <div className="text-[10px] text-gray-400">
                  İhlal Edilen Kısıtlar:
                  <ul className="list-disc list-inside mt-0.5 space-y-0.5 text-gray-300">
                    {diag.violated_constraints.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
                <div className="text-[10px] text-cyan-400 mt-1 flex items-center gap-1 font-mono">
                  <span>Hukuki Dayanak: BYKHY Madde 31, 33, 52</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
