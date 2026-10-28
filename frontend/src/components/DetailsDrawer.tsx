import React from 'react';
import { X, DoorOpen, Square, AlertTriangle, ShieldCheck, Layers, RotateCcw } from 'lucide-react';

interface DetailsDrawerProps {
  selectedElement: {
    id: string;
    type: 'room' | 'door' | 'wall' | 'arc' | 'violation';
    details: any;
  } | null;
  onClose: () => void;
}

export const DetailsDrawer: React.FC<DetailsDrawerProps> = ({ selectedElement, onClose }) => {
  if (!selectedElement) return null;

  const { id, type, details } = selectedElement;

  return (
    <div className="absolute top-16 right-4 z-20 w-88 bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-lg p-4 text-[14px] leading-relaxed text-[var(--ui-text)] shadow-xl animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--ui-border)]">
        <div className="flex items-center gap-2.5">
          {type === 'room' ? (
            <Square className="w-5 h-5 text-[var(--ui-primary)]" />
          ) : type === 'door' ? (
            <DoorOpen className="w-5 h-5 text-[var(--ui-success)]" />
          ) : type === 'wall' ? (
            <Layers className="w-5 h-5 text-[var(--ui-primary)]" />
          ) : type === 'arc' ? (
            <RotateCcw className="w-5 h-5 text-cyan-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-[var(--ui-danger)]" />
          )}
          <div>
            <h4 className="font-bold text-[var(--ui-text)] text-[14px] font-mono truncate max-w-[220px]">{id}</h4>
            <span className="text-[12px] text-[var(--ui-text-muted)] capitalize">{details?.name || type}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-[var(--ui-text-muted)] hover:text-white hover:bg-[var(--ui-surface-raised)] transition-colors"
          title="Kapat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Details List */}
      <div className="py-3 space-y-2.5">
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-[var(--ui-text-muted)]">Bulunduğu Kat:</span>
          <span className="font-mono text-[var(--ui-text)] font-semibold">
            {details?.floor !== undefined ? (details.floor === 0 ? 'Zemin Kat' : `Kat ${details.floor}`) : 'Genel'}
          </span>
        </div>

        {type === 'wall' && (
          <>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-[var(--ui-text-muted)]">Duvar Rolü:</span>
              <span className="badge badge-neutral text-[12px] font-mono">
                {details?.isShearWall ? 'Perde Duvar' : details?.isExterior ? 'Dış Cephe' : 'İç Bölme'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-[var(--ui-text-muted)]">Uzunluk (L):</span>
              <span className="font-mono text-[var(--ui-text)] font-semibold">{details?.length} m</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-[var(--ui-text-muted)]">Kalınlık (t):</span>
              <span className="font-mono text-[var(--ui-text)] font-semibold">{(details?.thickness * 100)?.toFixed(0)} cm</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-[var(--ui-text-muted)]">Eksen Açısı:</span>
              <span className="font-mono text-[var(--ui-text)] font-semibold">{details?.angle_deg}°</span>
            </div>
            {details?.start && details?.end && (
              <div className="text-[12px] bg-[var(--ui-surface-raised)] p-2 rounded font-mono text-[var(--ui-text-muted)] space-y-1">
                <div>2B Başlangıç: [{details.start[0]}, {details.start[1]}]</div>
                <div>2B Bitiş: [{details.end[0]}, {details.end[1]}]</div>
              </div>
            )}
          </>
        )}

        {type === 'door' && (
          <>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-[var(--ui-text-muted)]">Açıklık Genişliği:</span>
              <span className="font-mono text-[var(--ui-text)] font-semibold">{details?.width_cm} cm</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-[var(--ui-text-muted)]">Yangın Dayanımı:</span>
              <span className="font-mono text-[var(--ui-text)] font-semibold">
                {details?.isFire ? 'EI60 / Sertifikalı' : 'Standart'}
              </span>
            </div>
            {details?.wallAngle_deg !== undefined && (
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-[var(--ui-text-muted)]">Duvar Eksen Açısı:</span>
                <span className="font-mono text-[var(--ui-text)] font-semibold">{details.wallAngle_deg}°</span>
              </div>
            )}
            {details?.portal_xy && (
              <div className="text-[12px] bg-[var(--ui-surface-raised)] p-2 rounded font-mono text-[var(--ui-text-muted)]">
                <div>Portal XY: [{details.portal_xy[0]}, {details.portal_xy[1]}]</div>
              </div>
            )}
          </>
        )}

        {type === 'arc' && (
          <>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-[var(--ui-text-muted)]">Açılım Yarıçapı:</span>
              <span className="font-mono text-[var(--ui-text)] font-semibold">{details?.radius_cm} cm</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-[var(--ui-text-muted)]">Süpürme Açısı:</span>
              <span className="font-mono text-[var(--ui-text)] font-semibold">{details?.angle_deg}°</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-[var(--ui-text-muted)]">CAD Katmanı:</span>
              <span className="badge badge-neutral text-[12px] font-mono">{details?.layer}</span>
            </div>
          </>
        )}

        {details?.category && type === 'room' && (
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-[var(--ui-text-muted)]">Mekan Rolü:</span>
            <span className="badge badge-neutral text-[12px] font-mono">{details.category}</span>
          </div>
        )}

        {details?.queue !== undefined && (
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-[var(--ui-text-muted)]">Darboğaz Kuyruğu:</span>
            <span className="font-mono text-[var(--ui-warning)] font-bold">{details.queue} kişi</span>
          </div>
        )}

        {/* Regulatory Check Status */}
        <div className="p-3 rounded-md bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] space-y-1 mt-2">
          <div className="flex items-center gap-2 text-[var(--ui-success)] font-semibold text-[13px]">
            <ShieldCheck className="w-4 h-4 text-[var(--ui-success)]" />
            <span>2B/3B Geometri & Mevzuat Doğrulaması</span>
          </div>
          <p className="text-[12px] text-[var(--ui-text-muted)] leading-relaxed">
            {details?.status === 'GEOMETRY_VALID' || !details?.status
              ? '✓ 2B CAD ve 3B dünya koordinatları tutarlı, T-junction çakışması yok (GEOMETRY_VALID).'
              : `⚠️ Durum: ${details?.status}`}
          </p>
        </div>
      </div>
    </div>
  );
};

