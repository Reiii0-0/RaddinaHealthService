/**
 * Shared API Contracts
 * Single source of truth for API routes, payload structures, and response envelopes.
 */

export type UserRole = 'OWNER' | 'PHARMACIST' | 'CASHIER';
export type DrugClassification =
  | 'BEBAS'
  | 'BEBAS_TERBATAS'
  | 'KERAS'
  | 'PSIKOTROPIKA'
  | 'NARKOTIKA';
export type ParetoClass = 'A' | 'B' | 'C';
export type PricingTier = 'REGULAR' | 'PARTNER';
export type PaymentMethod = 'CASH' | 'QRIS' | 'DEBIT';
export type PaymentStatus = 'UNPAID' | 'PAID';
export type StockMovementType = 'IN_INVOICE' | 'OUT_SALE' | 'ADJUSTMENT';
export type BatchExpiryStatus = 'ACTIVE' | 'NEAR_EXPIRY' | 'EXPIRED';
export type PurchaseOrderStatus = 'ISSUED' | 'SENT_EMAIL' | 'RECEIVED';

export const API_ROUTES = {
  AUTH: {
    REGISTER: '/api/v1/auth/register',
    LOGIN: '/api/v1/auth/login',
    REFRESH: '/api/v1/auth/refresh',
    LOGOUT: '/api/v1/auth/logout',
    ME: '/api/v1/auth/me',
  },
  USERS: {
    LIST: '/api/v1/users',
    UPDATE_ROLE_SIPA: (id: string) => `/api/v1/users/${id}/role`,
  },
  CATEGORIES: {
    LIST: '/api/v1/categories',
    CREATE: '/api/v1/categories',
  },
  MEDICINES: {
    LIST: '/api/v1/medicines',
    DETAIL: (id: string) => `/api/v1/medicines/${id}`,
    CREATE: '/api/v1/medicines',
    UPDATE: (id: string) => `/api/v1/medicines/${id}`,
    DELETE: (id: string) => `/api/v1/medicines/${id}`,
    UPLOAD_IMAGE: (id: string) => `/api/v1/medicines/${id}/image`,
  },
  SUPPLIERS: {
    LIST: '/api/v1/suppliers',
    CREATE: '/api/v1/suppliers',
    UPDATE: (id: string) => `/api/v1/suppliers/${id}`,
  },
  INVOICES: {
    LIST: '/api/v1/invoices',
    DETAIL: (id: string) => `/api/v1/invoices/${id}`,
    CREATE: '/api/v1/invoices',
    UPLOAD_SCAN: (id: string) => `/api/v1/invoices/${id}/scan`,
  },
  INVENTORY: {
    BATCHES: '/api/v1/inventory/batches',
    STOCK_CARDS: '/api/v1/inventory/stock-cards',
  },
  SALES: {
    PREVIEW_FEFO: '/api/v1/sales/preview-fefo',
    CHECKOUT: '/api/v1/sales/checkout',
    LIST: '/api/v1/sales',
    DETAIL: (id: string) => `/api/v1/sales/${id}`,
  },
  ANALYTICS: {
    PARETO: '/api/v1/analytics/pareto',
    RECALCULATE_PARETO: '/api/v1/analytics/pareto/recalculate',
  },
  PROCUREMENT: {
    DEFEKTA: '/api/v1/procurement/defekta',
    PURCHASE_ORDERS: '/api/v1/procurement/purchase-orders',
  },
  NOTIFICATIONS: {
    NEAR_EXPIRY_DIGEST: '/api/v1/notifications/near-expiry-digest',
  },
} as const;

// ============================================================================
// 1. AUTH & USER CONTRACTS (US-01)
// ============================================================================

