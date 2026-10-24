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
    <div className="space-y-4 p-4 text-xs font-sans text-gray-200 overflow-y-auto max-h-full">
      {/* Banner */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-950/40 via-red-950/40 to-slate-900 border border-amber-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-amber-400" />
            <div>
              <h4 className="font-bold text-white text-xs">SFPE Hidrolik Tahliye & İki-Bölgeli Duman Simülasyonu</h4>
              <p className="text-[10px] text-gray-400">Hücre İletim Modeli (Δt=0.5s) · Geriye Yayılımlı (Spillback) Kuyruklaşma</p>
            </div>
          </div>
          <span className="badge badge-amber text-[10px] font-mono">SFPE 5. Baskı</span>
        </div>
      </div>

      {/* Real-time Evacuation Gauge */}
      <div className="glass-panel p-3 space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-gray-300 font-medium">Canlı Tahliye İlerlemesi (T = {simulationTime.toFixed(1)}s)</span>
          <span className="font-mono text-cyan-400 font-bold">{evacuatedCount} / {totalOccupants} Kişi (%{((evacuatedCount/totalOccupants)*100).toFixed(0)})</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full transition-all duration-200"
            style={{ width: `${(evacuatedCount / totalOccupants) * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-400">
          <span>Kalan: <strong className="text-amber-400">{remainingCount}</strong> kişi</span>
          <span>Tahliye Olan: <strong className="text-emerald-400">{evacuatedCount}</strong> kişi</span>
        </div>
      </div>

      {/* ASET vs RSET Card */}
      <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/30 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-red-300 text-xs flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-orange-400" /> ASET vs RSET Güvenlik Karşılaştırması
          </span>
          <span className="badge badge-red text-[9px] font-mono">-14.5 sn Güvenlik Açığı</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="p-2 rounded bg-black/40">
            <div className="text-[10px] text-gray-400">RSET (Gereken Süre)</div>
            <div className="text-base font-bold font-mono text-red-400">{totalTime.toFixed(1)} sn</div>
          </div>
          <div className="p-2 rounded bg-black/40">
            <div className="text-[10px] text-gray-400">ASET (Kullanılabilir Süre)</div>
            <div className="text-base font-bold font-mono text-cyan-400">{aset.toFixed(1)} sn</div>
          </div>
        </div>
        <p className="text-[10px] text-red-300 leading-normal">
          Duman tabakası 62. saniyede 1.80m kritik kaçış kotunun altına inmektedir. Tahliyenin güvenli tamamlanabilmesi için darboğazların giderilmesi şarttır.
        </p>
      </div>

      {/* Bottlenecks Table */}
      <div className="glass-panel p-3 space-y-2">
        <h5 className="font-semibold text-gray-300 text-xs flex items-center gap-1.5">
          <AlertOctagon className="w-3.5 h-3.5 text-amber-400" />
          Kritik Kapı Darboğazları & Kuyruk Analizi
        </h5>

        <div className="space-y-1.5">
          {bottlenecks.map((b, i) => (
            <div key={i} className="p-2 rounded bg-slate-900/50 border border-white/5 flex items-center justify-between">
              <div>
                <div className="font-mono text-white text-[11px] font-semibold">{b.door_id}</div>
                <div className="text-[10px] text-gray-400">
                  Akış Kapasitesi: <span className="text-gray-200">{b.flow_capacity_pers_s} kişi/s</span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-amber-400 text-xs font-bold">
                  Kuyruk: {b.peak_queue_length} kişi
                </div>
                <div className="text-[9px] text-gray-400">
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
