import React from 'react';
import { Play, Pause, RotateCcw, Eye, Flame, Network, Layers, Maximize2, Split, Building } from 'lucide-react';
import { CameraPreset, WallHeightMode } from '../types/pipeline';

interface TimelineControlsProps {
  simulationTime: number;
  setSimulationTime: (t: number) => void;
  isPlaying: boolean;
  setIsPlaying: (p: boolean) => void;
  playbackSpeed: number;
  setPlaybackSpeed: (s: number) => void;
  activeFloor: 'all' | number;
  setActiveFloor: (f: 'all' | number) => void;
  explodedZ: number;
  setExplodedZ: (z: number) => void;
  wallHeightMode: WallHeightMode;
  setWallHeightMode: (m: WallHeightMode) => void;
  cameraPreset: CameraPreset;
  setCameraPreset: (p: CameraPreset) => void;
  showSmoke: boolean;
  setShowSmoke: (s: boolean) => void;
  showRAGOverlay: boolean;
  setShowRAGOverlay: (r: boolean) => void;
  showBottlenecks: boolean;
  setShowBottlenecks: (b: boolean) => void;
  showBIMArchitecture?: boolean;
  setShowBIMArchitecture?: (b: boolean) => void;
  showDoorArcs?: boolean;
  setShowDoorArcs?: (show: boolean) => void;
  cadDiffMode: 'before' | 'after' | 'both';
  setCadDiffMode: (m: 'before' | 'after' | 'both') => void;
  availableFloors?: number[];
  maxSimulationTime?: number;
}


