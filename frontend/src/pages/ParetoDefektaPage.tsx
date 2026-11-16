import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Check,
  FileSpreadsheet,
  Lock,
  Mail,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  DefektaItemDto,
  ParetoClass,
  ParetoItemAnalyticsDto,
} from '@shared/api-contracts';
import { analyticsApi, procurementApi } from '@/lib/api-client';
import {
  formatDateId,
  formatNumberId,
  formatPercentId,
  formatRupiah,
  formatRupiahCost,
} from '@/lib/formatters';
import {
  applyWorstCaseDefekta,
  applyWorstCasePareto,
  useWorstCaseMode,
} from '@/lib/worst-case-fixtures';
import { useAuthStore } from '@/stores/auth.store';
import { StatusBadge } from '@/components/shared/StatusBadge';

export function ParetoDefektaPage() {
  const user = useAuthStore((s) => s.user);
  const [isWorstCase] = useWorstCaseMode();

  const [activeTab, setActiveTab] = useState<'pareto' | 'defekta'>('pareto');
  const [periodDays, setPeriodDays] = useState<number>(30);

  // State Pareto
  const [paretoItems, setParetoItems] = useState<ParetoItemAnalyticsDto[]>([]);
  const [isLoadingPareto, setIsLoadingPareto] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [selectedParetoFilter, setSelectedParetoFilter] = useState<ParetoClass | null>(null);
  const [hoveredParetoItem, setHoveredParetoItem] = useState<ParetoItemAnalyticsDto | null>(null);

  // State Defekta & Pemilihan Checklist
  const [defektaItems, setDefektaItems] = useState<DefektaItemDto[]>([]);
  const [isLoadingDefekta, setIsLoadingDefekta] = useState(false);
  const [selectedDefektaIds, setSelectedDefektaIds] = useState<Set<string>>(new Set());
  const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>({});

  // State Dialog SP-el
  const [isSpModalOpen, setIsSpModalOpen] = useState(false);
  const [spNotes, setSpNotes] = useState('');
  const [isIssuingSp, setIsIssuingSp] = useState(false);

  // Izin Penerbitan SP-el Berdasarkan SIPA
  const canIssueSp =
    user?.role === 'OWNER' || (user?.role === 'PHARMACIST' && Boolean(user.isSipaActive));

  const sipaBlockMessage =
    user?.role === 'CASHIER'
      ? 'Penerbitan SP-el memerlukan otorisasi Apoteker (APJ) atau Pemilik.'
      : user?.role === 'PHARMACIST' && !user.isSipaActive
      ? `SIPA Anda berakhir pada ${user.sipaExpiryDate ? formatDateId(user.sipaExpiryDate) : 'tanggal tidak tercatat'}. Hubungi pemilik apotek untuk memperbarui.`
      : null;

  const fetchPareto = async (days = periodDays) => {
    setIsLoadingPareto(true);
    try {
      const data = await analyticsApi.getPareto({ days });
      setParetoItems(applyWorstCasePareto(data));
    } catch {
      setParetoItems(applyWorstCasePareto([]));
    } finally {
      setIsLoadingPareto(false);
    }
  };

  const fetchDefekta = async () => {
    setIsLoadingDefekta(true);
    try {
      const data = await procurementApi.getDefekta();
      const normalized = applyWorstCaseDefekta(data);
      setDefektaItems(normalized);
      // Inisialisasi default order quantities
      const initialQtys: Record<string, number> = {};
      normalized.forEach((item) => {
        initialQtys[item.medicineId] = item.recommendedOrderQty || Math.max(1, item.reorderPointRop);
      });
      setOrderQuantities(initialQtys);
    } catch {
      setDefektaItems(applyWorstCaseDefekta([]));
    } finally {
      setIsLoadingDefekta(false);
    }
  };

  useEffect(() => {
    fetchPareto(periodDays);
    fetchDefekta();
  }, [periodDays, isWorstCase]);

  const handleRecalculatePareto = async () => {
    setIsRecalculating(true);
    try {
      await analyticsApi.recalculatePareto({ days: periodDays });
      toast.success(`Klasifikasi Pareto ABC periode ${periodDays} hari berhasil diperbarui.`);
      await fetchPareto(periodDays);
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghitung ulang Pareto.');
    } finally {
      setIsRecalculating(false);
    }
  };

  // Checklist Selection Handlers
  const toggleSelectDefekta = (id: string) => {
    setSelectedDefektaIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllDefekta = () => {
    if (selectedDefektaIds.size === defektaItems.length) {
      setSelectedDefektaIds(new Set());
    } else {
      setSelectedDefektaIds(new Set(defektaItems.map((d) => d.medicineId)));
    }
  };

  const handleUpdateOrderQty = (medicineId: string, qty: number) => {
    setOrderQuantities((prev) => ({
      ...prev,
      [medicineId]: Math.max(1, qty),
    }));
  };

  const handleOpenSpWorksheet = () => {
    if (!canIssueSp) {
      toast.error(sipaBlockMessage || 'Akses penerbitan SP-el ditolak.');
      return;
    }
    if (selectedDefektaIds.size === 0) {
      toast.error('Pilih minimal satu obat dari buku defekta.');
      return;
    }
    setIsSpModalOpen(true);
  };

  const handleExecuteIssueSp = async () => {
    const selectedItems = defektaItems.filter((d) => selectedDefektaIds.has(d.medicineId));
    if (selectedItems.length === 0) return;

    // Kelompokkan per supplier
    const primarySupplier = selectedItems[0]?.recommendedSupplier;
    if (!primarySupplier) {
      toast.error('Pemasok rekomendasi belum tercatat pada faktur 90 hari terakhir.');
      return;
    }

    setIsIssuingSp(true);
    try {
      const payload = {
        supplierId: primarySupplier.supplierId,
        notes: spNotes.trim() || undefined,
        items: selectedItems.map((it) => ({
          medicineId: it.medicineId,
          orderedBaseQty: orderQuantities[it.medicineId] || it.recommendedOrderQty || 1,
          estimatedUnitCost: it.recommendedSupplier?.lowestCostPerBaseUnit || '0',
        })),
      };

      const result = await procurementApi.createPurchaseOrder(payload);
      toast.success(`SP-el ${result.spNumber} terkirim ke email PBF ${primarySupplier.supplierName}.`);
      setIsSpModalOpen(false);
      setSelectedDefektaIds(new Set());
      await fetchDefekta();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menerbitkan Surat Pesanan Elektronik.');
    } finally {
      setIsIssuingSp(false);
    }
  };

  // Ringkasan Pareto
  const totalRevenue = paretoItems.reduce((acc, it) => acc + (it.totalRevenue || 0), 0);
  const classAItems = paretoItems.filter((it) => it.paretoClass === 'A');
  const classBItems = paretoItems.filter((it) => it.paretoClass === 'B');
  const classCItems = paretoItems.filter((it) => it.paretoClass === 'C');

  const classARevenue = classAItems.reduce((acc, it) => acc + (it.totalRevenue || 0), 0);
  const classBRevenue = classBItems.reduce((acc, it) => acc + (it.totalRevenue || 0), 0);
  const classCRevenue = classCItems.reduce((acc, it) => acc + (it.totalRevenue || 0), 0);

  const filteredParetoItems = selectedParetoFilter
    ? paretoItems.filter((it) => it.paretoClass === selectedParetoFilter)
    : paretoItems;

  const maxRevenue = paretoItems.length > 0 ? paretoItems[0].totalRevenue || 1 : 1;

  // Selected Defekta items calculation
  const selectedDefektaList = defektaItems.filter((d) => selectedDefektaIds.has(d.medicineId));
  const totalSpCostEstimate = selectedDefektaList.reduce((acc, item) => {
    const qty = orderQuantities[item.medicineId] || item.recommendedOrderQty || 1;
    const unitCost = Number(item.recommendedSupplier?.lowestCostPerBaseUnit || 0);
    return acc + qty * unitCost;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Kepala Halaman: Judul & Tab Switcher (Pareto vs Defekta) */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Analitik
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Analisis kontribusi omzet Pareto ABC dan pemesanan kembali buku defekta
          </p>
        </div>

        {/* Tab Kontrol Sesuai DESIGN.md Section 7.5 & 8.6 */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('pareto')}
            className={`rounded-control px-4 py-2 text-xs font-semibold transition-colors ${
              activeTab === 'pareto'
                ? 'bg-action text-white shadow-xs'
                : 'border border-line bg-surface text-ink-soft hover:bg-hover'
            }`}
          >
            Pareto ABC
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('defekta')}
            className={`flex items-center gap-1.5 rounded-control px-4 py-2 text-xs font-semibold transition-colors ${
              activeTab === 'defekta'
                ? 'bg-action text-white shadow-xs'
                : 'border border-line bg-surface text-ink-soft hover:bg-hover'
            }`}
          >
            <span>Buku defekta</span>
            {defektaItems.length > 0 && (
              <span className="rounded-full bg-cream px-1.5 py-0.2 text-[10px] font-bold text-warn-ink font-mono">
                {defektaItems.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PARETO ABC (80/20) SESUAI DESIGN.MD SECTION 8.6                    */}
      {/* ========================================================================= */}
      {activeTab === 'pareto' && (
        <div className="space-y-6">
          {/* Baris Alat: Pilihan Periode & Hitung Ulang */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-ink-muted">Periode analisis:</span>
              <div className="inline-flex rounded-control border border-line bg-sunken p-1">
                {[7, 30, 90].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setPeriodDays(days)}
                    className={`rounded-control px-3 py-1 font-semibold transition-colors ${
                      periodDays === days
                        ? 'border border-line bg-surface text-ink shadow-xs'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    {days} hari
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleRecalculatePareto}
              disabled={isRecalculating}
              className="flex h-9 items-center gap-2 rounded-control bg-mint px-3 text-xs font-semibold text-ink hover:bg-mint/80 active:bg-mint/90 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRecalculating ? 'animate-spin' : ''}`} />
              <span>Hitung ulang Pareto</span>
            </button>
          </div>

          {/* Tata Letak Dua Kolom: Kiri 2/3 Bagan Batang + Kanan 1/3 Ringkasan Kelas */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Kiri (2/3): Bagan Batang Menurun Sesuai DESIGN.md Section 8.6 */}
            <div className="rounded-panel border border-line bg-surface p-5 lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-ink">
                    Distribusi omzet menurun per obat
                  </h3>
                  <p className="text-[11px] text-ink-muted">
                    Warna kelas: A (hijau tua), B (mint), C (garis tipis)
                  </p>
                </div>
                {hoveredParetoItem && (
                  <div className="text-right font-mono text-xs">
                    <span className="font-semibold text-ink">{hoveredParetoItem.name}</span>
                    <span className="ml-2 text-ink-muted">
                      ({formatRupiah(hoveredParetoItem.totalRevenue)} • {formatPercentId(hoveredParetoItem.revenueShareRatio * 100)})
                    </span>
                  </div>
                )}
              </div>

              {/* Visualisasi Bar Chart SVG / HTML Sesuai Spek */}
              <div className="relative pt-6">
                {/* Garis Acuan Putus-putus 80% dan 95% */}
                <div className="pointer-events-none absolute inset-x-0 top-3 flex items-center justify-between border-t border-dashed border-line-input text-[10px] text-ink-muted font-mono">
                  <span>Batas Kelas A: 80% omzet kumulatif</span>
                  <span>Batas Kelas B: 95%</span>
                </div>

                <div className="mt-4 flex h-48 items-end gap-1.5 overflow-x-auto border-b border-line pb-1">
                  {paretoItems.map((item) => {
                    const heightPercent = Math.max(6, Math.round((item.totalRevenue / maxRevenue) * 100));
                    const barColor =
                      item.paretoClass === 'A'
                        ? 'bg-action hover:bg-action-hover'
                        : item.paretoClass === 'B'
                        ? 'bg-mint hover:bg-mint/80'
                        : 'bg-line hover:bg-line-input';

                    return (
                      <div
                        key={item.medicineId}
                        onMouseEnter={() => setHoveredParetoItem(item)}
                        onMouseLeave={() => setHoveredParetoItem(null)}
                        className="group relative flex h-full flex-1 min-w-[20px] flex-col justify-end items-center cursor-pointer"
                        title={`${item.name} (Kelas ${item.paretoClass}): ${formatRupiah(item.totalRevenue)}`}
                      >
                        <div
                          className={`w-full rounded-t-sm transition-all ${barColor}`}
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="mt-2 flex justify-between text-[11px] text-ink-muted">
                  <span>Peringkat 1 (Omzet tertinggi)</span>
                  <span>Peringkat {paretoItems.length}</span>
                </div>
              </div>
            </div>

            {/* Kanan (1/3): Daftar Tiga Kelas (A, B, C) */}
            <div className="rounded-panel border border-line bg-surface p-5 lg:col-span-4 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-ink">
                  Klasifikasi 3 kelas
                </h3>
                <p className="text-[11px] text-ink-muted">
                  Klik kelas untuk menyaring daftar tabel di bawah:
                </p>
              </div>

              <div className="space-y-2.5">
                {/* Kelas A */}
                <button
                  type="button"
                  onClick={() =>
                    setSelectedParetoFilter(selectedParetoFilter === 'A' ? null : 'A')
                  }
                  className={`flex w-full items-center justify-between rounded-control border p-3 text-left transition-colors ${
                    selectedParetoFilter === 'A'
                      ? 'border-action bg-selected'
                      : 'border-line bg-surface hover:bg-hover'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="h-3 w-3 rounded-full bg-action" />
                    <div>
                      <div className="font-semibold text-xs text-ink">Kelas A</div>
                      <div className="text-[11px] text-ink-muted">{classAItems.length} jenis obat</div>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-xs font-semibold text-ink tabular-nums">
                      {formatRupiah(classARevenue)}
                    </div>
                    <div className="text-[11px] text-action font-semibold">
                      {totalRevenue > 0 ? formatPercentId((classARevenue / totalRevenue) * 100) : '0%'} omzet
                    </div>
                  </div>
                </button>

                {/* Kelas B */}
                <button
                  type="button"
                  onClick={() =>
                    setSelectedParetoFilter(selectedParetoFilter === 'B' ? null : 'B')
                  }
                  className={`flex w-full items-center justify-between rounded-control border p-3 text-left transition-colors ${
                    selectedParetoFilter === 'B'
                      ? 'border-line-input bg-selected'
                      : 'border-line bg-surface hover:bg-hover'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="h-3 w-3 rounded-full bg-mint border border-line-input" />
                    <div>
                      <div className="font-semibold text-xs text-ink">Kelas B</div>
                      <div className="text-[11px] text-ink-muted">{classBItems.length} jenis obat</div>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-xs font-semibold text-ink tabular-nums">
                      {formatRupiah(classBRevenue)}
                    </div>
                    <div className="text-[11px] text-ink-soft font-semibold">
                      {totalRevenue > 0 ? formatPercentId((classBRevenue / totalRevenue) * 100) : '0%'} omzet
                    </div>
                  </div>
                </button>

                {/* Kelas C */}
                <button
                  type="button"
                  onClick={() =>
                    setSelectedParetoFilter(selectedParetoFilter === 'C' ? null : 'C')
                  }
                  className={`flex w-full items-center justify-between rounded-control border p-3 text-left transition-colors ${
                    selectedParetoFilter === 'C'
                      ? 'border-line-input bg-selected'
                      : 'border-line bg-surface hover:bg-hover'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="h-3 w-3 rounded-full bg-line border border-line-input" />
                    <div>
                      <div className="font-semibold text-xs text-ink">Kelas C</div>
                      <div className="text-[11px] text-ink-muted">{classCItems.length} jenis obat</div>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-xs font-semibold text-ink tabular-nums">
                      {formatRupiah(classCRevenue)}
                    </div>
                    <div className="text-[11px] text-ink-muted font-semibold">
                      {totalRevenue > 0 ? formatPercentId((classCRevenue / totalRevenue) * 100) : '0%'} omzet
                    </div>
                  </div>
                </button>
              </div>

              {selectedParetoFilter && (
                <div className="pt-1 text-center">
                  <button
                    type="button"
                    onClick={() => setSelectedParetoFilter(null)}
                    className="text-[11px] text-action hover:underline"
                  >
                    Tampilkan semua kelas
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Bawah: Tabel Tunggal Kontribusi Omzet Obat Sesuai DESIGN.md Section 8.6 */}
          <div className="rounded-panel border border-line bg-surface overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 z-10 border-b border-line bg-surface text-ink-muted">
                  <tr className="h-10 text-[11px] font-semibold">
                    <th className="px-4 py-2">Peringkat &amp; obat</th>
                    <th className="px-3 py-2 text-right">Omzet 30 hari</th>
                    <th className="px-3 py-2 text-right">Pangsa omzet</th>
                    <th className="px-3 py-2 text-right">Kumulatif</th>
                    <th className="px-4 py-2 text-center">Kelas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-ink">
                  {isLoadingPareto ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-ink-muted">
                        Memuat data analitik Pareto...
                      </td>
                    </tr>
                  ) : filteredParetoItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-ink-muted">
                        Belum ada data transaksi penjualan pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    filteredParetoItems.map((item) => (
                      <tr key={item.medicineId} className="h-12 hover:bg-hover transition-colors">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-ink-muted w-6">
                              #{item.rank}
                            </span>
                            <div>
                              <div className="font-semibold text-ink">{item.name}</div>
                              <div className="text-[11px] text-ink-muted font-mono">{item.sku}</div>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-2 text-right font-mono font-semibold text-ink tabular-nums">
                          {formatRupiah(item.totalRevenue)}
                        </td>

                        <td className="px-3 py-2 text-right font-mono text-ink-soft tabular-nums">
                          {formatPercentId(item.revenueShareRatio * 100)}
                        </td>

                        <td className="px-3 py-2 text-right font-mono font-semibold text-action tabular-nums">
                          {formatPercentId(item.cumulativeShareAfter * 100)}
                        </td>

                        <td className="px-4 py-2 text-center">
                          <StatusBadge kind="pareto" paretoClass={item.paretoClass} compact />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: BUKU DEFEKTA & REKOMENDASI PEMESANAN KEMBALI (ROP)                   */}
      {/* ========================================================================= */}
      {activeTab === 'defekta' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between text-xs">
            <span className="text-ink-muted">
              Obat otomatis masuk buku defekta bila sisa stok layak jual ≤ ROP (titik pesan ulang)
            </span>
            <button
              type="button"
              onClick={fetchDefekta}
              disabled={isLoadingDefekta}
              className="flex items-center gap-1.5 text-action hover:underline"
            >
              <RefreshCw className={`h-3 w-3 ${isLoadingDefekta ? 'animate-spin' : ''}`} />
              <span>Segarkan defekta</span>
            </button>
          </div>

          {/* Tabel Buku Defekta dengan Kotak Centang Sesuai DESIGN.md Section 8.6 */}
          <div className="rounded-panel border border-line bg-surface overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 z-10 border-b border-line bg-surface text-ink-muted">
                  <tr className="h-10 text-[11px] font-semibold">
                    <th className="px-3 py-2 text-center w-10">
                      <input
                        type="checkbox"
                        checked={
                          defektaItems.length > 0 &&
                          selectedDefektaIds.size === defektaItems.length
                        }
                        onChange={toggleSelectAllDefekta}
                        className="rounded border-line-input text-action focus:ring-mint"
                        aria-label="Pilih semua obat defekta"
                      />
                    </th>
                    <th className="px-3 py-2">Obat</th>
                    <th className="px-3 py-2 text-right">Stok aktif</th>
                    <th className="px-3 py-2 text-right">Titik ROP</th>
                    <th className="px-3 py-2 text-right">Jumlah pesan</th>
                    <th className="px-3 py-2">PBF termurah (90 hari)</th>
                    <th className="px-4 py-2 text-center">Status stok</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-ink">
                  {isLoadingDefekta ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-ink-muted">
                        Memuat data buku defekta...
                      </td>
                    </tr>
                  ) : defektaItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-mint text-ink font-bold">
                            ✓
                          </div>
                          <p className="text-sm font-semibold text-ink">
                            Buku defekta bersih
                          </p>
                          <p className="mt-0.5 text-xs text-ink-muted">
                            Seluruh stok obat aktif apotek saat ini berada di atas titik pesan ulang.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    defektaItems.map((item) => {
                      const isSelected = selectedDefektaIds.has(item.medicineId);
                      const currentOrderQty =
                        orderQuantities[item.medicineId] ??
                        item.recommendedOrderQty ??
                        item.reorderPointRop;

                      return (
                        <tr
                          key={item.medicineId}
                          className={`h-14 transition-colors ${
                            isSelected ? 'bg-selected' : 'hover:bg-hover'
                          }`}
                        >
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectDefekta(item.medicineId)}
                              className="rounded border-line-input text-action focus:ring-mint"
                              aria-label={`Pilih ${item.name}`}
                            />
                          </td>

                          <td className="px-3 py-2">
                            <div className="font-semibold text-ink">{item.name}</div>
                            <div className="text-[11px] text-ink-muted">
                              Konsumsi: <span className="font-mono font-medium">{formatNumberId(item.avgDailyConsumption)}</span> {item.baseUnit}/hari
                            </div>
                          </td>

                          <td className="px-3 py-2 text-right font-mono font-bold tabular-nums">
                            <span className={item.currentActiveStock === 0 ? 'text-danger-ink' : 'text-warn-ink'}>
                              {formatNumberId(item.currentActiveStock)}
                            </span>
                            <span className="text-[10px] text-ink-muted ml-1 font-normal">{item.baseUnit}</span>
                          </td>

                          <td className="px-3 py-2 text-right font-mono text-ink-soft tabular-nums">
                            {formatNumberId(item.reorderPointRop)} <span className="text-[10px] text-ink-muted font-normal">{item.baseUnit}</span>
                          </td>

                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min={1}
                              value={currentOrderQty}
                              onChange={(e) =>
                                handleUpdateOrderQty(item.medicineId, Number(e.target.value))
                              }
                              className="h-8 w-24 rounded-control border border-line-input bg-surface px-2 text-right font-mono text-xs text-ink focus:border-action focus:outline-none"
                            />
                          </td>

                          <td className="px-3 py-2">
                            {item.recommendedSupplier ? (
                              <div>
                                <div className="font-medium text-ink">{item.recommendedSupplier.supplierName}</div>
                                <div className="font-mono text-[11px] text-action tabular-nums">
                                  HPP: {formatRupiah(Number(item.recommendedSupplier.lowestCostPerBaseUnit))} / {item.baseUnit}
                                </div>
                              </div>
                            ) : (
                              <span className="text-ink-muted text-[11px] italic">
                                Belum ada riwayat faktur
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-2 text-center">
                            {item.currentActiveStock === 0 ? (
                              <span className="inline-flex items-center rounded-full bg-danger-soft px-2.5 py-0.5 text-[10px] font-semibold text-danger-ink border border-danger-ink/30">
                                Habis
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-cream px-2.5 py-0.5 text-[10px] font-semibold text-warn-ink border border-line-input">
                                Menipis
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bilah Aksi Lekat di Dasar Panel Sesuai DESIGN.md Section 8.6 */}
          {selectedDefektaIds.size > 0 && (
            <div className="sticky bottom-6 z-20 flex flex-wrap items-center justify-between gap-4 rounded-control border border-line-input bg-surface p-4 shadow-float">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-mint px-3 py-1 font-mono text-xs font-bold text-ink">
                  {selectedDefektaIds.size} obat dipilih
                </span>
                <span className="text-xs text-ink-muted">
                  Estimasi biaya: <strong className="font-mono text-ink">{formatRupiah(totalSpCostEstimate)}</strong>
                </span>
              </div>

              <div className="flex items-center gap-3">
                {sipaBlockMessage && (
                  <span className="text-xs text-danger-ink max-w-md">
                    {sipaBlockMessage}
                  </span>
                )}

                <button
                  type="button"
                  disabled={!canIssueSp}
                  onClick={handleOpenSpWorksheet}
                  className="flex h-10 items-center gap-2 rounded-control bg-action px-5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-action-hover active:bg-action-press disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Buat SP-el</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dialog Konfirmasi & Penerbitan SP-el */}
      {isSpModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-2xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sp-dialog-title"
        >
          <div className="w-full max-w-lg rounded-sheet border border-line bg-surface p-6 shadow-float space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 id="sp-dialog-title" className="text-base font-semibold text-ink">
                  Terbitkan Surat Pesanan Elektronik (SP-el)
                </h3>
                <p className="text-xs text-ink-muted">
                  Otorisasi resmi kefarmasian APJ Raddina Health Service
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSpModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-control text-ink-muted hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="rounded-control border border-line bg-sunken p-3 space-y-1">
                <div className="font-semibold text-ink">Apoteker Penanggung Jawab (APJ):</div>
                <div className="text-ink-soft">{user?.fullName}</div>
                <div className="font-mono text-[11px] text-ink-muted">
                  Nomor SIPA: {user?.noSipa || 'SIPA Terdaftar'}
                </div>
              </div>

              <div>
                <span className="font-semibold text-ink">Daftar item pesanan:</span>
                <ul className="mt-1.5 space-y-1 border border-line rounded-control divide-y divide-line p-2 bg-canvas">
                  {selectedDefektaList.map((item) => (
                    <li key={item.medicineId} className="flex justify-between py-1">
                      <span className="font-medium text-ink">{item.name}</span>
                      <span className="font-mono text-ink-soft tabular-nums">
                        {orderQuantities[item.medicineId] || item.recommendedOrderQty} {item.baseUnit}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <label htmlFor="sp-notes-field" className="block font-medium text-ink mb-1">
                  Catatan pesanan ke PBF (opsional)
                </label>
                <input
                  id="sp-notes-field"
                  type="text"
                  value={spNotes}
                  onChange={(e) => setSpNotes(e.target.value)}
                  placeholder="Instruksi pengiriman cepat atau batas tanggal"
                  className="h-10 w-full rounded-control border border-line-input bg-surface px-3 text-xs text-ink focus:border-action focus:outline-none"
                />
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-line">
                <span className="text-ink-muted">Estimasi tagihan:</span>
                <span className="font-mono font-bold text-base text-ink tabular-nums">
                  {formatRupiah(totalSpCostEstimate)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsSpModalOpen(false)}
                className="flex h-10 items-center justify-center rounded-control border border-line-input bg-surface px-4 text-xs font-semibold text-ink hover:bg-hover active:bg-selected"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isIssuingSp}
                onClick={handleExecuteIssueSp}
                className="flex h-10 items-center gap-2 rounded-control bg-action px-5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-action-hover active:bg-action-press disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{isIssuingSp ? 'Menerbitkan SP-el...' : 'Terbitkan & kirim email'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ParetoDefektaPage;
