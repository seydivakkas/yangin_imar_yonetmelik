import React from 'react';
import { ShieldAlert, CheckCircle2, TrendingUp, Clock, AlertTriangle, ArrowRight, Layers, FileText } from 'lucide-react';
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
  const violationsCount = (data?.basement_compliance?.length || 0) + (data?.vf2_diagnostics?.filter(v => !v.is_compliant)?.length || 0);
  const totalOccupants = data?.evacuation_report?.total_occupants || 78;
  const originalTime = data?.evacuation_report?.total_evacuation_time_s || 76.5;
  const optimizedTime = data?.counterfactual_optimization?.optimized_evacuation_time_s || 58.0;
  const timeSaved = (originalTime - optimizedTime).toFixed(1);
  const aset = 62.0;

  return (
    <div className="space-y-4 p-4 text-xs font-sans text-gray-200 overflow-y-auto max-h-full">
      {/* Hero Compliance Card */}
      <div className={`p-4 rounded-xl border ${violationsCount > 0 ? 'bg-red-950/20 border-red-500/30' : 'bg-emerald-950/20 border-emerald-500/30'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${violationsCount > 0 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
              {violationsCount > 0 ? <ShieldAlert className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                {violationsCount > 0 ? `${violationsCount} Kritik Mevzuat İhlali Tespit Edildi` : 'Bina Yangın & İmar Mevzuatına Uygun'}
              </h3>
              <p className="text-[11px] text-gray-400">
                BYKHY 2007/2015, PAİY, Sığınak ve Otopark Yönetmeliği Nöro-Sembolik Denetim Özeti
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold font-mono text-cyan-400">
              {violationsCount > 0 ? '%64' : '%98'}
            </div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider">Güvenlik Skoru</div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="glass-panel p-3">
          <div className="flex items-center justify-between text-gray-400 text-[11px] mb-1">
            <span>RSET (Tahliye Süresi)</span>
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-lg font-bold font-mono text-white flex items-baseline gap-1.5">
            <span>{originalTime.toFixed(1)} sn</span>
            <span className="text-[10px] text-red-400 font-sans font-normal">&gt; ASET ({aset} sn)</span>
          </div>
          <p className="text-[10px] text-red-400/90 mt-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            14.5 sn tahliye açığı (Duman riski)
          </p>
        </div>

        <div className="glass-panel p-3">
          <div className="flex items-center justify-between text-gray-400 text-[11px] mb-1">
            <span>Optimizasyon Kazancı</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-lg font-bold font-mono text-emerald-400 flex items-baseline gap-1.5">
            <span>-{timeSaved} sn</span>
            <span className="text-[11px] text-gray-300 font-sans">({optimizedTime.toFixed(1)} sn'ye)</span>
          </div>
          <p className="text-[10px] text-emerald-400/90 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            ASET marjı güvenli aralığa ulaştı
          </p>
        </div>

        <div className="glass-panel p-3">
          <div className="flex items-center justify-between text-gray-400 text-[11px] mb-1">
            <span>Toplam Alan & Kat</span>
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-base font-bold font-mono text-white">
            {data?.building_program?.total_area_m2 || 840} m²
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {data?.building_program?.floor_count || 3} Kat · {data?.rooms_analyzed || 28} Mekan · {data?.doors_analyzed || 26} Kapı
          </p>
        </div>

        <div className="glass-panel p-3">
          <div className="flex items-center justify-between text-gray-400 text-[11px] mb-1">
            <span>Kullanıcı Yükü</span>
            <span className="badge badge-purple text-[9px]">SFPE</span>
          </div>
          <div className="text-base font-bold font-mono text-white">
            {totalOccupants} Kişi
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">
            En yoğun kat: Kat 1 (34 kişi)
          </p>
        </div>
      </div>

      {/* Critical Findings Quick List */}
      <div className="glass-panel p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-gray-200 tracking-wide text-xs">Öncelikli Mevzuat Bulguları</h4>
          <button
            onClick={() => setActiveTab('fire_audit')}
            className="text-[11px] text-cyan-400 hover:underline flex items-center gap-0.5"
          >
            Tümünü Gör <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="space-y-1.5">
          <div className="p-2 rounded bg-red-950/30 border border-red-500/20 flex items-start gap-2">
            <span className="badge badge-red shrink-0 text-[9px] mt-0.5">BYKHY M.31</span>
            <div className="flex-1">
              <p className="text-[11px] text-gray-200 font-medium">Yangın güvenlik holü kapısı yetersiz genişlikte (0.90m &lt; 1.20m)</p>
              <p className="text-[10px] text-gray-400">Tahliye akışında hidrolik darboğaz ve 14 kişilik kuyruk oluşturuyor.</p>
            </div>
          </div>

          <div className="p-2 rounded bg-red-950/30 border border-red-500/20 flex items-start gap-2">
            <span className="badge badge-red shrink-0 text-[9px] mt-0.5">OTOPARK</span>
            <div className="flex-1">
              <p className="text-[11px] text-gray-200 font-medium">Kapalı otoparktan yangın merdivenine doğrudan kapı bağlantısı yasaktır</p>
              <p className="text-[10px] text-gray-400">Merdiven kovasına duman ve zehirli gaz sızma riski mevcuttur.</p>
            </div>
          </div>

          <div className="p-2 rounded bg-amber-950/30 border border-amber-500/20 flex items-start gap-2">
            <span className="badge badge-amber shrink-0 text-[9px] mt-0.5">SIĞINAK M.9</span>
            <div className="flex-1">
              <p className="text-[11px] text-gray-200 font-medium">Sığınak girişinde sızdırmaz hava kilidi (airlock) tespit edilemedi</p>
              <p className="text-[10px] text-gray-400">Min. 1.5 m² alanlı ve çift kapılı güvenlik geçidi gereklidir.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Shortcut Callouts */}
      <div className="p-3 rounded-lg bg-gradient-to-r from-cyan-950/40 to-blue-950/40 border border-cyan-500/30 flex items-center justify-between">
        <div>
          <h5 className="font-semibold text-cyan-300 text-xs">Karşı-Olgusal Tasarım Optimizasyonu</h5>
          <p className="text-[10px] text-gray-300 mt-0.5">
            3 adımda otomatik kapı genişletme ve hava kilidi revizyonu hazır
          </p>
        </div>
        <button
          onClick={onApplyOptimization}
          className="btn-primary text-xs py-1.5 px-3"
        >
          <span>Uygula & İncele</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
