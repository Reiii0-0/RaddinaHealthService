import React, { useEffect } from 'react';
import { X, Sparkles, Activity } from 'lucide-react';
import { Asclepius3DExperience } from './Asclepius3DExperience';

interface AsclepiusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AsclepiusModal: React.FC<AsclepiusModalProps> = ({
  isOpen,
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="asclepius-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="modal-panel-enter relative w-full max-w-4xl bg-[#062A27] border border-emerald-800/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-emerald-900/80 bg-[#041F1D]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300">
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 id="asclepius-modal-title" className="text-sm font-bold text-white tracking-wide">
                Inspeksi 3D Asklepios &amp; Bio-Intelligence
              </h2>
              <p className="text-[11px] text-emerald-300/70 font-mono">
                Visualisasi Lambang Farmasi &amp; Struktur Molekuler WebGL
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-300/70 hover:text-white hover:bg-emerald-900/60 transition"
            title="Tutup (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3D Canvas Body */}
        <div className="p-4 sm:p-6">
          <Asclepius3DExperience
            compact={false}
            className="w-full"
            initialMode="asclepius"
            showControls={true}
          />
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-emerald-900/80 bg-[#041F1D] flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-200/80">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span className="font-mono text-[11px]">
              Greek Classical Symbol of Medicine &amp; Ethical Stewardship
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
