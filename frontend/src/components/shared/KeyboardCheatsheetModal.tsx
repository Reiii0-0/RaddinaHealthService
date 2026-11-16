import React, { useEffect } from 'react';
import { X, Keyboard, Command } from 'lucide-react';

interface KeyboardCheatsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutEntry {
  key: string;
  action: string;
  scope: string;
  description: string;
}

const SHORTCUTS: ShortcutEntry[] = [
  {
    key: 'F1',
    action: 'Cari Obat Cepat',
    scope: 'Kasir POS',
    description: 'Membuka dan memfokuskan kursor ke bilah pencarian obat instan tanpa jeda.',
  },
  {
    key: 'F2',
    action: 'Alih Skema Harga',
    scope: 'Kasir POS',
    description: 'Beralih seketika antara Skema Harga Reguler (eceran umum) dan Skema Harga Mitra (apotek mitra).',
  },
  {
    key: 'F4',
    action: 'Putar Satuan Kemasan',
    scope: 'Kasir POS',
    description: 'Mengganti satuan UOM item terpilih secara siklis (Box → Strip → Tablet) dengan rasio harga otomatis.',
  },
  {
    key: 'F8',
    action: 'Bayar & Selesaikan',
    scope: 'Kasir POS',
    description: 'Membuka modal pembayaran cepat, memasukkan nominal uang, dan menerbitkan struk transaksi.',
  },
  {
    key: '↑ / ↓',
    action: 'Navigasi Baris',
    scope: 'Kasir POS',
    description: 'Memilih baris obat aktif pada keranjang belanja tanpa menggunakan kursor mouse.',
  },
  {
    key: 'Esc',
    action: 'Tutup Dialog / Modal',
    scope: 'Global',
    description: 'Menutup dialog modal yang sedang aktif, membatalkan aksi, atau menutup panel samping.',
  },
  {
    key: '?',
    action: 'Buka Panduan Pintasan',
    scope: 'Global',
    description: 'Menampilkan lembar panduan cepat seluruh pintasan papan ketik operasional ini.',
  },
];

export const KeyboardCheatsheetModal: React.FC<KeyboardCheatsheetModalProps> = ({
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
      aria-labelledby="keyboard-shortcuts-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="modal-panel-enter relative w-full max-w-xl rounded-2xl border border-[#DCE3E0] bg-[#FFFFFF] shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-[#F8FAF9]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h2 id="keyboard-shortcuts-title" className="text-sm font-bold text-[#0F172A]">
                Pintasan Papan Ketik Kasir Instan
              </h2>
              <p className="text-[11px] text-[#64748B]">
                Ergonomi operasional berkecepatan tinggi dengan latensi respon 0ms
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            title="Tutup (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content List */}
        <div className="p-6 divide-y divide-slate-100 overflow-y-auto max-h-[70vh]">
          {SHORTCUTS.map((sc) => (
            <div key={sc.key} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#0F172A]">{sc.action}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-[#475569] font-medium">
                    {sc.scope}
                  </span>
                </div>
                <p className="text-[11px] text-[#64748B] mt-0.5">{sc.description}</p>
              </div>

              <kbd className="shrink-0 px-2.5 py-1 rounded-md bg-[#F1F5F9] border border-[#CBD5E1] text-xs font-mono font-bold text-[#0F172A] shadow-2xs">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#E2E8F0] bg-[#F8FAF9] flex items-center justify-between text-xs text-[#64748B]">
          <span className="text-[11px] font-mono">
            Tekan <kbd className="font-bold px-1 bg-white border border-slate-300 rounded">Esc</kbd> untuk menutup
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#0F766E] hover:bg-[#115E59] text-white font-semibold text-xs transition"
          >
            Mengerti
          </button>
        </div>
      </div>
    </div>
  );
};