export interface AuthUserDto {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  noSipa: string | null;
  sipaExpiryDate: string | null;
  isSipaActive: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface RegisterRequestDto {
  email: string;
  password: string;
  fullName: string;
}

export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface AuthTokenResponseDto {
  accessToken: string;
  refreshToken: string;
  user: AuthUserDto;
}

export interface UpdateUserRoleSipaRequestDto {
  role: UserRole;
  noSipa?: string | null;
  sipaExpiryDate?: string | null;
}

// ============================================================================
// 2. MASTER OBAT & MULTI-UOM CONTRACTS (US-02)
// ============================================================================

export interface UomConversionInputDto {
  unitName: string;
  multiplierToBase: number;
  sellingPriceRegular: number;
  sellingPricePartner: number;
  barcode?: string | null;
}

export interface MedicineUomDto extends UomConversionInputDto {
  id: string;
  medicineId: string;
}

export interface MedicineSummaryDto {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  categoryName: string;
  activeIngredient: string;
  baseUnit: string;
  classification: DrugClassification;
  paretoClass: ParetoClass;
  minStockBaseUnit: number;
  totalActiveStockBaseUnit: number;
  earliestExpiryDate: string | null;
  imagePath: string | null;
  isActive: boolean;
  uomConversions: MedicineUomDto[];
}

export interface CreateMedicineRequestDto {
  sku: string;
  name: string;
  categoryId: string;
  activeIngredient: string;
  baseUnit: string;
  classification: DrugClassification;
  minStockBaseUnit: number;
  uomConversions: UomConversionInputDto[];
}

// ============================================================================
// 3. PBF INVOICES, BATCHES, & STOCK CARDS CONTRACTS (US-03)
// ============================================================================

export interface SupplierDto {
  id: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  izinPbfNo: string;
  address: string;
  isActive: boolean;
}

export interface CreateInvoiceItemInputDto {
  medicineId: string;
  batchNumber: string;
  expiryDate: string;
  uomUnitName: string;
  qtyInUom: number;
  purchasePricePerUom: number;
}

export interface CreatePbfInvoiceRequestDto {
  invoiceNumber: string;
  supplierId: string;
  invoiceDate: string;
  dueDate: string;
  notes?: string;
  items: CreateInvoiceItemInputDto[];
}

export interface BatchStockItemDto {
  id: string;
  medicineId: string;
  medicineName: string;
  medicineSku: string;
  baseUnit: string;
  supplierId: string;
  supplierName: string;
  batchNumber: string;
  expiryDate: string;
  daysUntilExpiry: number;
  expiryStatus: BatchExpiryStatus;
  initialStock: number;
  currentStock: number;
  costPricePerBaseUnit: string;
}

export interface StockCardEntryDto {
  id: string;
  medicineId: string;
  medicineName: string;
  baseUnit: string;
  batchId: string;
  batchNumber: string;
  actorUserId: string;
  actorFullName: string;
  movementType: StockMovementType;
  referenceId: string;
  qtyChange: number;
  balanceAfter: number;
  notes: string | null;
  createdAt: string;
}

// ============================================================================
// 4. POS SALES & ATOMIC FEFO ALLOCATION CONTRACTS (US-04)
// ============================================================================

export interface CartItemInputDto {
  medicineId: string;
  uomUnitName: string;
  qtyInUom: number;
}

export interface FefoBatchSliceDto {
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  daysUntilExpiry: number;
  allocatedBaseQty: number;
  availableStockBefore: number;
  remainingStockAfter: number;
}

export interface FefoItemPreviewDto {
  medicineId: string;
  medicineName: string;
  activeIngredient: string;
  uomUnitName: string;
  qtyInUom: number;
  multiplierToBase: number;
  requiredBaseQty: number;
  totalAvailableActiveStock: number;
  isSufficient: boolean;
  shortageBaseQty: number;
  unitSellingPrice: number;
  subtotal: number;
  allocations: FefoBatchSliceDto[];
  substitutes: Array<{
    medicineId: string;
    name: string;
    activeIngredient: string;
    availableActiveStock: number;
    baseUnit: string;
  }>;
}

export interface PreviewFefoRequestDto {
  pricingTier: PricingTier;
  items: CartItemInputDto[];
}

export interface CheckoutSaleRequestDto {
  pricingTier: PricingTier;
  customerName?: string;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  items: CartItemInputDto[];
}

// ============================================================================
// 5. PARETO ABC, DEFEKTA, & SP-EL CONTRACTS (US-05 & US-06)
// ============================================================================

export interface ParetoItemAnalyticsDto {
  rank: number;
  medicineId: string;
  sku: string;
  name: string;
  activeIngredient: string;
  baseUnit: string;
  totalQtySoldBase: number;
  totalRevenue: number;
  revenueShareRatio: number;
  cumulativeShareBefore: number;
  cumulativeShareAfter: number;
  paretoClass: ParetoClass;
}

export interface DefektaItemDto {
  medicineId: string;
  sku: string;
  name: string;
  activeIngredient: string;
  baseUnit: string;
  paretoClass: ParetoClass;
  currentActiveStock: number;
  minStockBaseUnit: number;
  soldLast30DaysBase: number;
  avgDailyConsumption: number;
  reorderPointRop: number;
  recommendedOrderQty: number;
  recommendedSupplier: {
    supplierId: string;
    supplierName: string;
    supplierEmail: string;
    lowestCostPerBaseUnit: string;
    lastInvoiceDate: string;
  } | null;
}

export interface CreatePurchaseOrderRequestDto {
  supplierId: string;
  notes?: string;
  items: Array<{
    medicineId: string;
    orderedBaseQty: number;
    estimatedUnitCost?: string;
  }>;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}
