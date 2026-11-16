import React, { useEffect, useState } from 'react';
import {
  FileText,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { invoicesApi, medicinesApi, suppliersApi } from '@/lib/api-client';
import { formatDateId, formatNumberId, formatRupiah } from '@/lib/formatters';
import { FileDropzone } from '@/components/shared/FileDropzone';
import { useAuthStore } from '@/stores/auth.store';
import type {
  CreateInvoiceItemInputDto,
  CreatePbfInvoiceRequestDto,
  MedicineSummaryDto,
  SupplierDto,
} from '@shared/api-contracts';

export const PbfInvoicesPage: React.FC = () => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [medicines, setMedicines] = useState<MedicineSummaryDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Lembar Penerimaan Faktur (Worksheet)
  const [isWorksheetOpen, setIsWorksheetOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<CreateInvoiceItemInputDto[]>([
    {
      medicineId: '',
      batchNumber: '',
      expiryDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
      uomUnitName: '',
      qtyInUom: 10,
      purchasePricePerUom: 50000,
    },
  ]);

  // Unggah Pindai Faktur Modal
  const [uploadInvoiceId, setUploadInvoiceId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { user } = useAuthStore();
  const isManager = user?.role === 'OWNER' || user?.role === 'PHARMACIST';

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [invData, supData, medData] = await Promise.all([
        invoicesApi.list(),
        suppliersApi.list(),
        medicinesApi.list({ limit: 100 }),
      ]);
      setInvoices(invData.items);
      setSuppliers(supData);
      setMedicines(medData.items);
      if (supData.length > 0 && !supplierId) {
        setSupplierId(supData[0].id);
      }
      if (medData.items.length > 0 && !items[0].medicineId) {
        setItems([
          {
            medicineId: medData.items[0].id,
            batchNumber: 'B-2401',
            expiryDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
            uomUnitName: medData.items[0].uomConversions[0]?.unitName || medData.items[0].baseUnit,
            qtyInUom: 10,
            purchasePricePerUom: 100000,
          },
        ]);
      }
    } catch {
      toast.error('Gagal memuat data faktur atau pemasok.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddItemRow = () => {
    const defaultMed = medicines[0];
    setItems((prev) => [
      ...prev,
      {
        medicineId: defaultMed?.id || '',
        batchNumber: '',
        expiryDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
        uomUnitName: defaultMed?.uomConversions[0]?.unitName || defaultMed?.baseUnit || '',
        qtyInUom: 1,
        purchasePricePerUom: 0,
      },
    ]);
  };

  const handleRemoveItemRow = (idx: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx: number, field: keyof CreateInvoiceItemInputDto, val: any) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, [field]: val };
        if (field === 'medicineId') {
          const med = medicines.find((m) => m.id === val);
          if (med && med.uomConversions.length > 0) {
            updated.uomUnitName = med.uomConversions[0].unitName;
          }
        }
        return updated;
      }),
    );
  };

  const handleSubmitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceNumber.trim() || !supplierId) {
      toast.error('Nomor faktur dan pemasok PBF wajib diisi.');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.medicineId || !it.batchNumber.trim() || !it.uomUnitName || it.qtyInUom <= 0) {
        toast.error(`Baris item ke-${i + 1} belum lengkap. Pilih obat, nomor batch, dan satuan.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await invoicesApi.create({
        invoiceNumber: invoiceNumber.trim(),
        supplierId,
        invoiceDate,
        dueDate,
        notes: notes || undefined,
        items,
      });

      toast.success(`Faktur diterima. Stok ${items.length} obat bertambah.`);
      setIsWorksheetOpen(false);
      setInvoiceNumber('');
      setNotes('');
      loadInitialData();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan faktur. Periksa keunikan nomor faktur.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadScanFile = async (file: File) => {
    if (!uploadInvoiceId) return;
    setIsUploading(true);
    try {
      await invoicesApi.uploadScan(uploadInvoiceId, file);
      toast.success('Pindai faktur fisik berhasil diunggah.');
      setUploadInvoiceId(null);
      loadInitialData();
    } catch (err: any) {
      toast.error(err.message || 'Ukuran berkas melebihi 5 MB atau format tidak didukung.');
    } finally {
      setIsUploading(false);
    }
  };

  const totalCalculatedAmount = items.reduce(
    (sum, it) => sum + (it.qtyInUom || 0) * (it.purchasePricePerUom || 0),
    0,
  );

  return (
    <div className="space-y-6">
      {/* Kepala Halaman: Judul & Tombol Utama */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Faktur masuk
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Penerimaan faktur pedagang besar farmasi (PBF), mutasi batch, dan konversi HPP
          </p>
        </div>

        {isManager && (
          <button
            type="button"
            onClick={() => setIsWorksheetOpen(true)}
            className="flex h-10 items-center gap-2 rounded-control bg-action px-4 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-action-hover active:bg-action-press"
          >
            <Plus className="h-4 w-4" />
            <span>Terima faktur</span>
          </button>
        )}
      </div>

      {/* Tabel Daftar Faktur PBF Masuk */}
      <div className="rounded-panel border border-line bg-surface overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-10 border-b border-line bg-surface text-ink-muted">
              <tr className="h-10 text-[11px] font-semibold">
                <th className="px-4 py-2">Nomor faktur</th>
                <th className="px-3 py-2">Pemasok PBF</th>
                <th className="px-3 py-2">Tanggal faktur</th>
                <th className="px-3 py-2">Jatuh tempo</th>
                <th className="px-3 py-2 text-right">Total tagihan</th>
                <th className="px-3 py-2 text-center">Status pindai</th>
                <th className="px-4 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-ink">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-ink-muted">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-action" />
                      <span>Memuat riwayat faktur...</span>
                    </div>
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-ink-muted">
                    Belum ada riwayat faktur masuk. Klik "Terima faktur" untuk mencatat penerimaan obat.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="h-12 hover:bg-hover transition-colors">
                    <td className="px-4 py-2 font-mono font-semibold text-ink">
                      {inv.invoiceNumber}
                    </td>

                    <td className="px-3 py-2 text-ink-soft font-medium">
                      {inv.supplierName || 'Pemasok Terdaftar'}
                    </td>

                    <td className="px-3 py-2 font-mono text-ink-muted">
                      {formatDateId(inv.invoiceDate)}
                    </td>

                    <td className="px-3 py-2 font-mono text-ink-muted">
                      {formatDateId(inv.dueDate)}
                    </td>

                    <td className="px-3 py-2 text-right font-mono font-semibold text-ink tabular-nums">
                      {formatRupiah(inv.totalAmount)}
                    </td>

                    <td className="px-3 py-2 text-center">
                      {inv.scanFilePath ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-mint px-2 py-0.5 text-[10px] font-semibold text-ink border border-line-input">
                          Ada berkas
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2 py-0.5 text-[10px] font-semibold text-warn-ink border border-line-input">
                          Belum dipindai
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-2 text-right">
                      {isManager && (
                        <button
                          type="button"
                          onClick={() => setUploadInvoiceId(inv.id)}
                          className="inline-flex items-center gap-1 rounded-control border border-line-input bg-surface px-2.5 py-1 text-xs font-semibold text-ink hover:bg-hover active:bg-selected"
                        >
                          <Upload className="h-3.5 w-3.5 text-action" />
                          <span>Unggah pindai</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lembar Kerja Penerimaan Faktur (Worksheet) Sesuai DESIGN.md Section 8.4 */}
      {isWorksheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-2xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="worksheet-title"
        >
          <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-sheet border border-line bg-surface shadow-float">
            {/* Kepala Lembar Kerja */}
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <div>
                <h2 id="worksheet-title" className="text-lg font-semibold text-ink">
                  Lembar penerimaan faktur PBF
                </h2>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Catat item obat masuk, nomor batch, dan tanggal kedaluwarsa untuk FEFO
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsWorksheetOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-control text-ink-soft hover:bg-hover hover:text-ink"
                aria-label="Tutup lembar kerja"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Dua Kolom Lembar Kerja: Kiri (2/3 Item) & Kanan (1/3 Metadata) Sesuai DESIGN.md 8.4 */}
            <form onSubmit={handleSubmitInvoice} className="flex flex-1 flex-col overflow-y-auto lg:flex-row">
              {/* Kolom Kiri (2/3): Tabel Item Penerimaan dengan Edit Langsung */}
              <div className="flex-1 space-y-4 border-b border-line p-6 lg:border-b-0 lg:border-r">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                    Daftar item obat faktur ({items.length})
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="flex h-8 items-center gap-1.5 rounded-control bg-mint px-2.5 text-xs font-semibold text-ink hover:bg-mint/80"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Tambah baris obat</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {items.map((item, idx) => {
                    const selectedMed = medicines.find((m) => m.id === item.medicineId);
                    const selectedUom = selectedMed?.uomConversions.find(
                      (u) => u.unitName === item.uomUnitName,
                    );
                    const multiplier = selectedUom?.multiplierToBase || 1;
                    const totalBaseUnits = (item.qtyInUom || 0) * multiplier;
                    const hppPerBase =
                      totalBaseUnits > 0
                        ? ((item.purchasePricePerUom || 0) / multiplier).toFixed(2)
                        : '0,00';

                    return (
                      <div
                        key={idx}
                        className="rounded-panel border border-line bg-canvas p-3.5 text-xs space-y-2.5"
                      >
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12 items-center">
                          {/* Pilihan Obat */}
                          <div className="sm:col-span-5">
                            <label className="block text-[11px] font-medium text-ink-soft mb-1">
                              Obat #{idx + 1}
                            </label>
                            <select
                              required
                              value={item.medicineId}
                              onChange={(e) =>
                                handleItemChange(idx, 'medicineId', e.target.value)
                              }
                              className="h-9 w-full rounded-control border border-line-input bg-surface px-2.5 text-xs text-ink focus:border-action focus:outline-none"
                            >
                              <option value="">Pilih obat...</option>
                              {medicines.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name} ({m.sku})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Pilihan Satuan UOM */}
                          <div className="sm:col-span-3">
                            <label className="block text-[11px] font-medium text-ink-soft mb-1">
                              Satuan kemasan
                            </label>
                            <select
                              required
                              value={item.uomUnitName}
                              onChange={(e) =>
                                handleItemChange(idx, 'uomUnitName', e.target.value)
                              }
                              className="h-9 w-full rounded-control border border-line-input bg-surface px-2 text-xs text-ink focus:border-action focus:outline-none"
                            >
                              {selectedMed?.uomConversions.map((u) => (
                                <option key={u.unitName} value={u.unitName}>
                                  {u.unitName} (x{u.multiplierToBase})
                                </option>
                              )) || (
                                <option value={item.uomUnitName || 'Unit'}>
                                  {item.uomUnitName || 'Unit'}
                                </option>
                              )}
                            </select>
                          </div>

                          {/* Kuantitas Kemasan */}
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-medium text-ink-soft mb-1">
                              Jumlah
                            </label>
                            <input
                              type="number"
                              min={1}
                              required
                              value={item.qtyInUom}
                              onChange={(e) =>
                                handleItemChange(idx, 'qtyInUom', Number(e.target.value))
                              }
                              className="h-9 w-full rounded-control border border-line-input bg-surface px-2 text-right font-mono text-xs text-ink focus:border-action focus:outline-none"
                            />
                          </div>

                          {/* Harga Beli Satuan */}
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-medium text-ink-soft mb-1">
                              Harga per kemasan
                            </label>
                            <input
                              type="number"
                              min={0}
                              required
                              value={item.purchasePricePerUom}
                              onChange={(e) =>
                                handleItemChange(
                                  idx,
                                  'purchasePricePerUom',
                                  Number(e.target.value),
                                )
                              }
                              className="h-9 w-full rounded-control border border-line-input bg-surface px-2 text-right font-mono text-xs text-ink focus:border-action focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Baris Kedua: Nomor Batch & Tanggal ED */}
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12 items-center pt-1 border-t border-line/60">
                          <div className="sm:col-span-5">
                            <input
                              type="text"
                              required
                              value={item.batchNumber}
                              onChange={(e) =>
                                handleItemChange(idx, 'batchNumber', e.target.value)
                              }
                              placeholder="Nomor batch (misal: B-2401)"
                              className="h-8 w-full rounded-control border border-line-input bg-surface px-2.5 font-mono text-xs text-ink focus:border-action focus:outline-none"
                            />
                          </div>

                          <div className="sm:col-span-5">
                            <input
                              type="date"
                              required
                              value={item.expiryDate}
                              onChange={(e) =>
                                handleItemChange(idx, 'expiryDate', e.target.value)
                              }
                              className="h-8 w-full rounded-control border border-line-input bg-surface px-2 font-mono text-xs text-ink focus:border-action focus:outline-none"
                            />
                          </div>

                          <div className="sm:col-span-2 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(idx)}
                              disabled={items.length <= 1}
                              className="flex h-8 w-8 items-center justify-center rounded-control text-ink-muted hover:bg-danger-soft hover:text-danger-ink disabled:opacity-30"
                              title="Hapus baris obat"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Umpan Balik Hitung Real-time Sesuai DESIGN.md Section 8.4 */}
                        <div className="font-mono text-[11px] text-ink-soft">
                          Masuk <strong className="text-ink">{formatNumberId(totalBaseUnits)}</strong> {selectedMed?.baseUnit || 'satuan dasar'}, HPP <strong className="text-action">{formatRupiah(Number(hppPerBase))}</strong> per {selectedMed?.baseUnit || 'satuan dasar'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Kolom Kanan (1/3, Lekat): Nomor Faktur, Pemasok, Tanggal & Total */}
              <div className="w-full lg:w-80 p-6 space-y-4 bg-sunken">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  Data faktur PBF
                </h3>

                <div>
                  <label htmlFor="inv-num" className="block text-xs font-medium text-ink">
                    Nomor faktur resmi
                  </label>
                  <input
                    id="inv-num"
                    type="text"
                    required
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="Contoh: INV-KF-2026-001"
                    className="mt-1 h-10 w-full rounded-control border border-line-input bg-surface px-3 font-mono text-xs text-ink focus:border-action focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="inv-sup" className="block text-xs font-medium text-ink">
                    Pemasok (PBF)
                  </label>
                  <select
                    id="inv-sup"
                    required
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="mt-1 h-10 w-full rounded-control border border-line-input bg-surface px-3 text-xs text-ink focus:border-action focus:outline-none"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="inv-date" className="block text-xs font-medium text-ink">
                      Tanggal terima
                    </label>
                    <input
                      id="inv-date"
                      type="date"
                      required
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      className="mt-1 h-9 w-full rounded-control border border-line-input bg-surface px-2 font-mono text-xs text-ink focus:border-action focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="inv-due" className="block text-xs font-medium text-ink">
                      Jatuh tempo
                    </label>
                    <input
                      id="inv-due"
                      type="date"
                      required
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="mt-1 h-9 w-full rounded-control border border-line-input bg-surface px-2 font-mono text-xs text-ink focus:border-action focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="inv-notes" className="block text-xs font-medium text-ink">
                    Catatan faktur (opsional)
                  </label>
                  <input
                    id="inv-notes"
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Keterangan pengiriman"
                    className="mt-1 h-9 w-full rounded-control border border-line-input bg-surface px-3 text-xs text-ink focus:border-action focus:outline-none"
                  />
                </div>

                <hr className="border-t border-line" />

                <div>
                  <div className="text-xs text-ink-muted">Total tagihan faktur</div>
                  <div className="tabular-nums font-mono text-2xl font-bold text-ink">
                    {formatRupiah(totalCalculatedAmount)}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-4 flex h-12 w-full items-center justify-center rounded-control bg-action px-4 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-action-hover active:bg-action-press disabled:opacity-50"
                >
                  {isSubmitting ? 'Memproses faktur...' : 'Simpan faktur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Unggah Pindai Berkas Faktur */}
      {uploadInvoiceId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-2xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="upload-scan-title"
        >
          <div className="w-full max-w-md rounded-sheet border border-line bg-surface p-6 shadow-float">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 id="upload-scan-title" className="text-sm font-semibold text-ink">
                Unggah pindai faktur fisik
              </h3>
              <button
                type="button"
                onClick={() => setUploadInvoiceId(null)}
                className="flex h-7 w-7 items-center justify-center rounded-control text-ink-muted hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-2 text-xs text-ink-muted">
              Pilih berkas PDF atau gambar (JPEG, PNG, WEBP) faktur fisik maksimal 5 MB.
            </p>

            <div className="mt-4">
              <FileDropzone
                label="Pindai faktur fisik"
                helperText="Pilih berkas PDF atau gambar (JPEG, PNG, WEBP) faktur fisik maksimal 5 MB."
                acceptMimeTypes={['application/pdf', 'image/jpeg', 'image/png', 'image/webp']}
                maxSizeBytes={5 * 1024 * 1024}
                onUploadFile={handleUploadScanFile}
                isUploading={isUploading}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PbfInvoicesPage;
