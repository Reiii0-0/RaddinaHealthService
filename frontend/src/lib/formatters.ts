import type {
  BatchExpiryStatus,
  DrugClassification,
  ParetoClass,
  PaymentMethod,
  PaymentStatus,
  PricingTier,
  PurchaseOrderStatus,
  StockMovementType,
  UserRole,
} from '@shared/api-contracts';

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

const rupiahDecimalFormatter = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

const numberIdFormatter = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 2,
});

/**
 * Memformat angka nominal ke format Rupiah standar Indonesia (contoh: Rp 12.500).
 */
export function formatRupiah(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') {
    return 'Rp 0';
  }
  const numericValue = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(numericValue)) {
    return 'Rp 0';
  }
  const sign = numericValue < 0 ? '-' : '';
  return `${sign}Rp ${rupiahFormatter.format(Math.round(Math.abs(numericValue)))}`;
}

/**
 * Memformat HPP satuan dasar presisi numeric(14,4) ke Rupiah desimal (contoh: Rp 423,50).
 */
export function formatRupiahCost(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') {
    return 'Rp 0';
  }
  const numericValue = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(numericValue)) {
    return 'Rp 0';
  }
  const hasFraction = Math.abs(numericValue % 1) > 0.0001;
  if (!hasFraction) {
    return formatRupiah(numericValue);
  }
  return `Rp ${rupiahDecimalFormatter.format(numericValue)}`;
}

/**
 * Memformat bilangan kuantitas atau stok dengan pemisah ribuan titik Indonesia (contoh: 245.000).
 */
export function formatNumberId(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '0';
  }
  const numericValue = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numericValue)) {
    return '0';
  }
  return numberIdFormatter.format(numericValue);
}

/**
 * Memformat persentase desimal (0..1) menjadi string persen (contoh: 84,5%).
 */
export function formatPercentId(ratio: number | null | undefined, fractionDigits = 1): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) {
    return '0%';
  }
  return `${(ratio * 100).toLocaleString('id-ID', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}%`;
}

export interface FormatDateOptions {
  includeTime?: boolean;
  shortMonth?: boolean;
}

/**
 * Memformat string tanggal ISO atau objek Date ke format tanggal Indonesia.
 */
export function formatDateId(
  dateInput: string | Date | null | undefined,
  options: FormatDateOptions = {},
): string {
  if (!dateInput) {
    return 'Belum diatur';
  }
  const parsed = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(parsed.getTime())) {
    return String(dateInput);
  }

  const { includeTime = false, shortMonth = true } = options;
  const datePart = parsed.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: shortMonth ? 'short' : 'long',
    year: 'numeric',
  });

  if (!includeTime) {
    return datePart;
  }

  const timePart = parsed.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return `${datePart}, ${timePart}`;
}

/**
 * Menghitung selisih hari dari hari ini menuju tanggal kedaluwarsa.
 */
export function computeDaysUntilExpiry(expiryDate: string | null | undefined): number | null {
  if (!expiryDate) {
    return null;
  }
  const target = new Date(expiryDate);
  if (Number.isNaN(target.getTime())) {
    return null;
  }
  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const targetUtc = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.ceil((targetUtc - todayUtc) / (1000 * 60 * 60 * 24));
}

/**
 * Memformat hitung mundur hari menuju tanggal kedaluwarsa (ED).
 */
export function formatDaysUntilExpiry(
  days: number | null | undefined,
  expiryDate?: string | null,
): string {
  const resolvedDays =
    days !== null && days !== undefined && Number.isFinite(days)
      ? Math.trunc(days)
      : computeDaysUntilExpiry(expiryDate);

  if (resolvedDays === null) {
    return 'Tanpa data ED';
  }
  if (resolvedDays < 0) {
    return `Kedaluwarsa ${Math.abs(resolvedDays)} hari lalu`;
  }
  if (resolvedDays === 0) {
    return 'Kedaluwarsa hari ini';
  }
  return `${formatNumberId(resolvedDays)} hari lagi`;
}

/**
 * Pita Kesegaran (DESIGN.md v2.0 Bagian 2.3)
 */
export type FreshnessBand = 'long' | 'good' | 'mid' | 'near' | 'urgent' | 'expired';

export function freshnessBand(daysLeft: number): FreshnessBand {
  if (daysLeft <= 0) return 'expired';
  if (daysLeft < 30) return 'urgent';
  if (daysLeft < 90) return 'near';
  if (daysLeft < 180) return 'mid';
  if (daysLeft < 365) return 'good';
  return 'long';
}

