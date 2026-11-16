import { useEffect, useState } from 'react';
import type {
  AuthUserDto,
  BatchStockItemDto,
  DefektaItemDto,
  FefoItemPreviewDto,
  MedicineSummaryDto,
  ParetoItemAnalyticsDto,
  StockCardEntryDto,
  SupplierDto,
} from '@shared/api-contracts';

export const WORST_CASE_STORAGE_KEY = 'rhs_worst_case';
const WORST_CASE_EVENT = 'rhs:worst-case-change';

/**
 * Mengecek apakah mode uji ekstrem (?data=worst / break-ui) sedang aktif.
 * Membaca parameter URL ?data=worst terlebih dahulu, lalu fallback ke localStorage.
 */
export function isWorstCaseMode(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const params = new URLSearchParams(window.location.search);
  const queryVal = params.get('data');
  if (queryVal === 'worst') {
    return true;
  }
  if (queryVal === 'normal') {
    return false;
  }
  return window.localStorage.getItem(WORST_CASE_STORAGE_KEY) === '1';
}

/**
 * Mengaktifkan atau menonaktifkan mode uji ekstrem (?data=worst) secara instan (0ms),
 * menyinkronkan URL query param dan localStorage, serta memancarkan event pembaruan UI.
 */
export function setWorstCaseMode(enabled: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (enabled) {
    window.localStorage.setItem(WORST_CASE_STORAGE_KEY, '1');
  } else {
    window.localStorage.removeItem(WORST_CASE_STORAGE_KEY);
  }

  const url = new URL(window.location.href);
  if (enabled) {
    url.searchParams.set('data', 'worst');
  } else {
    url.searchParams.delete('data');
  }
  window.history.replaceState({}, '', url.toString());
  window.dispatchEvent(new CustomEvent(WORST_CASE_EVENT, { detail: { enabled } }));
}

export function toggleWorstCaseMode(): boolean {
  const next = !isWorstCaseMode();
  setWorstCaseMode(next);
  return next;
}

/**
 * Hook reaktif untuk membaca dan mengubah status mode ?data=worst di seluruh komponen.
 */
