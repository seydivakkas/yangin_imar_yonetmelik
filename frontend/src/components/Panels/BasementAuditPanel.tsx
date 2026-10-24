import React from 'react';
import { Warehouse, Car, AlertTriangle, ShieldX, CheckCircle, ArrowRight } from 'lucide-react';
import { DiagramYonetmelikPipelineOutput } from '../../types/pipeline';

interface BasementAuditPanelProps {
  data: DiagramYonetmelikPipelineOutput | null;
  onSelectViolation: (v: any) => void;
}

export const BasementAuditPanel: React.FC<BasementAuditPanelProps> = ({
  data,
  onSelectViolation,
}) => {
  const violations = data?.basement_compliance || [
    {
      rule_id: 'SIGINAK_HAVA_KILIDI_YOK',
      category: 'siginak',
      severity: 'critical',
      description: 'Sığınak girişinde sızdırmaz hava kilidi (airlock) tespit edilemedi. Çift kapılı güvenlik geçidi zorunludur.',
      target_id: 'K-1_siginak',
      target_type: 'room',
      legal_basis: 'Sığınak Yönetmeliği Madde 9, 13',
      suggested_fix: 'Sığınak girişine min 1.5 m² alanlı ve sızdırmaz çift kapılı hava kilidi eklensin.',
    },
    {
      rule_id: 'OTOPARK_DOGRADAN_MERDIVEN_BAGLANTISI',
      category: 'otopark',
      severity: 'critical',
      description: 'Kapalı otoparktan doğrudan yangın merdivenine / asansör holüne kapı açılmıştır. Doğrudan geçiş yasaktır.',
      target_id: 'D_-1_merdiven',
      target_type: 'door',
      legal_basis: 'Otopark Yönetmeliği & BYKHY Madde 60',
      suggested_fix: 'Otopark ile merdiven arasına yangın güvenlik holü (hava geçiş korumalı) yerleştirilsin.',
    },
  ];

  return (
    <div className="space-y-4 p-4 text-xs font-sans text-gray-200 overflow-y-auto max-h-full">
      {/* Header Banner */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-purple-950/40 via-indigo-950/40 to-slate-900 border border-purple-500/30">
        <div className="flex items-center gap-2.5">
          <Warehouse className="w-5 h-5 text-purple-400" />
          <div>
            <h4 className="font-bold text-white text-xs">Bodrum Kat & Sığınak / Otopark Uyumluluk Denetimi</h4>
            <p className="text-[10px] text-gray-400">Sığınak Yönetmeliği M.9, 13 · Otopark Yönetmeliği & BYKHY M.60</p>
          </div>
        </div>
      </div>

      {/* Audit Checklist Status */}
      <div className="grid grid-cols-2 gap-2">
        <div className="glass-panel p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-semibold text-gray-300 text-[11px] flex items-center gap-1">
              <Warehouse className="w-3.5 h-3.5 text-purple-400" /> Sığınak Denetimi
            </span>
            <span className="badge badge-red text-[9px]">İhlal Var</span>
          </div>
          <p className="text-[10px] text-gray-400">
            Alan: 20 m² (Geçerli) · Hava Kilidi: <span className="text-red-400 font-bold">YOK</span>
          </p>
        </div>

        <div className="glass-panel p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-semibold text-gray-300 text-[11px] flex items-center gap-1">
              <Car className="w-3.5 h-3.5 text-blue-400" /> Otopark Denetimi
            </span>
            <span className="badge badge-red text-[9px]">İhlal Var</span>
          </div>
          <p className="text-[10px] text-gray-400">
            Merdiven Geçişi: <span className="text-red-400 font-bold">Doğrudan Kapı Açılmış</span>
          </p>
        </div>
      </div>

      {/* Violation Items */}
      <div className="space-y-3">
        <h5 className="font-semibold text-gray-300 text-xs">Tespit Edilen Bodrum İhlalleri ({violations.length})</h5>

        {violations.map((v, i) => (
          <div
            key={i}
            onClick={() => onSelectViolation(v)}
            className="p-3.5 rounded-lg border border-red-500/30 bg-red-950/25 hover:border-red-400 hover:bg-red-950/35 transition-all cursor-pointer space-y-2"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <ShieldX className="w-4 h-4 text-red-400 shrink-0" />
                <div>
                  <h6 className="font-bold text-white text-xs font-mono">{v.rule_id}</h6>
                  <span className="text-[10px] text-gray-400">Hedef: {v.target_id} ({v.target_type})</span>
                </div>
              </div>
              <span className="badge badge-red text-[9px] uppercase font-mono">{v.severity}</span>
            </div>

            <p className="text-[11px] text-gray-200 leading-relaxed">{v.description}</p>

            <div className="p-2 rounded bg-black/40 border border-white/5 space-y-1">
              <div className="text-[10px] text-cyan-400 font-mono">
                Hukuki Dayanak: <span className="text-gray-200">{v.legal_basis}</span>
              </div>
              {v.suggested_fix && (
                <div className="text-[10px] text-emerald-400">
                  Önerilen Çözüm: <span className="text-gray-300">{v.suggested_fix}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
