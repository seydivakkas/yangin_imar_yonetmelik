import React from 'react';
import { Activity, Clock, Flame, Users, AlertOctagon, TrendingDown, Layers } from 'lucide-react';
import { DiagramYonetmelikPipelineOutput } from '../../types/pipeline';

interface EvacuationPanelProps {
  data: DiagramYonetmelikPipelineOutput | null;
  simulationTime: number;
}

export const EvacuationPanel: React.FC<EvacuationPanelProps> = ({
  data,
  simulationTime,
}) => {
  const evac = data?.evacuation_report;
  const totalOccupants = evac?.total_occupants || 78;
  const totalTime = evac?.total_evacuation_time_s || 76.5;
  const aset = 62.0;
  const bottlenecks = evac?.bottleneck_doors || [
    { door_id: 'D_1_yangin_holu', flow_capacity_pers_s: 1.17, peak_queue_length: 14, total_waiting_time_s: 19.4, is_spillback_trigger: true },
    { door_id: 'D_0_yangin_holu', flow_capacity_pers_s: 1.17, peak_queue_length: 12, total_waiting_time_s: 16.2, is_spillback_trigger: true },
    { door_id: 'D_0_dis_cikis', flow_capacity_pers_s: 1.82, peak_queue_length: 6, total_waiting_time_s: 7.8, is_spillback_trigger: false },
  ];

  // Current evacuated occupants based on time
  const evacuatedCount = Math.min(totalOccupants, Math.floor((simulationTime / totalTime) * totalOccupants));
  const remainingCount = totalOccupants - evacuatedCount;

  return (
    <div className="space-y-4 text-[14px] leading-relaxed text-[var(--ui-text)] w-full">
      {/* Banner */}
      <div className="p-4 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-[var(--ui-primary)]/15 border border-[var(--ui-primary)]/30 flex items-center justify-center text-[var(--ui-primary)] shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-[var(--ui-text)] text-[16px]">SFPE Hidrolik Tahliye & Duman Simülasyonu</h4>
            <p className="text-[13px] text-[var(--ui-text-muted)] mt-0.5">Hücre İletim Modeli (Δt=0.5s) · Geriye Yayılımlı Kuyruklaşma</p>
          </div>
        </div>
        <span className="badge badge-neutral text-[12px] font-mono shrink-0">SFPE 5. Baskı</span>
      </div>

      {/* Real-time Evacuation Gauge */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between text-[14px]">
          <span className="text-[var(--ui-text)] font-semibold">Canlı Tahliye İlerlemesi (T = {simulationTime.toFixed(1)}s)</span>
          <span className="font-mono text-[var(--ui-primary)] font-bold">{evacuatedCount} / {totalOccupants} Kişi (%{((evacuatedCount/totalOccupants)*100).toFixed(0)})</span>
        </div>
        <div className="w-full bg-[var(--ui-surface-raised)] rounded-full h-3 overflow-hidden border border-[var(--ui-border)]">
          <div
            className="bg-[var(--ui-primary)] h-full transition-all duration-200"
            style={{ width: `${(evacuatedCount / totalOccupants) * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-[13px] text-[var(--ui-text-muted)]">
          <span>Kalan: <strong className="text-[var(--ui-warning)]">{remainingCount}</strong> kişi</span>
          <span>Tahliye Olan: <strong className="text-[var(--ui-success)]">{evacuatedCount}</strong> kişi</span>
        </div>
      </div>

      {/* ASET vs RSET Card */}
      <div className="p-4 rounded-lg bg-[#221A1D] border border-[var(--ui-danger)]/40 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-bold text-[var(--ui-danger)] text-[15px] flex items-center gap-2">
            <Flame className="w-4 h-4 text-[var(--ui-danger)]" /> ASET vs RSET Güvenlik Karşılaştırması
          </span>
          <span className="badge badge-danger text-[12px] font-mono">-14.5 sn Güvenlik Açığı</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="p-3 rounded-md bg-[var(--ui-surface-raised)] border border-[var(--ui-border)]">
            <div className="text-[12px] text-[var(--ui-text-muted)]">RSET (Gereken Süre)</div>
            <div className="text-xl font-bold font-mono text-[var(--ui-danger)] mt-0.5">{totalTime.toFixed(1)} sn</div>
          </div>
          <div className="p-3 rounded-md bg-[var(--ui-surface-raised)] border border-[var(--ui-border)]">
            <div className="text-[12px] text-[var(--ui-text-muted)]">ASET (Kritik Duman Süresi)</div>
            <div className="text-xl font-bold font-mono text-[var(--ui-primary)] mt-0.5">{aset.toFixed(1)} sn</div>
          </div>
        </div>
        <p className="text-[13px] text-[var(--ui-text)] leading-relaxed">
          Duman tabakası 62. saniyede 1.80m kritik kaçış kotunun altına inmektedir. Tahliyenin güvenli tamamlanabilmesi için darboğazların giderilmesi şarttır.
        </p>
      </div>

      {/* Bottlenecks Table */}
      <div className="card p-4 space-y-3">
        <h5 className="font-bold text-[var(--ui-text)] text-[15px] flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 text-[var(--ui-warning)]" />
          Kritik Kapı Darboğazları & Kuyruk Analizi
        </h5>

        <div className="space-y-2">
          {bottlenecks.map((b, i) => (
            <div key={i} className="p-3 rounded-md bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] flex items-center justify-between gap-3">
              <div>
                <div className="font-mono text-[var(--ui-text)] text-[14px] font-bold">{b.door_id}</div>
                <div className="text-[13px] text-[var(--ui-text-muted)] mt-0.5">
                  Akış Kapasitesi: <span className="text-[var(--ui-text)]">{b.flow_capacity_pers_s} kişi/s</span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[var(--ui-warning)] text-[14px] font-bold">
                  Kuyruk: {b.peak_queue_length} kişi
                </div>
                <div className="text-[12px] text-[var(--ui-text-muted)] mt-0.5">
                  Bekleme: {(b.total_waiting_time_s ?? 0).toFixed(1)} sn
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

