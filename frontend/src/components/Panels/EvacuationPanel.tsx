import React from 'react';
import { Activity, Clock, Flame, Users, AlertOctagon, TrendingDown, Layers, Play, Pause, RotateCcw, AlertTriangle, ShieldCheck, RefreshCw, Eye, Zap, Shield, Tag } from 'lucide-react';
import { DiagramYonetmelikPipelineOutput } from '../../types/pipeline';

interface EvacuationPanelProps {
  data: DiagramYonetmelikPipelineOutput | null;
  simulationTime: number;
  setSimulationTime?: (t: number) => void;
  isPlaying?: boolean;
  setIsPlaying?: (p: boolean) => void;
  playbackSpeed?: number;
  setPlaybackSpeed?: (s: number) => void;
  onRefreshAudit?: () => void;
  onSelectElement?: (element: any) => void;
  showBottlenecks?: boolean;
  setShowBottlenecks?: (show: boolean) => void;
  showBottleneckBadges?: boolean;
  setShowBottleneckBadges?: (show: boolean) => void;
}

export const EvacuationPanel: React.FC<EvacuationPanelProps> = ({
  data,
  simulationTime,
  setSimulationTime,
  isPlaying = false,
  setIsPlaying,
  playbackSpeed = 1,
  setPlaybackSpeed,
  onRefreshAudit,
  onSelectElement,
  showBottlenecks = false,
  setShowBottlenecks,
  showBottleneckBadges = true,
  setShowBottleneckBadges,
}) => {
  const evac: any = data?.evacuation || data?.evacuation_report;
  if (!evac) {
    return (
      <div className="p-4 rounded-lg border border-[var(--ui-border)] text-[14px] text-[var(--ui-text-muted)]">
        Tahliye simülasyonu için önce bir pafta denetleyin.
      </div>
    );
  }
  
  // Dinamik nüfus ve tahliye süreleri
  const totalOccupants = evac?.total_occupants ?? evac?.total_persons_evacuated ?? 0;
  const totalTime = evac?.total_evacuation_time_s ?? evac?.baseline_time_sec ?? 0;
  const hasAset = evac?.critical_aset_sec !== null && evac?.critical_aset_sec !== undefined;
  const aset: number = evac?.critical_aset_sec ?? 0;
  const safetyMargin: number = evac?.safety_margin_s ?? 0;
  const isIncomplete = evac?.evacuation_completed === false;
  const trappedPersons = evac?.trapped_persons ?? 0;
  const isSafe = evac?.aset_compliant !== false && !isIncomplete;
  const maxLimitTime = Math.max(180, Math.ceil(totalTime));

  // Dinamik darboğaz kapıları
  const bottlenecks: any[] = evac?.bottlenecks || evac?.bottleneck_doors || [];

  // Zaman serisine göre veya orantılı dinamik tahliye olan kişi sayısı
  let evacuatedCount = 0;
  const pts = evac?.time_series;
  // pts'in son elemanında en az 1 kişi tahliye olmuş olmalı (tüm serinin 0 olmaması kontrolü)
  const hasValidTimeSeries = Array.isArray(pts) && pts.length > 0 && pts[pts.length - 1] && pts[pts.length - 1][1] > 0;

  if (hasValidTimeSeries && pts) {
    // Zaman serisinde simulationTime anındaki değeri bul
    let closestVal = pts[0][1];
    for (const [t, count] of pts) {
      if (t <= simulationTime) {
        closestVal = count;
      } else {
        break;
      }
    }
    const maxPtsVal = pts[pts.length - 1][1];
    if (!isIncomplete && maxPtsVal > 0 && totalOccupants > 0 && maxPtsVal !== totalOccupants) {
      evacuatedCount = Math.min(totalOccupants, Math.round((closestVal / maxPtsVal) * totalOccupants));
    } else {
      evacuatedCount = Math.min(totalOccupants, closestVal);
    }
  } else if (isIncomplete) {
    evacuatedCount = evac?.total_persons_evacuated ?? 0;
  }

  // Eğer süre toplam tahliye süresine ulaştıysa veya aştıysa tüm kişiler tahliye olmalıdır
  if (!isIncomplete && simulationTime >= totalTime) {
    evacuatedCount = totalOccupants;
  }

  const remainingCount = Math.max(0, totalOccupants - evacuatedCount);
  const progressPercent = totalOccupants > 0 ? Math.min(100, Math.round((evacuatedCount / totalOccupants) * 100)) : 100;


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
        <div className="flex items-center gap-2">
          {onRefreshAudit && (
            <button
              onClick={onRefreshAudit}
              className="p-1.5 rounded-lg bg-[var(--ui-surface)] hover:bg-[var(--ui-primary)]/20 hover:text-[var(--ui-primary)] border border-[var(--ui-border)] transition-colors text-[var(--ui-text-muted)] cursor-pointer"
              title="SFPE Simülasyon Verisini Yeniden Hesapla / Tazele"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          <span className="badge badge-neutral text-[12px] font-mono shrink-0">SFPE 5. Baskı</span>
        </div>
      </div>

      {isIncomplete && (
        <div role="alert" className="p-3 rounded-lg border border-[var(--ui-danger)] bg-[var(--ui-danger-subtle)] text-[var(--ui-danger)] text-[13px] font-semibold">
          {evac?.has_exit === false
            ? 'Binada kullanılabilir dış çıkış bulunamadı. Tahliye tamamlanamaz.'
            : trappedPersons > 0
            ? `${trappedPersons} kişinin yangında kullanılabilir çıkış yolu yok. Tahliye tamamlanamaz.`
            : `Tahliye ${totalTime.toFixed(0)} sn simülasyon süresinde tamamlanamadı (${evac?.total_persons_evacuated ?? 0}/${totalOccupants} kişi çıktı).`}
        </div>
      )}

      {/* Real-time Evacuation Gauge & Interactive Simulation Controls */}
      <div className="card p-4 space-y-3.5 border border-[var(--ui-border)] bg-[var(--ui-surface)]">
        <div className="flex items-center justify-between text-[14px]">
          <div className="flex items-center gap-2">
            <span className="text-[var(--ui-text)] font-bold">Canlı Tahliye İlerlemesi</span>
            <span className="font-mono text-[12px] px-2 py-0.5 rounded bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] text-[var(--ui-primary)] font-bold">
              T = {simulationTime.toFixed(1)}s
            </span>
          </div>
          <span className="font-mono text-[var(--ui-primary)] font-bold text-[15px]">
            {evacuatedCount} / {totalOccupants} Kişi (%{progressPercent})
          </span>
        </div>

        {/* Dynamic Animated Progress Bar */}
        <div className="w-full bg-[var(--ui-surface-raised)] rounded-full h-3 overflow-hidden border border-[var(--ui-border)] relative">
          <div
            className={`h-full transition-all duration-150 ${
              hasAset && simulationTime >= aset && !isSafe
                ? 'bg-gradient-to-r from-[var(--ui-primary)] to-[var(--ui-danger)]'
                : 'bg-gradient-to-r from-[var(--ui-primary)] to-[#10B981]'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Evacuation Counts & Status Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[12px]">
          <div className="p-2.5 rounded bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] flex flex-col">
            <span className="text-[var(--ui-text-muted)] text-[11px]">Bina İçinde Kalan:</span>
            <strong className="text-[var(--ui-warning)] font-mono text-[14px]">{remainingCount} kişi</strong>
          </div>
          <div className="p-2.5 rounded bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] flex flex-col">
            <span className="text-[var(--ui-text-muted)] text-[11px]">Tahliye Olan:</span>
            <strong className="text-[var(--ui-success)] font-mono text-[14px]">{evacuatedCount} kişi</strong>
          </div>
          <div className="p-2.5 rounded bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] flex flex-col col-span-2 sm:col-span-1">
            <span className="text-[var(--ui-text-muted)] text-[11px]">Tahliye Durumu:</span>
            <strong className={`font-mono text-[13px] ${evacuatedCount >= totalOccupants ? 'text-[var(--ui-success)]' : isPlaying ? 'text-[var(--ui-primary)] animate-pulse' : 'text-[var(--ui-text)]'}`}>
              {evacuatedCount >= totalOccupants ? 'Tamamlandı' : isPlaying ? 'Canlı Akış Aktif' : 'Hazır'}
            </strong>
          </div>
        </div>

        {/* Interactive Timeline Scrubber Slider */}
        {setSimulationTime && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px] text-[var(--ui-text-muted)] font-mono">
              <span>0.0 sn (Başlangıç)</span>
              <span className={hasAset && simulationTime >= aset ? 'text-[var(--ui-danger)] font-bold' : ''}>ASET: {hasAset ? `${aset.toFixed(1)} sn` : '—'}</span>
              <span>RSET: {totalTime.toFixed(1)} sn</span>
            </div>
            <input
              type="range"
              min="0"
              max={maxLimitTime}
              step="0.5"
              value={simulationTime}
              onChange={(e) => setSimulationTime(parseFloat(e.target.value))}
              className="w-full accent-[var(--ui-primary)] cursor-pointer h-2 bg-[var(--ui-surface-raised)] rounded-lg border border-[var(--ui-border)]"
            />
          </div>
        )}

        {/* Simulation Playback & Speed Controls */}
        <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            {setIsPlaying && (
              <button
                onClick={() => {
                  if (!isPlaying && simulationTime >= totalTime) {
                    setSimulationTime && setSimulationTime(0);
                  }
                  setIsPlaying(!isPlaying);
                }}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-[12px] font-semibold transition-all shadow-sm ${
                  isPlaying
                    ? 'bg-[var(--ui-warning)] text-black hover:opacity-90 active:scale-95'
                    : 'bg-[var(--ui-primary)] text-white hover:opacity-90 active:scale-95'
                }`}
                title={isPlaying ? 'Tahliyeyi Durdur' : 'Canlı Tahliyeyi Başlat'}
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>Durdur</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    <span>{simulationTime > 0 && simulationTime < totalTime ? 'Devam Et' : 'Canlı Tahliyeyi Başlat'}</span>
                  </>
                )}
              </button>
            )}

            {setSimulationTime && (
              <>
                <button
                  onClick={() => {
                    setIsPlaying && setIsPlaying(false);
                    setSimulationTime(0);
                  }}
                  className="p-1.5 text-[var(--ui-text-muted)] hover:text-white hover:bg-[var(--ui-surface-raised)] rounded-md transition-colors border border-[var(--ui-border)]"
                  title="Zamanı Başa Sar (0.0s)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => setSimulationTime(Math.max(0, simulationTime - 5))}
                  className="px-2 py-1 text-[11px] font-mono text-[var(--ui-text-muted)] hover:text-white hover:bg-[var(--ui-surface-raised)] rounded border border-[var(--ui-border)]"
                  title="-5 Saniye Geri"
                >
                  -5s
                </button>

                <button
                  onClick={() => setSimulationTime(Math.min(maxLimitTime, simulationTime + 5))}
                  className="px-2 py-1 text-[11px] font-mono text-[var(--ui-text-muted)] hover:text-white hover:bg-[var(--ui-surface-raised)] rounded border border-[var(--ui-border)]"
                  title="+5 Saniye İleri"
                >
                  +5s
                </button>
              </>
            )}
          </div>

          {/* Speed Selector */}
          {setPlaybackSpeed && (
            <div className="flex items-center gap-1 bg-[var(--ui-surface-raised)] px-1.5 py-0.5 rounded-md border border-[var(--ui-border)]">
              {[1, 2, 5, 10].map((s) => (
                <button
                  key={s}
                  onClick={() => setPlaybackSpeed(s)}
                  className={`px-1.5 py-0.5 text-[11px] font-mono rounded font-semibold transition-colors ${
                    playbackSpeed === s
                      ? 'bg-[var(--ui-primary)] text-white'
                      : 'text-[var(--ui-text-muted)] hover:text-white'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Real-time Smoke Warning Status */}
        {hasAset && simulationTime >= aset && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[var(--ui-danger)]/15 border border-[var(--ui-danger)]/30 text-[12px] text-[var(--ui-danger)] animate-pulse">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="font-medium">
              Kritik Duman Kotu Uyarısı: En dar bölgede duman {aset.toFixed(1)}. saniyede 1.80 m kotuna iner.
            </span>
          </div>
        )}
      </div>

      {/* ASET vs RSET Card */}
      <div className={`p-4 rounded-lg border space-y-3 ${isSafe ? 'bg-[#18261E] border-[var(--ui-success)]/40' : 'bg-[#221A1D] border-[var(--ui-danger)]/40'}`}>
        <div className="flex items-center justify-between">
          <span className={`font-bold text-[15px] flex items-center gap-2 ${isSafe ? 'text-[var(--ui-success)]' : 'text-[var(--ui-danger)]'}`}>
            <Flame className={`w-4 h-4 ${isSafe ? 'text-[var(--ui-success)]' : 'text-[var(--ui-danger)]'}`} /> ASET vs RSET Güvenlik Karşılaştırması
          </span>
          <span className={`badge ${isSafe ? 'badge-success' : 'badge-danger'} text-[12px] font-mono`}>
            {safetyMargin >= 0 ? `+${safetyMargin.toFixed(1)} sn Güvenli Marj` : `${safetyMargin.toFixed(1)} sn Güvenlik Açığı`}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="p-3 rounded-md bg-[var(--ui-surface-raised)] border border-[var(--ui-border)]">
            <div className="text-[12px] text-[var(--ui-text-muted)]">RSET (Gereken Süre)</div>
            <div className={`text-xl font-bold font-mono mt-0.5 ${isSafe ? 'text-[var(--ui-success)]' : 'text-[var(--ui-danger)]'}`}>{totalTime.toFixed(1)} sn</div>
          </div>
          <div className="p-3 rounded-md bg-[var(--ui-surface-raised)] border border-[var(--ui-border)]">
            <div className="text-[12px] text-[var(--ui-text-muted)]">ASET (Kritik Duman Süresi)</div>
            <div className="text-xl font-bold font-mono text-[var(--ui-primary)] mt-0.5">{hasAset ? `${aset.toFixed(1)} sn` : '—'}</div>
          </div>
        </div>
        <p className="text-[13px] text-[var(--ui-text)] leading-relaxed">
          {isIncomplete
            ? 'Tahliye tamamlanamadığı için güvenli bir süre hesaplanamaz.'
            : isSafe
            ? `Her bölge, duman 1.80 m kotuna inmeden boşalıyor. En dar güvenlik payı ${safetyMargin.toFixed(1)} sn. Duman modeli sadeleştirilmiştir; korunumlu hol ve merdivenlerin dumandan etkilenmediğini varsayar.`
            : `En az bir bölge, duman 1.80 m kotuna indikten ${Math.abs(safetyMargin).toFixed(1)} sn sonra boşalıyor. Darboğazların giderilmesi gerekir. Duman modeli sadeleştirilmiştir.`}
        </p>
      </div>

      {/* SFPE Hidrolik Termal Akış Lejantı */}
      <div className="card p-3 bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] space-y-2">
        <div className="flex items-center justify-between text-[12px] font-bold">
          <span className="flex items-center gap-1.5 text-[var(--ui-text)]">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            3B SFPE Hidrolik Termal Akış & Kuyruk Skalası
          </span>
          <div className="flex items-center gap-1.5">
            {setShowBottlenecks && (
              <button
                onClick={() => setShowBottlenecks(!showBottlenecks)}
                className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  showBottlenecks
                    ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/25 border border-amber-400'
                    : 'bg-[var(--ui-surface)] border border-[var(--ui-border)] text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'
                }`}
                title="3B Termal Akış ve Darboğaz Görünümünü Aç / Kapat"
              >
                <Flame className={`w-3.5 h-3.5 ${showBottlenecks ? 'animate-pulse text-white' : 'text-amber-400'}`} />
                <span>{showBottlenecks ? '3B Termal Akış: AKTİF' : '3B Termal Akış: PASİF'}</span>
              </button>
            )}
            {showBottlenecks && setShowBottleneckBadges && (
              <button
                onClick={() => setShowBottleneckBadges(!showBottleneckBadges)}
                className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
                  showBottleneckBadges
                    ? 'bg-amber-600/90 text-white border border-amber-400/60 shadow-sm'
                    : 'bg-[var(--ui-surface)] border border-[var(--ui-border)] text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'
                }`}
                title="3B Sahne Üzerindeki Darboğaz Bilgi Kutucuklarını (HUD Kartları) Aç / Kapat"
              >
                <Tag className="w-3 h-3" />
                <span>{showBottleneckBadges ? 'Kutucuklar: AÇIK' : 'Kutucuklar: KAPALI'}</span>
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div className="p-2 rounded bg-red-950/40 border border-red-500/40 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
            <div>
              <div className="font-bold text-red-400">Kritik Darboğaz</div>
              <div className="text-[10px] text-zinc-400">Kuyruk ≥ 8 · Geri-Tıkanma</div>
            </div>
          </div>
          <div className="p-2 rounded bg-amber-950/40 border border-amber-500/40 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
            <div>
              <div className="font-bold text-amber-400">Yoğun Akış</div>
              <div className="text-[10px] text-zinc-400">Kuyruk 3-7 · Yavaşlama</div>
            </div>
          </div>
          <div className="p-2 rounded bg-emerald-950/40 border border-emerald-500/40 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <div>
              <div className="font-bold text-emerald-400">Akıcı Geçiş</div>
              <div className="text-[10px] text-zinc-400">Kuyruk &lt; 3 · v=1.19 m/s</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottlenecks Table */}
      <div className="card p-4 space-y-3">
        <h5 className="font-bold text-[var(--ui-text)] text-[15px] flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 text-[var(--ui-warning)]" />
          Kritik Kapı Darboğazları & Kuyruk Analizi ({bottlenecks.length})
        </h5>

        {bottlenecks.length === 0 ? (
          <div className="p-4 rounded-md bg-[#18261E] border border-[var(--ui-success)]/40 text-center">
            <span className="text-[13px] text-[var(--ui-success)] font-semibold">
              Kritik bir kapı darboğazı veya geri-tıkanma (spillback) tespit edilmemiştir. Kaçış akışı akıcıdır.
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            {bottlenecks.map((b: any, i: number) => {
            const doorName = b.door_id || (b.edge ? `Kat ${b.floor_level ?? 0}: ${b.source_type || 'Oda'} ➔ ${b.target_type || 'Koridor'}` : `Darboğaz Kapı #${i + 1}`);
            const queueLen = b.peak_queue_length ?? (b.max_queue ? Math.round(b.max_queue) : 0);
            const waitTime = b.total_waiting_time_s ?? b.waiting_time_s ?? b.spillback_sec ?? 0;
            const flowCap = b.flow_capacity_pers_s ?? 1.17;
            const isSpill = b.is_spillback_trigger || (b.spillback_sec && b.spillback_sec > 0);

            const handleFocusDoor = () => {
              if (onSelectElement) {
                onSelectElement({
                  id: b.door_id || `door_${b.edge ? b.edge.join('_') : i}`,
                  type: 'door',
                  details: {
                    name: doorName,
                    queue: queueLen,
                    waitTime: waitTime,
                    flowCap: flowCap,
                    isSpillback: isSpill,
                    coords: b.spatial_coords || null,
                  }
                });
              }
            };

            return (
              <div key={i} className="p-3 rounded-md bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-mono text-[var(--ui-text)] text-[14px] font-bold flex items-center gap-2">
                    <span>{doorName}</span>
                    {isSpill && (
                      <span className="badge badge-danger text-[10px] py-0 px-1.5 font-sans">Geri-Tıkanma</span>
                    )}
                  </div>
                  <div className="text-[13px] text-[var(--ui-text-muted)] flex items-center gap-3">
                    <span>Akış: <span className="text-[var(--ui-text)] font-semibold">{flowCap} kişi/s</span></span>
                    <span>·</span>
                    <button
                      onClick={handleFocusDoor}
                      className="text-[11px] text-[var(--ui-primary)] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      3B Sahneye Odaklan
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[var(--ui-warning)] text-[14px] font-bold">
                    Kuyruk: {queueLen} kişi
                  </div>
                  <div className="text-[12px] text-[var(--ui-text-muted)] mt-0.5">
                    Bekleme: {waitTime.toFixed(1)} sn
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