export function useWorstCaseMode(): [boolean, (enabled: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(() => isWorstCaseMode());

  useEffect(() => {
    const syncState = () => {
      setEnabled(isWorstCaseMode());
    };
    window.addEventListener(WORST_CASE_EVENT, syncState);
    window.addEventListener('popstate', syncState);
    return () => {
      window.removeEventListener(WORST_CASE_EVENT, syncState);
      window.removeEventListener('popstate', syncState);
    };
  }, []);

  return [enabled, setWorstCaseMode];
}

/**
 * Konstanta nilai uji ekstrem realistis sesuai standar break-ui (bukan string acak "aaaa").
 */
export const WORST_CASE_VALUES = {
  longMedicineName135:
    'Amoxicillin Trihydrate 500 mg + Potassium Clavulanate 125 mg Film-Coated Kaplet Salut Selaput Generik Berlogo Khusus Fasilitas Kesehatan',
  longActiveIngredient:
    'Amoxicillin Trihydrate Eq. 500 mg + Diluted Potassium Clavulanate Eq. Clavulanic Acid 125 mg + Sodium Starch Glycolate USP',
  shortMedicineName: 'Zn',
  extremePriceRegular: 89_450_000,
  extremePricePartner: 84_900_000,
  extremeStockBaseUnit: 245_000,
  zeroStockBaseUnit: 0,
  singleStockBaseUnit: 1,
  longBatchNumber: 'BATCH-IMP-2026-KLINIS-9988776655-EXTREME-FEFO',
  longSku: 'SKU-ONKO-IMUNO-2026-9988776655-SUB',
  longSupplierName:
    'PT Antar Mitra Sembada Distribusi Farmasi & Alat Kesehatan Nasional Cabang Utama Surabaya Timur',
  longUnbreakableEmail:
    'pengadaan.nasional.cabang.surabaya.timur@pt-antar-mitra-sembada-distribusi-farmasi-indonesia.co.id',
  expiredSipaNumber: '19910421/SIPA_35.78/DINKES-KOTA-SURABAYA/2021/4099-EXPIRED',
  expiredSipaDate: '2024-01-01',
} as const;

/**
 * Transformasi daftar obat (Medicines) dengan menyuntikkan kasus tepi ekstrem pada baris teratas:
 * - Baris 1: Nama 135 karakter, zat aktif panjang, harga Rp 89.450.000, stok 245.000 Tablet
 * - Baris 2: Stok 0 (habis total) dengan tanggal ED sudah lewat
 * - Baris 3: Nama 2 huruf ("Zn") dan stok tepat 1 Tablet (uji pluralisasi/alignment)
 */
export function applyWorstCaseMedicines(items: MedicineSummaryDto[]): MedicineSummaryDto[] {
  if (!isWorstCaseMode()) {
    return items;
  }

  const baseList = items.length > 0 ? items.map((item) => ({ ...item })) : [];

  const syntheticExtremeRow: MedicineSummaryDto = {
    id: baseList[0]?.id ?? 'worst-med-01',
    sku: WORST_CASE_VALUES.longSku,
    name: WORST_CASE_VALUES.longMedicineName135,
    categoryId: baseList[0]?.categoryId ?? 'cat-worst-01',
    categoryName: 'Onkologi & Antibiotik Kombinasi Lini Ketiga Rumah Sakit Rujukan',
    activeIngredient: WORST_CASE_VALUES.longActiveIngredient,
    baseUnit: 'Tablet',
    classification: 'KERAS',
    paretoClass: 'A',
    minStockBaseUnit: 15_000,
    totalActiveStockBaseUnit: WORST_CASE_VALUES.extremeStockBaseUnit,
    earliestExpiryDate: '2026-11-30',
    imagePath: null,
    isActive: true,
    uomConversions: [
      {
        id: 'worst-uom-1',
        medicineId: baseList[0]?.id ?? 'worst-med-01',
        unitName: 'Box Rumah Sakit (1000 Tab)',
        multiplierToBase: 1000,
        sellingPriceRegular: WORST_CASE_VALUES.extremePriceRegular,
        sellingPricePartner: WORST_CASE_VALUES.extremePricePartner,
        barcode: '899990011223344556677',
      },
      {
        id: 'worst-uom-2',
        medicineId: baseList[0]?.id ?? 'worst-med-01',
        unitName: 'Strip',
        multiplierToBase: 10,
        sellingPriceRegular: 925_000,
        sellingPricePartner: 880_000,
        barcode: '899990011223344556678',
      },
      {
        id: 'worst-uom-3',
        medicineId: baseList[0]?.id ?? 'worst-med-01',
        unitName: 'Tablet',
        multiplierToBase: 1,
        sellingPriceRegular: 95_000,
        sellingPricePartner: 90_000,
        barcode: null,
      },
    ],
  };

  const zeroStockRow: MedicineSummaryDto = {
    id: baseList[1]?.id ?? 'worst-med-02',
    sku: 'SKU-ZERO-STOCK-002',
    name:
      baseList[1]?.name ??
      'Cefixime Trihydrate 200 mg Kapsul Generik (Stok Kosong & Batch Kedaluwarsa)',
    categoryId: baseList[1]?.categoryId ?? 'cat-worst-01',
    categoryName: baseList[1]?.categoryName ?? 'Antibiotik Oral',
    activeIngredient:
      baseList[1]?.activeIngredient ?? 'Cefixime Trihydrate Equivalent to Cefixime 200 mg',
    baseUnit: 'Kapsul',
    classification: 'KERAS',
    paretoClass: 'B',
    minStockBaseUnit: 500,
    totalActiveStockBaseUnit: WORST_CASE_VALUES.zeroStockBaseUnit,
    earliestExpiryDate: '2024-02-15',
    imagePath: null,
    isActive: true,
    uomConversions: baseList[1]?.uomConversions?.length
      ? baseList[1].uomConversions
      : [
          {
            id: 'worst-uom-zero',
            medicineId: 'worst-med-02',
            unitName: 'Kapsul',
            multiplierToBase: 1,
            sellingPriceRegular: 4_500,
            sellingPricePartner: 4_000,
            barcode: null,
          },
        ],
  };

  const shortNameRow: MedicineSummaryDto = {
    id: baseList[2]?.id ?? 'worst-med-03',
    sku: 'ZN-1',
    name: WORST_CASE_VALUES.shortMedicineName,
    categoryId: baseList[2]?.categoryId ?? 'cat-worst-02',
    categoryName: 'Suplemen',
    activeIngredient: 'Zinc Sulfate Monohydrate 20 mg',
    baseUnit: 'Tablet',
    classification: 'BEBAS_TERBATAS',
    paretoClass: 'C',
    minStockBaseUnit: 1,
    totalActiveStockBaseUnit: WORST_CASE_VALUES.singleStockBaseUnit,
    earliestExpiryDate: '2027-08-01',
    imagePath: null,
    isActive: true,
    uomConversions: baseList[2]?.uomConversions?.length
      ? baseList[2].uomConversions
      : [
          {
            id: 'worst-uom-short',
            medicineId: 'worst-med-03',
            unitName: 'Tablet',
            multiplierToBase: 1,
            sellingPriceRegular: 1_500,
            sellingPricePartner: 1_200,
            barcode: null,
          },
        ],
  };

  if (baseList.length === 0) {
    return [syntheticExtremeRow, zeroStockRow, shortNameRow];
  }

  const result = [...baseList];
  result[0] = {
    ...result[0],
    name: WORST_CASE_VALUES.longMedicineName135,
    activeIngredient: WORST_CASE_VALUES.longActiveIngredient,
    sku: WORST_CASE_VALUES.longSku,
    totalActiveStockBaseUnit: WORST_CASE_VALUES.extremeStockBaseUnit,
    minStockBaseUnit: 15_000,
    uomConversions: result[0].uomConversions.map((u, idx) =>
      idx === 0
        ? {
            ...u,
            sellingPriceRegular: WORST_CASE_VALUES.extremePriceRegular,
            sellingPricePartner: WORST_CASE_VALUES.extremePricePartner,
          }
        : u,
    ),
  };

  if (result.length > 1) {
    result[1] = {
      ...result[1],
      totalActiveStockBaseUnit: 0,
      earliestExpiryDate: '2024-01-10',
    };
  } else {
    result.push(zeroStockRow);
  }

  if (result.length > 2) {
    result[2] = {
      ...result[2],
      name: WORST_CASE_VALUES.shortMedicineName,
      totalActiveStockBaseUnit: 1,
    };
  } else {
    result.push(shortNameRow);
  }

  return result;
}

/**
 * Transformasi daftar Batch stok dengan nomor batch sangat panjang, kuantitas 245.000,
 * stok 0, serta status EXPIRED dan NEAR_EXPIRY.
 */
export function applyWorstCaseBatches(items: BatchStockItemDto[]): BatchStockItemDto[] {
  if (!isWorstCaseMode()) {
    return items;
  }

  const syntheticBatches: BatchStockItemDto[] = [
    {
      id: items[0]?.id ?? 'worst-batch-01',
      medicineId: items[0]?.medicineId ?? 'worst-med-01',
      medicineName: WORST_CASE_VALUES.longMedicineName135,
      medicineSku: WORST_CASE_VALUES.longSku,
      baseUnit: 'Tablet',
      supplierId: items[0]?.supplierId ?? 'worst-sup-01',
      supplierName: WORST_CASE_VALUES.longSupplierName,
      batchNumber: WORST_CASE_VALUES.longBatchNumber,
      expiryDate: '2026-12-15',
      daysUntilExpiry: 40,
      expiryStatus: 'NEAR_EXPIRY',
      initialStock: 250_000,
      currentStock: WORST_CASE_VALUES.extremeStockBaseUnit,
      costPricePerBaseUnit: '89450.7525',
    },
    {
      id: items[1]?.id ?? 'worst-batch-02',
      medicineId: items[1]?.medicineId ?? 'worst-med-02',
      medicineName:
        items[1]?.medicineName ??
        'Meropenem Trihydrate 1000 mg Serbuk Injeksi Intravena Steril Vial Tunggal',
      medicineSku: items[1]?.medicineSku ?? 'SKU-MERO-1000-EXP',
      baseUnit: 'Vial',
      supplierId: items[1]?.supplierId ?? 'worst-sup-01',
      supplierName: WORST_CASE_VALUES.longSupplierName,
      batchNumber: 'BATCH-EXPIRED-2023-DO-NOT-DISPENSE-991',
      expiryDate: '2023-09-30',
      daysUntilExpiry: -401,
      expiryStatus: 'EXPIRED',
      initialStock: 500,
      currentStock: 0,
      costPricePerBaseUnit: '145000.0000',
    },
  ];

  if (items.length === 0) {
    return syntheticBatches;
  }

  const result = items.map((item) => ({ ...item }));
  result[0] = {
    ...result[0],
    medicineName: WORST_CASE_VALUES.longMedicineName135,
    medicineSku: WORST_CASE_VALUES.longSku,
    supplierName: WORST_CASE_VALUES.longSupplierName,
    batchNumber: WORST_CASE_VALUES.longBatchNumber,
    currentStock: WORST_CASE_VALUES.extremeStockBaseUnit,
    initialStock: 250_000,
    costPricePerBaseUnit: '89450.7525',
    expiryStatus: 'NEAR_EXPIRY',
    daysUntilExpiry: 35,
  };

  if (result.length > 1) {
    result[1] = {
      ...result[1],
      batchNumber: 'BATCH-EXPIRED-2023-DO-NOT-DISPENSE-991',
      currentStock: 0,
      expiryStatus: 'EXPIRED',
      daysUntilExpiry: -380,
      expiryDate: '2023-10-15',
    };
  } else {
    result.push(syntheticBatches[1]);
  }

  return result;
}

/**
 * Transformasi buku audit Kartu Stok dengan catatan mutasi dan nama obat panjang.
 */
export function applyWorstCaseStockCards(items: StockCardEntryDto[]): StockCardEntryDto[] {
  if (!isWorstCaseMode()) {
    return items;
  }

  const syntheticEntries: StockCardEntryDto[] = [
    {
      id: items[0]?.id ?? 'worst-sc-01',
      medicineId: items[0]?.medicineId ?? 'worst-med-01',
      medicineName: WORST_CASE_VALUES.longMedicineName135,
      baseUnit: 'Tablet',
      batchId: items[0]?.batchId ?? 'worst-batch-01',
      batchNumber: WORST_CASE_VALUES.longBatchNumber,
      actorUserId: 'worst-user-01',
      actorFullName: 'apt. Aleksandra Wiśniewska-Kowalczyk, S.Farm., M.Farm.Klin.',
      movementType: 'IN_INVOICE',
      referenceId: 'INV/PBF-AMS/SBY-TIMUR/2026/XI/998877665544',
      qtyChange: 245_000,
      balanceAfter: 245_000,
      notes:
        'Penerimaan faktur konsinyasi rumah sakit rujukan regional dengan pemeriksaan suhu rantai dingin (2-8°C) terverifikasi utuh.',
      createdAt: new Date().toISOString(),
    },
    {
      id: items[1]?.id ?? 'worst-sc-02',
      medicineId: items[1]?.medicineId ?? 'worst-med-02',
      medicineName: 'Zn',
      baseUnit: 'Tablet',
      batchId: items[1]?.batchId ?? 'worst-batch-02',
      batchNumber: 'B-01',
      actorUserId: 'worst-user-02',
      actorFullName: 'Jo',
      movementType: 'OUT_SALE',
      referenceId: 'POS-20261105-0001',
      qtyChange: -1,
      balanceAfter: 0,
      notes: null,
      createdAt: new Date().toISOString(),
    },
  ];

  if (items.length === 0) {
    return syntheticEntries;
  }

  const result = items.map((item) => ({ ...item }));
  result[0] = {
    ...result[0],
    medicineName: WORST_CASE_VALUES.longMedicineName135,
    batchNumber: WORST_CASE_VALUES.longBatchNumber,
    actorFullName: 'apt. Aleksandra Wiśniewska-Kowalczyk, S.Farm., M.Farm.Klin.',
    referenceId: 'INV/PBF-AMS/SBY-TIMUR/2026/XI/998877665544',
    qtyChange: 245_000,
    balanceAfter: 245_000,
  };
  return result;
}

/**
 * Transformasi daftar Pemasok PBF dengan email panjang tanpa spasi dan alamat lengkap.
 */
export function applyWorstCaseSuppliers(items: SupplierDto[]): SupplierDto[] {
  if (!isWorstCaseMode()) {
    return items;
  }

  if (items.length === 0) {
    return [
      {
        id: 'worst-sup-01',
        code: 'PBF-AMS-SBY-TIMUR-99',
        name: WORST_CASE_VALUES.longSupplierName,
        email: WORST_CASE_VALUES.longUnbreakableEmail,
        phone: '+62-31-8998877-EXT-4455',
        izinPbfNo: 'HK.02.06/MENKES/PBF-NASIONAL/V/2024/99887766',
        address:
          'Kawasan Industri Rungkut SIER Jalan Berbek Industri Raya Kavling 14-18 Gedung Logistik B Lantai 3, Surabaya, Jawa Timur 60293',
        isActive: true,
      },
    ];
  }

  const result = items.map((item) => ({ ...item }));
  result[0] = {
    ...result[0],
    name: WORST_CASE_VALUES.longSupplierName,
    email: WORST_CASE_VALUES.longUnbreakableEmail,
    izinPbfNo: 'HK.02.06/MENKES/PBF-NASIONAL/V/2024/99887766',
  };
  return result;
}

/**
 * Worst-case Pareto ABC data transformation for layout stress testing.
 */
export function applyWorstCasePareto(items: ParetoItemAnalyticsDto[]): ParetoItemAnalyticsDto[] {
  if (!isWorstCaseMode()) {
    return items;
  }
  if (items.length === 0) {
    return [
      {
        rank: 1,
        medicineId: 'worst-med-01',
        sku: WORST_CASE_VALUES.longSku,
        name: WORST_CASE_VALUES.longMedicineName135,
        activeIngredient: WORST_CASE_VALUES.longActiveIngredient,
        baseUnit: 'Tablet',
        totalQtySoldBase: 245_000,
        totalRevenue: WORST_CASE_VALUES.extremePriceRegular,
        revenueShareRatio: 0.854,
        cumulativeShareBefore: 0,
        cumulativeShareAfter: 0.854,
        paretoClass: 'A',
      },
    ];
  }
  const result = items.map((item) => ({ ...item }));
  result[0] = {
    ...result[0],
    name: WORST_CASE_VALUES.longMedicineName135,
    activeIngredient: WORST_CASE_VALUES.longActiveIngredient,
    sku: WORST_CASE_VALUES.longSku,
    totalQtySoldBase: 245_000,
    totalRevenue: WORST_CASE_VALUES.extremePriceRegular,
  };
  return result;
}

/**
 * Worst-case Defekta data transformation for layout stress testing.
 */
export function applyWorstCaseDefekta(items: DefektaItemDto[]): DefektaItemDto[] {
  if (!isWorstCaseMode()) {
    return items;
  }
  if (items.length === 0) {
    return [
      {
        medicineId: 'worst-med-01',
        sku: WORST_CASE_VALUES.longSku,
        name: WORST_CASE_VALUES.longMedicineName135,
        activeIngredient: WORST_CASE_VALUES.longActiveIngredient,
        baseUnit: 'Tablet',
        paretoClass: 'A',
        currentActiveStock: 0,
        minStockBaseUnit: 15_000,
        soldLast30DaysBase: 245_000,
        avgDailyConsumption: 8166.67,
        reorderPointRop: 57_167,
        recommendedOrderQty: 114_334,
        recommendedSupplier: {
          supplierId: 'worst-sup-01',
          supplierName: WORST_CASE_VALUES.longSupplierName,
          supplierEmail: WORST_CASE_VALUES.longUnbreakableEmail,
          lowestCostPerBaseUnit: '89450.7525',
          lastInvoiceDate: '2026-10-28',
        },
      },
    ];
  }
  const result = items.map((item) => ({ ...item }));
  result[0] = {
    ...result[0],
    name: WORST_CASE_VALUES.longMedicineName135,
    activeIngredient: WORST_CASE_VALUES.longActiveIngredient,
    sku: WORST_CASE_VALUES.longSku,
    currentActiveStock: 0,
    recommendedOrderQty: 245_000,
    recommendedSupplier: {
      supplierId: result[0].recommendedSupplier?.supplierId ?? 'worst-sup-01',
      supplierName: WORST_CASE_VALUES.longSupplierName,
      supplierEmail: WORST_CASE_VALUES.longUnbreakableEmail,
      lowestCostPerBaseUnit: '89450.7525',
      lastInvoiceDate: '2026-10-28',
    },
  };
  return result;
}

/**
 * Transformasi data Pengguna & SIPA untuk menguji tampilan SIPA kedaluwarsa dan email panjang.
 */
export function applyWorstCaseUsers(items: AuthUserDto[]): AuthUserDto[] {
  if (!isWorstCaseMode()) {
    return items;
  }
  if (items.length === 0) {
    return [
      {
        id: 'worst-user-01',
        email: WORST_CASE_VALUES.longUnbreakableEmail,
        fullName: 'apt. Aleksandra Wiśniewska-Kowalczyk, S.Farm., M.Farm.Klin.',
        role: 'PHARMACIST',
        noSipa: WORST_CASE_VALUES.expiredSipaNumber,
        sipaExpiryDate: WORST_CASE_VALUES.expiredSipaDate,
        isSipaActive: false,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
    ];
  }
  const result = items.map((item) => ({ ...item }));
  result[0] = {
    ...result[0],
    email: WORST_CASE_VALUES.longUnbreakableEmail,
    fullName: 'apt. Aleksandra Wiśniewska-Kowalczyk, S.Farm., M.Farm.Klin.',
    noSipa: WORST_CASE_VALUES.expiredSipaNumber,
    sipaExpiryDate: WORST_CASE_VALUES.expiredSipaDate,
    isSipaActive: false,
  };
  return result;
}

/**
 * Worst-case FEFO batch allocation preview data transformation for layout stress testing.
 */
export function applyWorstCaseFefoPreviews(items: FefoItemPreviewDto[]): FefoItemPreviewDto[] {
  if (!isWorstCaseMode()) {
    return items;
  }
  return items.map((item, idx) =>
    idx === 0
      ? {
          ...item,
          medicineName: WORST_CASE_VALUES.longMedicineName135,
          activeIngredient: WORST_CASE_VALUES.longActiveIngredient,
          unitSellingPrice: WORST_CASE_VALUES.extremePriceRegular,
          subtotal: WORST_CASE_VALUES.extremePriceRegular * item.qtyInUom,
        }
      : item,
  );
}
