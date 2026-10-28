import React from 'react';
import { Network, ArrowUpDown, ShieldCheck, Compass, GitCommit } from 'lucide-react';
import { DiagramYonetmelikPipelineOutput } from '../../types/pipeline';

interface SpatialRagPanelProps {
  data: DiagramYonetmelikPipelineOutput | null;
}

export const SpatialRagPanel: React.FC<SpatialRagPanelProps> = ({ data }) => {
  const summary = data?.graph_3d_summary || {
    node_count: 32,
    edge_count: 48,
    floors: [-1, 0, 1],
    vertical_shafts: 2,
    fire_elevators_excluded: true,
  };

  return (
    <div className="space-y-4 text-[14px] leading-relaxed text-[var(--ui-text)] w-full">
      {/* Banner */}
      <div className="p-4 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-lg bg-[var(--ui-primary)]/15 border border-[var(--ui-primary)]/30 flex items-center justify-center text-[var(--ui-primary)] shrink-0">
          <Network className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-bold text-[var(--ui-text)] text-[16px]">Çok Katlı 3B Mekansal Graf (3B RAG)</h4>
          <p className="text-[13px] text-[var(--ui-text-muted)] mt-0.5">
            Düşey Çekirdek Bağlantıları · Merdiven Yürüme Faktörü (2.2x) · Yangın Asansörü İzolasyonu
          </p>
        </div>
      </div>

      {/* Graph Metrics */}
      <div className="grid grid-cols-2 gap-3.5">
        <div className="card p-3.5">
          <div className="text-[12px] text-[var(--ui-text-muted)] font-medium">Graf Düğümleri (Oda & Hol)</div>
          <div className="text-xl font-bold font-mono text-[var(--ui-text)] mt-1">{summary.node_count} Düğüm</div>
          <div className="text-[13px] text-[var(--ui-text-muted)] mt-1">3 Kat · 1 Dış Çıkış</div>
        </div>

        <div className="card p-3.5">
          <div className="text-[12px] text-[var(--ui-text-muted)] font-medium">Graf Kenarları (Kapı & Şaft)</div>
          <div className="text-xl font-bold font-mono text-[var(--ui-text)] mt-1">{summary.edge_count} Kenar</div>
          <div className="text-[13px] text-[var(--ui-text-muted)] mt-1">42 Yatay · 6 Dikey Geçiş</div>
        </div>
      </div>

      {/* Special Engine Features */}
      <div className="card p-4 space-y-3">
        <h5 className="font-bold text-[var(--ui-text)] text-[15px] border-b border-[var(--ui-border)] pb-2">
          3B RAG Mekansal Hesaplama Kuralları
        </h5>

        <div className="space-y-2.5">
          <div className="p-3.5 rounded-lg audit-card-info space-y-1">
            <div className="flex items-center gap-2 text-[var(--ui-primary)] font-semibold text-[14px]">
              <ArrowUpDown className="w-4 h-4 text-[var(--ui-primary)]" />
              <span>Merdiven Yürüme Direnci Faktörü (2.2x)</span>
            </div>
            <p className="text-[13px] text-[var(--ui-text-muted)] leading-relaxed">
              Düşey kaçışta merdiven basamakları düz koridor yürüyüşüne göre 2.2 kat daha fazla efor ve süre gerektirir (SFPE standardı).
            </p>
          </div>

          <div className="p-3.5 rounded-lg audit-card-success space-y-1">
            <div className="flex items-center gap-2 text-[var(--ui-success)] font-semibold text-[14px]">
              <ShieldCheck className="w-4 h-4 text-[var(--ui-success)]" />
              <span>Yangın Asansörünün Kaçıştan Hariç Tutulması</span>
            </div>
            <p className="text-[13px] text-[var(--ui-text-muted)] leading-relaxed">
              BYKHY Madde 62 uyarınca, normal veya yangın asansörleri kaçış yolu hesabına dahil edilmez; grafa yalnızca itfaiyeci erişim düğümü olarak eklenir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

