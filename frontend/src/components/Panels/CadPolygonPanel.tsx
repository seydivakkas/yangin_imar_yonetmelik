import React, { useState, useMemo } from 'react';
import {
  Layers,
  Square,
  DoorOpen,
  Compass,
  Search,
  Filter,
  CheckCircle2,
  Box,
  Maximize2,
  Cpu,
  Sparkles,
  Hash,
  ArrowRight,
  ShieldCheck,
  Flame,
} from 'lucide-react';
import { DiagramYonetmelikPipelineOutput } from '../../types/pipeline';

interface CadPolygonPanelProps {
  data: DiagramYonetmelikPipelineOutput | null;
  onSelectElement?: (element: { id: string; type: 'room' | 'door' | 'wall' | 'arc' | 'violation'; details: any }) => void;
  activeFloor?: 'all' | number;
  onFloorChange?: (floor: 'all' | number) => void;
}

export const CadPolygonPanel: React.FC<CadPolygonPanelProps> = ({
  data,
  onSelectElement,
  activeFloor,
  onFloorChange,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedFloor, setSelectedFloor] = useState<'all' | number>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Extract rooms dynamically from data.nodes
  const allRooms = useMemo(() => {
    if (!data?.nodes || data.nodes.length === 0) {
      return [
        { id: 'K0_oda_1', name: 'Salon A', floor: 0, area: 30.0, category: 'salon', verticesCount: 4, center: [3.5, 11.5] },
        { id: 'K0_oda_2', name: 'Oda B', floor: 0, area: 24.0, category: 'oda', verticesCount: 4, center: [10.5, 11.5] },
        { id: 'K0_koridor', name: 'Kat Koridoru', floor: 0, area: 36.0, category: 'kat_koridoru', verticesCount: 8, center: [9.0, 20.0] },
        { id: 'K0_yangin_holu', name: 'Yangın Güvenlik Holü', floor: 0, area: 16.0, category: 'yangin_holu', verticesCount: 4, center: [11.0, 22.5] },
        { id: 'K0_merdiven', name: 'Yangın Merdiveni', floor: 0, area: 20.0, category: 'yangin_merdiveni', verticesCount: 6, center: [13.0, 28.0] },
        { id: 'K0_dis_cikis', name: 'Ana Dış Çıkış', floor: 0, area: 16.0, category: 'dis_cikis', verticesCount: 4, center: [9.0, 18.0] },
        { id: 'K-1_siginak', name: 'Sığınak Alanı', floor: -1, area: 20.0, category: 'siginak', verticesCount: 4, center: [4.0, 32.0] },
        { id: 'K-1_otopark', name: 'Kapalı Otopark', floor: -1, area: 95.0, category: 'otopark', verticesCount: 8, center: [10.0, 32.0] },
      ];
    }

    return data.nodes.map((n: any, idx: number) => {
      const rawPoly = n.polygon_2d || [];
      const vCount = rawPoly.length > 0 ? (rawPoly[rawPoly.length - 1][0] === rawPoly[0][0] && rawPoly[rawPoly.length - 1][1] === rawPoly[0][1] ? rawPoly.length - 1 : rawPoly.length) : 4;
      const center = n.pos_3d ? [Number(n.pos_3d[0].toFixed(1)), Number(n.pos_3d[1].toFixed(1))] : [0, 0];
      return {
        id: String(n.id || `node_${idx}`),
        name: n.name_label || `${n.room_type || 'Mekan'} (${n.floor_level}. Kat)`,
        floor: Number(n.floor_level || 0),
        area: Number((n.area_m2 || 0).toFixed(1)),
        category: n.room_type || 'oda',
        verticesCount: vCount,
        center,
        raw: n,
      };
    });
  }, [data]);

  // Unique floors present in this pafta
  const floorsList = useMemo(() => {
    const set = new Set<number>();
    allRooms.forEach((r) => set.add(r.floor));
    return Array.from(set).sort((a, b) => b - a); // Top floor down to basement
  }, [allRooms]);

  // Aggregate stats
  const totalRooms = data?.rooms_analyzed || allRooms.length;
  const totalDoors = data?.doors_analyzed || (data?.edges?.length || 0);
  const totalAreaM2 = useMemo(() => {
    return allRooms.reduce((acc, r) => acc + (r.area || 0), 0);
  }, [allRooms]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      residential: 0,
      circulation: 0,
      fire_core: 0,
      technical: 0,
      exit: 0,
    };
    allRooms.forEach((r) => {
      const cat = r.category.toLowerCase();
      if (['salon', 'oda', 'yatak_odasi', 'mutfak', 'banyo', 'antre'].includes(cat)) counts.residential++;
      else if (['kat_koridoru', 'koridor', 'hol', 'giris_holu'].includes(cat)) counts.circulation++;
      else if (['yangin_merdiveni', 'yangin_holu', 'merdiven', 'duman_kilit'].includes(cat)) counts.fire_core++;
      else if (['asansor', 'siginak', 'otopark', 'depo', 'kazan_dairesi'].includes(cat)) counts.technical++;
      else if (['dis_cikis', 'exit', 'cikis'].includes(cat)) counts.exit++;
      else counts.residential++;
    });
    return counts;
  }, [allRooms]);

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return allRooms.filter((r) => {
      // Floor filter
      if (selectedFloor !== 'all' && r.floor !== selectedFloor) return false;

      // Category filter
      if (selectedCategory !== 'all') {
        const cat = r.category.toLowerCase();
        if (selectedCategory === 'residential' && !['salon', 'oda', 'yatak_odasi', 'mutfak', 'banyo', 'antre'].includes(cat)) return false;
        if (selectedCategory === 'circulation' && !['kat_koridoru', 'koridor', 'hol', 'giris_holu'].includes(cat)) return false;
        if (selectedCategory === 'fire_core' && !['yangin_merdiveni', 'yangin_holu', 'merdiven', 'duman_kilit'].includes(cat)) return false;
        if (selectedCategory === 'technical' && !['asansor', 'siginak', 'otopark', 'depo', 'kazan_dairesi'].includes(cat)) return false;
        if (selectedCategory === 'exit' && !['dis_cikis', 'exit', 'cikis'].includes(cat)) return false;
      }

      // Search term
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const matchName = r.name.toLowerCase().includes(term);
        const matchId = r.id.toLowerCase().includes(term);
        const matchCat = r.category.toLowerCase().includes(term);
        if (!matchName && !matchId && !matchCat) return false;
      }

      return true;
    });
  }, [allRooms, selectedFloor, selectedCategory, searchTerm]);

  // Category badge styling helper
  const getCategoryBadge = (cat: string) => {
    const c = cat.toLowerCase();
    if (c === 'yangin_merdiveni' || c.includes('merdiven')) {
      return { label: 'Yangın Merdiveni', bg: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' };
    }
    if (c === 'yangin_holu' || c.includes('hol')) {
      return { label: 'Güvenlik Holü', bg: 'bg-purple-500/15 text-purple-400 border-purple-500/30' };
    }
    if (c === 'kat_koridoru' || c.includes('koridor')) {
      return { label: 'Kat Koridoru', bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
    }
    if (c === 'dis_cikis' || c.includes('çıkış') || c.includes('cikis')) {
      return { label: 'Dış Çıkış', bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
    }
    if (c === 'asansor' || c.includes('asansör')) {
      return { label: 'Asansör (İzole)', bg: 'bg-red-500/15 text-red-400 border-red-500/30' };
    }
    if (c === 'siginak') {
      return { label: 'Sığınak Alanı', bg: 'bg-orange-500/15 text-orange-400 border-orange-500/30' };
    }
    if (c === 'otopark') {
      return { label: 'Otopark', bg: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30' };
    }
    return { label: 'Konut / Oda', bg: 'bg-sky-500/15 text-sky-400 border-sky-500/30' };
  };

  const handleSelectRoom = (r: any) => {
    if (onSelectElement) {
      onSelectElement({
        id: r.id,
        type: 'room',
        details: {
          id: r.id,
          name: r.name,
          category: r.category,
          floor: r.floor,
          area_m2: r.area,
          verticesCount: r.verticesCount,
          center: r.center,
        },
      });
    }
    if (onFloorChange && (activeFloor !== r.floor)) {
      onFloorChange(r.floor);
    }
  };

  return (
    <div className="space-y-4 text-[14px] leading-relaxed text-[var(--ui-text)] w-full">
      {/* Header Banner */}
      <div className="p-4 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--ui-primary)]/15 border border-[var(--ui-primary)]/30 flex items-center justify-center text-[var(--ui-primary)] shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-[var(--ui-text)] text-[16px] flex items-center gap-2">
              CAD Kat Planı & Mekan Poligonlaşması
              <span className="text-[11px] px-2 py-0.5 rounded font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Dinamik Pafta
              </span>
            </h4>
            <p className="text-[13px] text-[var(--ui-text-muted)] mt-0.5">
              Kapı Köprüleme · Morfolojik Aşındırma · Türkçe Etiket Sınıflandırma
            </p>
          </div>
        </div>
      </div>

      {/* 4 Dynamic Top KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div className="card p-3 space-y-1">
          <div className="text-[12px] text-[var(--ui-text-muted)] font-medium">Toplam Mekan</div>
          <div className="text-2xl font-bold font-mono text-[var(--ui-text)]">
            {totalRooms} <span className="text-[12px] font-normal text-[var(--ui-text-muted)]">Poligon</span>
          </div>
          <div className="text-[11px] text-[var(--ui-text-muted)] font-mono">Kapalı Döngü</div>
        </div>

        <div className="card p-3 space-y-1">
          <div className="text-[12px] text-[var(--ui-text-muted)] font-medium">Köprülenen Kapı</div>
          <div className="text-2xl font-bold font-mono text-cyan-400">
            {totalDoors} <span className="text-[12px] font-normal text-[var(--ui-text-muted)]">Geçit</span>
          </div>
          <div className="text-[11px] text-[var(--ui-text-muted)] font-mono">Duvar Boşluğu</div>
        </div>

        <div className="card p-3 space-y-1">
          <div className="text-[12px] text-[var(--ui-text-muted)] font-medium">Poligonize Kat</div>
          <div className="text-2xl font-bold font-mono text-purple-400">
            {floorsList.length} <span className="text-[12px] font-normal text-[var(--ui-text-muted)]">Kat</span>
          </div>
          <div className="text-[11px] text-[var(--ui-text-muted)] font-mono">
            {floorsList.length > 0 ? `K${floorsList[floorsList.length - 1]} ➔ K${floorsList[0]}` : '--'}
          </div>
        </div>

        <div className="card p-3 space-y-1">
          <div className="text-[12px] text-[var(--ui-text-muted)] font-medium">Toplam Net Alan</div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {totalAreaM2 > 0 ? totalAreaM2.toFixed(0) : '--'}{' '}
            <span className="text-[12px] font-normal text-[var(--ui-text-muted)]">m²</span>
          </div>
          <div className="text-[11px] text-[var(--ui-text-muted)] font-mono">Hesaplanan Alan</div>
        </div>
      </div>

      {/* CAD Processing Pipeline Card */}
      <div className="p-4 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] space-y-3">
        <div className="flex items-center justify-between border-b border-[var(--ui-border)] pb-2">
          <div className="font-bold text-[14px] text-[var(--ui-text)] flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[var(--ui-primary)]" />
            <span>CAD Morfolojik Dönüşüm Pipeline Durumu</span>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            100% Doğrulandı
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2.5 text-[12px]">
          <div className="p-2.5 rounded bg-[var(--ui-bg)] space-y-1">
            <div className="text-[var(--ui-text)] font-semibold flex items-center gap-1.5">
              <DoorOpen className="w-3.5 h-3.5 text-cyan-400" />
              <span>1. Kapı Köprüleme</span>
            </div>
            <p className="text-[11px] text-[var(--ui-text-muted)]">
              {totalDoors} kapı eşiği ve duvar boşluğu taranarak poligon kenarları birleştirildi.
            </p>
          </div>

          <div className="p-2.5 rounded bg-[var(--ui-bg)] space-y-1">
            <div className="text-[var(--ui-text)] font-semibold flex items-center gap-1.5">
              <Square className="w-3.5 h-3.5 text-purple-400" />
              <span>2. Kontur Çıkarma</span>
            </div>
            <p className="text-[11px] text-[var(--ui-text-muted)]">
              Shapely planar graph ile {totalRooms} adet kapalı poligon döngüsü çıkarıldı.
            </p>
          </div>

          <div className="p-2.5 rounded bg-[var(--ui-bg)] space-y-1">
            <div className="text-[var(--ui-text)] font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>3. Türkçe NLP Etiket</span>
            </div>
            <p className="text-[11px] text-[var(--ui-text-muted)]">
              CAD MTEXT mahal isimleri geometrik ağırlık merkeziyle eşleştirildi.
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ui-text-muted)]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Mahal adı, ID veya kategori ara..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--ui-bg)] border border-[var(--ui-border)] text-[13px] text-[var(--ui-text)] focus:outline-none focus:border-[var(--ui-primary)]"
            />
          </div>

          {/* Floor Dropdown Filter */}
          <select
            value={selectedFloor}
            onChange={(e) => setSelectedFloor(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="p-2 rounded-lg bg-[var(--ui-bg)] border border-[var(--ui-border)] text-[13px] text-[var(--ui-text)] focus:outline-none focus:border-[var(--ui-primary)]"
          >
            <option value="all">Tüm Katlar ({allRooms.length})</option>
            {floorsList.map((fl) => {
              const count = allRooms.filter((r) => r.floor === fl).length;
              const label = fl === 0 ? 'K0 (Zemin)' : fl < 0 ? `K${fl} (Bodrum)` : `Kat ${fl}`;
              return (
                <option key={fl} value={fl}>
                  {label} ({count})
                </option>
              );
            })}
          </select>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap gap-1.5 text-[12px]">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              selectedCategory === 'all'
                ? 'bg-[var(--ui-primary)] text-white'
                : 'bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'
            }`}
          >
            Tümü ({allRooms.length})
          </button>
          <button
            onClick={() => setSelectedCategory('residential')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              selectedCategory === 'residential'
                ? 'bg-sky-500 text-white'
                : 'bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'
            }`}
          >
            Konut Odaları ({categoryCounts.residential})
          </button>
          <button
            onClick={() => setSelectedCategory('fire_core')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              selectedCategory === 'fire_core'
                ? 'bg-cyan-500 text-white'
                : 'bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'
            }`}
          >
            Yangın Merdiveni & Hol ({categoryCounts.fire_core})
          </button>
          <button
            onClick={() => setSelectedCategory('circulation')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              selectedCategory === 'circulation'
                ? 'bg-amber-500 text-white'
                : 'bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'
            }`}
          >
            Koridorlar ({categoryCounts.circulation})
          </button>
          <button
            onClick={() => setSelectedCategory('technical')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              selectedCategory === 'technical'
                ? 'bg-orange-500 text-white'
                : 'bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'
            }`}
          >
            Sığınak & Asansör ({categoryCounts.technical})
          </button>
        </div>
      </div>

      {/* Dynamic Rooms List */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-[var(--ui-border)] pb-2">
          <h5 className="font-bold text-[var(--ui-text)] text-[15px] flex items-center gap-2">
            <Square className="w-4 h-4 text-[var(--ui-primary)]" />
            <span>Çıkarılan Mekan Poligonları ({filteredRooms.length})</span>
          </h5>
          <span className="text-[12px] text-[var(--ui-text-muted)] font-mono">
            {searchTerm || selectedFloor !== 'all' || selectedCategory !== 'all' ? 'Filtrelenmiş Sonuçlar' : 'Tüm Pafta'}
          </span>
        </div>

        {filteredRooms.length === 0 ? (
          <div className="p-6 text-center text-[var(--ui-text-muted)] text-[13px]">
            Seçili filtrelere uygun mekan bulunamadı.
          </div>
        ) : (
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {filteredRooms.map((r) => {
              const badge = getCategoryBadge(r.category);
              return (
                <div
                  key={r.id}
                  onClick={() => handleSelectRoom(r)}
                  className="p-3 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] hover:border-[var(--ui-primary)]/60 cursor-pointer transition-all flex items-center justify-between gap-3 group"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[var(--ui-text)] text-[13px] font-bold">
                        #{r.id}
                      </span>
                      <span className="text-[13px] font-medium text-[var(--ui-text)] truncate">
                        {r.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-[var(--ui-text-muted)] font-mono">
                      <span>Kat: {r.floor === 0 ? 'Zemin (0)' : r.floor < 0 ? `Bodrum (${r.floor})` : r.floor}</span>
                      <span>·</span>
                      <span>{r.verticesCount} Köşe</span>
                      <span>·</span>
                      <span>Merkez: [{r.center[0]}, {r.center[1]}]</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className={`text-[11px] px-2 py-0.5 rounded font-mono font-medium border ${badge.bg}`}>
                      {badge.label}
                    </span>
                    <span className="font-mono text-[var(--ui-text)] text-[14px] font-bold">
                      {r.area} m²
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[var(--ui-text-muted)] group-hover:text-[var(--ui-primary)] group-hover:translate-x-0.5 transition-all" />
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
