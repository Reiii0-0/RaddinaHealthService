import React, { useEffect, useId, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Printer,
  QrCode,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { PaymentMethod } from '@shared/api-contracts';
import { type SaleTransactionDto, salesApi } from '@/lib/api-client';
import { formatDateId, formatNumberId, formatRupiah } from '@/lib/formatters';
import { posAudio } from '@/lib/audio-feedback';
import { usePosCartStore } from '@/stores/pos-cart.store';

export interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalAmount: number;
}

export function CheckoutModal({
  isOpen,
  onClose,
  totalAmount,
}: CheckoutModalProps) {
  const customerNameId = useId();
  const amountPaidId = useId();

  const items = usePosCartStore((s) => s.items);
  const pricingTier = usePosCartStore((s) => s.pricingTier);
  const customerName = usePosCartStore((s) => s.customerName);
  const paymentMethod = usePosCartStore((s) => s.paymentMethod);

  const setCustomerName = usePosCartStore((s) => s.setCustomerName);
  const setPaymentMethod = usePosCartStore((s) => s.setPaymentMethod);
  const clearCart = usePosCartStore((s) => s.clearCart);

  const [amountPaidInput, setAmountPaidInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedSale, setCompletedSale] = useState<SaleTransactionDto | null>(null);

  // Inisialisasi default amountPaid saat modal terbuka
  useEffect(() => {
    if (isOpen) {
      setAmountPaidInput(String(totalAmount));
      setCompletedSale(null);
    }
  }, [isOpen]);

  const parsedAmountPaid = Number(amountPaidInput) || 0;
  const changeAmount =
    paymentMethod === 'CASH'
      ? Math.max(0, parsedAmountPaid - totalAmount)
      : 0;
  const isPaymentSufficient =
    paymentMethod !== 'CASH' || parsedAmountPaid >= totalAmount;

  // Pintasan keyboard: F8 untuk konfirmasi bayar, Escape untuk tutup
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'F8') {
        e.preventDefault();
        if (isPaymentSufficient && !isSubmitting && !completedSale) {
          handleExecutePayment();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPaymentSufficient, isSubmitting, completedSale, totalAmount, amountPaidInput, paymentMethod]);

  const handleQuickAmount = (amount: number) => {
    setAmountPaidInput(String(amount));
  };

  const handleExecutePayment = async () => {
    if (items.length === 0) {
      toast.error('Keranjang transaksi belanja masih kosong');
      return;
    }

    if (!isPaymentSufficient) {
      toast.error('Nominal uang dibayarkan kurang dari total tagihan');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        pricingTier,
        customerName: customerName.trim() || undefined,
        paymentMethod,
        amountPaid: paymentMethod === 'CASH' ? parsedAmountPaid : totalAmount,
        items: items.map((it) => ({
          medicineId: it.medicineId,
          uomUnitName: it.uomUnitName,
          qtyInUom: it.qtyInUom,
        })),
      };

      const result = await salesApi.checkout(payload);
      posAudio.playCheckoutSuccess();
      setCompletedSale(result);
      toast.success(`Transaksi selesai. Struk ${result.receiptNumber} siap dicetak.`);
      clearCart();
    } catch (err: unknown) {
      posAudio.playWarning();
      const errMsg =
        err instanceof Error
          ? err.message
          : 'Gagal memproses transaksi kasir.';
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseAndReset = () => {
    setCompletedSale(null);
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-modal-heading"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Tirai Gelap Lembut */}
      <div
        className="fixed inset-0 bg-[#16281F]/40 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel Dialog (Maksimal 560px, rounded-sheet 24px) */}
      <div className="relative w-full max-w-[560px] rounded-sheet border border-line bg-surface shadow-float overflow-hidden">
        {completedSale ? (
          /* Pratinjau Struk Kasir Termal 80mm di Layar */
          <div className="flex max-h-[90vh] flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-6 py-3.5 bg-surface">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-mint text-ink border border-line-input">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <h2
                    id="checkout-modal-heading"
                    className="text-sm font-semibold text-ink"
                  >
                    Transaksi selesai
                  </h2>
                  <p className="text-xs text-ink-muted">
                    Struk siap dicetak dan alokasi stok FEFO berhasil dicatat.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseAndReset}
                className="rounded-control p-1 text-ink-muted hover:bg-hover hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Area Kertas Struk 80mm (Lebar 302px di Layar, Latar Paper) */}
            <div className="flex-1 overflow-y-auto p-6 bg-canvas flex justify-center">
              <div
                id="printable-thermal-receipt"
                className="receipt w-[302px] rounded-control border border-line-input bg-paper p-5 font-mono text-xs text-ink shadow-xs"
              >
                {/* Header Apotek Resmi */}
                <div className="text-center space-y-0.5">
                  <div className="text-xs font-bold tracking-tight text-ink">
                    APOTEK RADDINA HEALTH SERVICE
                  </div>
                  <div className="text-[10px] text-ink-soft">
                    SIA: 503/0042/SIA/35.78/2024
                  </div>
                  <div className="text-[10px] text-ink-soft">
                    SIPA APJ: 19940815/SIPA_35.78/2023/2011
                  </div>
                  <div className="text-[10px] font-semibold text-action">
                    apt. Raddina Nurul Aini, S.Farm.
                  </div>
                  <div className="text-[10px] text-ink-muted">
                    Jl. Raya Dharmahusada No. 45, Surabaya
                  </div>
                  <div className="text-[10px] text-ink-muted">
                    Telp: (031) 5928811
                  </div>
                </div>

                <div className="my-2.5 border-b border-dashed border-line-input" />

                {/* Metadata Transaksi */}
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-ink-muted">No. struk:</span>
                    <span className="tabular-nums font-bold text-ink">
                      {completedSale.receiptNumber}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Waktu:</span>
                    <span className="tabular-nums">
                      {formatDateId(completedSale.createdAt, { includeTime: true })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Kasir:</span>
                    <span>{completedSale.cashierFullName || 'Kasir'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Pelanggan:</span>
                    <span>{completedSale.customerName || 'Pelanggan umum'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Skema:</span>
                    <span className="font-semibold text-action">
                      {completedSale.pricingTier === 'PARTNER'
                        ? 'Harga mitra'
                        : 'Harga reguler'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Pembayaran:</span>
                    <span className="font-semibold">{completedSale.paymentMethod}</span>
                  </div>
                </div>

                <div className="my-2.5 border-b border-dashed border-line-input" />

                {/* Rincian Item Penjualan & Alokasi Batch FEFO */}
                <div className="space-y-2 text-[11px]">
                  <div className="flex justify-between text-[10px] font-semibold text-ink-muted">
                    <span>Item &amp; batch</span>
                    <span>Subtotal</span>
                  </div>

                  {completedSale.items && completedSale.items.length > 0 ? (
                    completedSale.items.map((item, idx) => (
                      <div key={item.id || idx} className="space-y-0.5">
                        <div className="font-semibold text-ink">
                          {item.medicineName || 'Sediaan obat'}
                        </div>
                        <div className="flex justify-between text-[10px] text-ink-soft">
                          <span className="tabular-nums">
                            {formatNumberId(item.qtyInUom)} {item.uomUnitName} ×{' '}
                            {formatRupiah(item.unitSellingPrice)}
                          </span>
                          <span className="tabular-nums font-semibold text-ink">
                            {formatRupiah(item.subtotal)}
                          </span>
                        </div>

                        {/* Rincian Alokasi Batch FEFO */}
                        {item.allocations && item.allocations.length > 0 && (
                          <div className="mt-1 space-y-0.5 pl-2 border-l-2 border-mint text-[10px] text-ink-soft">
                            {item.allocations.map((alloc) => (
                              <div
                                key={alloc.batchId}
                                className="flex justify-between tabular-nums"
                              >
                                <span>
                                  Lot {alloc.batchNumber} (ED {alloc.expiryDate})
                                </span>
                                <span>
                                  {formatNumberId(alloc.allocatedBaseQty)} unit
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-[10px] text-ink-muted italic">
                      Item obat diproses langsung dari inventaris kasir.
                    </div>
                  )}
                </div>

                <div className="my-2.5 border-b border-dashed border-line-input" />

                {/* Rincian Finansial & Total */}
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Subtotal:</span>
                    <span className="tabular-nums">
                      {formatRupiah(completedSale.totalAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-ink-muted">PPN 0% (obat resep bebas pajak):</span>
                    <span className="tabular-nums">Rp 0</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-line text-xs font-semibold text-action">
                    <span>Total tagihan:</span>
                    <span className="tabular-nums text-sm font-bold">
                      {formatRupiah(completedSale.totalAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-ink-muted">
                      Bayar ({completedSale.paymentMethod}):
                    </span>
                    <span className="tabular-nums font-semibold">
                      {formatRupiah(completedSale.amountPaid)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-line text-xs font-semibold text-action">
                    <span>Uang kembalian:</span>
                    <span className="tabular-nums text-sm font-bold">
                      {formatRupiah(completedSale.changeAmount)}
                    </span>
                  </div>
                </div>

                <div className="my-3 border-b border-dashed border-line-input" />

                {/* Simulasi Barcode Thermal & Motto */}
                <div className="text-center space-y-1.5">
                  <div className="flex justify-center items-center gap-[2px] h-7 px-4">
                    {[1, 2, 1, 3, 1, 2, 1, 1, 2, 3, 1, 2, 1, 3, 2, 1, 2, 1, 1, 3, 1, 2].map(
                      (w, i) => (
                        <div
                          key={i}
                          className="bg-ink h-full"
                          style={{ width: `${w}px` }}
                        />
                      ),
                    )}
                  </div>
                  <div className="tabular-nums text-[10px] font-semibold text-ink-soft tracking-wider">
                    *{completedSale.receiptNumber}*
                  </div>

                  <div className="pt-1 text-[10px] font-semibold tracking-wider text-ink">
                    SALUS AEGROTI SUPREMA LEX
                  </div>
                  <div className="text-[10px] text-ink-muted">
                    Semoga lekas sembuh dan sehat selalu.
                  </div>
                </div>
              </div>
            </div>

            {/* Tombol Aksi di Bawah Struk */}
            <div className="flex items-center justify-end gap-2.5 border-t border-line bg-surface px-6 py-3.5">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex h-10 items-center gap-1.5 rounded-control border border-line-input bg-surface px-4 text-xs font-semibold text-ink hover:bg-hover"
              >
                <Printer className="h-4 w-4 text-action" />
                <span>Cetak struk</span>
              </button>

              <button
                type="button"
                onClick={handleCloseAndReset}
                className="flex h-10 items-center rounded-control bg-action px-4 text-xs font-semibold text-white hover:bg-action-hover"
              >
                Transaksi baru
              </button>
            </div>
          </div>
        ) : (
          /* Formulir Pembayaran Kasir */
          <div className="flex flex-col">
            <div className="flex items-center justify-between border-b border-line px-6 py-4 bg-surface">
              <div>
                <h2
                  id="checkout-modal-heading"
                  className="text-base font-semibold text-ink"
                >
                  Pembayaran kasir
                </h2>
                <p className="text-xs text-ink-muted">
                  Periksa total tagihan dan pilih metode pembayaran transaksi.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-control p-1 text-ink-muted hover:bg-hover hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Total Belanja (Gaya total: 40/48 mono 700) */}
              <div className="rounded-panel border border-line-input bg-sage p-4 text-center">
                <span className="text-xs font-semibold text-ink-soft">
                  Total tagihan
                </span>
                <div className="tabular-nums font-mono text-[36px] leading-[44px] font-bold text-ink mt-0.5">
                  {formatRupiah(totalAmount)}
                </div>
              </div>

              {/* Pemilih Metode Pembayaran */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink">
                  Metode pembayaran
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'CASH', label: 'Tunai', icon: Banknote },
                    { id: 'QRIS', label: 'QRIS', icon: QrCode },
                    { id: 'DEBIT', label: 'Kartu debit', icon: CreditCard },
                  ].map((method) => {
                    const Icon = method.icon;
                    const isSelected = paymentMethod === method.id;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                        className={`pos-instant flex h-10 items-center justify-center gap-2 rounded-control border text-xs font-semibold transition-colors ${
                          isSelected
                            ? 'border-action bg-selected text-ink'
                            : 'border-line-input bg-surface text-ink-soft hover:bg-hover'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{method.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Input Nama Pelanggan (Opsional) */}
              <div className="space-y-1.5">
                <label htmlFor={customerNameId} className="text-xs font-semibold text-ink">
                  Nama pelanggan <span className="text-ink-muted font-normal">(opsional)</span>
                </label>
                <input
                  id={customerNameId}
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nama pasien atau pembeli umum"
                  className="h-10 w-full rounded-control border border-line-input bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus:border-action focus:ring-2 focus:ring-mint focus:outline-none"
                />
              </div>

              {/* Bagian Uang Tunai: Input Uang Diterima & Kembalian */}
              {paymentMethod === 'CASH' && (
                <div className="space-y-3 pt-2 border-t border-line">
                  <div className="space-y-1.5">
                    <label htmlFor={amountPaidId} className="text-xs font-semibold text-ink">
                      Nominal uang diterima
                    </label>
                    <div className="relative flex items-center">
                      <span className="pointer-events-none absolute left-3 text-xs font-semibold text-ink-muted font-mono">
                        Rp
                      </span>
                      <input
                        id={amountPaidId}
                        type="number"
                        min={totalAmount}
                        step="1000"
                        value={amountPaidInput}
                        onChange={(e) => setAmountPaidInput(e.target.value)}
                        className="tabular-nums h-10 w-full rounded-control border border-line-input bg-surface pr-3 pl-9 text-right text-sm font-semibold text-ink focus:border-action focus:ring-2 focus:ring-mint focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Tombol Nominal Pas & Cepat */}
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuickAmount(totalAmount)}
                      className="pos-instant rounded-control border border-line-input bg-sunken px-2.5 py-1 text-xs font-semibold text-ink hover:bg-hover"
                    >
                      Uang pas
                    </button>
                    {[50000, 100000, 200000].map((amt) => {
                      if (amt < totalAmount) return null;
                      return (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => handleQuickAmount(amt)}
                          className="pos-instant rounded-control border border-line-input bg-sunken px-2.5 py-1 text-xs font-semibold text-ink hover:bg-hover font-mono tabular-nums"
                        >
                          {formatRupiah(amt)}
                        </button>
                      );
                    })}
                  </div>

                  {/* Kalkulasi Uang Kembalian */}
                  <div className="flex items-center justify-between rounded-control border border-line bg-canvas p-3">
                    <span className="text-xs font-semibold text-ink-soft">
                      Uang kembalian:
                    </span>
                    <span className="tabular-nums font-mono text-base font-bold text-action">
                      {formatRupiah(changeAmount)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Tombol Eksekusi Bayar (Tinggi 48px/56px) */}
            <div className="flex items-center justify-end gap-2.5 border-t border-line bg-surface px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                className="h-10 rounded-control border border-line-input bg-surface px-4 text-xs font-semibold text-ink hover:bg-hover"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={isSubmitting || !isPaymentSufficient}
                onClick={handleExecutePayment}
                className="pos-instant flex h-12 items-center justify-center gap-2 rounded-control bg-action px-6 text-sm font-semibold text-white hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSubmitting ? (
                  <span>Memproses transaksi...</span>
                ) : (
                  <>
                    <span>Selesaikan transaksi</span>
                    <kbd className="tabular-nums rounded border border-line-input bg-action-press px-1.5 py-0.5 text-[11px] font-semibold text-white">
                      F8
                    </kbd>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CheckoutModal;
