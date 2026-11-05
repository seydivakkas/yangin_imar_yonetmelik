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
  const opt: any = data?.optimization || data?.counterfactual_optimization;
  if (!opt) {
    return (
      <div className="p-4 rounded-lg border border-[var(--ui-border)] text-[14px] text-[var(--ui-text-muted)]">
        Optimizasyon sonucu için önce bir pafta denetleyin.
      </div>
    );
  }
  const originalTime: number = opt.baseline_time_sec ?? opt.original_evacuation_time_s ?? 0;
  const optimizedTime: number = opt.optimized_time_sec ?? opt.optimized_evacuation_time_s ?? originalTime;
  const timeSaved: number = opt.savings_sec ?? opt.time_saved_s ?? Math.max(0, originalTime - optimizedTime);
  const interventions: any[] = opt.steps || opt.applied_interventions || [];
  const totalCost: number = opt.remodeling_cost ?? interventions.reduce((acc: number, cur: any) => acc + (cur.cost ?? 0), 0);
  const prunedSteps: number = opt.pruned_redundant_steps ?? 0;

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
              Açgözlü Darboğaz İyileştirme · Geriye Dönük Fazlalık Budaması
            </p>
          </div>
        </div>
        <span className="badge badge-neutral text-[12px] font-mono shrink-0">{prunedSteps} adım budandı</span>
      </div>

      {/* Comparison Scorecard */}
      <div className="card p-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-md bg-[var(--ui-surface-raised)] border border-[var(--ui-border)]">
            <div className="text-[12px] text-[var(--ui-text-muted)] font-medium">Mevcut Süre</div>
            <div className="text-xl font-bold font-mono text-[var(--ui-danger)] mt-1">{originalTime.toFixed(1)} sn</div>
            <div className="text-[12px] text-[var(--ui-text-muted)] mt-0.5 font-medium">Simülasyon</div>
          </div>
          <div className="p-3 rounded-md bg-[var(--ui-surface-raised)] border border-[var(--ui-border)]">
            <div className="text-[12px] text-[var(--ui-text-muted)] font-medium">Revize Süre</div>
            <div className="text-xl font-bold font-mono text-[var(--ui-success)] mt-1">{optimizedTime.toFixed(1)} sn</div>
            <div className="text-[12px] text-[var(--ui-text-muted)] mt-0.5 font-medium">Tadilat Sonrası</div>
          </div>
          <div className="p-3 rounded-md bg-[var(--ui-surface-raised)] border border-[var(--ui-border)]">
            <div className="text-[12px] text-[var(--ui-text-muted)] font-medium">Tasarruf</div>
            <div className="text-xl font-bold font-mono text-[var(--ui-primary)] mt-1">-{timeSaved.toFixed(1)} sn</div>
            <div className="text-[12px] text-[var(--ui-primary)] mt-0.5 font-medium">
              %{originalTime > 0 ? ((timeSaved / originalTime) * 100).toFixed(0) : 0} İyileşme
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
            Maliyet Endeksi: {totalCost.toLocaleString('tr-TR')}
          </span>
        </div>

        {interventions.length === 0 && (
          <div className="p-3.5 rounded-lg border border-[var(--ui-border)] text-[13px] text-[var(--ui-text-muted)]">
            Bu pafta için hesaplanmış tadilat adımı yok. Çıkışa bağlı olmayan odalar varsa kapı genişletmek sorunu çözmez.
          </div>
        )}
        {interventions.map((step: any, idx: number) => {
          const delta: number | null = step.delta_evacuation_time_s ?? null;
          return (
            <div key={idx} className="p-3.5 rounded-lg bg-[var(--ui-surface)] border border-[var(--ui-border)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="badge badge-primary text-[12px] font-mono">OPT-{step.step_id ?? idx + 1}</span>
                <span className="font-mono text-[var(--ui-success)] text-[14px] font-bold">
                  {delta !== null ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)} sn` : '—'}
                </span>
              </div>

              <div className="text-[14px] text-[var(--ui-text)] font-semibold">
                {step.description}
              </div>

              <div className="flex items-center justify-between text-[13px] text-[var(--ui-text-muted)] pt-2 border-t border-[var(--ui-border)]">
                <span>İşlem: <code className="text-[var(--ui-text)] font-mono">{step.action_type}</code></span>
                <span>Maliyet Endeksi: <strong className="text-[var(--ui-text)]">{(step.cost ?? 0).toLocaleString('tr-TR')}</strong></span>
              </div>
            </div>
          );
        })}
      </div>

      {/* DXF Export Button */}
      <div className="pt-2 space-y-2">
        <a
          href="/api/download/annotated-pdf"
          download="REVİZE_MIMARI_VE_TAHLIYE_PAFTASI.pdf"
          className="w-full btn btn-primary justify-center text-[14px] py-3 flex items-center gap-2 text-white no-underline font-semibold bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-md shadow-rose-900/30"
        >
          <Download className="w-4 h-4 text-white" />
          <span>Vektörel PDF Paftası İndir (1:100 Baskı & İnceleme)</span>
        </a>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <button
            onClick={onDownloadDXF}
            className="w-full btn btn-secondary justify-center text-[13px] py-2 flex items-center gap-2"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>Revize DXF Paftası (Revcloud)</span>
          </button>

          <a
            href="/api/download/compliant-8-story-dxf"
            download="8_KATLI_KUSURSUZ_YONETMELIK_UYGUN_MIMARI_PAFTA.dxf"
            className="w-full btn btn-secondary justify-center text-[13px] py-2 flex items-center gap-2 text-emerald-400 no-underline font-semibold border border-emerald-500/30"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>8 Katlı Örnek DXF</span>
          </a>
        </div>
      </div>
    </div>
  );
};

