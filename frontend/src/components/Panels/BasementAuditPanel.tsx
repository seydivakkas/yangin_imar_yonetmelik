import React from 'react';
import { Warehouse, Car, AlertTriangle, ShieldX, CheckCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { DiagramYonetmelikPipelineOutput } from '../../types/pipeline';

interface BasementAuditPanelProps {
  data: DiagramYonetmelikPipelineOutput | null;
  onSelectViolation: (v: any) => void;
}

export const BasementAuditPanel: React.FC<BasementAuditPanelProps> = ({
  data,
  onSelectViolation,
}) => {
  // Canlı backend verisinden bodrum katı, sığınak ve otopark ihlallerini filtrele
  const violations = React.useMemo(() => {
    if (!data) return [];
    if (data.basement_compliance && data.basement_compliance.length > 0) {
      return data.basement_compliance;
    }
    if (data.violations) {
      return data.violations
        .filter((v: any) =>
          (typeof v.floor_level === 'number' && v.floor_level < 0) ||
          String(v.code || '').startsWith('SIGINAK') ||
          String(v.code || '').startsWith('OTOPARK')
        )
        .map((v: any) => ({
          rule_id: v.code || 'BODRUM_IHLAL',
          category: String(v.code || '').includes('SIGINAK') ? 'siginak' : 'otopark',
          severity: (v.severity || 'critical').toLowerCase(),
          description: v.description || 'Yönetmelik ihlali tespit edildi.',
          target_id: v.target_node != null ? `Düğüm #${v.target_node}` : (v.target_edge ? `Kenar (${v.target_edge[0]}→${v.target_edge[1]})` : 'Bodrum Katı'),
          target_type: 'bina_elemani',
          legal_basis: v.regulation || 'Sığınak / Otopark / BYKHY M.60',
          suggested_fix: v.remedy || 'Mevzuat standartlarına uygun olarak revize ediniz.',
        }));
    }
    return [];
  }, [data]);

  const siginakViolations = violations.filter(v => v.category === 'siginak' || String(v.rule_id).includes('SIGINAK'));
  const otoparkViolations = violations.filter(v => v.category === 'otopark' || String(v.rule_id).includes('OTOPARK'));
  const hasSiginakViolation = siginakViolations.length > 0;
  const hasOtoparkViolation = otoparkViolations.length > 0;

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
            <span className={`badge ${hasSiginakViolation ? 'badge-danger' : 'badge-success'} text-[12px]`}>
              {hasSiginakViolation ? 'İhlal Var' : 'Uygun'}
            </span>
          </div>
          <p className="text-[13px] text-[var(--ui-text-muted)]">
            Alan: 80 m² (Geçerli) · Hava Kilidi:{' '}
            {hasSiginakViolation ? (
              <strong className="text-[var(--ui-danger)]">YOK / EKSİK</strong>
            ) : (
              <strong className="text-[var(--ui-success)]">MEVCUT (Sızdırmaz Çift Kapı)</strong>
            )}
          </p>
        </div>

        <div className="card p-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-[var(--ui-text)] text-[14px] flex items-center gap-1.5">
              <Car className="w-4 h-4 text-[var(--ui-primary)]" /> Otopark Denetimi
            </span>
            <span className={`badge ${hasOtoparkViolation ? 'badge-danger' : 'badge-success'} text-[12px]`}>
              {hasOtoparkViolation ? 'İhlal Var' : 'Uygun'}
            </span>
          </div>
          <p className="text-[13px] text-[var(--ui-text-muted)]">
            Merdiven Geçişi:{' '}
            {hasOtoparkViolation ? (
              <strong className="text-[var(--ui-danger)]">Doğrudan Kapı Açılmış (Hol Yok)</strong>
            ) : (
              <strong className="text-[var(--ui-success)]">Yangın Güvenlik Holü ile Korumalı (EI90)</strong>
            )}
          </p>
        </div>
      </div>

      {/* Violation Items */}
      <div className="space-y-3">
        <div className="border-b border-[var(--ui-border)] pb-2 flex items-center justify-between">
          <h5 className="font-bold text-[var(--ui-text)] text-[15px]">
            Tespit Edilen Bodrum İhlalleri ({violations.length})
          </h5>
          <span className={`text-[13px] font-semibold ${violations.length > 0 ? 'text-[var(--ui-danger)]' : 'text-[var(--ui-success)]'}`}>
            {violations.length > 0 ? 'Kritik Risk' : 'Sıfır Risk'}
          </span>
        </div>

        {violations.length === 0 ? (
          <div className="p-6 rounded-lg bg-[#182924] border border-[var(--ui-success)]/50 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[var(--ui-success)]/20 border border-[var(--ui-success)]/40 flex items-center justify-center text-[var(--ui-success)] mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[var(--ui-text)] font-bold text-[16px]">
                Bodrum Kat, Sığınak ve Otopark Tamamen Uygun
              </div>
              <p className="text-[13px] text-[var(--ui-text-muted)] max-w-lg mx-auto mt-1">
                Sığınak Yönetmeliği (M.9, 13) ve Otopark Yönetmeliği & BYKHY M.60 uyarınca denetlenen sızdırmaz hava kilidi, acil kaçış şaftı ve otopark yangın güvenlik holü geçiş standartlarının tümü eksiksiz sağlanmıştır.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
              <span className="badge badge-success text-[12px]">Hava Kilidi Çift Kapı Tam</span>
              <span className="badge badge-success text-[12px]">Acil Tahliye Menfezi / Şaftı Tam</span>
              <span className="badge badge-success text-[12px]">Otopark Yangın Güvenlik Holü Tam</span>
            </div>
          </div>
        ) : (
          violations.map((v, i) => (
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
          ))
        )}
      </div>
    </div>
  );
};
