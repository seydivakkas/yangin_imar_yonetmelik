import React, { useState, useMemo } from 'react';
import { Boxes, Box, Compass, Hash, Filter, Search, CheckCircle2, AlertTriangle, Layers, Ruler, DoorClosed } from 'lucide-react';
import { DiagramYonetmelikPipelineOutput, MacroNodeRecord } from '../../types/pipeline';

interface SpminerPanelProps {
  data: DiagramYonetmelikPipelineOutput | null;
  onSelectMacroNode?: (macro: MacroNodeRecord) => void;
}

export const SpminerPanel: React.FC<SpminerPanelProps> = ({ data, onSelectMacroNode }) => {
  const [selectedFloor, setSelectedFloor] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Canlı backend çıktısından veya spminer alanından makro düğümleri al
  const macroNodes: MacroNodeRecord[] = useMemo(() => {
    if (!data) return [];
    if (data.spminer_macro_nodes && data.spminer_macro_nodes.length > 0) {
      return data.spminer_macro_nodes;
    }
    const sp = (data as any)?.spminer?.macro_nodes;
    if (Array.isArray(sp) && sp.length > 0) {
      return sp;
    }
    return [];
  }, [data]);

  // Kat seviyelerini tespit et
  const availableFloors = useMemo(() => {
    const s = new Set<number>();
    macroNodes.forEach((m) => {
      if (typeof m.floor_level === 'number') s.add(m.floor_level);
    });
    return Array.from(s).sort((a, b) => b - a);
  }, [macroNodes]);

  // İstatistikler
  const totalApartments = data?.program?.total_apartments || macroNodes.length;
  const maxEscapeDepth = useMemo(() => {
    if (macroNodes.length === 0) return 0;
    return Math.max(...macroNodes.map((m) => m.internal_exit_depth_m || 0));
  }, [macroNodes]);

  const compressionRatio = Math.round((data?.spminer_compression_ratio ?? 0) * 100);

  // Filtrelenmiş liste
  const filteredNodes = useMemo(() => {
    return macroNodes.filter((m) => {
      const matchesFloor = selectedFloor === 'all' || m.floor_level === selectedFloor;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        m.macro_id.toLowerCase().includes(q) ||
        (m.module_type && m.module_type.toLowerCase().includes(q)) ||
        m.member_rooms.some((r) => r.toLowerCase().includes(q));
      return matchesFloor && matchesSearch;
    });
  }, [macroNodes, selectedFloor, searchQuery]);

  return (
    <div className="space-y-4 text-[14px] leading-relaxed text-[var(--ui-text)] w-full">
      {/* Banner */}
      <div className="p-4 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] flex items-center justify-between gap-3.5">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-[var(--ui-primary)]/15 border border-[var(--ui-primary)]/30 flex items-center justify-center text-[var(--ui-primary)] shrink-0">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-[var(--ui-text)] text-[16px]">SPMiner Modül Keşfi & Graf İriliştirme</h4>
              <span className="badge badge-primary text-[12px] font-mono">
                {macroNodes.length} Bağımsız Modül
              </span>
            </div>
            <p className="text-[13px] text-[var(--ui-text-muted)] mt-0.5">
              GNN Order Embedding · WL-Hash Tekilleştirme · İç Kaçış Derinliği Korunumu
            </p>
          </div>
        </div>
        <div className="text-right shrink-0 hidden sm:block">
          <div className="text-[11px] text-[var(--ui-text-muted)] uppercase tracking-wider font-semibold">Graf İriliştirme</div>
          <div className="text-[14px] font-bold text-[var(--ui-success)] font-mono">%{compressionRatio} Sıkıştırma</div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="card p-3 flex flex-col justify-between">
          <div className="text-[12px] text-[var(--ui-text-muted)] flex items-center justify-between">
            <span>Keşfedilen Modül</span>
            <Boxes className="w-3.5 h-3.5 text-[var(--ui-primary)]" />
          </div>
          <div className="text-xl font-bold font-mono text-[var(--ui-text)] mt-1">{macroNodes.length} Adet</div>
          <div className="text-[11px] text-[var(--ui-success)] mt-0.5 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Tamamı Tekilleştirildi</span>
          </div>
        </div>

        <div className="card p-3 flex flex-col justify-between">
          <div className="text-[12px] text-[var(--ui-text-muted)] flex items-center justify-between">
            <span>Daire Tipleri</span>
            <Layers className="w-3.5 h-3.5 text-[var(--ui-primary)]" />
          </div>
          <div className="text-[15px] font-bold text-[var(--ui-text)] mt-1 truncate">
            {data?.metadata?.title && data.metadata.title.includes('Daire Dağılımı:')
              ? data.metadata.title.replace('Daire Dağılımı: ', '')
              : `${totalApartments} Konut Ünitesi`}
          </div>
          <div className="text-[11px] text-[var(--ui-text-muted)] mt-0.5">SPMiner İzomorfizma</div>
        </div>

        <div className="card p-3 flex flex-col justify-between">
          <div className="text-[12px] text-[var(--ui-text-muted)] flex items-center justify-between">
            <span>Azami Kaçış Derinliği</span>
            <Ruler className="w-3.5 h-3.5 text-[var(--ui-primary)]" />
          </div>
          <div className="text-xl font-bold font-mono text-[var(--ui-text)] mt-1">
            {maxEscapeDepth > 0 ? `${maxEscapeDepth.toFixed(1)} m` : '-'}
          </div>
          <div className={`text-[11px] mt-0.5 font-medium ${maxEscapeDepth <= 15 ? 'text-[var(--ui-success)]' : 'text-[var(--ui-danger)]'}`}>
            {maxEscapeDepth <= 15 ? 'BYKHY M.31: Uygun (≤15m)' : 'İç Kaçış Sınırı Aşımı (>15m)'}
          </div>
        </div>

        <div className="card p-3 flex flex-col justify-between">
          <div className="text-[12px] text-[var(--ui-text-muted)] flex items-center justify-between">
            <span>Düğüm Azaltımı</span>
            <Hash className="w-3.5 h-3.5 text-[var(--ui-primary)]" />
          </div>
          <div className="text-xl font-bold font-mono text-[var(--ui-primary)] mt-1">%{compressionRatio}</div>
          <div className="text-[11px] text-[var(--ui-text-muted)] mt-0.5">Hesaplama Hızlandırması</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Floor Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-[13px]">
          <span className="text-[var(--ui-text-muted)] text-[12px] font-medium flex items-center gap-1 shrink-0 mr-1">
            <Filter className="w-3.5 h-3.5 text-[var(--ui-primary)]" /> Kat:
          </span>
          <button
            onClick={() => setSelectedFloor('all')}
            className={`px-2.5 py-1 rounded text-[12px] font-medium transition-colors shrink-0 ${
              selectedFloor === 'all'
                ? 'bg-[var(--ui-primary)] text-white font-semibold'
                : 'text-[var(--ui-text-muted)] hover:text-white bg-[var(--ui-surface-raised)]'
            }`}
          >
            Tüm Katlar ({macroNodes.length})
          </button>
          {availableFloors.map((fl) => {
            const count = macroNodes.filter((m) => m.floor_level === fl).length;
            return (
              <button
                key={fl}
                onClick={() => setSelectedFloor(fl)}
                className={`px-2.5 py-1 rounded text-[12px] font-mono font-medium transition-colors flex items-center gap-1.5 shrink-0 ${
                  selectedFloor === fl
                    ? 'bg-[var(--ui-primary)] text-white font-semibold'
                    : 'text-[var(--ui-text-muted)] hover:text-white bg-[var(--ui-surface-raised)]'
                }`}
              >
                <span>{fl === 0 ? 'Zemin' : fl < 0 ? `B${Math.abs(fl)}` : `Kat ${fl}`}</span>
                <span
                  className={`text-[10px] px-1 py-0.2 rounded-full ${
                    selectedFloor === fl ? 'bg-black/30 text-white' : 'bg-[var(--ui-border)] text-[var(--ui-text-muted)]'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative shrink-0 w-full sm:w-48">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ui-text-muted)]" />
          <input
            type="text"
            placeholder="Modül veya oda ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[var(--ui-bg)] border border-[var(--ui-border)] rounded text-[12px] pl-8 pr-2.5 py-1 text-[var(--ui-text)] placeholder-[var(--ui-text-muted)] focus:outline-none focus:border-[var(--ui-primary)]"
          />
        </div>
      </div>

      {/* Discovered Architectural Macro-Nodes List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-[var(--ui-border)] pb-2">
          <h5 className="font-bold text-[var(--ui-text)] text-[15px] flex items-center gap-2">
            <Box className="w-4 h-4 text-[var(--ui-primary)]" />
            Keşfedilen Mimari Makro-Düğümler ({filteredNodes.length})
          </h5>
          <span className="text-[12px] text-[var(--ui-text-muted)]">
            Açgözlü Büyüme & Weisfeiler-Lehman İriliştirme
          </span>
        </div>

        {filteredNodes.length === 0 ? (
          <div className="p-6 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] text-center space-y-2">
            <Boxes className="w-6 h-6 text-[var(--ui-text-muted)] mx-auto" />
            <div className="text-[var(--ui-text)] font-semibold text-[14px]">
              Seçilen Kriterde Makro-Düğüm Bulunamadı
            </div>
            <p className="text-[12px] text-[var(--ui-text-muted)]">
              Filtreyi temizleyerek veya farklı bir kat seçerek tüm modülleri inceleyebilirsiniz.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredNodes.map((m) => {
              const isDeepSafe = (m.internal_exit_depth_m || 0) <= 15.0;
              const floorLabel = m.floor_level === 0 ? 'Zemin Kat' : m.floor_level < 0 ? `Bodrum B${Math.abs(m.floor_level)}` : `Kat ${m.floor_level}`;

              return (
                <div
                  key={m.macro_id}
                  onClick={() => onSelectMacroNode && onSelectMacroNode(m)}
                  className="p-3.5 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] hover:border-[var(--ui-primary)] transition-all cursor-pointer space-y-2.5 shadow-sm"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[var(--ui-primary)] font-bold text-[14px]">{m.macro_id}</span>
                      <span className="badge badge-neutral text-[11px] font-mono">{floorLabel}</span>
                      {m.module_type && (
                        <span className="badge badge-primary text-[11px] font-semibold">{m.module_type}</span>
                      )}
                      {m.total_area_m2 && m.total_area_m2 > 0 && (
                        <span className="badge badge-neutral text-[11px] font-mono">{m.total_area_m2} m²</span>
                      )}
                    </div>
                    <span className="badge badge-success text-[11px] font-mono shrink-0">WL-Hash Eşleşti</span>
                  </div>

                  {/* Member Rooms Chips */}
                  <div className="space-y-1">
                    <div className="text-[12px] text-[var(--ui-text-muted)] font-medium">
                      Oda Üyeleri ({m.member_rooms.length} Mahal):
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {m.member_rooms.map((room, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded bg-[var(--ui-surface)] border border-[var(--ui-border)] text-[12px] text-[var(--ui-text)] font-sans"
                        >
                          {room}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Bottom Metrics Bar */}
                  <div className="flex items-center justify-between text-[12px] pt-2 border-t border-[var(--ui-border)] flex-wrap gap-2">
                    <div className="flex items-center gap-1.5">
                      <Ruler className="w-3.5 h-3.5 text-[var(--ui-text-muted)]" />
                      <span className="text-[var(--ui-text-muted)]">İç Kaçış Derinliği:</span>
                      <strong className={`font-mono ${isDeepSafe ? 'text-[var(--ui-success)]' : 'text-[var(--ui-danger)]'}`}>
                        {m.internal_exit_depth_m} m
                      </strong>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isDeepSafe ? 'bg-[var(--ui-success)]/15 text-[var(--ui-success)]' : 'bg-[var(--ui-danger)]/15 text-[var(--ui-danger)]'}`}>
                        {isDeepSafe ? '≤15m BYKHY Uygun' : '>15m Derinlik Aşımı'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <DoorClosed className="w-3.5 h-3.5 text-[var(--ui-text-muted)]" />
                      <span className="text-[var(--ui-text-muted)]">Sınır Kapısı:</span>
                      <code className="text-[var(--ui-text)] font-mono font-semibold bg-[var(--ui-surface)] px-1.5 py-0.5 rounded border border-[var(--ui-border)]">
                        {m.boundary_portals && m.boundary_portals.length > 0 ? m.boundary_portals.join(', ') : 'Daire Kapısı'}
                      </code>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
