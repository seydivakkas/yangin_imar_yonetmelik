import React from 'react';
import { Sparkles, CheckCircle2, TrendingUp, DollarSign, ArrowRight, Split, Download } from 'lucide-react';
import { DiagramYonetmelikPipelineOutput } from '../../types/pipeline';

interface OptimizationPanelProps {
  data: DiagramYonetmelikPipelineOutput | null;
  cadDiffMode: 'before' | 'after' | 'both';
  setCadDiffMode: (m: 'before' | 'after' | 'both') => void;
  onDownloadDXF: () => void;
}

export const OptimizationPanel: React.FC<OptimizationPanelProps> = ({
  data,
  cadDiffMode,
  setCadDiffMode,
  onDownloadDXF,
}) => {
  const opt = data?.counterfactual_optimization;
  const originalTime = opt?.original_evacuation_time_s || 76.5;
  const optimizedTime = opt?.optimized_evacuation_time_s || 58.0;
  const timeSaved = opt?.time_saved_s || 18.5;

  const interventions = opt?.applied_interventions || [
    {
      step_id: 'OPT-1',
      action_type: 'kapi_genislet',
      target_element_id: 'D_1_yangin_holu',
      parameter_name: 'width_m',
      delta_value: 0.30,
      estimated_cost_try: 4500,
      delta_evacuation_time_s: -11.2,
    },
    {
      step_id: 'OPT-2',
      action_type: 'kapi_genislet',
      target_element_id: 'D_0_yangin_holu',
      parameter_name: 'width_m',
      delta_value: 0.30,
      estimated_cost_try: 4500,
      delta_evacuation_time_s: -5.1,
    },
    {
      step_id: 'OPT-3',
      action_type: 'hava_kilidi_ekle',
      target_element_id: 'K-1_siginak_girisi',
      parameter_name: 'airlock_area_m2',
      delta_value: 2.2,
      estimated_cost_try: 5500,
      delta_evacuation_time_s: -2.2,
    },
  ];

  const totalCost = interventions.reduce((acc, cur) => acc + cur.estimated_cost_try, 0);

  return (
    <div className="space-y-4 p-4 text-xs font-sans text-gray-200 overflow-y-auto max-h-full">
      {/* Header Banner */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/40 via-teal-950/40 to-slate-900 border border-emerald-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <div>
              <h4 className="font-bold text-white text-xs">Karşı-Olgusal (Counterfactual) Tasarım Optimizasyonu</h4>
              <p className="text-[10px] text-gray-400">Geriye Yayılımlı Darboğaz Budama · Minimum Maliyetli Mimari Müdahaleler</p>
            </div>
          </div>
          <span className="badge badge-green text-[10px] font-mono">Otomatik Rollout</span>
        </div>
      </div>

      {/* Comparison Scorecard */}
      <div className="glass-panel p-3.5">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded bg-black/40">
            <div className="text-[10px] text-gray-400">Mevcut Süre</div>
            <div className="text-base font-bold font-mono text-red-400">{originalTime.toFixed(1)} sn</div>
            <div className="text-[9px] text-red-400/80">ASET Aşılıyor</div>
          </div>
          <div className="p-2 rounded bg-black/40">
            <div className="text-[10px] text-gray-400">Revize Süre</div>
            <div className="text-base font-bold font-mono text-emerald-400">{optimizedTime.toFixed(1)} sn</div>
            <div className="text-[9px] text-emerald-400/80">Güvenli Tahliye</div>
          </div>
          <div className="p-2 rounded bg-black/40">
            <div className="text-[10px] text-gray-400">Tasarruf</div>
            <div className="text-base font-bold font-mono text-cyan-400">-{timeSaved.toFixed(1)} sn</div>
            <div className="text-[9px] text-cyan-400/80">%{((timeSaved / originalTime) * 100).toFixed(0)} Hızlanma</div>
          </div>
        </div>
      </div>

      {/* CAD Diff Toggle Bar */}
      <div className="glass-panel p-2.5 flex items-center justify-between">
        <span className="text-[11px] text-gray-300 font-medium flex items-center gap-1.5">
          <Split className="w-4 h-4 text-cyan-400" /> 3B Görünüm Modu:
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCadDiffMode('before')}
            className={`px-2.5 py-1 rounded text-[11px] font-mono ${
              cadDiffMode === 'before' ? 'bg-red-500/25 text-red-300 border border-red-500/40 font-bold' : 'text-gray-400 bg-white/5'
            }`}
          >
            Önce (İhlal)
          </button>
          <button
            onClick={() => setCadDiffMode('after')}
            className={`px-2.5 py-1 rounded text-[11px] font-mono ${
              cadDiffMode === 'after' ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 font-bold' : 'text-gray-400 bg-white/5'
            }`}
          >
            Sonra (Opt.)
          </button>
          <button
            onClick={() => setCadDiffMode('both')}
            className={`px-2.5 py-1 rounded text-[11px] font-mono ${
              cadDiffMode === 'both' ? 'bg-purple-500/25 text-purple-300 border border-purple-500/40 font-bold' : 'text-gray-400 bg-white/5'
            }`}
          >
            İkisi
          </button>
        </div>
      </div>

      {/* Applied Interventions List */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h5 className="font-semibold text-gray-300 text-xs">Uygulanan Tasarım Müdahaleleri ({interventions.length})</h5>
          <span className="text-[11px] font-mono text-emerald-400">
            Toplam Maliyet: {totalCost.toLocaleString('tr-TR')} TL
          </span>
        </div>

        {interventions.map((step, idx) => (
          <div key={idx} className="p-3 rounded-lg bg-slate-900/50 border border-white/10 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="badge badge-cyan text-[9px] font-mono">{step.step_id}</span>
              <span className="font-mono text-emerald-400 text-xs font-semibold">
                {step.delta_evacuation_time_s.toFixed(1)} sn
              </span>
            </div>

            <div className="text-[11px] text-white font-medium">
              {step.action_type === 'kapi_genislet' ? (
                <span>Kapı Genişletme: <strong className="text-cyan-400">{step.target_element_id}</strong> (+{step.delta_value}m)</span>
              ) : (
                <span>Hava Kilidi Ekleme: <strong className="text-purple-400">{step.target_element_id}</strong> (+{step.delta_value}m²)</span>
              )}
            </div>

            <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1 border-t border-white/5">
              <span>Parametre: <code className="text-gray-300">{step.parameter_name}</code></span>
              <span>Tahmini Maliyet: <strong className="text-gray-200">{step.estimated_cost_try.toLocaleString('tr-TR')} TL</strong></span>
            </div>
          </div>
        ))}
      </div>

      {/* DXF Export Button */}
      <div className="pt-2">
        <button
          onClick={onDownloadDXF}
          className="w-full btn-primary justify-center text-xs py-2.5"
        >
          <Download className="w-4 h-4" />
          <span>Revize DXF Paftasını İndir (Yeşil Revcloud Katmanı)</span>
        </button>
      </div>
    </div>
  );
};
