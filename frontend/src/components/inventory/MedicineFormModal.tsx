import React, { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type {
  CreateMedicineRequestDto,
  DrugClassification,
  MedicineSummaryDto,
  UomConversionInputDto,
} from '@shared/api-contracts';
import type { CategoryDto } from '@/lib/api-client';
import { formatRupiah } from '@/lib/formatters';

export interface MedicineFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMedicine?: MedicineSummaryDto | null;
  categories: CategoryDto[];
  onCreateCategory?: (name: string) => Promise<CategoryDto>;
  onSubmit: (dto: CreateMedicineRequestDto, editingId?: string) => Promise<void>;
  isSubmitting?: boolean;
}

const DRUG_CLASS_OPTIONS: Array<{ value: DrugClassification; label: string }> = [
  { value: 'BEBAS', label: 'Bebas (lingkaran hijau)' },
  { value: 'BEBAS_TERBATAS', label: 'Bebas terbatas (lingkaran biru)' },
  { value: 'KERAS', label: 'Keras (lingkaran merah K)' },
  { value: 'PSIKOTROPIKA', label: 'Psikotropika (SP khusus)' },
  { value: 'NARKOTIKA', label: 'Narkotika (pengawasan ketat)' },
];

export function MedicineFormModal({
  isOpen,
  onClose,
  initialMedicine = null,
  categories,
  onCreateCategory,
  onSubmit,
  isSubmitting = false,
}: MedicineFormModalProps) {
  const isEditing = Boolean(initialMedicine);

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [activeIngredient, setActiveIngredient] = useState('');
  const [baseUnit, setBaseUnit] = useState('Tablet');
  const [classification, setClassification] = useState<DrugClassification>('BEBAS');
  const [minStockBaseUnit, setMinStockBaseUnit] = useState<number>(50);
  const [uomRows, setUomRows] = useState<UomConversionInputDto[]>([
    {
      unitName: 'Tablet',
      multiplierToBase: 1,
      sellingPriceRegular: 1500,
      sellingPricePartner: 1300,
      barcode: '',
    },
    {
      unitName: 'Strip',
      multiplierToBase: 10,
      sellingPriceRegular: 14000,
      sellingPricePartner: 12500,
      barcode: '',
    },
    {
      unitName: 'Box',
      multiplierToBase: 100,
      sellingPriceRegular: 132000,
      sellingPricePartner: 118000,
      barcode: '',
    },
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFormError(null);
    if (initialMedicine) {
      setSku(initialMedicine.sku);
      setName(initialMedicine.name);
      setCategoryId(initialMedicine.categoryId);
      setActiveIngredient(initialMedicine.activeIngredient);
      setBaseUnit(initialMedicine.baseUnit);
      setClassification(initialMedicine.classification);
      setMinStockBaseUnit(initialMedicine.minStockBaseUnit);
      setUomRows(
        initialMedicine.uomConversions.length > 0
          ? initialMedicine.uomConversions.map((u) => ({
              unitName: u.unitName,
              multiplierToBase: u.multiplierToBase,
              sellingPriceRegular: u.sellingPriceRegular,
              sellingPricePartner: u.sellingPricePartner,
              barcode: u.barcode ?? '',
            }))
          : [
              {
                unitName: initialMedicine.baseUnit,
                multiplierToBase: 1,
                sellingPriceRegular: 1000,
                sellingPricePartner: 900,
                barcode: '',
              },
            ],
      );
    } else {
      setSku('');
      setName('');
      setCategoryId(categories[0]?.id || '');
      setActiveIngredient('');
      setBaseUnit('Tablet');
      setClassification('BEBAS');
      setMinStockBaseUnit(50);
      setUomRows([
        {
          unitName: 'Tablet',
          multiplierToBase: 1,
          sellingPriceRegular: 1500,
          sellingPricePartner: 1300,
          barcode: '',
        },
        {
          unitName: 'Strip',
          multiplierToBase: 10,
          sellingPriceRegular: 14000,
          sellingPricePartner: 12500,
          barcode: '',
        },
      ]);
    }
  }, [isOpen, initialMedicine, categories]);

  if (!isOpen) return null;

  const handleAddUomRow = () => {
    setUomRows((prev) => [
      ...prev,
      {
        unitName: '',
        multiplierToBase: 1,
        sellingPriceRegular: 0,
        sellingPricePartner: 0,
        barcode: '',
      },
    ]);
  };

  const handleRemoveUomRow = (index: number) => {
    if (uomRows.length <= 1) {
      setFormError('Setiap obat wajib memiliki minimal satu satuan penjualan.');
      return;
    }
    setUomRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateUomRow = (
    index: number,
    field: keyof UomConversionInputDto,
    value: any,
  ) => {
    setUomRows((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)),
    );
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!sku.trim() || !name.trim() || !activeIngredient.trim() || !baseUnit.trim()) {
      setFormError('Semua field identitas obat wajib diisi sebelum menyimpan.');
      return;
    }

    if (!categoryId) {
      setFormError('Pilih kategori obat terlebih dahulu.');
      return;
    }

    const cleanedUoms = uomRows.map((row) => ({
      unitName: row.unitName.trim(),
      multiplierToBase: Math.max(1, Math.trunc(Number(row.multiplierToBase) || 1)),
      sellingPriceRegular: Math.max(0, Math.trunc(Number(row.sellingPriceRegular) || 0)),
      sellingPricePartner: Math.max(0, Math.trunc(Number(row.sellingPricePartner) || 0)),
      barcode: row.barcode && row.barcode.trim().length > 0 ? row.barcode.trim() : null,
    }));

    if (cleanedUoms.some((u) => !u.unitName)) {
      setFormError('Setiap baris satuan UOM wajib memiliki nama satuan.');
      return;
    }

    const hasBaseMultiplier = cleanedUoms.some((u) => u.multiplierToBase === 1);
    if (!hasBaseMultiplier) {
      setFormError(`Wajib ada minimal satu satuan dengan pengali = 1 untuk satuan dasar (${baseUnit}).`);
      return;
    }

    const payload: CreateMedicineRequestDto = {
      sku: sku.trim(),
      name: name.trim(),
      categoryId,
      activeIngredient: activeIngredient.trim(),
      baseUnit: baseUnit.trim(),
      classification,
      minStockBaseUnit: Math.max(0, Math.trunc(Number(minStockBaseUnit) || 0)),
      uomConversions: cleanedUoms,
    };

    try {
      await onSubmit(payload, initialMedicine?.id);
    } catch (err: any) {
      setFormError(err.message || 'Penyimpanan obat ditolak oleh server. Periksa keunikan SKU.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-2xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="medicine-form-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-[720px] flex-col overflow-hidden rounded-sheet border border-line bg-surface shadow-float">
        {/* Kepala Dialog */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h2 id="medicine-form-title" className="text-lg font-semibold text-ink">
              {isEditing ? `Ubah obat ${initialMedicine?.name}` : 'Tambah obat baru'}
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              Identitas zat aktif dan konversi satuan multi-UOM
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-control text-ink-soft hover:bg-hover hover:text-ink"
            aria-label="Tutup form obat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Isi Form: 3 Bagian Dipisah Garis Tipis (Tanpa Kartu di Dalam Kartu) */}
        <form onSubmit={handleSubmitForm} className="flex-1 space-y-6 overflow-y-auto px-6 py-5 text-xs text-ink">
          {formError && (
            <div
              role="alert"
              className="rounded-control border border-danger-ink/30 bg-danger-soft p-3 text-xs text-danger-ink"
            >
              {formError}
            </div>
          )}

          {/* Bagian 1: Identitas */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              1. Identitas obat
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="form-med-sku" className="block text-xs font-medium text-ink">
                  Kode SKU
                </label>
                <input
                  id="form-med-sku"
                  type="text"
                  required
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="Contoh: AMX-500-GEN"
                  className="mt-1 h-10 w-full rounded-control border border-line-input bg-surface px-3 text-xs font-mono text-ink placeholder:text-ink-muted focus:border-action focus:ring-2 focus:ring-mint focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="form-med-name" className="block text-xs font-medium text-ink">
                  Nama dagang obat
                </label>
                <input
                  id="form-med-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Amoxicillin Trihydrate 500 mg"
                  className="mt-1 h-10 w-full rounded-control border border-line-input bg-surface px-3 text-xs font-semibold text-ink placeholder:text-ink-muted focus:border-action focus:ring-2 focus:ring-mint focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="form-med-cat" className="block text-xs font-medium text-ink">
                  Kategori
                </label>
                <select
                  id="form-med-cat"
                  required
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="mt-1 h-10 w-full rounded-control border border-line-input bg-surface px-3 text-xs text-ink focus:border-action focus:ring-2 focus:ring-mint focus:outline-none"
                >
                  <option value="">Pilih kategori...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="form-med-active" className="block text-xs font-medium text-ink">
                  Zat aktif
                </label>
                <input
                  id="form-med-active"
                  type="text"
                  required
                  value={activeIngredient}
                  onChange={(e) => setActiveIngredient(e.target.value)}
                  placeholder="Contoh: Amoxicillin"
                  className="mt-1 h-10 w-full rounded-control border border-line-input bg-surface px-3 text-xs text-ink placeholder:text-ink-muted focus:border-action focus:ring-2 focus:ring-mint focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="form-med-class" className="block text-xs font-medium text-ink">
                  Golongan obat
                </label>
                <select
                  id="form-med-class"
                  value={classification}
                  onChange={(e) => setClassification(e.target.value as DrugClassification)}
                  className="mt-1 h-10 w-full rounded-control border border-line-input bg-surface px-3 text-xs text-ink focus:border-action focus:ring-2 focus:ring-mint focus:outline-none"
                >
                  {DRUG_CLASS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="form-med-base" className="block text-xs font-medium text-ink">
                  Satuan terkecil (dasar)
                </label>
                <input
                  id="form-med-base"
                  type="text"
                  required
                  value={baseUnit}
                  onChange={(e) => setBaseUnit(e.target.value)}
                  placeholder="Contoh: Tablet, Kapsul, Botol"
                  className="mt-1 h-10 w-full rounded-control border border-line-input bg-surface px-3 text-xs text-ink placeholder:text-ink-muted focus:border-action focus:ring-2 focus:ring-mint focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="form-med-min" className="block text-xs font-medium text-ink">
                  Batas stok minimum (ROP)
                </label>
                <input
                  id="form-med-min"
                  type="number"
                  min={0}
                  required
                  value={minStockBaseUnit}
                  onChange={(e) => setMinStockBaseUnit(Number(e.target.value))}
                  className="mt-1 h-10 w-full rounded-control border border-line-input bg-surface px-3 text-xs font-mono text-ink text-right placeholder:text-ink-muted focus:border-action focus:ring-2 focus:ring-mint focus:outline-none"
                />
              </div>
            </div>
          </div>

          <hr className="border-t border-line" />

          {/* Bagian 2: Satuan dan Harga Multi-UOM */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  2. Satuan dan harga jual
                </h3>
                <p className="text-[11px] text-ink-muted">
                  Konversi satuan dasar ke kemasan Strip, Box, atau Botol beserta harga Reguler dan Mitra
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddUomRow}
                className="flex h-8 items-center gap-1 rounded-control bg-mint px-2.5 text-xs font-semibold text-ink hover:bg-mint/80"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Tambah kemasan</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-control border border-line">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-line bg-sunken text-ink-muted text-[11px]">
                  <tr>
                    <th className="px-3 py-2">Nama kemasan</th>
                    <th className="px-3 py-2 text-right">Pengali ke dasar</th>
                    <th className="px-3 py-2 text-right">Harga reguler</th>
                    <th className="px-3 py-2 text-right">Harga mitra</th>
                    <th className="px-2 py-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line bg-surface">
                  {uomRows.map((uom, idx) => (
                    <tr key={idx} className="hover:bg-hover">
                      <td className="p-2">
                        <input
                          type="text"
                          required
                          value={uom.unitName}
                          onChange={(e) => handleUpdateUomRow(idx, 'unitName', e.target.value)}
                          placeholder="Misal: Strip"
                          className="h-8 w-full rounded-control border border-line-input bg-surface px-2 text-xs text-ink focus:border-action focus:outline-none"
                        />
                      </td>

                      <td className="p-2">
                        <input
                          type="number"
                          min={1}
                          required
                          value={uom.multiplierToBase}
                          onChange={(e) =>
                            handleUpdateUomRow(idx, 'multiplierToBase', Number(e.target.value))
                          }
                          className="h-8 w-20 rounded-control border border-line-input bg-surface px-2 text-right font-mono text-xs text-ink focus:border-action focus:outline-none"
                        />
                      </td>

                      <td className="p-2">
                        <input
                          type="number"
                          min={0}
                          required
                          value={uom.sellingPriceRegular}
                          onChange={(e) =>
                            handleUpdateUomRow(idx, 'sellingPriceRegular', Number(e.target.value))
                          }
                          className="h-8 w-28 rounded-control border border-line-input bg-surface px-2 text-right font-mono text-xs text-ink focus:border-action focus:outline-none"
                        />
                      </td>

                      <td className="p-2">
                        <input
                          type="number"
                          min={0}
                          required
                          value={uom.sellingPricePartner}
                          onChange={(e) =>
                            handleUpdateUomRow(idx, 'sellingPricePartner', Number(e.target.value))
                          }
                          className="h-8 w-28 rounded-control border border-line-input bg-surface px-2 text-right font-mono text-xs text-ink focus:border-action focus:outline-none"
                        />
                      </td>

                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveUomRow(idx)}
                          className="flex h-7 w-7 items-center justify-center rounded-control text-ink-muted hover:bg-danger-soft hover:text-danger-ink"
                          title="Hapus kemasan"
                          aria-label="Hapus kemasan"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <hr className="border-t border-line" />

          {/* Bagian 3: Keterangan Berkas Gambar */}
          <div className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              3. Foto kemasan obat
            </h3>
            <p className="text-[11px] text-ink-muted">
              Foto kemasan obat dapat diunggah melalui laci inspeksi setelah data obat disimpan (format JPEG, PNG, WEBP maks 5 MB).
            </p>
          </div>

          {/* Tombol Aksi */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 items-center justify-center rounded-control border border-line-input bg-surface px-4 text-xs font-semibold text-ink hover:bg-hover active:bg-selected"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-10 items-center justify-center rounded-control bg-action px-5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-action-hover active:bg-action-press disabled:opacity-50"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan obat'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MedicineFormModal;