export interface FreshnessMeta {
  band: FreshnessBand;
  label: string;
  fillClass: string;
  textClass: string;
  borderClass: string;
  fillHex: string;
  iconType: 'none' | 'clock' | 'alert' | 'x-circle';
}

export function getFreshnessMeta(daysLeft: number): FreshnessMeta {
  const band = freshnessBand(daysLeft);
  switch (band) {
    case 'long':
      return {
        band: 'long',
        label: `Panjang (${daysLeft} hr)`,
        fillClass: 'bg-mint',
        textClass: 'text-ink',
        borderClass: 'border-line-input',
        fillHex: '#B6D8C0',
        iconType: 'none',
      };
    case 'good':
      return {
        band: 'good',
        label: `Baik (${daysLeft} hr)`,
        fillClass: 'bg-sage',
        textClass: 'text-ink',
        borderClass: 'border-line-input',
        fillHex: '#C8D9BF',
        iconType: 'none',
      };
    case 'mid':
      return {
        band: 'mid',
        label: `Sedang (${daysLeft} hr)`,
        fillClass: 'bg-sand',
        textClass: 'text-ink',
        borderClass: 'border-line-input',
        fillHex: '#DADABD',
        iconType: 'none',
      };
    case 'near':
      return {
        band: 'near',
        label: `Mendekati ED (${daysLeft} hr)`,
        fillClass: 'bg-cream',
        textClass: 'text-warn-ink',
        borderClass: 'border-line-input',
        fillHex: '#ECDBBC',
        iconType: 'clock',
      };
    case 'urgent':
      return {
        band: 'urgent',
        label: `Segera habiskan (${daysLeft} hr)`,
        fillClass: 'bg-peach',
        textClass: 'text-warn-ink font-semibold',
        borderClass: 'border-warn-line',
        fillHex: '#FEDCBA',
        iconType: 'alert',
      };
    case 'expired':
    default:
      return {
        band: 'expired',
        label: 'Kedaluwarsa',
        fillClass: 'bg-danger',
        textClass: 'text-white font-semibold',
        borderClass: 'border-danger',
        fillHex: '#B42318',
        iconType: 'x-circle',
      };
  }
}

export interface BadgeVisualMeta {
  label: string;
  bgHex: string;
  textHex: string;
  borderHex: string;
  dotHex: string;
  className: string;
}

/**
 * Penentu warna semantik untuk status Batch FEFO berbasis Pita Kesegaran.
 */
export function getBatchStatusMeta(
  status: BatchExpiryStatus,
  daysUntilExpiry?: number,
): BadgeVisualMeta {
  if (status === 'EXPIRED' || (daysUntilExpiry !== undefined && daysUntilExpiry <= 0)) {
    return {
      label: 'Kedaluwarsa (tidak dijual)',
      bgHex: '#B42318',
      textHex: '#FFFFFF',
      borderHex: '#B42318',
      dotHex: '#FFFFFF',
      className: 'bg-danger text-white border-danger',
    };
  }

  if (daysUntilExpiry !== undefined) {
    const meta = getFreshnessMeta(daysUntilExpiry);
    return {
      label: meta.label,
      bgHex: meta.fillHex,
      textHex: meta.band === 'near' || meta.band === 'urgent' ? '#7A3E0C' : '#16281F',
      borderHex: meta.band === 'urgent' ? '#C2610F' : '#7D9788',
      dotHex: meta.band === 'urgent' ? '#C2610F' : '#2F6B4C',
      className: `${meta.fillClass} ${meta.textClass} border ${meta.borderClass}`,
    };
  }

  switch (status) {
    case 'ACTIVE':
      return {
        label: 'Stok layak jual',
        bgHex: '#B6D8C0',
        textHex: '#16281F',
        borderHex: '#7D9788',
        dotHex: '#2F6B4C',
        className: 'bg-mint text-ink border-line-input',
      };
    case 'NEAR_EXPIRY':
      return {
        label: 'Mendekati ED (< 90 hr)',
        bgHex: '#ECDBBC',
        textHex: '#7A3E0C',
        borderHex: '#7D9788',
        dotHex: '#C2610F',
        className: 'bg-cream text-warn-ink border-line-input',
      };
    default:
      return {
        label: 'Kedaluwarsa (tidak dijual)',
        bgHex: '#B42318',
        textHex: '#FFFFFF',
        borderHex: '#B42318',
        dotHex: '#FFFFFF',
        className: 'bg-danger text-white border-danger',
      };
  }
}

