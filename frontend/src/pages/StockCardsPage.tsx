import React, { useEffect, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  History,
  Lock,
  RefreshCw,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { inventoryApi } from '@/lib/api-client';
import { formatDateId, formatNumberId } from '@/lib/formatters';
import type { StockCardEntryDto } from '@shared/api-contracts';

export const StockCardsPage: React.FC = () => {
  const [cards, setCards] = useState<StockCardEntryDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [movementFilter, setMovementFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadStockCards();
  }, [movementFilter]);

  const loadStockCards = async () => {
    setIsLoading(true);
    try {
      const res = await inventoryApi.listStockCards({
        movementType: (movementFilter as any) || undefined,
        limit: 100,
      });
      setCards(res.items);
    } catch {
      toast.error('Tidak dapat terhubung ke server. Periksa koneksi lalu muat ulang.');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCards = cards.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.medicineName.toLowerCase().includes(q) ||
      c.batchNumber.toLowerCase().includes(q) ||
      c.referenceId.toLowerCase().includes(q) ||
      c.actorFullName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Kepala Halaman */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Kartu stok
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Buku besar mutasi persediaan obat append-only
          </p>
        </div>

        <button
          type="button"
          onClick={loadStockCards}
          disabled={isLoading}
          className="flex h-10 items-center gap-2 rounded-control border border-line-input bg-surface px-4 text-xs font-semibold text-ink hover:bg-hover active:bg-selected disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-action' : ''}`} />
          <span>Segarkan catatan</span>
        </button>
      </div>

      {/* Satu Kalimat Penegasan Permanen Sesuai DESIGN.md Section 8.5 */}
      <div className="flex items-center gap-2.5 rounded-control border border-line bg-sunken px-4 py-3 text-xs text-ink-soft">
        <Lock className="h-4 w-4 shrink-0 text-ink-muted" />
        <span>
          Kartu stok bersifat permanen. Catatan mutasi tidak dapat diubah atau dihapus untuk menjaga keabsahan audit persediaan farmasi.
        </span>
      </div>

      {/* Baris Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari obat, nomor batch, referensi, atau staf..."
            className="h-10 w-full rounded-control border border-line-input bg-surface pl-10 pr-3.5 text-xs text-ink placeholder:text-ink-muted focus:border-action focus:ring-2 focus:ring-mint focus:outline-none"
          />
        </div>

        <select
          value={movementFilter}
          onChange={(e) => setMovementFilter(e.target.value)}
          className="h-10 rounded-control border border-line-input bg-surface px-3 text-xs text-ink focus:border-action focus:ring-2 focus:ring-mint focus:outline-none"
          aria-label="Filter jenis mutasi stok"
        >
          <option value="">Semua jenis mutasi</option>
          <option value="IN_INVOICE">Masuk faktur PBF</option>
          <option value="OUT_SALE">Keluar penjualan kasir</option>
          <option value="ADJUSTMENT">Penyesuaian stok</option>
        </select>
      </div>

      {/* Tabel Buku Besar Tunggal Sesuai DESIGN.md Section 8.5 */}
      <div className="rounded-panel border border-line bg-surface overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-10 border-b border-line bg-surface text-ink-muted">
              <tr className="h-10 text-[11px] font-semibold">
                <th className="px-4 py-2">Waktu</th>
                <th className="px-3 py-2">Obat</th>
                <th className="px-3 py-2 font-mono">Batch</th>
                <th className="px-3 py-2">Jenis mutasi</th>
                <th className="px-3 py-2 font-mono">Referensi</th>
                <th className="px-3 py-2 text-right">Perubahan</th>
                <th className="px-4 py-2 text-right">Saldo akhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-ink">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-ink-muted">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-action" />
                      <span>Memuat buku kartu stok...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredCards.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-ink-muted">
                    Belum ada mutasi stok. Terima faktur atau lakukan penjualan untuk mulai mencatat.
                  </td>
                </tr>
              ) : (
                filteredCards.map((entry) => {
                  const isPositive = entry.qtyChange > 0;

                  return (
                    <tr key={entry.id} className="h-12 hover:bg-hover transition-colors">
                      <td className="px-4 py-2 font-mono text-ink-muted whitespace-nowrap">
                        {formatDateId(entry.createdAt)}
                      </td>

                      <td className="px-3 py-2">
                        <div className="font-semibold text-ink">{entry.medicineName}</div>
                        <div className="text-[11px] text-ink-muted">Oleh: {entry.actorFullName}</div>
                      </td>

                      <td className="px-3 py-2 font-mono font-semibold text-ink-soft">
                        {entry.batchNumber}
                      </td>

                      <td className="px-3 py-2">
                        {entry.movementType === 'IN_INVOICE' ? (
                          <span className="inline-flex items-center rounded-full bg-mint px-2.5 py-0.5 text-[11px] font-semibold text-ink border border-line-input">
                            Masuk faktur
                          </span>
                        ) : entry.movementType === 'OUT_SALE' ? (
                          <span className="inline-flex items-center rounded-full bg-sand px-2.5 py-0.5 text-[11px] font-semibold text-ink border border-line-input">
                            Keluar kasir
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-sunken px-2.5 py-0.5 text-[11px] font-semibold text-ink-soft border border-line">
                            Penyesuaian
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-2 font-mono text-ink-muted">
                        {entry.referenceId}
                      </td>

                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex items-center gap-1 font-mono font-semibold">
                          {isPositive ? (
                            <span className="flex items-center text-action tabular-nums">
                              <ArrowUpRight className="h-3 w-3" />
                              +{formatNumberId(entry.qtyChange)}
                            </span>
                          ) : (
                            <span className="flex items-center text-danger-ink tabular-nums">
                              <ArrowDownRight className="h-3 w-3" />
                              {formatNumberId(entry.qtyChange)}
                            </span>
                          )}
                          <span className="text-[10px] text-ink-muted font-normal">
                            {entry.baseUnit}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-2 text-right font-mono font-bold text-ink tabular-nums text-sm">
                        {formatNumberId(entry.balanceAfter)} <span className="text-xs font-normal text-ink-muted">{entry.baseUnit}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StockCardsPage;
