import React from 'react';
import { ShieldAlert, CheckCircle2, TrendingUp, Clock, AlertTriangle, ArrowRight, Layers, FileText, Check } from 'lucide-react';
import { DiagramYonetmelikPipelineOutput, ActiveTab } from '../../types/pipeline';

interface OverviewPanelProps {
  data: DiagramYonetmelikPipelineOutput | null;
  setActiveTab: (tab: ActiveTab) => void;
  onApplyOptimization: () => void;
}

export const OverviewPanel: React.FC<OverviewPanelProps> = ({
  data,
  setActiveTab,
  onApplyOptimization,
}) => {
  const evac: any = data?.evacuation || data?.evacuation_report;
  const opt: any = data?.optimization || data?.counterfactual_optimization;
  const violationsCount = data?.violations?.length ?? ((data?.basement_compliance?.length || 0) + (data?.vf2_diagnostics?.filter(v => !v.is_compliant)?.length || 0));
  const totalOccupants: number | null = evac?.total_occupants ?? null;
  const originalTime: number | null = evac?.baseline_time_sec ?? evac?.total_evacuation_time_s ?? null;
  const optimizedTime: number | null = opt?.optimized_time_sec ?? opt?.optimized_evacuation_time_s ?? null;
  const timeSaved = originalTime !== null && optimizedTime !== null ? originalTime - optimizedTime : null;
  const asetMargin: number | null = evac?.safety_margin_s ?? null;
  const evacOk = evac?.is_compliant === true;
  const hasProblem = !!data && (violationsCount > 0 || !evacOk);
  const totalArea = data?.program?.residential_area_m2 ?? data?.building_program?.total_area_m2 ?? null;
  const floorCount = data?.metadata?.total_floors ?? data?.building_program?.floor_count ?? null;
  const totalRooms = data?.metadata?.total_rooms ?? data?.rooms_analyzed ?? null;
  const totalDoors = data?.metadata?.total_doors ?? data?.doors_analyzed ?? null;
  const stepCount: number = (opt?.steps || opt?.applied_interventions || []).length;
  const headline = !data
    ? 'Henüz denetlenmiş pafta yok'
    : violationsCount > 0
    ? `${violationsCount} Mevzuat İhlali Kaydedildi`
    : evacOk
    ? 'Uygulanan denetimlerde ihlal kaydedilmedi'
    : 'Kural ihlali yok, tahliye denetimi geçmedi';

  return (
    <div className="flex flex-col gap-3.5 text-[14px] leading-relaxed text-[var(--ui-text)] w-full">
      {/* Hero Compliance Status Card */}
      <div
        className={`p-3.5 rounded-lg border transition-all ${
          hasProblem
            ? 'bg-[#2A1D22] border-[var(--ui-danger)]/50'
            : 'bg-[#182924] border-[var(--ui-success)]/50'
        }`}
      >
        <div className="flex items-start justify-between gap-3.5">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                hasProblem
                  ? 'bg-[var(--ui-danger)]/15 text-[var(--ui-danger)] border border-[var(--ui-danger)]/30'
                  : 'bg-[var(--ui-success)]/15 text-[var(--ui-success)] border border-[var(--ui-success)]/30'
              }`}
            >
              {hasProblem ? <ShieldAlert className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-[var(--ui-text)] leading-[1.45]">{headline}</h3>
              <p className="text-[13px] text-[var(--ui-text-muted)] mt-0.5 leading-[1.45]">
                Ön denetim özeti. Yalnızca uygulanan kuralları kapsar; mesleki onayın yerini tutmaz.
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold font-mono text-[var(--ui-primary)]">
              {data ? violationsCount : '—'}
            </div>
            <div className="text-[12px] text-[var(--ui-text-muted)] uppercase tracking-wide font-medium mt-0.5">
              Kayıtlı İhlal
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid (2x2, gap: 10px, padding: 12px 14px) */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* RSET */}
        <div className="card p-[12px_14px] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[var(--ui-text-muted)] text-[13px] mb-1.5">
              <span className="font-medium">RSET (Tahliye Süresi)</span>
              <Clock className="w-4 h-4 text-[var(--ui-primary)]" />
            </div>
            <div className="text-xl font-bold font-mono text-[var(--ui-text)] flex items-baseline gap-2">
              <span>{originalTime !== null ? `${originalTime.toFixed(1)} sn` : '—'}</span>
            </div>
          </div>
          {asetMargin === null ? (
            <p className="text-[12px] text-[var(--ui-text-muted)] mt-2 leading-[1.45]">ASET karşılaştırması için veri yok</p>
          ) : asetMargin >= 0 ? (
            <p className="text-[12px] text-[var(--ui-success)] mt-2 flex items-center gap-1.5 leading-[1.45]">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>En dar bölgede +{asetMargin.toFixed(1)} sn ASET payı</span>
            </p>
          ) : (
            <p className="text-[12px] text-[var(--ui-danger)] mt-2 flex items-center gap-1.5 leading-[1.45]">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>En dar bölgede {Math.abs(asetMargin).toFixed(1)} sn ASET açığı</span>
            </p>
          )}
        </div>

        {/* Optimizasyon */}
        <div className="card p-[12px_14px] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[var(--ui-text-muted)] text-[13px] mb-1.5">
              <span className="font-medium">Optimizasyon Kazancı</span>
              <TrendingUp className="w-4 h-4 text-[var(--ui-success)]" />
            </div>
            <div className="text-xl font-bold font-mono text-[var(--ui-success)] flex items-baseline gap-1.5">
              <span>{timeSaved !== null ? `-${timeSaved.toFixed(1)} sn` : '—'}</span>
              {optimizedTime !== null && (
                <span className="text-[13px] text-[var(--ui-text-muted)] font-sans font-normal">
                  ({optimizedTime.toFixed(1)}s)
                </span>
              )}
            </div>
          </div>
          <p className="text-[12px] text-[var(--ui-text-muted)] mt-2 leading-[1.45]">
            {stepCount > 0 ? `${stepCount} tadilat adımıyla hesaplandı` : 'Hesaplanmış tadilat adımı yok'}
          </p>
        </div>

        {/* Bina Alanı */}
        <div className="card p-[12px_14px] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[var(--ui-text-muted)] text-[13px] mb-1.5">
              <span className="font-medium">Toplam Yapı Alanı</span>
              <Layers className="w-4 h-4 text-[var(--ui-primary)]" />
            </div>
            <div className="text-xl font-bold font-mono text-[var(--ui-text)]">
              {totalArea !== null ? `${totalArea} m²` : '—'}
            </div>
          </div>
          <p className="text-[12px] text-[var(--ui-text-muted)] mt-2 leading-[1.45]">
            {floorCount ?? '—'} Kat · {totalRooms ?? '—'} Mekan · {totalDoors ?? '—'} Kapı
          </p>
        </div>

        {/* Kullanıcı Yükü */}
        <div className="card p-[12px_14px] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[var(--ui-text-muted)] text-[13px] mb-1.5">
              <span className="font-medium">Simülasyon Kullanıcı Yükü</span>
              <span className="badge badge-neutral text-[11px]">Toplam</span>
            </div>
            <div className="text-xl font-bold font-mono text-[var(--ui-text)]">
              {totalOccupants !== null ? `${totalOccupants} Kişi` : '—'}
            </div>
          </div>
          <p className="text-[12px] text-[var(--ui-text-muted)] mt-2 leading-[1.45]">
            Oda tipine göre varsayılan kişi yükü; projeye özel değildir.
          </p>
        </div>
      </div>

      {/* Critical Findings Quick List */}
      <div className="card p-3.5 flex flex-col gap-2.5">
        <div className="flex items-center justify-between border-b border-[var(--ui-border)] pb-2">
          <h4 className="font-bold text-[var(--ui-text)] text-[15px]">Öncelikli Mevzuat Bulguları</h4>
          <button
            onClick={() => setActiveTab('fire_audit')}
            className="text-[13px] text-[var(--ui-primary)] hover:underline flex items-center gap-1 font-medium"
          >
            Tüm Denetimi İncele <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {violationsCount === 0 ? (
          <div className="p-4 rounded-lg bg-[#182924] border border-[var(--ui-success)]/40 text-center space-y-2">
            <CheckCircle2 className="w-6 h-6 text-[var(--ui-success)] mx-auto" />
            <div className="text-[var(--ui-text)] font-semibold text-[14px]">
              {data ? 'Uygulanan denetimlerde ihlal kaydedilmedi' : 'Bulgu için önce bir pafta denetleyin'}
            </div>
            {data && (
              <p className="text-[12px] text-[var(--ui-text-muted)] max-w-md mx-auto">
                Bu sonuç yalnızca sistemin denetlediği kuralları kapsar. Ölçülmeyen maddeler için Kaçış & Merdiven Listesi sekmesine bakın.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {(data?.violations ?? []).slice(0, 3).map((v: any, idx: number) => (
              <div key={idx} className="p-3 rounded-lg audit-card-danger flex items-start gap-2.5 mb-2.5">
                <span className="badge badge-danger shrink-0 text-[12px] font-mono mt-0.5">
                  {v.regulation || v.code}
                </span>
                <div className="flex-1 flex flex-col gap-1.5 leading-[1.45]">
                  <p className="text-[14px] text-[var(--ui-text)] font-semibold leading-[1.45]">
                    {v.description}
                  </p>
                  <p className="text-[13px] text-[var(--ui-text-muted)] leading-[1.45]">
                    {v.remedy || v.suggested_fix || 'Mevzuata uygun hale getirilmelidir.'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Shortcut Callouts */}
      <div className="p-4 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] flex items-center justify-between gap-4">
        <div>
          <h5 className="font-bold text-[var(--ui-text)] text-[15px]">Karşı-Olgusal Tasarım Optimizasyonu</h5>
          <p className="text-[13px] text-[var(--ui-text-muted)] mt-1">
            {stepCount > 0 ? `${stepCount} hesaplanmış tadilat adımını inceleyin` : 'Bu pafta için hesaplanmış tadilat adımı yok'}
          </p>
        </div>
        <button
          onClick={onApplyOptimization}
          className="btn btn-primary text-[14px] py-2 px-4 shrink-0 flex items-center gap-2"
        >
          <span>Optimizasyonu Görüntüle</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

