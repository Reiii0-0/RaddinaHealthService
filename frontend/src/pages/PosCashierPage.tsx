import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Clock,
  RotateCw,
  Search,
  ShoppingCart,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  FefoItemPreviewDto,
  MedicineSummaryDto,
  PricingTier,
} from '@shared/api-contracts';
import { medicinesApi, salesApi } from '@/lib/api-client';
import { formatDateId, formatNumberId, formatRupiah } from '@/lib/formatters';
import { applyWorstCaseFefoPreviews, useWorstCaseMode } from '@/lib/worst-case-fixtures';
import { useAuthStore } from '@/stores/auth.store';
import { usePosCartStore } from '@/stores/pos-cart.store';
import { CartTable } from '@/components/pos/CartTable';
import { CheckoutModal } from '@/components/pos/CheckoutModal';
import { FefoBatchStrip } from '@/components/pos/FefoBatchStrip';
import { PosSearchCommand } from '@/components/pos/PosSearchCommand';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { posAudio } from '@/lib/audio-feedback';

export function PosCashierPage() {
  const user = useAuthStore((s) => s.user);
  const items = usePosCartStore((s) => s.items);
  const selectedIndex = usePosCartStore((s) => s.selectedIndex);
  const pricingTier = usePosCartStore((s) => s.pricingTier);
  const setPricingTier = usePosCartStore((s) => s.setPricingTier);
  const togglePricingTier = usePosCartStore((s) => s.togglePricingTier);
  const cycleItemUom = usePosCartStore((s) => s.cycleItemUom);
  const replaceItemWithSubstitute = usePosCartStore(
    (s) => s.replaceItemWithSubstitute,
  );

  const [isWorstCase] = useWorstCaseMode();
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [fefoPreviews, setFefoPreviews] = useState<FefoItemPreviewDto[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');

  // Perbarui jam operasional kasir setiap detik
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Hitung total tagihan dari keranjang
  const totalAmount = items.reduce((acc, item) => {
    const price =
      pricingTier === 'PARTNER'
        ? item.sellingPricePartner
        : item.sellingPriceRegular;
    return acc + price * item.qtyInUom;
  }, 0);

  const totalBaseUnits = items.reduce(
    (acc, it) => acc + it.qtyInUom * it.multiplierToBase,
    0,
  );

  // Ambil pratinjau alokasi FEFO dari server setiap kali keranjang atau pricingTier berubah
  useEffect(() => {
    if (items.length === 0) {
      setFefoPreviews([]);
      return;
    }

    let isCancelled = false;
    setIsLoadingPreview(true);

    const payload = {
      pricingTier,
      items: items.map((it) => ({
        medicineId: it.medicineId,
        uomUnitName: it.uomUnitName,
        qtyInUom: it.qtyInUom,
      })),
    };

    salesApi
      .previewFefo(payload)
      .then((res) => {
        if (!isCancelled) {
          const list = Array.isArray(res) ? res : res.items ?? [];
          const normalized = applyWorstCaseFefoPreviews(list);
          setFefoPreviews(normalized);
          setIsLoadingPreview(false);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          // Fallback lokal jika backend belum berjalan atau simulasi offline
          const fallbackList: FefoItemPreviewDto[] = items.map((it) => ({
            medicineId: it.medicineId,
            medicineName: it.name,
            activeIngredient: it.activeIngredient,
            uomUnitName: it.uomUnitName,
            qtyInUom: it.qtyInUom,
            multiplierToBase: it.multiplierToBase,
            requiredBaseQty: it.qtyInUom * it.multiplierToBase,
            totalAvailableActiveStock: it.totalActiveStockBaseUnit,
            isSufficient:
              it.totalActiveStockBaseUnit >= it.qtyInUom * it.multiplierToBase,
            shortageBaseQty: Math.max(
              0,
              it.qtyInUom * it.multiplierToBase - it.totalActiveStockBaseUnit,
            ),
            unitSellingPrice:
              pricingTier === 'PARTNER'
                ? it.sellingPricePartner
                : it.sellingPriceRegular,
            subtotal:
              (pricingTier === 'PARTNER'
                ? it.sellingPricePartner
                : it.sellingPriceRegular) * it.qtyInUom,
            allocations: [
              {
                batchId: `batch-${it.medicineId}-01`,
                batchNumber: 'B-2401',
                expiryDate: '2026-12-31',
                daysUntilExpiry: 420,
                allocatedBaseQty: Math.min(
                  it.totalActiveStockBaseUnit,
                  it.qtyInUom * it.multiplierToBase,
                ),
                availableStockBefore: it.totalActiveStockBaseUnit,
                remainingStockAfter: Math.max(
                  0,
                  it.totalActiveStockBaseUnit -
                    it.qtyInUom * it.multiplierToBase,
                ),
              },
            ],
            substitutes: [],
          }));
          setFefoPreviews(applyWorstCaseFefoPreviews(fallbackList));
          setIsLoadingPreview(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [items, pricingTier, isWorstCase]);

  // Handler pintasan keyboard global (0ms latency, tanpa animasi)
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT';

      if (e.key === 'F1') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (e.key === 'F2') {
        e.preventDefault();
        posAudio.playPriceToggle();
        togglePricingTier();
        toast.info(
          `Skema harga diubah ke: ${
            pricingTier === 'REGULAR' ? 'Harga Mitra' : 'Harga Reguler'
          }`,
        );
        return;
      }

      if (e.key === 'F4') {
        e.preventDefault();
        if (items.length > 0) {
          posAudio.playUomCycle();
          cycleItemUom(selectedIndex);
        }
        return;
      }

      if (e.key === 'F8') {
        e.preventDefault();
        if (items.length === 0) {
          toast.error('Tambahkan obat ke keranjang terlebih dahulu (F1).');
          return;
        }
        setIsCheckoutOpen(true);
        return;
      }

      if (
        !isInput &&
        (e.key === 'ArrowDown' || e.key === 'ArrowUp') &&
        items.length > 0
      ) {
        e.preventDefault();
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        const nextIdx = (selectedIndex + delta + items.length) % items.length;
        usePosCartStore.getState().setSelectedIndex(nextIdx);
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [items, selectedIndex, pricingTier, togglePricingTier, cycleItemUom]);

  // Item dan pratinjau FEFO yang aktif terpilih
  const selectedCartItem = items[selectedIndex] ?? null;
  const selectedItemPreview =
    fefoPreviews.find(
      (p) =>
        selectedCartItem &&
        p.medicineId === selectedCartItem.medicineId &&
        p.uomUnitName === selectedCartItem.uomUnitName,
    ) ??
    fefoPreviews[selectedIndex] ??
    null;

  // Temukan obat yang kekurangan stok untuk panel rekomendasi substitusi
  const insufficientItems = fefoPreviews.filter(
    (p) => !p.isSufficient || p.shortageBaseQty > 0,
  );

  const handleApplySubstitute = async (
    targetMedicineId: string,
    substituteMedId: string,
  ) => {
    try {
      const fullMed = await medicinesApi.detail(substituteMedId);
      replaceItemWithSubstitute(targetMedicineId, fullMed);
      toast.success(
        `Obat digantikan dengan substitusi zat aktif ${fullMed.name}.`,
      );
    } catch {
      toast.error('Gagal memuat rincian obat pengganti.');
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col justify-between pb-12">
      <div className="space-y-6">
        {/* Kepala Halaman: Judul, Info Kasir & Segmen Harga F2 */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-ink">
                Kasir
              </h1>
              {user && (
                <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-soft">
                  <span className="h-1.5 w-1.5 rounded-full bg-action" />
                  <span className="font-semibold">{user.fullName}</span>
                  <span className="text-ink-muted font-mono">({user.role})</span>
                </div>
              )}
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              Penjualan cepat dengan alokasi otomatis FEFO atomik
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Waktu kasir */}
            <div className="hidden items-center gap-1.5 text-xs text-ink-muted sm:flex">
              <Clock className="h-3.5 w-3.5 text-ink-soft" />
              <span className="tabular-nums font-mono text-ink-soft">{currentTime}</span>
            </div>

            {/* Segmen Reguler atau Mitra (F2) */}
            <div className="inline-flex rounded-control border border-line bg-sunken p-1">
              <button
                type="button"
                onClick={() => {
                  if (pricingTier !== 'REGULAR') {
                    posAudio.playPriceToggle();
                    setPricingTier('REGULAR');
                  }
                }}
                className={`rounded-control px-3 py-1.5 text-xs font-semibold transition-colors ${
                  pricingTier === 'REGULAR'
                    ? 'border border-line bg-surface text-ink shadow-xs'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Reguler
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pricingTier !== 'PARTNER') {
                    posAudio.playPriceToggle();
                    setPricingTier('PARTNER');
                  }
                }}
                className={`flex items-center gap-1 rounded-control px-3 py-1.5 text-xs font-semibold transition-colors ${
                  pricingTier === 'PARTNER'
                    ? 'border border-line bg-surface text-ink shadow-xs'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                <span>Mitra</span>
                <span className="rounded bg-mint/50 px-1 py-0.2 text-[10px] text-ink font-mono font-bold">
                  F2
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Bilah Pencarian Obat F1 */}
        <div className="w-full">
          <PosSearchCommand inputRef={searchInputRef} />
        </div>

        {/* Dua Zona: Kiri (Keranjang & FEFO) + Kanan (Ringkasan Lebar 360px Sticky) */}
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Zona Kiri: Keranjang & Alokasi FEFO */}
          <div className="min-w-0 flex-1 space-y-5">
            {/* Tabel Keranjang */}
            <CartTable />

            {/* Pita Kesegaran Alokasi Batch FEFO */}
            <div className="rounded-panel border border-line bg-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-ink">
                    Pita alokasi batch FEFO baris terpilih
                  </h3>
                  <p className="text-[11px] text-ink-muted">
                    Urutan batch terpotong otomatis dari masa kedaluwarsa terdekat
                  </p>
                </div>
                {isLoadingPreview && (
                  <span className="flex items-center gap-1.5 text-xs text-action">
                    <RotateCw className="h-3 w-3 animate-spin" />
                    <span>Memverifikasi alokasi batch</span>
                  </span>
                )}
              </div>

              <FefoBatchStrip
                itemPreview={selectedItemPreview}
                medicineName={selectedCartItem?.name}
                baseUnit={selectedCartItem?.baseUnit}
              />
            </div>

            {/* Rekomendasi Substitusi Zat Aktif Jika Stok Kurang (422) */}
            {insufficientItems.length > 0 && (
              <div className="rounded-panel border border-danger-ink/30 bg-danger-soft p-4 text-xs text-danger-ink">
                <div className="flex items-center gap-2 font-semibold text-danger-ink">
                  <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
                  <span>Stok layak jual tidak mencukupi</span>
                </div>
                <p className="mt-1 text-xs text-danger-ink">
                  Stok obat pada baris keranjang berikut kurang dari jumlah yang diminta. Pilih obat pengganti dengan zat aktif yang sama di bawah ini:
                </p>

                <div className="mt-3 divide-y divide-danger-ink/20 rounded-control border border-danger-ink/30 bg-surface text-ink">
                  {insufficientItems.map((item) => (
                    <div key={item.medicineId} className="p-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-ink">
                          {item.medicineName}
                        </span>
                        <span className="tabular-nums font-mono font-semibold text-danger-ink">
                          Kurang {formatNumberId(item.shortageBaseQty)} satuan dasar
                        </span>
                      </div>

                      <div className="mt-0.5 text-[11px] text-ink-muted">
                        Zat aktif: <span className="font-medium text-ink">{item.activeIngredient}</span>
                      </div>

                      {item.substitutes && item.substitutes.length > 0 ? (
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          {item.substitutes.map((sub) => (
                            <button
                              key={sub.medicineId}
                              type="button"
                              onClick={() =>
                                handleApplySubstitute(item.medicineId, sub.medicineId)
                              }
                              className="inline-flex items-center gap-1.5 rounded-control border border-line-input bg-surface px-2.5 py-1 text-xs font-semibold text-ink hover:bg-hover active:bg-selected"
                            >
                              <span>{sub.name}</span>
                              <span className="tabular-nums font-mono text-[11px] text-ink-muted">
                                ({formatNumberId(sub.availableActiveStock)} {sub.baseUnit})
                              </span>
                              <span className="text-[11px] text-action font-medium underline">
                                Ganti
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-[11px] text-ink-muted italic">
                          Tidak ada obat alternatif lain dengan zat aktif {item.activeIngredient} yang memiliki stok aktif di apotek.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Zona Kanan: Ringkasan Transaksi Lebar 360px Sticky Berlatar Sage */}
          <div className="w-full shrink-0 lg:w-[360px]">
            <div className="sticky top-6 rounded-panel border border-line-input/50 bg-sage p-6 text-ink space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-ink">
                  Ringkasan
                </h2>
                {pricingTier === 'PARTNER' && (
                  <span className="rounded-full bg-sand px-2.5 py-0.5 text-xs font-semibold text-ink border border-line-input">
                    Harga mitra
                  </span>
                )}
              </div>

              <div className="space-y-2.5 text-xs text-ink-soft">
                <div className="flex items-center justify-between">
                  <span>Jumlah item</span>
                  <span className="tabular-nums font-mono font-semibold text-ink">
                    {items.length} obat
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Total unit dasar</span>
                  <span className="tabular-nums font-mono font-semibold text-ink">
                    {formatNumberId(totalBaseUnits)} unit
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span className="tabular-nums font-mono font-semibold text-ink">
                    {formatRupiah(totalAmount)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Diskon</span>
                  <span className="tabular-nums font-mono font-semibold text-ink">
                    Rp 0
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span>PPN 0% (obat resep)</span>
                  <span className="tabular-nums font-mono font-semibold text-ink">
                    Rp 0
                  </span>
                </div>
              </div>

              <hr className="border-t border-line-input/40" />

              <div>
                <span className="text-xs font-semibold tracking-wide text-ink-soft">
                  Total
                </span>
                <div className="tabular-nums mt-1 text-3xl font-bold tracking-tight text-ink sm:text-4xl font-mono">
                  {formatRupiah(totalAmount)}
                </div>
              </div>

              <button
                type="button"
                disabled={items.length === 0}
                onClick={() => setIsCheckoutOpen(true)}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-control bg-action px-4 text-base font-semibold text-white shadow-xs transition-colors hover:bg-action-hover active:bg-action-press disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span>Bayar</span>
                <kbd className="tabular-nums rounded border border-white/30 bg-action-press px-1.5 py-0.5 text-xs font-semibold text-white font-mono">
                  F8
                </kbd>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bilah Pintasan Bawah (Tinggi 40px, bg-sunken border-t border-line) */}
      <footer className="fixed bottom-0 left-0 right-0 z-20 flex h-10 items-center justify-between border-t border-line bg-sunken px-6 text-xs text-ink-soft">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => {
              searchInputRef.current?.focus();
              searchInputRef.current?.select();
            }}
            className="flex items-center gap-1.5 hover:text-ink"
          >
            <kbd className="tabular-nums rounded border border-line-input/60 bg-surface px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink shadow-2xs">
              F1
            </kbd>
            <span>Cari</span>
          </button>

          <button
            type="button"
            onClick={() => {
              posAudio.playPriceToggle();
              togglePricingTier();
            }}
            className="flex items-center gap-1.5 hover:text-ink"
          >
            <kbd className="tabular-nums rounded border border-line-input/60 bg-surface px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink shadow-2xs">
              F2
            </kbd>
            <span>Harga Reguler/Mitra</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (items.length > 0) {
                posAudio.playUomCycle();
                cycleItemUom(selectedIndex);
              }
            }}
            className="flex items-center gap-1.5 hover:text-ink"
          >
            <kbd className="tabular-nums rounded border border-line-input/60 bg-surface px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink shadow-2xs">
              F4
            </kbd>
            <span>Ganti satuan</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (items.length > 0) {
                setIsCheckoutOpen(true);
              }
            }}
            className="flex items-center gap-1.5 hover:text-ink"
          >
            <kbd className="tabular-nums rounded border border-line-input/60 bg-surface px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink shadow-2xs">
              F8
            </kbd>
            <span>Bayar</span>
          </button>
        </div>

        <div className="hidden items-center gap-4 text-[11px] text-ink-muted md:flex">
          <span>Gunakan panah ↑/↓ untuk navigasi baris keranjang</span>
        </div>
      </footer>

      {/* Modal Pembayaran Checkout F8 */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        totalAmount={totalAmount}
      />
    </div>
  );
}

export default PosCashierPage;
