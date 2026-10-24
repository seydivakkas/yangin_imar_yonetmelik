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
  cadDiffMode: 'before' | 'after' | 'both';
  setCadDiffMode: (m: 'before' | 'after' | 'both') => void;
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
  cadDiffMode,
  setCadDiffMode,
}) => {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 pointer-events-auto w-[94%] max-w-5xl">
      {/* Upper Controls: Presets, Isolation, Wall Heights & Overlays */}
      <div className="glass-panel px-3 py-2 flex flex-wrap items-center justify-between gap-3 w-full text-xs">
        {/* Camera Presets */}
        <div className="flex items-center gap-1">
          <span className="text-gray-400 font-mono text-[11px] mr-1">Kamera:</span>
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
                className={`px-2 py-1 rounded transition-colors ${
                  cameraPreset === p ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 font-semibold' : 'text-gray-400 hover:text-white bg-white/5'
                }`}
              >
                {labels[p]}
              </button>
            );
          })}
        </div>

        {/* Floor Isolation */}
        <div className="flex items-center gap-1">
          <span className="text-gray-400 font-mono text-[11px] mr-1">Kat:</span>
          {(['all', 1, 0, -1] as const).map((fl) => (
            <button
              key={fl}
              onClick={() => setActiveFloor(fl)}
              className={`px-2 py-0.5 rounded font-mono text-[11px] ${
                activeFloor === fl ? 'bg-cyan-500 text-black font-bold' : 'text-gray-400 hover:text-white bg-white/5'
              }`}
            >
              {fl === 'all' ? 'Tümü' : fl === 0 ? 'Zemin' : `K${fl}`}
            </button>
          ))}
        </div>

        {/* Exploded Z Slider */}
        <div className="flex items-center gap-2">
          <span className="text-gray-400 font-mono text-[11px]">Patlatılmış Z:</span>
          <input
            type="range"
            min="1.0"
            max="3.0"
            step="0.1"
            value={explodedZ}
            onChange={(e) => setExplodedZ(parseFloat(e.target.value))}
            className="w-20 accent-cyan-400 cursor-pointer"
          />
          <span className="font-mono text-cyan-400 text-[11px] w-8">{explodedZ.toFixed(1)}x</span>
        </div>

        {/* Wall Height Mode (Dollhouse / Full / Slab) */}
        <div className="flex items-center gap-1">
          <span className="text-gray-400 font-mono text-[11px] mr-1">Duvar Kesiti:</span>
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
                className={`px-2 py-0.5 rounded text-[11px] ${
                  wallHeightMode === mode
                    ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/50 font-semibold'
                    : 'text-gray-400 hover:text-white bg-white/5'
                }`}
                title={
                  mode === 'cut'
                    ? 'Mimari Kesit / Dollhouse Modu (Pencereleri ve kapı kasalarını keserek içeriyi gösterir)'
                    : mode === 'full'
                    ? 'Tam Mimari Görünüm (2.80m)'
                    : 'Sadece Plan Modu (0.15m)'
                }
              >
                {labels[mode]}
              </button>
            );
          })}
        </div>

        {/* Feature Toggles */}
        <div className="flex items-center gap-1.5 border-l border-white/10 pl-2">
          {setShowBIMArchitecture && (
            <button
              onClick={() => setShowBIMArchitecture(!showBIMArchitecture)}
              className={`p-1.5 rounded flex items-center gap-1 text-[11px] ${
                showBIMArchitecture
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                  : 'text-gray-500 bg-white/5'
              }`}
              title="Mimari Yapı Elemanları (Kolon, Duvar, Kapı, Pencere, Merdiven)"
            >
              <Building className="w-3.5 h-3.5" />
              <span>BIM Mimari</span>
            </button>
          )}

          <button
            onClick={() => setShowSmoke(!showSmoke)}
            className={`p-1.5 rounded flex items-center gap-1 text-[11px] ${
              showSmoke ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' : 'text-gray-500 bg-white/5'
            }`}
            title="İki Bölgeli Duman Katmanı Simülasyonu"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Duman</span>
          </button>

          <button
            onClick={() => setShowRAGOverlay(!showRAGOverlay)}
            className={`p-1.5 rounded flex items-center gap-1 text-[11px] ${
              showRAGOverlay ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 font-semibold' : 'text-gray-500 bg-white/5'
            }`}
            title="3B RAG Graf Topolojisi ve Çekirdek Şaftları (Hayalet Katman)"
          >
            <Network className="w-3.5 h-3.5" />
            <span>3B Graf</span>
          </button>

          <button
            onClick={() => setShowBottlenecks(!showBottlenecks)}
            className={`p-1.5 rounded flex items-center gap-1 text-[11px] ${
              showBottlenecks ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'text-gray-500 bg-white/5'
            }`}
            title="SFPE Hidrolik Darboğaz Isı Haritası"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Darboğaz</span>
          </button>


          {/* CAD Diff Mode */}
          <button
            onClick={() => {
              if (cadDiffMode === 'before') setCadDiffMode('after');
              else if (cadDiffMode === 'after') setCadDiffMode('both');
              else setCadDiffMode('before');
            }}
            className={`px-2 py-1 rounded flex items-center gap-1 text-[11px] font-mono border ${
              cadDiffMode === 'before'
                ? 'bg-red-500/20 text-red-400 border-red-500/40'
                : cadDiffMode === 'after'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-purple-500/20 text-purple-300 border-purple-500/40'
            }`}
            title="Önce / Sonra Karşı-Olgusal CAD Karşılaştırması"
          >
            <Split className="w-3 h-3" />
            <span>{cadDiffMode === 'before' ? 'CAD: Önce (İhlal)' : cadDiffMode === 'after' ? 'CAD: Sonra (Opt.)' : 'CAD: İkisi'}</span>
          </button>
        </div>
      </div>

      {/* Lower Controls: Scrub Timeline Slider & Playback */}
      <div className="glass-panel-elevated px-4 py-2.5 flex items-center gap-4 w-full">
        {/* Play/Pause & Reset */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-8 h-8 rounded-full bg-cyan-400 text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md shadow-cyan-400/30"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>

          <button
            onClick={() => {
              setIsPlaying(false);
              setSimulationTime(0);
            }}
            className="p-1.5 text-gray-400 hover:text-white transition-colors"
            title="Sıfırla"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Time Slider */}
        <div className="flex-1 flex items-center gap-3">
          <span className="font-mono text-xs text-cyan-400 font-bold min-w-[50px]">
            {simulationTime.toFixed(1)} sn
          </span>
          <input
            type="range"
            min="0"
            max="180"
            step="0.5"
            value={simulationTime}
            onChange={(e) => setSimulationTime(parseFloat(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
          />
          <span className="font-mono text-xs text-gray-500 min-w-[50px]">
            180.0 sn
          </span>
        </div>

        {/* Speed Multiplier */}
        <div className="flex items-center gap-1 bg-black/40 px-1.5 py-0.5 rounded border border-white/5">
          {[1, 2, 5].map((s) => (
            <button
              key={s}
              onClick={() => setPlaybackSpeed(s)}
              className={`px-1.5 py-0.5 text-[11px] font-mono rounded ${
                playbackSpeed === s ? 'bg-cyan-500/20 text-cyan-400 font-bold' : 'text-gray-400 hover:text-white'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
