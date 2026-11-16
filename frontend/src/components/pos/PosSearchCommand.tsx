import React, { useEffect, useRef, useState, useTransition } from 'react';
import { CornerDownLeft, Loader2, Package, Search, X } from 'lucide-react';
import type { MedicineSummaryDto } from '@shared/api-contracts';
import { medicinesApi } from '@/lib/api-client';
import { formatNumberId, formatRupiah } from '@/lib/formatters';
import { applyWorstCaseMedicines, useWorstCaseMode } from '@/lib/worst-case-fixtures';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { usePosCartStore } from '@/stores/pos-cart.store';
import { posAudio } from '@/lib/audio-feedback';

export interface PosSearchCommandProps {
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onSelectMedicine?: (medicine: MedicineSummaryDto) => void;
  className?: string;
}

export function PosSearchCommand({
  inputRef: externalInputRef,
  onSelectMedicine,
  className = '',
}: PosSearchCommandProps) {
  const internalInputRef = useRef<HTMLInputElement | null>(null);
  const activeInputRef = externalInputRef ?? internalInputRef;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MedicineSummaryDto[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [, startTransition] = useTransition();

  const [isWorstCase] = useWorstCaseMode();
  const addItem = usePosCartStore((s) => s.addItem);
  const pricingTier = usePosCartStore((s) => s.pricingTier);

  // Mengambil daftar obat berdasarkan query
  useEffect(() => {
    let isCancelled = false;
    const trimmed = query.trim();

    if (!trimmed) {
      setIsLoading(true);
      medicinesApi
        .list({ limit: 10 })
        .then((res) => {
          if (!isCancelled) {
            const data = applyWorstCaseMedicines(res.items);
            setResults(data);
            setSelectedIndex(0);
            setIsLoading(false);
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setResults([]);
            setIsLoading(false);
          }
        });
      return () => {
        isCancelled = true;
      };
    }

    setIsLoading(true);
    const debounceTimer = setTimeout(() => {
      medicinesApi
        .list({ search: trimmed, limit: 15 })
        .then((res) => {
          if (!isCancelled) {
            const data = applyWorstCaseMedicines(res.items);
            setResults(data);
            setSelectedIndex(0);
            setIsLoading(false);
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setResults([]);
            setIsLoading(false);
          }
        });
    }, 100);

    return () => {
      isCancelled = true;
      clearTimeout(debounceTimer);
    };
  }, [query, isWorstCase]);

  // Pintasan Keyboard F1 untuk memfokuskan pencarian instan (0ms)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        activeInputRef.current?.focus();
        activeInputRef.current?.select();
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeInputRef]);

  const handleSelect = (medicine: MedicineSummaryDto) => {
    posAudio.playItemAdd();
    if (onSelectMedicine) {
      onSelectMedicine(medicine);
    } else {
      addItem(medicine);
    }
    setQuery('');
    // Tetap fokus di input untuk obat berikutnya
    activeInputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % results.length);
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (results.length > 0 && results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      activeInputRef.current?.blur();
      return;
    }
  };

  return (
    <div className={`relative w-full ${className}`}>
      {/* Kolom Pencarian Input (Tinggi 48px/56px) */}
      <div className="relative flex items-center">
        <div className="pointer-events-none absolute left-3.5 flex items-center text-ink-muted">
          <Search className="h-5 w-5" strokeWidth={1.75} />
        </div>

        <input
          ref={activeInputRef}
          type="text"
          value={query}
          onChange={(e) => {
            const val = e.target.value;
            startTransition(() => {
              setQuery(val);
              setIsOpen(true);
            });
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Cari obat atau zat aktif... (tekan F1)"
          className="h-12 w-full rounded-control border border-line-input bg-surface py-2.5 pr-24 pl-11 text-sm text-ink placeholder:text-ink-muted focus:border-action focus:ring-2 focus:ring-mint focus:outline-none"
        />

        <div className="absolute right-3 flex items-center gap-1.5">
          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-action" strokeWidth={2} />
          )}

          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setIsOpen(false);
                activeInputRef.current?.focus();
              }}
              className="pos-instant rounded p-1 text-ink-muted hover:bg-hover hover:text-ink"
              title="Bersihkan"
              aria-label="Bersihkan pencarian"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          <kbd
            className="tabular-nums flex h-6 items-center rounded border border-line bg-sunken px-2 text-xs font-semibold text-ink-soft"
            title="Pintasan F1"
          >
            F1
          </kbd>
        </div>
      </div>

      {/* Palet Hasil Pencarian Instan (0ms latency, tanpa animasi) */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <div className="absolute top-full right-0 left-0 z-30 mt-1 max-h-96 overflow-y-auto rounded-sheet border border-line-input bg-surface shadow-float">
            {results.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm font-semibold text-ink">
                  Obat tidak ditemukan
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  Periksa ejaan nama obat, kandungan zat aktif, atau kode SKU.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-line" role="listbox">
                {results.map((med, idx) => {
                  const isHighlighted = idx === selectedIndex;
                  const activeStock = med.totalActiveStockBaseUnit;
                  const isStockAvailable = activeStock > 0;
                  const baseUom = med.uomConversions?.find((u) => u.multiplierToBase === 1);
                  const displayPrice =
                    pricingTier === 'PARTNER'
                      ? baseUom?.sellingPricePartner ?? 0
                      : baseUom?.sellingPriceRegular ?? 0;

                  return (
                    <li
                      key={med.id}
                      role="option"
                      aria-selected={isHighlighted}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => handleSelect(med)}
                      className={`pos-instant flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
                        isHighlighted
                          ? 'bg-selected border-l-[3px] border-l-action'
                          : 'bg-surface hover:bg-hover'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-ink">
                            {med.name}
                          </span>
                          <StatusBadge
                            kind="drug"
                            classification={med.classification}
                            compact
                          />
                        </div>

                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                          <span className="font-mono tabular-nums">SKU: {med.sku}</span>
                          <span>•</span>
                          <span className="truncate max-w-[280px]">
                            {med.activeIngredient}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-end text-right">
                        <div className="tabular-nums font-mono text-sm font-semibold text-ink">
                          {formatRupiah(displayPrice)}
                          <span className="text-xs font-normal text-ink-muted">
                            /{med.baseUnit}
                          </span>
                        </div>

                        <div className="mt-0.5 flex items-center gap-1">
                          <Package
                            className={`h-3.5 w-3.5 ${
                              isStockAvailable ? 'text-action' : 'text-danger'
                            }`}
                          />
                          <span
                            className={`tabular-nums text-xs font-semibold ${
                              isStockAvailable ? 'text-ink' : 'text-danger'
                            }`}
                          >
                            Stok: {formatNumberId(activeStock)} {med.baseUnit}
                          </span>
                        </div>

                        {isHighlighted && (
                          <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-action">
                            <CornerDownLeft className="h-3 w-3" />
                            <span>Tekan Enter</span>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="border-t border-line bg-sunken px-4 py-2.5 text-xs text-ink-soft flex items-center justify-between">
              <span>Gunakan panah ↑/↓ untuk memilih, Enter untuk memasukkan ke keranjang.</span>
              <span className="font-semibold text-ink">{results.length} obat ditemukan</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default PosSearchCommand;
