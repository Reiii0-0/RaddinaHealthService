import React from 'react';
import { Minus, Plus, RefreshCw, ShoppingCart, Trash2 } from 'lucide-react';
import { formatNumberId, formatRupiah } from '@/lib/formatters';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { type PosCartItem, usePosCartStore } from '@/stores/pos-cart.store';

export interface CartTableProps {
  onRowSelect?: (index: number) => void;
  className?: string;
}

export function CartTable({ onRowSelect, className = '' }: CartTableProps) {
  const [isConfirmClearOpen, setIsConfirmClearOpen] = React.useState(false);
  const items = usePosCartStore((s) => s.items);
  const selectedIndex = usePosCartStore((s) => s.selectedIndex);
  const pricingTier = usePosCartStore((s) => s.pricingTier);

  const setSelectedIndex = usePosCartStore((s) => s.setSelectedIndex);
  const updateItemQty = usePosCartStore((s) => s.updateItemQty);
  const setItemUom = usePosCartStore((s) => s.setItemUom);
  const cycleItemUom = usePosCartStore((s) => s.cycleItemUom);
  const removeItem = usePosCartStore((s) => s.removeItem);
  const clearCart = usePosCartStore((s) => s.clearCart);

  const handleRowClick = (idx: number) => {
    setSelectedIndex(idx);
    if (onRowSelect) {
      onRowSelect(idx);
    }
  };

  if (items.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-panel border border-line bg-surface p-12 text-center ${className}`}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-mint text-ink">
          <ShoppingCart className="h-6 w-6" strokeWidth={1.75} />
        </div>
        <p className="mt-3 text-sm font-semibold text-ink">
          Keranjang belanja masih kosong
        </p>
        <p className="mt-1 max-w-sm text-xs text-ink-muted">
          Cari obat dengan menekan tombol F1 atau gunakan kolom pencarian untuk memasukkan obat ke transaksi.
        </p>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-panel border border-line bg-surface ${className}`}>
      {/* Header Panel Keranjang */}
      <div className="flex items-center justify-between border-b border-line px-4 py-3 bg-surface">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink">
            Daftar belanja ({items.length} item)
          </span>
          {pricingTier === 'PARTNER' && (
            <span className="rounded-full bg-mint px-2 py-0.5 text-xs font-semibold text-ink border border-line-input">
              Harga mitra
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsConfirmClearOpen(true)}
          className="pos-instant flex items-center gap-1 rounded-control px-2.5 py-1 text-xs font-semibold text-danger hover:bg-danger-soft"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Kosongkan</span>
        </button>
      </div>

      {/* Tabel Keranjang */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm text-ink">
          <thead>
            <tr className="border-b border-line bg-surface text-xs font-semibold text-ink-muted">
              <th className="py-2.5 pr-2 pl-4 w-12 text-center">No</th>
              <th className="py-2.5 pr-4 pl-2">Obat dan zat aktif</th>
              <th className="py-2.5 px-3 w-36">Satuan</th>
              <th className="py-2.5 px-3 w-32 text-center">Jumlah</th>
              <th className="py-2.5 px-3 w-28 text-right">Harga satuan</th>
              <th className="py-2.5 px-3 w-32 text-right">Subtotal</th>
              <th className="py-2.5 pr-4 pl-2 w-12 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((item: PosCartItem, idx: number) => {
              const isSelected = idx === selectedIndex;
              const unitPrice =
                pricingTier === 'PARTNER'
                  ? item.sellingPricePartner
                  : item.sellingPriceRegular;
              const lineSubtotal = unitPrice * item.qtyInUom;
              const conversions = item.uomConversions ?? [];

              return (
                <tr
                  key={`${item.medicineId}-${item.uomUnitName}`}
                  onClick={() => handleRowClick(idx)}
                  className={`pos-instant cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-selected border-l-[3px] border-l-action'
                      : 'hover:bg-hover'
                  }`}
                >
                  {/* Nomor Baris */}
                  <td className="py-3 pr-2 pl-4 text-center">
                    <span className="tabular-nums text-xs text-ink-muted">
                      {idx + 1}
                    </span>
                  </td>

                  {/* Nama Obat & Zat Aktif */}
                  <td className="py-3 pr-4 pl-2 min-w-[200px]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-ink">
                        {item.name}
                      </span>
                      <StatusBadge
                        kind="drug"
                        classification={item.classification}
                        compact
                      />
                    </div>
                    <div className="mt-0.5 text-xs text-ink-muted truncate max-w-[280px]">
                      {item.activeIngredient}
                    </div>
                  </td>

                  {/* Pemilih Satuan UOM */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1">
                      <select
                        value={item.uomUnitName}
                        onChange={(e) => setItemUom(idx, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Ubah satuan untuk ${item.name}`}
                        className="w-full rounded-control border border-line-input bg-surface py-1 pr-6 pl-2 text-xs text-ink focus:border-action focus:outline-none"
                      >
                        {conversions.map((u) => (
                          <option key={u.unitName} value={u.unitName}>
                            {u.unitName} (×{u.multiplierToBase})
                          </option>
                        ))}
                      </select>

                      {conversions.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            cycleItemUom(idx);
                          }}
                          className="pos-instant flex h-7 w-7 items-center justify-center rounded-control border border-line-input bg-surface text-ink-soft hover:bg-hover"
                          title="Putar satuan [F4]"
                          aria-label="Putar satuan"
                        >
                          <RefreshCw className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Stepper Jumlah */}
                  <td className="py-3 px-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateItemQty(idx, item.qtyInUom - 1);
                        }}
                        className="pos-instant flex h-7 w-7 items-center justify-center rounded-control border border-line-input bg-surface text-ink-soft hover:bg-hover"
                        aria-label="Kurangi jumlah"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>

                      <input
                        type="number"
                        min="1"
                        value={item.qtyInUom}
                        onChange={(e) => {
                          const val = Number.parseInt(e.target.value, 10);
                          if (!Number.isNaN(val)) {
                            updateItemQty(idx, val);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="tabular-nums h-7 w-12 rounded-control border border-line-input bg-surface text-center text-xs font-semibold text-ink focus:border-action focus:outline-none"
                        aria-label={`Jumlah ${item.name}`}
                      />

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateItemQty(idx, item.qtyInUom + 1);
                        }}
                        className="pos-instant flex h-7 w-7 items-center justify-center rounded-control border border-line-input bg-surface text-ink-soft hover:bg-hover"
                        aria-label="Tambah jumlah"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>

                  {/* Harga Satuan */}
                  <td className="py-3 px-3 text-right">
                    <div className="tabular-nums font-mono text-ink-soft">
                      {formatRupiah(unitPrice)}
                    </div>
                  </td>

                  {/* Subtotal */}
                  <td className="py-3 px-3 text-right">
                    <div className="tabular-nums font-mono font-semibold text-ink">
                      {formatRupiah(lineSubtotal)}
                    </div>
                  </td>

                  {/* Tombol Hapus */}
                  <td className="py-3 pr-4 pl-2 text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(idx);
                      }}
                      className="pos-instant rounded-control p-1 text-ink-muted hover:bg-danger-soft hover:text-danger"
                      title="Hapus baris"
                      aria-label="Hapus baris obat"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={isConfirmClearOpen}
        title="Kosongkan keranjang belanja"
        description="Apakah Anda yakin ingin membatalkan transaksi ini dan menghapus semua obat dari daftar belanja?"
        confirmLabel="Kosongkan keranjang"
        cancelLabel="Kembali"
        variant="danger"
        onConfirm={() => {
          clearCart();
          setIsConfirmClearOpen(false);
        }}
        onCancel={() => setIsConfirmClearOpen(false)}
      />
    </div>
  );
}

export default CartTable;
