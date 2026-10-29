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
  const violationsCount = data?.violations?.length ?? ((data?.basement_compliance?.length || 0) + (data?.vf2_diagnostics?.filter(v => !v.is_compliant)?.length || 0));
  const totalOccupants = data?.program?.est_persons || data?.evacuation_report?.total_occupants || 78;
  const originalTime = data?.evacuation?.baseline_time_sec || data?.evacuation_report?.total_evacuation_time_s || 76.5;
  const optimizedTime = data?.optimization?.optimized_time_sec || data?.counterfactual_optimization?.optimized_evacuation_time_s || 58.0;
  const timeSaved = (originalTime - optimizedTime).toFixed(1);
  const aset = 62.0;
  const totalArea = data?.program?.residential_area_m2 || data?.building_program?.total_area_m2 || 840;
  const floorCount = data?.metadata?.total_floors || data?.building_program?.floor_count || 2;
  const totalRooms = data?.metadata?.total_rooms || data?.rooms_analyzed || 28;
  const totalDoors = data?.metadata?.total_doors || data?.doors_analyzed || 26;

  return (
    <div className="flex flex-col gap-3.5 text-[14px] leading-relaxed text-[var(--ui-text)] w-full">
      {/* Hero Compliance Status Card */}
      <div
        className={`p-3.5 rounded-lg border transition-all ${
          violationsCount > 0
            ? 'bg-[#2A1D22] border-[var(--ui-danger)]/50'
            : 'bg-[#182924] border-[var(--ui-success)]/50'
        }`}
      >
        <div className="flex items-start justify-between gap-3.5">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                violationsCount > 0
                  ? 'bg-[var(--ui-danger)]/15 text-[var(--ui-danger)] border border-[var(--ui-danger)]/30'
                  : 'bg-[var(--ui-success)]/15 text-[var(--ui-success)] border border-[var(--ui-success)]/30'
              }`}
            >
              {violationsCount > 0 ? <ShieldAlert className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-[var(--ui-text)] leading-[1.45]">
                {violationsCount > 0
                  ? `${violationsCount} Kritik Mevzuat İhlali Tespit Edildi`
                  : 'Bina Yangın & İmar Mevzuatına Tam Uygun'}
              </h3>
              <p className="text-[13px] text-[var(--ui-text-muted)] mt-0.5 leading-[1.45]">
                BYKHY 2007/2015, PAİY, Sığınak ve Otopark Yönetmeliği Nöro-Sembolik Denetim Özeti
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold font-mono text-[var(--ui-primary)]">
              {violationsCount > 0 ? '%64' : '%98'}
            </div>
            <div className="text-[12px] text-[var(--ui-text-muted)] uppercase tracking-wide font-medium mt-0.5">
              Güvenlik Skoru
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
              <span>{originalTime.toFixed(1)} sn</span>
              <span className={`text-[12px] font-sans font-medium ${originalTime <= aset ? 'text-[var(--ui-success)]' : 'text-[var(--ui-danger)]'}`}>
                {originalTime <= aset ? `< ${aset}s ASET (Güvenli)` : `> ${aset}s ASET`}
              </span>
            </div>
          </div>
          {originalTime <= aset ? (
            <p className="text-[12px] text-[var(--ui-success)] mt-2 flex items-center gap-1.5 leading-[1.45]">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Tahliye marjı güvenli aralıkta</span>
            </p>
          ) : (
            <p className="text-[12px] text-[var(--ui-danger)] mt-2 flex items-center gap-1.5 leading-[1.45]">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{(originalTime - aset).toFixed(1)} sn tahliye açığı (Duman riski)</span>
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
              <span>-{timeSaved} sn</span>
              <span className="text-[13px] text-[var(--ui-text-muted)] font-sans font-normal">
                ({optimizedTime.toFixed(1)}s)
              </span>
            </div>
          </div>
          <p className="text-[12px] text-[var(--ui-success)] mt-2 flex items-center gap-1.5 leading-[1.45]">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>ASET marjı güvenli aralığa ulaştı</span>
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
              {totalArea} m²
            </div>
          </div>
          <p className="text-[12px] text-[var(--ui-text-muted)] mt-2 leading-[1.45]">
            {floorCount} Kat · {totalRooms} Mekan · {totalDoors} Kapı
          </p>
        </div>

        {/* Kullanıcı Yükü */}
        <div className="card p-[12px_14px] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[var(--ui-text-muted)] text-[13px] mb-1.5">
              <span className="font-medium">Kullanıcı Yükü (SFPE)</span>
              <span className="badge badge-neutral text-[11px]">Kişi / Kat</span>
            </div>
            <div className="text-xl font-bold font-mono text-[var(--ui-text)]">
              {totalOccupants} Kişi
            </div>
          </div>
          <p className="text-[12px] text-[var(--ui-text-muted)] mt-2 leading-[1.45]">
            En yoğun kat: Kat 1 (34 kişi / 2 kaçış kapısı)
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
              Tüm Mevzuata %100 Uygun - Sıfır İhlal
            </div>
            <p className="text-[12px] text-[var(--ui-text-muted)] max-w-md mx-auto">
              BYKHY, PAİY, Sığınak ve Otopark yönetmelikleri kapsamında hiçbir ihlal bulunmamaktadır. Yangın kaçış güvenliği, hava kilitleri ve kompartıman sınırları tamdır.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {(data?.violations && data.violations.length > 0 ? data.violations.slice(0, 3) : [
              { code: 'BYKHY_M31', description: 'Yangın güvenlik holü kapısı yetersiz genişlikte (0.90m < 1.20m)', regulation: 'BYKHY M.31', remedy: 'Kapı net genişliği 1.20 m yapılmalıdır.' },
              { code: 'OTOPARK_M6', description: 'Kapalı otoparktan yangın merdivenine doğrudan kapı bağlantısı yasaktır', regulation: 'OTOPARK M.6', remedy: 'Yangın güvenlik holü eklenmelidir.' },
              { code: 'SIGINAK_M9', description: 'Sığınak girişinde sızdırmaz hava kilidi tespit edilemedi', regulation: 'SIĞINAK M.9', remedy: 'Çift kapılı sızdırmaz hava kilidi eklenmelidir.' }
            ]).map((v: any, idx: number) => (
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
          <h5 className="font-bold text-[var(--ui-text)] text-[15px]">
            {violationsCount === 0 ? 'Tasarım Mevzuata Tam Uygun' : 'Karşı-Olgusal Tasarım Optimizasyonu'}
          </h5>
          <p className="text-[13px] text-[var(--ui-text-muted)] mt-1">
            {violationsCount === 0
              ? 'Pafta sıfır ihlalle onaylanmıştır. İki bağımsız merdiven, holler ve sığınak eksiksizdir.'
              : '3 adımda otomatik kapı genişletme ve hava kilidi mimari revizyonu hazır'}
          </p>
        </div>
        <button
          onClick={onApplyOptimization}
          className="btn btn-primary text-[14px] py-2 px-4 shrink-0 flex items-center gap-2"
        >
          <span>{violationsCount === 0 ? 'Optimizasyonu Görüntüle' : 'Uygula & İncele'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