/**
 * Penentu warna semantik untuk Kelas Pareto ABC (DESIGN.md v2.0).
 * Kelas A: action (#2F6B4C), Kelas B: mint (#B6D8C0), Kelas C: line (#DCE6DE)
 */
export function getParetoClassMeta(paretoClass: ParetoClass): BadgeVisualMeta {
  switch (paretoClass) {
    case 'A':
      return {
        label: 'Kelas A (80% omzet)',
        bgHex: '#2F6B4C',
        textHex: '#FFFFFF',
        borderHex: '#2F6B4C',
        dotHex: '#B6D8C0',
        className: 'bg-action text-white border-action',
      };
    case 'B':
      return {
        label: 'Kelas B (15% omzet)',
        bgHex: '#B6D8C0',
        textHex: '#16281F',
        borderHex: '#7D9788',
        dotHex: '#2F6B4C',
        className: 'bg-mint text-ink border-line-input',
      };
    case 'C':
    default:
      return {
        label: 'Kelas C (5% omzet)',
        bgHex: '#DCE6DE',
        textHex: '#16281F',
        borderHex: '#7D9788',
        dotHex: '#5A7164',
        className: 'bg-line text-ink border-line-input',
      };
  }
}

/**
 * Penentu warna semantik untuk Golongan Obat BPOM.
 */
export function getDrugClassMeta(classification: DrugClassification): BadgeVisualMeta {
  switch (classification) {
    case 'BEBAS':
      return {
        label: 'Obat bebas',
        bgHex: '#B6D8C0',
        textHex: '#16281F',
        borderHex: '#7D9788',
        dotHex: '#2F6B4C',
        className: 'bg-mint text-ink border-line-input',
      };
    case 'BEBAS_TERBATAS':
      return {
        label: 'Bebas terbatas',
        bgHex: '#C8D9BF',
        textHex: '#16281F',
        borderHex: '#7D9788',
        dotHex: '#2F6B4C',
        className: 'bg-sage text-ink border-line-input',
      };
    case 'KERAS':
      return {
        label: 'Obat keras (K)',
        bgHex: '#FCE4E0',
        textHex: '#9F1F14',
        borderHex: '#B42318',
        dotHex: '#B42318',
        className: 'bg-danger-soft text-danger-ink border-danger',
      };
    case 'PSIKOTROPIKA':
      return {
        label: 'Psikotropika',
        bgHex: '#ECDBBC',
        textHex: '#7A3E0C',
        borderHex: '#C2610F',
        dotHex: '#C2610F',
        className: 'bg-cream text-warn-ink border-warn-line',
      };
    case 'NARKOTIKA':
    default:
      return {
        label: 'Narkotika',
        bgHex: '#FCE4E0',
        textHex: '#9F1F14',
        borderHex: '#B42318',
        dotHex: '#B42318',
        className: 'bg-danger-soft text-danger-ink border-danger',
      };
  }
}

/**
 * Penentu warna semantik untuk status SIPA Apoteker (DESIGN.md v2.0).
 */
export function getSipaStatusMeta(
  isSipaActive: boolean,
  sipaExpiryDate?: string | null,
  role?: UserRole,
): BadgeVisualMeta {
  if (role && role !== 'PHARMACIST') {
    return {
      label: role === 'OWNER' ? 'Pemilik apotek' : 'Non-apoteker (tanpa SIPA)',
      bgHex: '#DADABD',
      textHex: '#16281F',
      borderHex: '#7D9788',
      dotHex: '#5A7164',
      className: 'bg-sand text-ink border-line-input',
    };
  }

  if (isSipaActive) {
    const days = computeDaysUntilExpiry(sipaExpiryDate);
    if (days !== null && days <= 60) {
      return {
        label: `SIPA aktif (sisa ${days} hr)`,
        bgHex: '#ECDBBC',
        textHex: '#7A3E0C',
        borderHex: '#7D9788',
        dotHex: '#C2610F',
        className: 'bg-cream text-warn-ink border-line-input',
      };
    }
    return {
      label: 'SIPA aktif',
      bgHex: '#B6D8C0',
      textHex: '#16281F',
      borderHex: '#7D9788',
      dotHex: '#2F6B4C',
      className: 'bg-mint text-ink border-line-input',
    };
  }

  return {
    label: sipaExpiryDate ? 'SIPA berakhir' : 'SIPA belum terdaftar',
    bgHex: '#FCE4E0',
    textHex: '#9F1F14',
    borderHex: '#B42318',
    dotHex: '#B42318',
    className: 'bg-danger-soft text-danger-ink border-danger',
  };
}

