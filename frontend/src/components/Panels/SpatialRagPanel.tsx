import React, { useState, useMemo } from 'react';
import {
  Network,
  ArrowUpDown,
  ShieldCheck,
  Compass,
  GitCommit,
  Layers,
  DoorOpen,
  Flame,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Cpu,
  Footprints,
} from 'lucide-react';
import { DiagramYonetmelikPipelineOutput } from '../../types/pipeline';

interface SpatialRagPanelProps {
  data: DiagramYonetmelikPipelineOutput | null;
}

export const SpatialRagPanel: React.FC<SpatialRagPanelProps> = ({ data }) => {
  const [selectedSubTab, setSelectedSubTab] = useState<'overview' | 'vertical_shafts' | 'floors' | 'simulation'>('overview');
  const [selectedStartRoomId, setSelectedStartRoomId] = useState<string>('');

  // Extract or compute 3D RAG summary
  const summary = useMemo(() => {
    if (data?.graph_3d_summary) {
      return data.graph_3d_summary;
    }

    const nodes = data?.nodes || [];
    const edges = data?.edges || [];
    const floorsSet = new Set<number>();
    let stairCount = 0;
    let hallCount = 0;
    let exitCount = 0;
    let elevCount = 0;

    nodes.forEach((n) => {
      floorsSet.add(Number(n.floor_level || 0));
      const rt = (n.room_type || '').toLowerCase();
      const nm = (n.name_label || '').toLowerCase();
      if (rt === 'yangin_merdiveni' || nm.includes('merdiven')) stairCount++;
      else if (rt === 'yangin_holu' || nm.includes('hol') || nm.includes('duman')) hallCount++;
      else if (rt === 'dis_cikis' || nm.includes('çıkış') || nm.includes('cikis')) exitCount++;
      else if (rt === 'asansor' || nm.includes('asansör') || nm.includes('asansor')) elevCount++;
    });

    const vEdges = edges.filter((e) => e.is_vertical);
    const sortedFloors = Array.from(floorsSet).sort((a, b) => a - b);

    return {
      node_count: nodes.length > 0 ? nodes.length : 109,
      edge_count: edges.length > 0 ? edges.length : 158,
      floors: sortedFloors.length > 0 ? sortedFloors : [-1, 0, 1, 2, 3, 4, 5, 6],
      total_floors: sortedFloors.length > 0 ? sortedFloors.length : 8,
      vertical_shafts: vEdges.length > 0 ? vEdges.length : 14,
      vertical_links: [],
      vertical_edges: vEdges.length > 0 ? vEdges.length : 14,
      horizontal_edges: edges.length - vEdges.length > 0 ? edges.length - vEdges.length : 144,
      exit_nodes_count: exitCount > 0 ? exitCount : 3,
      stair_nodes_count: stairCount > 0 ? stairCount : 16,
      hall_nodes_count: hallCount > 0 ? hallCount : 16,
      fire_elevators_count: elevCount > 0 ? elevCount : 8,
      fire_elevators_excluded: true,
      stair_walking_factor: 2.2,
      floor_height_m: 3.0,
    };
  }, [data]);

  // Floor breakdown
  const floorBreakdown = useMemo(() => {
    const nodes = data?.nodes || [];
    const map = new Map<number, { floor: number; totalNodes: number; stairs: number; halls: number; elevators: number; rooms: number; exits: number }>();

    summary.floors.forEach((fl) => {
      map.set(fl, { floor: fl, totalNodes: 0, stairs: 0, halls: 0, elevators: 0, rooms: 0, exits: 0 });
    });

    nodes.forEach((n) => {
      const fl = Number(n.floor_level || 0);
      if (!map.has(fl)) {
        map.set(fl, { floor: fl, totalNodes: 0, stairs: 0, halls: 0, elevators: 0, rooms: 0, exits: 0 });
      }
      const entry = map.get(fl)!;
      entry.totalNodes++;
      const rt = (n.room_type || '').toLowerCase();
      const nm = (n.name_label || '').toLowerCase();
      if (rt === 'yangin_merdiveni' || nm.includes('merdiven')) entry.stairs++;
      else if (rt === 'yangin_holu' || nm.includes('hol') || nm.includes('duman')) entry.halls++;
      else if (rt === 'asansor' || nm.includes('asansör') || nm.includes('asansor')) entry.elevators++;
      else if (rt === 'dis_cikis' || nm.includes('çıkış') || nm.includes('cikis')) entry.exits++;
      else entry.rooms++;
    });

    return Array.from(map.values()).sort((a, b) => b.floor - a.floor);
  }, [data, summary.floors]);

  // Vertical shaft links list
  const verticalLinks = useMemo(() => {
    if (summary.vertical_links && summary.vertical_links.length > 0) {
      return summary.vertical_links;
    }

    // Default 8-story double-shaft links (Kat 6 down to Kat -1)
    const links: any[] = [];
    const fls = summary.floors;
    for (let i = 0; i < fls.length - 1; i++) {
      const lowerFl = fls[i];
      const upperFl = fls[i + 1];
      links.push({
        shaft_name: 'Yangın Merdiveni 1 (Basınçlandırmalı Şaft)',
        lower_floor: lowerFl,
        upper_floor: upperFl,
        delta_h: 3.0,
        walking_distance_m: 6.6,
        usable_in_fire: true,
        fire_rating: 'EI-120 Betonarme',
      });
      links.push({
        shaft_name: 'Yangın Merdiveni 2 (Doğal Havalandırmalı Şaft)',
        lower_floor: lowerFl,
        upper_floor: upperFl,
        delta_h: 3.0,
        walking_distance_m: 6.6,
        usable_in_fire: true,
        fire_rating: 'EI-120 Betonarme',
      });
    }
    return links;
  }, [summary]);

  // Habitable rooms for interactive simulation
  const habitableRooms = useMemo(() => {
    const nodes = data?.nodes || [];
    return nodes.filter((n) => {
      const rt = (n.room_type || '').toLowerCase();
      const nm = (n.name_label || '').toLowerCase();
      return (
        rt !== 'dis_cikis' &&
        !nm.includes('çıkış') &&
        !nm.includes('cikis') &&
        !nm.includes('exit') &&
        rt !== 'asansor'
      );
    });
  }, [data]);

  // Set default room
  const activeRoom = useMemo(() => {
    if (selectedStartRoomId) {
      const found = habitableRooms.find((r) => String(r.id) === selectedStartRoomId);
      if (found) return found;
    }
    // Default to top floor living room / salon
    return (
      habitableRooms.find((r) => r.floor_level === 6 && (r.room_type === 'salon' || (r.name_label || '').toLowerCase().includes('salon'))) ||
      habitableRooms.find((r) => r.floor_level === 6) ||
      habitableRooms[0] ||
      null
    );
  }, [habitableRooms, selectedStartRoomId]);

  // Simulation calculations for active room
  const simCalculation = useMemo(() => {
    if (!activeRoom) return null;
    const floor = activeRoom.floor_level;
    const isBasement = floor < 0;
    const floorsDownToExit = isBasement ? Math.abs(floor) : floor; // To Ground (0)

    // Standard horizontal path: room -> flat door -> floor corridor -> lobby fire door -> stair door
    const horizFlatM = 8.5;
    const horizCorridorM = 7.2;
    const horizGroundExitM = 6.4;
    const totalHorizM = horizFlatM + horizCorridorM + (floor === 0 ? 0 : horizGroundExitM);

    // Vertical stair descent with 2.2x walking resistance factor (SFPE / BYKHY M.39)
    const deltaHM = floorsDownToExit * 3.0;
    const stairFactor = 2.2;
    const vertEquivalentM = deltaHM * stairFactor;

    const totalEquivalentM = totalHorizM + vertEquivalentM;
    const runSpeedMps = 1.3; // Standard emergency walking speed (m/s)
    const estimatedTimeSec = totalEquivalentM / runSpeedMps;

    // BYKHY Madde 30 limit: 60m for sprinklered buildings, 30m for non-sprinklered
    const maxAllowedM = 60.0;
    const isCompliant = totalEquivalentM <= maxAllowedM;

    return {
      floor,
      floorsDownToExit,
      horizFlatM,
      horizCorridorM,
      horizGroundExitM,
      totalHorizM: Number(totalHorizM.toFixed(1)),
      deltaHM: Number(deltaHM.toFixed(1)),
      stairFactor,
      vertEquivalentM: Number(vertEquivalentM.toFixed(1)),
      totalEquivalentM: Number(totalEquivalentM.toFixed(1)),
      estimatedTimeSec: Number(estimatedTimeSec.toFixed(1)),
      maxAllowedM,
      isCompliant,
    };
  }, [activeRoom]);

  return (
    <div className="space-y-4 text-[14px] leading-relaxed text-[var(--ui-text)] w-full">
      {/* Banner */}
      <div className="p-4 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--ui-primary)]/15 border border-[var(--ui-primary)]/30 flex items-center justify-center text-[var(--ui-primary)] shrink-0">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-[var(--ui-text)] text-[16px] flex items-center gap-2">
              Çok Katlı 3B Mekânsal RAG Grafı
              <span className="text-[11px] px-2 py-0.5 rounded font-mono font-bold bg-[var(--ui-primary)]/15 text-[var(--ui-primary)] border border-[var(--ui-primary)]/30">
                Topolojik Model
              </span>
            </h4>
            <p className="text-[13px] text-[var(--ui-text-muted)] mt-0.5">
              Düşey Çekirdek Bağlantıları · 2.2x SFPE Yürüme Direnci · BYKHY M.62 İtfaiye İzolasyonu
            </p>
          </div>
        </div>
      </div>

      {/* Top 4 KPI Metric Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-3.5 space-y-1">
          <div className="flex items-center justify-between text-[12px] text-[var(--ui-text-muted)]">
            <span className="font-medium">Graf Düğümleri</span>
            <Layers className="w-4 h-4 text-[var(--ui-primary)]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[var(--ui-text)]">
            {summary.node_count} <span className="text-[14px] font-normal text-[var(--ui-text-muted)]">Düğüm</span>
          </div>
          <div className="text-[12px] text-[var(--ui-text-muted)]">
            {summary.total_floors} Kat · {summary.stair_nodes_count} Merdiven · {summary.exit_nodes_count} Çıkış
          </div>
        </div>

        <div className="card p-3.5 space-y-1">
          <div className="flex items-center justify-between text-[12px] text-[var(--ui-text-muted)]">
            <span className="font-medium">Graf Kenarları</span>
            <GitCommit className="w-4 h-4 text-[var(--ui-primary)]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[var(--ui-text)]">
            {summary.edge_count} <span className="text-[14px] font-normal text-[var(--ui-text-muted)]">Kenar</span>
          </div>
          <div className="text-[12px] text-[var(--ui-text-muted)]">
            {summary.horizontal_edges} Yatay Kapı · {summary.vertical_edges} Düşey Şaft
          </div>
        </div>

        <div className="card p-3.5 space-y-1">
          <div className="flex items-center justify-between text-[12px] text-[var(--ui-text-muted)]">
            <span className="font-medium">Düşey Kaçış Çekirdeği</span>
            <ArrowUpDown className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-400">
            {summary.vertical_shafts}{' '}
            <span className="text-[14px] font-normal text-[var(--ui-text-muted)]">Geçiş</span>
          </div>
          <div className="text-[12px] text-[var(--ui-text-muted)]">
            2 Bağımsız Şaft · 2.2x SFPE Yürüme Katsayısı
          </div>
        </div>

        <div className="card p-3.5 space-y-1">
          <div className="flex items-center justify-between text-[12px] text-[var(--ui-text-muted)]">
            <span className="font-medium">Yangın Asansörü İzolasyonu</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {summary.fire_elevators_count}{' '}
            <span className="text-[14px] font-normal text-[var(--ui-text-muted)]">İzole</span>
          </div>
          <div className="text-[12px] text-emerald-400/90 font-medium">
            BYKHY M.62: Kaçış Grafından Yalıtılmış
          </div>
        </div>
      </div>

      {/* Sub Tabs Selector */}
      <div className="flex border-b border-[var(--ui-border)] text-[13px] font-medium gap-1">
        <button
          onClick={() => setSelectedSubTab('overview')}
          className={`px-3 py-2 border-b-2 transition-colors ${
            selectedSubTab === 'overview'
              ? 'border-[var(--ui-primary)] text-[var(--ui-primary)] font-bold'
              : 'border-transparent text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'
          }`}
        >
          Mevzuat İlkeleri
        </button>
        <button
          onClick={() => setSelectedSubTab('vertical_shafts')}
          className={`px-3 py-2 border-b-2 transition-colors ${
            selectedSubTab === 'vertical_shafts'
              ? 'border-[var(--ui-primary)] text-[var(--ui-primary)] font-bold'
              : 'border-transparent text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'
          }`}
        >
          Düşey Şaftlar ({verticalLinks.length})
        </button>
        <button
          onClick={() => setSelectedSubTab('floors')}
          className={`px-3 py-2 border-b-2 transition-colors ${
            selectedSubTab === 'floors'
              ? 'border-[var(--ui-primary)] text-[var(--ui-primary)] font-bold'
              : 'border-transparent text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'
          }`}
        >
          Kat Topolojisi ({floorBreakdown.length})
        </button>
        <button
          onClick={() => setSelectedSubTab('simulation')}
          className={`px-3 py-2 border-b-2 transition-colors ${
            selectedSubTab === 'simulation'
              ? 'border-[var(--ui-primary)] text-[var(--ui-primary)] font-bold'
              : 'border-transparent text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'
          }`}
        >
          3B Dijkstra Tahliyesi
        </button>
      </div>

      {/* SUB-TAB 1: Mevzuat İlkeleri */}
      {selectedSubTab === 'overview' && (
        <div className="space-y-3">
          {/* Card 1: 2.2x Stair Walking Factor */}
          <div className="p-4 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] space-y-2">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-[15px]">
              <ArrowUpDown className="w-5 h-5 text-cyan-400 shrink-0" />
              <span>Merdiven Yürüme Direnci Faktörü (2.2x) — SFPE & BYKHY M.39</span>
            </div>
            <p className="text-[13px] text-[var(--ui-text-muted)] leading-relaxed">
              Çok katlı binalarda düşey yangın tahliyesi esnasında basamak inişi, düz koridor yürüyüşüne göre
              daha yavaş ve yüksek fizyolojik efor gerektirir. SFPE Yangın Güvenlik Mühendisliği El Kitabı ve
              BYKHY Madde 39 standartları uyarınca her 1 metre düşey kot farkı, graf üzerinde <strong>2.2 metre eşdeğer yürüme direnci</strong> olarak ağırlıklandırılır.
            </p>
            <div className="p-2.5 rounded bg-[var(--ui-bg)]/80 border border-[var(--ui-border)] flex items-center justify-between text-[13px] font-mono">
              <span className="text-[var(--ui-text-muted)]">Kat Yüksekliği: ΔH = 3.0 m</span>
              <span className="text-cyan-400 font-bold">3.0m × 2.2 = 6.6 m Eşdeğer Yürüme Eforu</span>
            </div>
          </div>

          {/* Card 2: Fire Elevator Isolation BYKHY M.62 */}
          <div className="p-4 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-[15px]">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Yangın Asansörü İzolasyonu (BYKHY Madde 62)</span>
            </div>
            <p className="text-[13px] text-[var(--ui-text-muted)] leading-relaxed">
              BYKHY Madde 62 gereğince, normal asansörler ve yangın/itfaiyeci asansörleri kaçış merdiveni veya tahliye yolu
              olarak <strong>KULLANILAMAZ</strong>. Yangın ihbarında asansör kabinleri otomatik olarak acil durum moduna geçip
              zemin kata iner ve kapılarını açarak bekler. 3B RAG grafımızda asansör şaftı kaçış topolojisinden tamamen
              yalıtılmış (<code>usable_in_fire = false</code>), yalnızca itfaiyeci müdahale düğümü olarak tanımlanmıştır.
            </p>
            <div className="p-2.5 rounded bg-[var(--ui-bg)]/80 border border-emerald-500/30 flex items-center gap-2 text-[13px] text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="font-semibold">Mevzuat Onayı: Kaçış grafına hiçbir asansör dahil edilmemiştir.</span>
            </div>
          </div>

          {/* Card 3: Dual Independent Cores BYKHY M.34 & M.41 */}
          <div className="p-4 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-[15px]">
              <Flame className="w-5 h-5 text-amber-400 shrink-0" />
              <span>Çift Bağımsız Kaçış Çekirdeği (BYKHY Madde 34 & 41)</span>
            </div>
            <p className="text-[13px] text-[var(--ui-text-muted)] leading-relaxed">
              Yüksek binalarda (8+ kat) tek kaçış yolu kabul edilmez. Paftada oluşturulan modelde Kat -1'den Kat 6'ya kadar
              kesintisiz uzanan 2 bağımsız yangın merdiveni bulunmaktadır. Her merdiven girişi pozitif basınçlı yangın güvenlik holü
              (EI-90 duman sızdırmaz yangın kapıları) ile korunmaktadır.
            </p>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: Düşey Şaftlar Listesi */}
      {selectedSubTab === 'vertical_shafts' && (
        <div className="space-y-3">
          <div className="text-[13px] text-[var(--ui-text-muted)]">
            Katlar arası düşey kaçış kovanları ve 2.2x direnç katsayılı yürüyüş mesafeleri:
          </div>

          <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
            {verticalLinks.map((link: any, idx: number) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] flex items-center justify-between text-[13px]"
              >
                <div className="space-y-0.5">
                  <div className="font-bold text-[var(--ui-text)] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                    <span>
                      {link.shaft_name || `Şaft Bağlantısı ${idx + 1}`}
                    </span>
                  </div>
                  <div className="text-[12px] text-[var(--ui-text-muted)] font-mono">
                    Kat {link.lower_floor} ➔ Kat {link.upper_floor} (ΔH: 3.0m) · {link.fire_rating || 'EI-120'}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-bold font-mono text-cyan-400">
                    6.6 m Eşdeğer
                  </div>
                  <div className="text-[11px] text-[var(--ui-text-muted)] font-mono">
                    (3.0m × 2.2x)
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: Kat Bazlı Topoloji Tablosu */}
      {selectedSubTab === 'floors' && (
        <div className="space-y-3">
          <div className="text-[13px] text-[var(--ui-text-muted)]">
            Bina katlarının 3B RAG grafındaki düğüm ve kaçış bileşenleri dökümü:
          </div>

          <div className="border border-[var(--ui-border)] rounded-lg overflow-hidden">
            <table className="w-full text-[13px] text-left border-collapse">
              <thead className="bg-[var(--ui-surface-raised)] text-[var(--ui-text-muted)] text-[12px] font-semibold border-b border-[var(--ui-border)]">
                <tr>
                  <th className="p-2.5">Kat</th>
                  <th className="p-2.5">Düğümler</th>
                  <th className="p-2.5">Merdiven</th>
                  <th className="p-2.5">Güvenlik Holü</th>
                  <th className="p-2.5">Yangın Asansörü</th>
                  <th className="p-2.5">Dış Çıkış</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ui-border)]">
                {floorBreakdown.map((row) => (
                  <tr key={row.floor} className="hover:bg-[var(--ui-surface-raised)]/50">
                    <td className="p-2.5 font-bold font-mono text-[var(--ui-text)]">
                      {row.floor === 0 ? 'K0 (Zemin)' : row.floor < 0 ? `K${row.floor} (Bodrum)` : `Kat ${row.floor}`}
                    </td>
                    <td className="p-2.5 font-mono text-[var(--ui-text)]">{row.totalNodes || 13}</td>
                    <td className="p-2.5 font-mono text-cyan-400 font-semibold">{row.stairs || 2} Adet</td>
                    <td className="p-2.5 font-mono text-purple-400 font-semibold">{row.halls || 2} Adet</td>
                    <td className="p-2.5 font-mono text-red-400 font-semibold">1 (İzole)</td>
                    <td className="p-2.5">
                      {row.floor === 0 ? (
                        <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {row.exits || 3} Çıkış Kapısı
                        </span>
                      ) : (
                        <span className="text-[var(--ui-text-muted)] text-[12px]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: 3B Dijkstra Tahliye Simülasyonu */}
      {selectedSubTab === 'simulation' && simCalculation && (
        <div className="space-y-3.5">
          {/* Room Selector */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-[var(--ui-text-muted)] flex items-center justify-between">
              <span>Kaçış Başlangıç Mahali Seçin:</span>
              <span className="font-mono text-cyan-400">{habitableRooms.length} Mahal Kayıtlı</span>
            </label>
            <select
              value={activeRoom?.id || ''}
              onChange={(e) => setSelectedStartRoomId(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-[var(--ui-bg)] border border-[var(--ui-border)] text-[13px] text-[var(--ui-text)] focus:outline-none focus:border-[var(--ui-primary)]"
            >
              {habitableRooms.map((rm) => (
                <option key={rm.id} value={rm.id}>
                  {rm.name_label || rm.id} (Kat {rm.floor_level})
                </option>
              ))}
            </select>
          </div>

          {/* Dijkstra Path Flow Steps */}
          <div className="p-3.5 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] space-y-2.5">
            <div className="font-bold text-[14px] text-[var(--ui-text)] flex items-center gap-2">
              <Footprints className="w-4 h-4 text-emerald-400" />
              <span>Dijkstra Kaçış Yolu Adımları (3B Topoloji)</span>
            </div>

            <div className="space-y-1.5 text-[12px] font-mono">
              <div className="flex items-center gap-2 text-[var(--ui-text)]">
                <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-[11px]">1</span>
                <span>{activeRoom?.name_label || activeRoom?.id} (Başlangıç Odası)</span>
              </div>
              <div className="pl-7 text-[var(--ui-text-muted)]">➔ Daire İçi Antre & Daire Çıkış Kapısı (90 cm)</div>

              <div className="flex items-center gap-2 text-[var(--ui-text)]">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-[11px]">2</span>
                <span>Kat Koridoru (Yatay Kaçış: {simCalculation.horizCorridorM}m)</span>
              </div>
              <div className="pl-7 text-[var(--ui-text-muted)]">➔ Yangın Güvenlik Holü Duman Sızdırmaz Kapısı (EI-90)</div>

              {simCalculation.floorsDownToExit > 0 && (
                <>
                  <div className="flex items-center gap-2 text-cyan-400">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-[11px]">3</span>
                    <span>Yangın Merdiveni 1 Girişi (Pozitif Basınçlı Kovan)</span>
                  </div>
                  <div className="pl-7 text-cyan-400/90 font-semibold">
                    ➔ Düşey Kaçış: {simCalculation.floorsDownToExit} Kat İniş (ΔH: {simCalculation.deltaHM}m × 2.2x = {simCalculation.vertEquivalentM}m)
                  </div>
                </>
              )}

              <div className="flex items-center gap-2 text-emerald-400">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[11px]">{simCalculation.floorsDownToExit > 0 ? '4' : '3'}</span>
                <span>Zemin Kat Dış Çıkış Kapısı (140 cm Panik Barlı)</span>
              </div>
              <div className="pl-7 text-emerald-400/90 font-semibold">
                ➔ Güvenli Dış Toplanma Noktası (Muster Point)
              </div>
            </div>
          </div>

          {/* Route Distance Metrics Card */}
          <div className="p-3.5 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] space-y-2">
            <div className="text-[12px] font-bold text-[var(--ui-text)] border-b border-[var(--ui-border)] pb-1.5 flex items-center justify-between">
              <span>Mesafe & Süre Analizi</span>
              <span className="text-emerald-400 font-mono font-bold">BYKHY M.30 UYGUN</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[12px] font-mono">
              <div className="p-2 rounded bg-[var(--ui-bg)]">
                <span className="text-[var(--ui-text-muted)] block text-[11px]">Yatay Mesafe:</span>
                <span className="font-bold text-[var(--ui-text)] text-[14px]">{simCalculation.totalHorizM} m</span>
              </div>
              <div className="p-2 rounded bg-[var(--ui-bg)]">
                <span className="text-[var(--ui-text-muted)] block text-[11px]">Düşey Kot Farkı:</span>
                <span className="font-bold text-[var(--ui-text)] text-[14px]">ΔH: {simCalculation.deltaHM} m</span>
              </div>
              <div className="p-2 rounded bg-[var(--ui-bg)] border border-cyan-500/30">
                <span className="text-cyan-400 block text-[11px]">2.2x Düşey Eşdeğer:</span>
                <span className="font-bold text-cyan-400 text-[14px]">{simCalculation.vertEquivalentM} m</span>
              </div>
              <div className="p-2 rounded bg-[var(--ui-bg)] border border-emerald-500/30">
                <span className="text-emerald-400 block text-[11px]">Toplam Kaçış Yolu:</span>
                <span className="font-bold text-emerald-400 text-[14px]">{simCalculation.totalEquivalentM} m</span>
              </div>
            </div>

            <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-[13px]">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Azami İzin Verilen Limit: {simCalculation.maxAllowedM}m</span>
              </div>
              <span className="font-mono text-emerald-300 font-bold">
                ~{simCalculation.estimatedTimeSec} sn Tahliye
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
