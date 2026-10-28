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
    <div className="space-y-4 text-[14px] leading-relaxed text-[var(--ui-text)] w-full">
      {/* Header Banner */}
      <div className="p-4 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-lg bg-[var(--ui-primary)]/15 border border-[var(--ui-primary)]/30 flex items-center justify-center text-[var(--ui-primary)] shrink-0">
          <Warehouse className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-bold text-[var(--ui-text)] text-[16px]">
            Bodrum Kat, Sığınak ve Otopark Denetimi
          </h4>
          <p className="text-[13px] text-[var(--ui-text-muted)] mt-0.5">
            Sığınak Yönetmeliği M.9, 13 · Otopark Yönetmeliği & BYKHY M.60
          </p>
        </div>
      </div>

      {/* Audit Checklist Status */}
      <div className="grid grid-cols-2 gap-3.5">
        <div className="card p-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-[var(--ui-text)] text-[14px] flex items-center gap-1.5">
              <Warehouse className="w-4 h-4 text-[var(--ui-primary)]" /> Sığınak Denetimi
            </span>
            <span className="badge badge-danger text-[12px]">İhlal Var</span>
          </div>
          <p className="text-[13px] text-[var(--ui-text-muted)]">
            Alan: 20 m² (Geçerli) · Hava Kilidi: <strong className="text-[var(--ui-danger)]">YOK</strong>
          </p>
        </div>

        <div className="card p-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-[var(--ui-text)] text-[14px] flex items-center gap-1.5">
              <Car className="w-4 h-4 text-[var(--ui-primary)]" /> Otopark Denetimi
            </span>
            <span className="badge badge-danger text-[12px]">İhlal Var</span>
          </div>
          <p className="text-[13px] text-[var(--ui-text-muted)]">
            Merdiven Geçişi: <strong className="text-[var(--ui-danger)]">Doğrudan Kapı Açılmış</strong>
          </p>
        </div>
      </div>

      {/* Violation Items */}
      <div className="space-y-3">
        <div className="border-b border-[var(--ui-border)] pb-2 flex items-center justify-between">
          <h5 className="font-bold text-[var(--ui-text)] text-[15px]">
            Tespit Edilen Bodrum İhlalleri ({violations.length})
          </h5>
          <span className="text-[13px] text-[var(--ui-danger)] font-semibold">Kritik Risk</span>
        </div>

        {violations.map((v, i) => (
          <div
            key={i}
            onClick={() => onSelectViolation(v)}
            className="p-4 rounded-lg border border-[var(--ui-danger)]/40 bg-[#221A1D] hover:border-[var(--ui-danger)] transition-all cursor-pointer space-y-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <ShieldX className="w-5 h-5 text-[var(--ui-danger)] shrink-0" />
                <div>
                  <h6 className="font-bold text-[var(--ui-text)] text-[15px] font-mono">{v.rule_id}</h6>
                  <span className="text-[13px] text-[var(--ui-text-muted)]">
                    Hedef: {v.target_id} ({v.target_type})
                  </span>
                </div>
              </div>
              <span className="badge badge-danger text-[12px] font-mono uppercase">{v.severity}</span>
            </div>

            <p className="text-[14px] text-[var(--ui-text)] leading-relaxed">{v.description}</p>

            <div className="p-3 rounded-md bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] space-y-1.5">
              <div className="text-[13px] text-[var(--ui-text-muted)] font-mono">
                Hukuki Dayanak: <span className="text-[var(--ui-text)] font-semibold">{v.legal_basis}</span>
              </div>
              {v.suggested_fix && (
                <div className="text-[13px] text-[var(--ui-success)] leading-relaxed">
                  <span className="font-semibold">Önerilen Çözüm:</span>{' '}
                  <span className="text-[var(--ui-text)]">{v.suggested_fix}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

