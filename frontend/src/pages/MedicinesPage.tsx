import React, { useEffect, useState } from 'react';
import {
  History,
  ImageIcon,
  Pencil,
  Pill,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { categoriesApi, medicinesApi } from '@/lib/api-client';
import {
  computeDaysUntilExpiry,
  formatNumberId,
  formatRupiah,
} from '@/lib/formatters';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { MedicineFormModal } from '@/components/inventory/MedicineFormModal';
import { StockCardDrawer } from '@/components/inventory/StockCardDrawer';
import { useAuthStore } from '@/stores/auth.store';
import type {
  CreateMedicineRequestDto,
  MedicineSummaryDto,
} from '@shared/api-contracts';
import type { CategoryDto } from '@/lib/api-client';

type StockStatusFilter = 'ALL' | 'LOW' | 'EMPTY' | 'NEAR_ED';

export const MedicinesPage: React.FC = () => {
  const [medicines, setMedicines] = useState<MedicineSummaryDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPareto, setSelectedPareto] = useState('');
  const [statusFilter, setStatusFilter] = useState<StockStatusFilter>('ALL');

  // Modal & Drawer State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<MedicineSummaryDto | null>(null);
  const [inspectingMedicine, setInspectingMedicine] = useState<MedicineSummaryDto | null>(null);
  const [medicineToDelete, setMedicineToDelete] = useState<MedicineSummaryDto | null>(null);
  const [isStockDrawerOpen, setIsStockDrawerOpen] = useState(false);

  const { user } = useAuthStore();
  const isManager = user?.role === 'OWNER' || user?.role === 'PHARMACIST';

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadMedicines();
  }, [search, selectedCategory, selectedPareto]);

  const loadCategories = async () => {
    try {
      const data = await categoriesApi.list();
      setCategories(data);
    } catch {
      // Diamkan bila kategori gagal termuat sesaat
    }
  };

  const loadMedicines = async () => {
    setIsLoading(true);
    try {
      const res = await medicinesApi.list({
        search: search || undefined,
        categoryId: selectedCategory || undefined,
        paretoClass: (selectedPareto as any) || undefined,
        limit: 100,
      });
      setMedicines(res.items);
    } catch (err: any) {
      toast.error('Tidak dapat terhubung ke server. Periksa koneksi lalu muat ulang.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveMedicine = async (dto: CreateMedicineRequestDto) => {
    try {
      if (editingMedicine) {
        await medicinesApi.update(editingMedicine.id, dto);
        toast.success(`Data obat ${dto.name} berhasil diperbarui.`);
      } else {
        await medicinesApi.create(dto);
        toast.success(`Obat ${dto.name} berhasil ditambahkan ke katalog.`);
      }
      setIsFormModalOpen(false);
      setEditingMedicine(null);
      loadMedicines();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan data obat. Periksa kelengkapan field.');
    }
  };

  const executeDeleteMedicine = async (med: MedicineSummaryDto) => {
    try {
      await medicinesApi.remove(med.id);
      toast.success(`Obat ${med.name} dinonaktifkan atau dihapus dari katalog.`);
      setMedicineToDelete(null);
      loadMedicines();
    } catch (err: any) {
      toast.error('Gagal menghapus obat karena memiliki keterkaitan mutasi stok.');
    }
  };

  const handleOpenStockCard = (med: MedicineSummaryDto) => {
    setInspectingMedicine(med);
    setIsStockDrawerOpen(true);
  };

  // Filter lokal status stok
  const filteredMedicines = medicines.filter((m) => {
    if (statusFilter === 'LOW') {
      return m.totalActiveStockBaseUnit > 0 && m.totalActiveStockBaseUnit <= m.minStockBaseUnit;
    }
    if (statusFilter === 'EMPTY') {
      return m.totalActiveStockBaseUnit === 0;
    }
    if (statusFilter === 'NEAR_ED') {
      if (!m.earliestExpiryDate) return false;
      const days = computeDaysUntilExpiry(m.earliestExpiryDate);
      return days !== null && days > 0 && days <= 90;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Kepala Halaman: Judul & Aksi Utama (Satu tugas utama per layar) */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Obat
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Katalog master obat, penetapan harga multi-UOM, dan pemantauan masa berlaku
          </p>
        </div>

        {isManager && (
          <button
            type="button"
            onClick={() => {
              setEditingMedicine(null);
              setIsFormModalOpen(true);
            }}
            className="flex h-10 items-center gap-2 rounded-control bg-action px-4 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-action-hover active:bg-action-press"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah obat</span>
          </button>
        )}
      </div>

      {/* Satu Baris Alat (Pencarian, Kategori & Segmen Status) Sesuai DESIGN.md Section 8.3 */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Field Pencarian */}
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama obat, SKU, atau zat aktif..."
            className="h-10 w-full rounded-control border border-line-input bg-surface pl-10 pr-3.5 text-xs text-ink placeholder:text-ink-muted focus:border-action focus:ring-2 focus:ring-mint focus:outline-none"
          />
        </div>

        {/* Pemilih Kategori */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="h-10 rounded-control border border-line-input bg-surface px-3 text-xs text-ink focus:border-action focus:ring-2 focus:ring-mint focus:outline-none"
          aria-label="Filter kategori obat"
        >
          <option value="">Semua kategori</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Pemilih Kelas Pareto */}
        <select
          value={selectedPareto}
          onChange={(e) => setSelectedPareto(e.target.value)}
          className="h-10 rounded-control border border-line-input bg-surface px-3 text-xs text-ink focus:border-action focus:ring-2 focus:ring-mint focus:outline-none"
          aria-label="Filter kelas Pareto"
        >
          <option value="">Semua Pareto</option>
          <option value="A">Kelas A (80% omzet)</option>
          <option value="B">Kelas B (15% omzet)</option>
          <option value="C">Kelas C (5% omzet)</option>
        </select>

        {/* Segmen Status Stok Sesuai DESIGN.md 8.3 */}
        <div className="inline-flex rounded-control border border-line bg-sunken p-1">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`rounded-control px-2.5 py-1 text-xs font-semibold transition-colors ${
              statusFilter === 'ALL'
                ? 'border border-line bg-surface text-ink shadow-xs'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Semua
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('LOW')}
            className={`rounded-control px-2.5 py-1 text-xs font-semibold transition-colors ${
              statusFilter === 'LOW'
                ? 'border border-line bg-surface text-ink shadow-xs'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Menipis
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('EMPTY')}
            className={`rounded-control px-2.5 py-1 text-xs font-semibold transition-colors ${
              statusFilter === 'EMPTY'
                ? 'border border-line bg-surface text-ink shadow-xs'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Habis
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('NEAR_ED')}
            className={`rounded-control px-2.5 py-1 text-xs font-semibold transition-colors ${
              statusFilter === 'NEAR_ED'
                ? 'border border-line bg-surface text-ink shadow-xs'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Mendekati ED
          </button>
        </div>

        {/* Tombol Segarkan */}
        <button
          type="button"
          onClick={loadMedicines}
          disabled={isLoading}
          className="flex h-10 w-10 items-center justify-center rounded-control border border-line-input bg-surface text-ink-soft hover:bg-hover active:bg-selected disabled:opacity-50"
          title="Segarkan data obat"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-action' : ''}`} />
        </button>
      </div>

      {/* Tabel Tunggal Dibungkus Panel Putih Sesuai DESIGN.md Section 7.4 & 8.3 */}
      <div className="rounded-panel border border-line bg-surface overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-10 border-b border-line bg-surface text-ink-muted">
              <tr className="h-10 text-[11px] font-semibold">
                <th className="px-4 py-2">Obat</th>
                <th className="px-3 py-2">Golongan &amp; Pareto</th>
                <th className="px-3 py-2">Kategori</th>
                <th className="px-3 py-2">Satuan &amp; harga reguler</th>
                <th className="px-3 py-2 text-right">Stok layak jual</th>
                <th className="px-3 py-2 text-center">ED terdekat</th>
                <th className="px-4 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-ink">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-ink-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="h-5 w-5 animate-spin text-action" />
                      <span>Memuat katalog obat...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredMedicines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-mint text-ink">
                        <Pill className="h-6 w-6" />
                      </div>
                      <p className="text-sm font-semibold text-ink">
                        Belum ada obat yang cocok dengan filter
                      </p>
                      <p className="mt-1 text-xs text-ink-muted">
                        Sesuaikan kata kunci pencarian atau tambahkan obat baru ke katalog apotek.
                      </p>
                      {isManager && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMedicine(null);
                            setIsFormModalOpen(true);
                          }}
                          className="mt-4 flex h-9 items-center gap-1.5 rounded-control bg-mint px-3 text-xs font-semibold text-ink hover:bg-mint/80"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Tambah obat</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredMedicines.map((med) => {
                  const daysUntilExpiry = med.earliestExpiryDate
                    ? (computeDaysUntilExpiry(med.earliestExpiryDate) ?? undefined)
                    : undefined;

                  return (
                    <tr
                      key={med.id}
                      onClick={() => handleOpenStockCard(med)}
                      className="cursor-pointer transition-colors hover:bg-hover h-14"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          {med.imagePath ? (
                            <img
                              src={med.imagePath}
                              alt=""
                              className="h-10 w-10 shrink-0 rounded-control border border-line object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-line bg-sunken text-ink-muted">
                              <ImageIcon className="h-4 w-4" />
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-ink text-sm">
                              {med.name}
                            </div>
                            <div className="text-[11px] text-ink-muted">
                              Zat aktif: <span className="text-ink-soft font-medium">{med.activeIngredient}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge kind="drug" status={med.classification} compact />
                          <StatusBadge kind="pareto" status={med.paretoClass} compact />
                        </div>
                      </td>

                      <td className="px-3 py-2.5 text-xs text-ink-soft font-medium">
                        {med.categoryName}
                      </td>

                      <td className="px-3 py-2.5">
                        <div className="space-y-0.5">
                          {med.uomConversions.map((uom) => (
                            <div
                              key={uom.unitName}
                              className="flex items-center gap-2 font-mono text-[11px]"
                            >
                              <span className="w-12 text-ink-soft font-medium">
                                {uom.unitName}
                              </span>
                              <span className="text-ink-muted text-[10px]">
                                (x{uom.multiplierToBase})
                              </span>
                              <span className="font-semibold text-ink tabular-nums">
                                {formatRupiah(uom.sellingPriceRegular)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>

                      <td className="px-3 py-2.5 text-right">
                        <div className="tabular-nums font-mono text-sm font-semibold text-ink">
                          {formatNumberId(med.totalActiveStockBaseUnit)}
                        </div>
                        <div className="text-[10px] text-ink-muted font-mono">
                          {med.baseUnit} (min: {med.minStockBaseUnit})
                        </div>
                      </td>

                      <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        {daysUntilExpiry !== undefined ? (
                          <StatusBadge
                            kind="batch"
                            daysUntilExpiry={daysUntilExpiry}
                            compact
                          />
                        ) : (
                          <span className="text-[11px] text-ink-muted italic">
                            Belum ada batch
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenStockCard(med)}
                            className="flex h-8 w-8 items-center justify-center rounded-control text-ink-soft hover:bg-hover hover:text-ink"
                            title="Buka kartu stok & sediaan 3D"
                            aria-label={`Buka kartu stok ${med.name}`}
                          >
                            <History className="h-4 w-4" />
                          </button>

                          {isManager && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMedicine(med);
                                  setIsFormModalOpen(true);
                                }}
                                className="flex h-8 w-8 items-center justify-center rounded-control text-ink-soft hover:bg-hover hover:text-ink"
                                title="Ubah data obat"
                                aria-label={`Ubah data obat ${med.name}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setMedicineToDelete(med)}
                                className="flex h-8 w-8 items-center justify-center rounded-control text-ink-soft hover:bg-danger-soft hover:text-danger-ink"
                                title="Hapus atau nonaktifkan obat"
                                aria-label={`Hapus obat ${med.name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal Obat Sesuai DESIGN.md Section 8.3 (720px wide, 3 sections divided by line) */}
      {isFormModalOpen && (
        <MedicineFormModal
          isOpen={isFormModalOpen}
          initialMedicine={editingMedicine}
          categories={categories}
          onClose={() => {
            setIsFormModalOpen(false);
            setEditingMedicine(null);
          }}
          onSubmit={(dto) => handleSaveMedicine(dto)}
        />
      )}

      {/* Laci Stok Obat Sesuai DESIGN.md Section 8.3 (480px wide) */}
      {isStockDrawerOpen && inspectingMedicine && (
        <StockCardDrawer
          isOpen={isStockDrawerOpen}
          medicine={inspectingMedicine}
          onClose={() => {
            setIsStockDrawerOpen(false);
            setInspectingMedicine(null);
          }}
          onImageUpdated={(newImagePath) => {
            setMedicines((prev) =>
              prev.map((m) =>
                m.id === inspectingMedicine.id ? { ...m, imagePath: newImagePath } : m,
              ),
            );
          }}
        />
      )}

      {/* Dialog Konfirmasi Hapus */}
      <ConfirmModal
        isOpen={Boolean(medicineToDelete)}
        title="Hapus atau nonaktifkan obat"
        description={`Apakah Anda yakin ingin menghapus atau menonaktifkan ${medicineToDelete?.name}? Jika obat memiliki catatan transaksi, sistem akan menonaktifkannya secara aman.`}
        confirmLabel="Hapus obat"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={() => {
          if (medicineToDelete) {
            executeDeleteMedicine(medicineToDelete);
          }
        }}
        onCancel={() => setMedicineToDelete(null)}
      />
    </div>
  );
};

export default MedicinesPage;