export const TimelineControls: React.FC<TimelineControlsProps> = ({
  simulationTime,
  setSimulationTime,
  isPlaying,
  setIsPlaying,
  playbackSpeed,
  setPlaybackSpeed,
  activeFloor,
  setActiveFloor,
  explodedZ,
  setExplodedZ,
  wallHeightMode,
  setWallHeightMode,
  cameraPreset,
  setCameraPreset,
  showSmoke,
  setShowSmoke,
  showRAGOverlay,
  setShowRAGOverlay,
  showBottlenecks,
  setShowBottlenecks,
  showBIMArchitecture = true,
  setShowBIMArchitecture,
  showDoorArcs = false,
  setShowDoorArcs,
  cadDiffMode,
  setCadDiffMode,
  availableFloors,
  maxSimulationTime = 180,
}) => {
  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5 pointer-events-auto w-[calc(100%-40px)] max-w-5xl">
      {/* Upper Controls: Presets, Isolation, Wall Heights & Overlays */}
      <div className="hud-card rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2 w-full text-[12px] shadow-2xl">
        {/* Camera Presets */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[var(--ui-text-muted)] font-medium text-[11px] mr-0.5 whitespace-nowrap">Kamera:</span>
          {(['isometric', 'top_down', 'side_elevation', 'first_person'] as CameraPreset[]).map((p) => {
            const labels: Record<CameraPreset, string> = {
              isometric: '3B İzometrik',
              top_down: '2B Plan',
              side_elevation: 'Yan Kesit',
              first_person: '1. Şahıs Kaçış',
            };
            return (
              <button
                key={p}
                onClick={() => setCameraPreset(p)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                  cameraPreset === p
                    ? 'bg-[var(--ui-primary)] text-white font-semibold'
                    : 'text-[var(--ui-text-muted)] hover:text-white bg-[var(--ui-surface-raised)]'
                }`}
              >
                {labels[p]}
              </button>
            );
          })}
        </div>

        {/* Floor Isolation */}
        <div className="flex items-center gap-1">
          <span className="text-[var(--ui-text-muted)] font-medium text-[11px] mr-0.5 whitespace-nowrap">Kat:</span>
          <div className="flex items-center gap-1 overflow-x-auto max-w-[280px] scrollbar-thin">
            {(['all', ...(availableFloors && availableFloors.length > 0 ? availableFloors : [1, 0, -1])] as const).map((fl) => (
              <button
                key={fl}
                onClick={() => setActiveFloor(fl as 'all' | number)}
                className={`px-2 py-1 rounded font-mono text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeFloor === fl
                    ? 'bg-[var(--ui-primary)] text-white font-semibold'
                    : 'text-[var(--ui-text-muted)] hover:text-white bg-[var(--ui-surface-raised)]'
                }`}
                title={fl === 'all' ? 'Tüm Katları Göster' : fl === 0 ? 'Zemin Kat' : fl < 0 ? `Bodrum ${Math.abs(fl)}` : `Kat ${fl}`}
              >
                {fl === 'all' ? 'Tümü' : fl === 0 ? 'Zemin' : fl < 0 ? `B${Math.abs(fl)}` : `K${fl}`}
              </button>
            ))}
          </div>
        </div>

        {/* Exploded Z Slider */}
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-[var(--ui-text-muted)] text-[11px] font-medium">Patlatılmış Z:</span>
          <input
            type="range"
            min="1.0"
            max="3.0"
            step="0.1"
            value={explodedZ}
            onChange={(e) => setExplodedZ(parseFloat(e.target.value))}
            className="w-16 sm:w-20 accent-[var(--ui-primary)] cursor-pointer h-1.5"
          />
          <span className="font-mono text-[var(--ui-primary)] text-[11px] font-bold w-7 text-right">{explodedZ.toFixed(1)}x</span>
        </div>

        {/* Wall Height Mode (Dollhouse / Full / Slab) */}
        <div className="flex items-center gap-1">
          <span className="text-[var(--ui-text-muted)] text-[11px] font-medium mr-0.5 whitespace-nowrap">Duvar:</span>
          {(['cut', 'full', 'slab'] as WallHeightMode[]).map((mode) => {
            const labels: Record<WallHeightMode, string> = {
              cut: 'Dollhouse (1.2m)',
              full: 'Tam (2.8m)',
              slab: 'Plan (0.15m)',
            };
            return (
              <button
                key={mode}
                onClick={() => setWallHeightMode(mode)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                  wallHeightMode === mode
                    ? 'bg-[var(--ui-primary)] text-white font-semibold'
                    : 'text-[var(--ui-text-muted)] hover:text-white bg-[var(--ui-surface-raised)]'
                }`}
                title={
                  mode === 'cut'
                    ? 'Mimari Kesit / Dollhouse Modu'
                    : mode === 'full'
                    ? 'Tam Mimari Görünüm'
                    : 'Sadece Plan Modu'
                }
              >
                {labels[mode]}
              </button>
            );
          })}
        </div>

        {/* Feature Toggles */}
        <div className="flex items-center gap-1 border-l border-[var(--ui-border)] pl-2 flex-wrap">
          {setShowBIMArchitecture && (
            <button
              onClick={() => setShowBIMArchitecture(!showBIMArchitecture)}
              className={`px-2 py-1 rounded flex items-center gap-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                showBIMArchitecture
                  ? 'bg-[var(--ui-primary)] text-white font-semibold'
                  : 'text-[var(--ui-text-muted)] bg-[var(--ui-surface-raised)] hover:text-white'
              }`}
              title="Mimari Yapı Elemanları (Kolon, Duvar, Kapı, Pencere, Merdiven)"
            >
              <Building className="w-3.5 h-3.5" />
              <span>BIM</span>
            </button>
          )}

          <button
            onClick={() => setShowSmoke(!showSmoke)}
            className={`px-2 py-1 rounded flex items-center gap-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
              showSmoke
                ? 'bg-[var(--ui-danger)] text-white font-semibold'
                : 'text-[var(--ui-text-muted)] bg-[var(--ui-surface-raised)] hover:text-white'
            }`}
            title="İki Bölgeli Duman Katmanı Simülasyonu"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Duman</span>
          </button>

          <button
            onClick={() => setShowRAGOverlay(!showRAGOverlay)}
            className={`px-2 py-1 rounded flex items-center gap-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
              showRAGOverlay
                ? 'bg-[var(--ui-primary)] text-white font-semibold'
                : 'text-[var(--ui-text-muted)] bg-[var(--ui-surface-raised)] hover:text-white'
            }`}
            title="3B RAG Graf Topolojisi ve Çekirdek Şaftları"
          >
            <Network className="w-3.5 h-3.5" />
            <span>3B Graf</span>
          </button>

          <button
            onClick={() => setShowBottlenecks(!showBottlenecks)}
            className={`px-2 py-1 rounded flex items-center gap-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
              showBottlenecks
                ? 'bg-[var(--ui-warning)] text-white font-semibold'
                : 'text-[var(--ui-text-muted)] bg-[var(--ui-surface-raised)] hover:text-white'
            }`}
            title="SFPE Hidrolik Darboğaz Isı Haritası"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Darboğaz</span>
          </button>

          {setShowDoorArcs && (
            <button
              onClick={() => setShowDoorArcs(!showDoorArcs)}
              className={`px-2 py-1 rounded flex items-center gap-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                showDoorArcs
                  ? 'bg-cyan-500 text-white font-semibold'
                  : 'text-[var(--ui-text-muted)] bg-[var(--ui-surface-raised)] hover:text-white'
              }`}
              title="2B/3B Kapı Açılım Yayları ve CAD Çizgilerini Aç/Kapat"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Yaylar</span>
            </button>
          )}

          {/* CAD Diff Mode */}
          <button
            onClick={() => {
              if (cadDiffMode === 'before') setCadDiffMode('after');
              else if (cadDiffMode === 'after') setCadDiffMode('both');
              else setCadDiffMode('before');
            }}
            className={`px-2 py-1 rounded flex items-center gap-1 text-[11px] font-mono font-medium border transition-colors whitespace-nowrap shrink-0 ${
              cadDiffMode === 'before'
                ? 'bg-[#2A1D22] text-[var(--ui-danger)] border-[var(--ui-danger)]/50'
                : cadDiffMode === 'after'
                ? 'bg-[#182924] text-[var(--ui-success)] border-[var(--ui-success)]/50'
                : 'bg-[var(--ui-surface-raised)] text-[var(--ui-text)] border-[var(--ui-border)]'
            }`}
            title="Önce / Sonra Karşı-Olgusal CAD Karşılaştırması"
          >
            <Split className="w-3 h-3" />
            <span>{cadDiffMode === 'before' ? 'CAD: Önce' : cadDiffMode === 'after' ? 'CAD: Sonra' : 'CAD: İkisi'}</span>
          </button>
        </div>
      </div>

      {/* Lower Controls: Scrub Timeline Slider & Playback */}
      <div className="hud-card rounded-lg px-3 py-2 flex items-center gap-3 w-full shadow-2xl text-[12px]">
        {/* Play/Pause & Reset */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-8 h-8 rounded bg-[var(--ui-primary)] text-white flex items-center justify-center hover:opacity-90 active:scale-95 transition-all shadow-sm shrink-0"
            title={isPlaying ? 'Durdur' : 'Oynat'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
          </button>

          <button
            onClick={() => {
              setIsPlaying(false);
              setSimulationTime(0);
            }}
            className="p-1.5 text-[var(--ui-text-muted)] hover:text-white hover:bg-[var(--ui-surface)] rounded transition-colors shrink-0"
            title="Zamanı Sıfırla"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Time Slider */}
        <div className="flex-1 flex items-center gap-2.5 min-w-0">
          <span className="font-mono text-[12px] text-[var(--ui-text)] font-bold whitespace-nowrap shrink-0 min-w-[55px]">
            {simulationTime.toFixed(1)} sn
          </span>
          <input
            type="range"
            min="0"
            max={maxSimulationTime}
            step="0.5"
            value={simulationTime}
            onChange={(e) => setSimulationTime(parseFloat(e.target.value))}
            className="w-full accent-[var(--ui-primary)] cursor-pointer h-1.5 bg-[var(--ui-surface)] rounded border border-[var(--ui-border)]"
          />
          <span className="font-mono text-[12px] text-[var(--ui-text-muted)] whitespace-nowrap shrink-0 min-w-[50px] text-right">
            {maxSimulationTime.toFixed(1)} sn
          </span>
        </div>

        {/* Speed Multiplier */}
        <div className="flex items-center gap-1 bg-[var(--ui-surface)] px-1.5 py-0.5 rounded border border-[var(--ui-border)] shrink-0">
          {[1, 2, 5].map((s) => (
            <button
              key={s}
              onClick={() => setPlaybackSpeed(s)}
              className={`px-1.5 py-0.5 text-[11px] font-mono rounded font-semibold transition-colors shrink-0 ${
                playbackSpeed === s
                  ? 'bg-[var(--ui-primary)] text-white'
                  : 'text-[var(--ui-text-muted)] hover:text-white'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Integrated AutoCAD Navigation Controls Hint */}
        <div className="hidden lg:flex items-center gap-1 text-[11px] font-mono text-[var(--ui-text-muted)] border-l border-[var(--ui-border)]/60 pl-2.5 shrink-0 whitespace-nowrap">
          <span className="text-[var(--ui-primary)] font-semibold">CAD:</span>
          <span>Orta/Sağ Tık: Pan · Tekerlek: Zoom · Sol: Orbit · WASD: Gezin</span>
        </div>
      </div>
    </div>
  );
};