/**
 * Penentu warna semantik untuk Peran Pengguna (DESIGN.md v2.0).
 * Pemilik: ink, Apoteker: mint, Kasir: sand
 */
export function getRoleMeta(role: UserRole): BadgeVisualMeta {
  switch (role) {
    case 'OWNER':
      return {
        label: 'Pemilik',
        bgHex: '#16281F',
        textHex: '#FFFFFF',
        borderHex: '#16281F',
        dotHex: '#B6D8C0',
        className: 'bg-ink text-white border-ink',
      };
    case 'PHARMACIST':
      return {
        label: 'Apoteker',
        bgHex: '#B6D8C0',
        textHex: '#16281F',
        borderHex: '#7D9788',
        dotHex: '#2F6B4C',
        className: 'bg-mint text-ink border-line-input',
      };
    case 'CASHIER':
    default:
      return {
        label: 'Kasir',
        bgHex: '#DADABD',
        textHex: '#16281F',
        borderHex: '#7D9788',
        dotHex: '#5A7164',
        className: 'bg-sand text-ink border-line-input',
      };
  }
}

/**
 * Penentu warna semantik untuk jenis mutasi Kartu Stok.
 */
export function getMovementTypeMeta(movementType: StockMovementType): BadgeVisualMeta {
  switch (movementType) {
    case 'IN_INVOICE':
      return {
        label: 'Masuk faktur',
        bgHex: '#B6D8C0',
        textHex: '#16281F',
        borderHex: '#7D9788',
        dotHex: '#2F6B4C',
        className: 'bg-mint text-ink border-line-input',
      };
    case 'OUT_SALE':
      return {
        label: 'Keluar penjualan',
        bgHex: '#DADABD',
        textHex: '#16281F',
        borderHex: '#7D9788',
        dotHex: '#5A7164',
        className: 'bg-sand text-ink border-line-input',
      };
    case 'ADJUSTMENT':
    default:
      return {
        label: 'Penyesuaian stok',
        bgHex: '#ECDBBC',
        textHex: '#7A3E0C',
        borderHex: '#7D9788',
        dotHex: '#C2610F',
        className: 'bg-cream text-warn-ink border-line-input',
      };
  }
}

/**
 * Penentu warna semantik untuk status Surat Pesanan Elektronik (SP-el).
 */
export function getPurchaseOrderStatusMeta(status: PurchaseOrderStatus): BadgeVisualMeta {
  switch (status) {
    case 'SENT_EMAIL':
      return {
        label: 'Terkirim ke email PBF',
        bgHex: '#B6D8C0',
        textHex: '#16281F',
        borderHex: '#7D9788',
        dotHex: '#2F6B4C',
        className: 'bg-mint text-ink border-line-input',
      };
    case 'RECEIVED':
      return {
        label: 'Barang diterima',
        bgHex: '#C8D9BF',
        textHex: '#16281F',
        borderHex: '#7D9788',
        dotHex: '#2F6B4C',
        className: 'bg-sage text-ink border-line-input',
      };
    case 'ISSUED':
    default:
      return {
        label: 'SP-el diterbitkan',
        bgHex: '#DADABD',
        textHex: '#16281F',
        borderHex: '#7D9788',
        dotHex: '#5A7164',
        className: 'bg-sand text-ink border-line-input',
      };
  }
}

/**
 * Penentu warna semantik untuk status pembayaran faktur PBF.
 */
export function getPaymentStatusMeta(status: PaymentStatus): BadgeVisualMeta {
  if (status === 'PAID') {
    return {
      label: 'Lunas',
      bgHex: '#B6D8C0',
      textHex: '#16281F',
      borderHex: '#7D9788',
      dotHex: '#2F6B4C',
      className: 'bg-mint text-ink border-line-input',
    };
  }
  return {
    label: 'Belum lunas',
    bgHex: '#ECDBBC',
    textHex: '#7A3E0C',
    borderHex: '#7D9788',
    dotHex: '#C2610F',
    className: 'bg-cream text-warn-ink border-line-input',
  };
}

export function formatPricingTierLabel(tier: PricingTier): string {
  return tier === 'PARTNER' ? 'Harga mitra' : 'Harga reguler';
}

export function formatPaymentMethodLabel(method: PaymentMethod): string {
  switch (method) {
    case 'QRIS':
      return 'QRIS';
    case 'DEBIT':
      return 'Kartu debit';
    case 'CASH':
    default:
      return 'Tunai';
  }
}
