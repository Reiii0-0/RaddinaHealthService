import React from 'react';
import { FlaskConical, RotateCcw } from 'lucide-react';
import { useWorstCaseMode } from '@/lib/worst-case-fixtures';

export interface WorstCaseBannerProps {
  compact?: boolean;
  className?: string;
}

export function WorstCaseBanner({ compact = false, className = '' }: WorstCaseBannerProps) {
  const [worstMode, setWorstMode] = useWorstCaseMode();

  if (compact) {
    return (
      <div
        className={`inline-flex items-center rounded-lg border border-[#DCE3E0] bg-[#F4F6F5] p-0.5 text-xs ${className}`}
        role="group"
        aria-label="Pengalih Mode Data Uji"
      >
        <button
          type="button"
          onClick={() => setWorstMode(false)}
          className={`pos-instant rounded-md px-2.5 py-1 font-medium ${
            !worstMode
              ? 'bg-[#FFFFFF] text-[#0F172A] border border-[#DCE3E0]'
              : 'text-[#475569] hover:text-[#0F172A]'
          }`}
        >
          Data Normal
        </button>
        <button
          type="button"
          onClick={() => setWorstMode(true)}
          className={`pos-instant inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium ${
            worstMode
              ? 'bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]'
              : 'text-[#475569] hover:text-[#0F172A]'
          }`}
        >
          <FlaskConical className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          <span>Uji Ekstrem (?data=worst)</span>
        </button>
      </div>
    );
  }

  if (!worstMode) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-2.5 text-xs text-[#92400E] ${className}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <FlaskConical className="h-4 w-4 shrink-0 text-[#D97706]" strokeWidth={1.75} />
        <p className="min-w-0 leading-relaxed">
          <span className="font-semibold">Mode Uji Ketahanan UI (?data=worst) Aktif:</span>{' '}
          Menyuntikkan nama obat 135 karakter, komposisi zat aktif panjang, harga{' '}
          <span className="tabular-nums font-semibold">Rp 89.450.000</span>, kuantitas{' '}
          <span className="tabular-nums font-semibold">245.000 Tablet</span>, stok{' '}
          <span className="tabular-nums font-semibold">0</span>, dan SIPA kedaluwarsa.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setWorstMode(false)}
        className="pos-instant inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#FDE68A] bg-[#FFFFFF] px-3 py-1.5 text-xs font-semibold text-[#92400E] hover:bg-[#FEF3C7]"
      >
        <RotateCcw className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        <span>Kembali ke Data Normal</span>
      </button>
    </div>
  );
}

export default WorstCaseBanner;
