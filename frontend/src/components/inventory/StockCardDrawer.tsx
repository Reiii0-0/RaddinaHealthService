import React, { useEffect, useState } from 'react';
import {
  Box,
  Clock,
  History,
  Layers,
  RefreshCw,
  UploadCloud,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { inventoryApi, medicinesApi } from '@/lib/api-client';
import {
  computeDaysUntilExpiry,
  formatDateId,
  formatNumberId,
  formatRupiah,
} from '@/lib/formatters';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FileDropzone } from '@/components/shared/FileDropzone';
import { Medicine3DViewer } from '@/components/shared/Medicine3DViewer';
import type {
  BatchStockItemDto,
  MedicineSummaryDto,
  StockCardEntryDto,
} from '@shared/api-contracts';

interface StockCardDrawerProps {
  medicine: MedicineSummaryDto | null;
  isOpen: boolean;
  onClose: () => void;
  onImageUpdated?: (newImagePath: string) => void;
}

type DrawerTab = 'batches' | 'uom' | 'cards' | 'photo';

export const StockCardDrawer: React.FC<StockCardDrawerProps> = ({
  medicine,
  isOpen,
  onClose,
  onImageUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<DrawerTab>('batches');
  const [batches, setBatches] = useState<BatchStockItemDto[]>([]);
  const [entries, setEntries] = useState<StockCardEntryDto[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [isLoadingCards, setIsLoadingCards] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (isOpen && medicine) {
      loadBatches(medicine.id);
      loadStockCards(medicine.id);
    } else {
      setBatches([]);
      setEntries([]);
    }
  }, [isOpen, medicine]);

  const loadBatches = async (medicineId: string) => {
    setIsLoadingBatches(true);
    try {
      const data = await inventoryApi.listBatches({ medicineId });
      setBatches(data.items);
    } catch {
      // Abaikan bila backend gagal sejenak
    } finally {
      setIsLoadingBatches(false);
    }
  };

  const loadStockCards = async (medicineId: string) => {
    setIsLoadingCards(true);
    try {
      const response = await inventoryApi.listStockCards({
        medicineId,
        limit: 50,
      });
      setEntries(response.items);
    } catch {
      // Abaikan bila backend gagal sejenak
    } finally {
      setIsLoadingCards(false);
    }
  };

  const handleUploadImage = async (file: File) => {
    if (!medicine) return;
    setIsUploading(true);
    try {
      const result = await medicinesApi.uploadImage(medicine.id, file);
      const imgPath = 'imagePath' in result ? result.imagePath : (result as any).imagePath;
      toast.success('Foto kemasan obat berhasil diunggah.');
      if (onImageUpdated && imgPath) {
        onImageUpdated(imgPath);
      }
    } catch (err: any) {
      toast.error(err.message || 'Ukuran berkas melebihi 5 MB atau format tidak didukung.');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen || !medicine) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-2xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stock-drawer-title"
    >
      <div className="flex h-full w-full max-w-[480px] flex-col border-l border-line bg-surface shadow-float">
        {/* Kepala Laci */}
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 id="stock-drawer-title" className="text-base font-semibold text-ink">
              {medicine.name}
            </h2>
            <p className="font-mono text-xs text-ink-muted">
              SKU: {medicine.sku} • {medicine.baseUnit}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-control text-ink-soft hover:bg-hover hover:text-ink"
            aria-label="Tutup laci rincian obat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Panggung 3D Sediaan Setinggi 240px Sesuai DESIGN.md Section 8.3 & 10 */}
        <div className="border-b border-line p-3 bg-canvas">
          <Medicine3DViewer
            name={medicine.name}
            dosageForm={medicine.baseUnit}
            activeIngredient={medicine.activeIngredient}
            className="h-[220px] w-full"
          />
        </div>

        {/* Tab Sesuai DESIGN.md 8.3: Batch (bawaan), Satuan dan harga, Riwayat singkat, Foto */}
        <div className="flex border-b border-line px-4 bg-surface text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('batches')}
            className={`flex items-center gap-1.5 border-b-2 py-3 px-3 transition-colors ${
              activeTab === 'batches'
                ? 'border-action text-ink font-bold'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <span>Batch ({batches.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('uom')}
            className={`border-b-2 py-3 px-3 transition-colors ${
              activeTab === 'uom'
                ? 'border-action text-ink font-bold'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <span>Satuan &amp; harga</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cards')}
            className={`border-b-2 py-3 px-3 transition-colors ${
              activeTab === 'cards'
                ? 'border-action text-ink font-bold'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <span>Riwayat stok</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('photo')}
            className={`border-b-2 py-3 px-3 transition-colors ${
              activeTab === 'photo'
                ? 'border-action text-ink font-bold'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <span>Foto kemasan</span>
          </button>
        </div>

        {/* Isi Tab */}
        <div className="flex-1 overflow-y-auto p-4 text-xs">
          {/* Tab 1: Batch Sesuai DESIGN.md 8.3 */}
          {activeTab === 'batches' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-ink-muted text-[11px]">
                <span>Daftar batch FEFO berurutan tanggal kedaluwarsa</span>
                <button
                  type="button"
                  onClick={() => loadBatches(medicine.id)}
                  className="flex items-center gap-1 text-action hover:underline"
                >
                  <RefreshCw className={`h-3 w-3 ${isLoadingBatches ? 'animate-spin' : ''}`} />
                  <span>Segarkan</span>
                </button>
              </div>

              {isLoadingBatches ? (
                <div className="py-12 text-center text-ink-muted">
                  Memuat data batch FEFO...
                </div>
              ) : batches.length === 0 ? (
                <div className="rounded-control border border-line bg-sunken p-6 text-center text-ink-muted">
                  Belum ada batch aktif untuk obat ini. Terima faktur PBF untuk menambah stok.
                </div>
              ) : (
                <div className="space-y-2">
                  {batches.map((batch, idx) => {
                    const days = batch.daysUntilExpiry;
                    const isFirstActive = idx === 0 && days > 0;
                    const isExpired = days <= 0;

                    return (
                      <div
                        key={batch.id}
                        className={`rounded-control border p-3 ${
                          isExpired
                            ? 'border-danger-ink/30 bg-danger-soft/40'
                            : isFirstActive
                            ? 'border-line-input bg-mint/15'
                            : 'border-line bg-surface'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-ink">
                              {batch.batchNumber}
                            </span>
                            {isFirstActive && (
                              <span className="rounded-full bg-mint px-2 py-0.5 text-[10px] font-semibold text-ink border border-line-input">
                                Dijual lebih dulu
                              </span>
                            )}
                            {isExpired && (
                              <span className="rounded-full bg-danger px-2 py-0.5 text-[10px] font-semibold text-white">
                                Tidak dijual
                              </span>
                            )}
                          </div>
                          <span className="tabular-nums font-mono text-xs font-semibold text-ink">
                            {formatNumberId(batch.currentStock)} {batch.baseUnit}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-[11px] text-ink-muted">
                          <span>PBF: {batch.supplierName}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono">ED: {batch.expiryDate}</span>
                            <StatusBadge kind="batch" daysUntilExpiry={days} compact />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Satuan & Harga */}
          {activeTab === 'uom' && (
            <div className="space-y-3">
              <div className="text-[11px] text-ink-muted">
                Tingkatan harga jual per satuan kemasan
              </div>

              <div className="overflow-x-auto rounded-control border border-line">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-line bg-sunken text-ink-muted text-[11px]">
                    <tr>
                      <th className="px-3 py-2">Kemasan</th>
                      <th className="px-3 py-2 text-right">Pengali</th>
                      <th className="px-3 py-2 text-right">Harga reguler</th>
                      <th className="px-3 py-2 text-right">Harga mitra</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line bg-surface font-mono">
                    {medicine.uomConversions.map((uom) => (
                      <tr key={uom.unitName} className="hover:bg-hover">
                        <td className="px-3 py-2 font-sans font-semibold text-ink">
                          {uom.unitName}
                        </td>
                        <td className="px-3 py-2 text-right text-ink-soft">
                          x{uom.multiplierToBase}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-ink tabular-nums">
                          {formatRupiah(uom.sellingPriceRegular)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-action tabular-nums">
                          {formatRupiah(uom.sellingPricePartner)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 3: Riwayat Kartu Stok */}
          {activeTab === 'cards' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-ink-muted text-[11px]">
                <span>Buku besar mutasi stok append-only</span>
                <button
                  type="button"
                  onClick={() => loadStockCards(medicine.id)}
                  className="flex items-center gap-1 text-action hover:underline"
                >
                  <RefreshCw className={`h-3 w-3 ${isLoadingCards ? 'animate-spin' : ''}`} />
                  <span>Segarkan</span>
                </button>
              </div>

              {isLoadingCards ? (
                <div className="py-12 text-center text-ink-muted">
                  Memuat data kartu stok...
                </div>
              ) : entries.length === 0 ? (
                <div className="rounded-control border border-line bg-sunken p-6 text-center text-ink-muted">
                  Belum ada mutasi stok untuk obat ini.
                </div>
              ) : (
                <div className="space-y-2">
                  {entries.map((entry) => {
                    const isPositive = entry.qtyChange > 0;
                    return (
                      <div
                        key={entry.id}
                        className="rounded-control border border-line bg-surface p-3 hover:bg-hover transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                entry.movementType === 'IN_INVOICE'
                                  ? 'bg-mint text-ink border border-line-input'
                                  : 'bg-sand text-ink border border-line-input'
                              }`}
                            >
                              {entry.movementType === 'IN_INVOICE' ? 'Masuk faktur' : 'Keluar kasir'}
                            </span>
                            <span className="font-mono text-xs text-ink-soft">
                              Batch: {entry.batchNumber}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-ink-muted">
                            {formatDateId(entry.createdAt)}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-xs">
                          <span className="text-[11px] text-ink-muted">
                            Ref: <span className="font-mono text-ink-soft">{entry.referenceId}</span>
                          </span>
                          <div className="flex items-center gap-2 font-mono">
                            <span
                              className={`font-semibold tabular-nums ${
                                isPositive ? 'text-action' : 'text-danger-ink'
                              }`}
                            >
                              {isPositive ? `+${entry.qtyChange}` : entry.qtyChange}
                            </span>
                            <span className="text-ink-muted">→</span>
                            <span className="font-bold text-ink tabular-nums">
                              {entry.balanceAfter}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Unggah Foto Kemasan */}
          {activeTab === 'photo' && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-ink">Foto kemasan obat</h4>
                <p className="mt-0.5 text-[11px] text-ink-muted">
                  Unggah berkas foto kemasan resmi (JPEG, PNG, atau WEBP maks 5 MB)
                </p>
              </div>

              {medicine.imagePath && (
                <div className="rounded-control border border-line p-2 text-center bg-canvas">
                  <img
                    src={medicine.imagePath}
                    alt={medicine.name}
                    className="mx-auto max-h-48 rounded object-contain"
                  />
                  <div className="mt-1 font-mono text-[10px] text-ink-muted truncate">
                    {medicine.imagePath}
                  </div>
                </div>
              )}

              <FileDropzone
                label="Unggah foto kemasan obat"
                acceptMimeTypes={['image/jpeg', 'image/png', 'image/webp']}
                maxSizeBytes={5 * 1024 * 1024}
                onUploadFile={handleUploadImage}
                isUploading={isUploading}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StockCardDrawer;
