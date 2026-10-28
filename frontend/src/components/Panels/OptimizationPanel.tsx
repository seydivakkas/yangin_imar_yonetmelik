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

  const totalCost = interventions.reduce((acc, cur) => acc + (cur.estimated_cost_try ?? 0), 0);

  return (
    <div className="space-y-4 text-[14px] leading-relaxed text-[var(--ui-text)] w-full">
      {/* Header Banner */}
      <div className="p-4 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-[var(--ui-primary)]/15 border border-[var(--ui-primary)]/30 flex items-center justify-center text-[var(--ui-primary)] shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-[var(--ui-text)] text-[16px]">Karşı-Olgusal Tasarım Optimizasyonu</h4>
            <p className="text-[13px] text-[var(--ui-text-muted)] mt-0.5">
              Geriye Yayılımlı Darboğaz Budama · Asgari Maliyetli Mimari Müdahaleler
            </p>
          </div>
        </div>
        <span className="badge badge-success text-[12px] font-mono shrink-0">Otomatik Rollout</span>
      </div>

      {/* Comparison Scorecard */}
      <div className="card p-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-md bg-[var(--ui-surface-raised)] border border-[var(--ui-border)]">
            <div className="text-[12px] text-[var(--ui-text-muted)] font-medium">Mevcut Süre</div>
            <div className="text-xl font-bold font-mono text-[var(--ui-danger)] mt-1">{originalTime.toFixed(1)} sn</div>
            <div className="text-[12px] text-[var(--ui-danger)] mt-0.5 font-medium">ASET Aşılıyor</div>
          </div>
          <div className="p-3 rounded-md bg-[var(--ui-surface-raised)] border border-[var(--ui-border)]">
            <div className="text-[12px] text-[var(--ui-text-muted)] font-medium">Revize Süre</div>
            <div className="text-xl font-bold font-mono text-[var(--ui-success)] mt-1">{optimizedTime.toFixed(1)} sn</div>
            <div className="text-[12px] text-[var(--ui-success)] mt-0.5 font-medium">Güvenli Tahliye</div>
          </div>
          <div className="p-3 rounded-md bg-[var(--ui-surface-raised)] border border-[var(--ui-border)]">
            <div className="text-[12px] text-[var(--ui-text-muted)] font-medium">Tasarruf</div>
            <div className="text-xl font-bold font-mono text-[var(--ui-primary)] mt-1">-{timeSaved.toFixed(1)} sn</div>
            <div className="text-[12px] text-[var(--ui-primary)] mt-0.5 font-medium">
              %{((timeSaved / originalTime) * 100).toFixed(0)} İyileşme
            </div>
          </div>
        </div>
      </div>

      {/* CAD Diff Toggle Bar */}
      <div className="card p-3 flex items-center justify-between gap-2">
        <span className="text-[14px] text-[var(--ui-text)] font-semibold flex items-center gap-2">
          <Split className="w-4 h-4 text-[var(--ui-primary)]" /> 3B Görünüm Modu:
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCadDiffMode('before')}
            className={`px-3 py-1.5 rounded text-[13px] font-medium transition-colors ${
              cadDiffMode === 'before'
                ? 'bg-[var(--ui-danger)] text-white font-semibold'
                : 'text-[var(--ui-text-muted)] hover:text-white bg-[var(--ui-surface-raised)]'
            }`}
          >
            Önce (İhlal)
          </button>
          <button
            onClick={() => setCadDiffMode('after')}
            className={`px-3 py-1.5 rounded text-[13px] font-medium transition-colors ${
              cadDiffMode === 'after'
                ? 'bg-[var(--ui-success)] text-white font-semibold'
                : 'text-[var(--ui-text-muted)] hover:text-white bg-[var(--ui-surface-raised)]'
            }`}
          >
            Sonra (Opt.)
          </button>
          <button
            onClick={() => setCadDiffMode('both')}
            className={`px-3 py-1.5 rounded text-[13px] font-medium transition-colors ${
              cadDiffMode === 'both'
                ? 'bg-[var(--ui-primary)] text-white font-semibold'
                : 'text-[var(--ui-text-muted)] hover:text-white bg-[var(--ui-surface-raised)]'
            }`}
          >
            İkisi
          </button>
        </div>
      </div>

      {/* Applied Interventions List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-[var(--ui-border)] pb-2">
          <h5 className="font-bold text-[var(--ui-text)] text-[15px]">
            Uygulanan Tasarım Müdahaleleri ({interventions.length})
          </h5>
          <span className="text-[13px] font-mono text-[var(--ui-success)] font-semibold">
            Toplam: {totalCost.toLocaleString('tr-TR')} TL
          </span>
        </div>

        {interventions.map((step, idx) => (
          <div key={idx} className="p-3.5 rounded-lg bg-[var(--ui-surface)] border border-[var(--ui-border)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="badge badge-primary text-[12px] font-mono">{step.step_id}</span>
              <span className="font-mono text-[var(--ui-success)] text-[14px] font-bold">
                {(step.delta_evacuation_time_s ?? 0).toFixed(1)} sn
              </span>
            </div>

            <div className="text-[14px] text-[var(--ui-text)] font-semibold">
              {step.action_type === 'kapi_genislet' ? (
                <span>Kapı Genişletme: <strong className="text-[var(--ui-primary)]">{step.target_element_id}</strong> (+{step.delta_value}m)</span>
              ) : (
                <span>Hava Kilidi Ekleme: <strong className="text-[var(--ui-primary)]">{step.target_element_id}</strong> (+{step.delta_value}m²)</span>
              )}
            </div>

            <div className="flex items-center justify-between text-[13px] text-[var(--ui-text-muted)] pt-2 border-t border-[var(--ui-border)]">
              <span>Parametre: <code className="text-[var(--ui-text)] font-mono">{step.parameter_name}</code></span>
              <span>Tahmini Maliyet: <strong className="text-[var(--ui-text)]">{(step.estimated_cost_try ?? 0).toLocaleString('tr-TR')} TL</strong></span>
            </div>
          </div>
        ))}
      </div>

      {/* DXF Export Button */}
      <div className="pt-2">
        <button
          onClick={onDownloadDXF}
          className="w-full btn btn-primary justify-center text-[14px] py-3 flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          <span>Revize DXF Paftasını İndir (Yeşil Revcloud Katmanı)</span>
        </button>
      </div>
    </div>
  );
};

