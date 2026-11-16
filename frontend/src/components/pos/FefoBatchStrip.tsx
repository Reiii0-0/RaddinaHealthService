import React from 'react';
import type { FefoBatchSliceDto, FefoItemPreviewDto } from '@shared/api-contracts';
import {
  computeDaysUntilExpiry,
  formatDateId,
  formatNumberId,
  getFreshnessMeta,
} from '@/lib/formatters';

export interface FefoBatchStripProps {
  itemPreview?: FefoItemPreviewDto | null;
  medicineName?: string;
  baseUnit?: string;
  className?: string;
  compact?: boolean; // compact = 12px height (keranjang), non-compact = 20px (laci stok)
}

export function FefoBatchStrip({
  itemPreview,
  medicineName,
  baseUnit = 'tablet',
  className = '',
  compact = true,
}: FefoBatchStripProps) {
  if (!itemPreview || !itemPreview.allocations || itemPreview.allocations.length === 0) {
    return (
      <div className={`text-xs text-ink-muted ${className}`}>
        <span>Belum ada alokasi batch FEFO untuk item ini.</span>
      </div>
    );
  }

  const { allocations = [], requiredBaseQty = 0 } = itemPreview;
  const resolvedMedName = itemPreview.medicineName || medicineName || 'Obat';

  // Hitung total alokasi
  const totalAllocated = allocations.reduce((sum, a) => sum + (a.allocatedBaseQty || 0), 0);
  const totalBase = Math.max(requiredBaseQty, totalAllocated, 1);

  // Cari ED terdekat
  const earliestDays = allocations.reduce<number | null>((min, a) => {
    const days = computeDaysUntilExpiry(a.expiryDate);
    if (days === null) return min;
    return min === null ? days : Math.min(min, days);
  }, null);

  const summaryText = allocations
    .map((a) => `${a.batchNumber} × ${formatNumberId(a.allocatedBaseQty)}`)
    .join(', ');

  const ariaSummary = `Dipotong dari ${allocations.length} batch: ${summaryText}. ${
    earliestDays !== null ? `ED terdekat ${earliestDays} hari.` : ''
  }`;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* Header baris kecil bila tidak kompak */}
      {!compact && (
        <div className="flex items-center justify-between text-xs text-ink">
          <span className="font-semibold">{resolvedMedName}</span>
          <span className="tabular-nums text-ink-soft">
            {formatNumberId(requiredBaseQty)} {baseUnit}
          </span>
        </div>
      )}

      {/* Rangkaian Segmen Pita Kesegaran */}
      <div
        tabIndex={0}
        role="group"
        aria-label={ariaSummary}
        className={`flex w-full overflow-hidden rounded-full border border-line-input bg-canvas focus-visible:outline-action ${
          compact ? 'h-3' : 'h-5'
        }`}
      >
        {allocations.map((alloc: FefoBatchSliceDto, idx: number) => {
          const days = computeDaysUntilExpiry(alloc.expiryDate) ?? 180;
          const meta = getFreshnessMeta(days);
          const pct = Math.max(8, Math.min(100, ((alloc.allocatedBaseQty || 0) / totalBase) * 100));

          return (
            <div
              key={alloc.batchId || idx}
              style={{ width: `${pct}%` }}
              title={`Lot ${alloc.batchNumber} • ED: ${formatDateId(alloc.expiryDate)} (${days} hr) • Dipotong: ${alloc.allocatedBaseQty} ${baseUnit}`}
              className={`relative flex items-center justify-center border-r-2 border-white last:border-r-0 ${meta.fillClass} text-[10px] text-ink font-semibold select-none`}
            >
              {!compact && pct >= 25 && (
                <span className="truncate px-1 tabular-nums">
                  {alloc.batchNumber} ({formatNumberId(alloc.allocatedBaseQty)})
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Teks Ringkasan Mono Ink-Soft di Bawah Pita */}
      <div className="flex items-center justify-between text-xs text-ink-soft">
        <span className="tabular-nums font-mono">{summaryText}</span>
        {earliestDays !== null && (
          <span className="tabular-nums text-ink-muted text-[11px]">
            ED terdekat {earliestDays} hari
          </span>
        )}
      </div>
    </div>
  );
}
