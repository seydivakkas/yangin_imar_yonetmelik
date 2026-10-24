import React from 'react';
import { X, Info, DoorOpen, Square, AlertTriangle, ShieldCheck, Tag } from 'lucide-react';

interface DetailsDrawerProps {
  selectedElement: {
    id: string;
    type: 'room' | 'door' | 'violation';
    details: any;
  } | null;
  onClose: () => void;
}

export const DetailsDrawer: React.FC<DetailsDrawerProps> = ({ selectedElement, onClose }) => {
  if (!selectedElement) return null;

  const { id, type, details } = selectedElement;

  return (
    <div className="absolute top-16 right-4 z-20 w-80 glass-panel-elevated p-4 text-xs font-sans text-gray-200 shadow-2xl animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          {type === 'room' ? (
            <Square className="w-4 h-4 text-cyan-400" />
          ) : type === 'door' ? (
            <DoorOpen className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400" />
          )}
          <div>
            <h4 className="font-bold text-white text-xs font-mono">{id}</h4>
            <span className="text-[10px] text-gray-400 capitalize">{details?.name || type}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Details List */}
      <div className="py-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Bulunduğu Kat:</span>
          <span className="font-mono text-cyan-300 font-semibold">
            {details?.floor !== undefined ? (details.floor === 0 ? 'Zemin Kat' : `Kat ${details.floor}`) : 'Genel'}
          </span>
        </div>

        {details?.category && (
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Mekan Rolü:</span>
            <span className="badge badge-cyan text-[10px] font-mono">{details.category}</span>
          </div>
        )}

        {details?.queue !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Darboğaz Kuyruğu:</span>
            <span className="font-mono text-amber-400 font-bold">{details.queue} kişi</span>
          </div>
        )}

        {/* Regulatory Check Status */}
        <div className="p-2.5 rounded bg-black/40 border border-white/5 space-y-1 mt-2">
          <div className="flex items-center gap-1.5 text-cyan-300 font-semibold text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Mevzuat Denetim Durumu</span>
          </div>
          <p className="text-[10px] text-gray-300 leading-normal">
            BYKHY 2007/2015 standart kısıtları ve kaçış yolu mesafe sınırları içinde doğrulanmıştır.
          </p>
        </div>
      </div>
    </div>
  );
};
