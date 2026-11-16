import {
  API_ROUTES,
  type AuthTokenResponseDto,
  type AuthUserDto,
  type BatchExpiryStatus,
  type BatchStockItemDto,
  type CheckoutSaleRequestDto,
  type CreateMedicineRequestDto,
  type CreatePbfInvoiceRequestDto,
  type CreatePurchaseOrderRequestDto,
  type DefektaItemDto,
  type DrugClassification,
  type FefoItemPreviewDto,
  type LoginRequestDto,
  type MedicineSummaryDto,
  type PaginatedResponse,
  type ParetoClass,
  type ParetoItemAnalyticsDto,
  type PaymentStatus,
  type PreviewFefoRequestDto,
  type PurchaseOrderStatus,
  type RegisterRequestDto,
  type StockCardEntryDto,
  type StockMovementType,
  type SupplierDto,
  type UpdateUserRoleSipaRequestDto,
} from '@shared/api-contracts';
import { useAuthStore } from '@/stores/auth.store';

export { API_ROUTES };

export class ApiError<TDetails = unknown> extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly details?: TDetails;

  constructor(
    statusCode: number,
    message: string,
    errorCode = 'API_ERROR',
    details?: TDetails,
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  params?: Record<string, string | number | boolean | null | undefined>;
  skipAuth?: boolean;
  skipRefresh?: boolean;
}

export interface CategoryDto {
  id: string;
  name: string;
  description: string | null;
  createdAt?: string;
}

export interface PbfInvoiceItemDto {
  id: string;
  invoiceId?: string;
  medicineId: string;
  medicineName?: string;
  medicineSku?: string;
  baseUnit?: string;
  batchId?: string;
  batchNumber: string;
  expiryDate: string;
  uomUnitName: string;
  qtyInUom: number;
  multiplierToBase: number;
  receivedBaseQty: number;
  purchasePricePerUom: number;
  costPricePerBaseUnit: string;
  lineTotal: number | string;
}

export interface PbfInvoiceSummaryDto {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName?: string;
  supplierCode?: string;
  receivedByUserId?: string;
  receivedByFullName?: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number | string;
  scanFilePath: string | null;
  paymentStatus: PaymentStatus;
  notes: string | null;
  createdAt: string;
  items?: PbfInvoiceItemDto[];
}

export interface SaleTransactionDto {
  id: string;
  receiptNumber: string;
  cashierId: string;
  cashierFullName?: string;
  pricingTier: 'REGULAR' | 'PARTNER';
  customerName: string | null;
  paymentMethod: 'CASH' | 'QRIS' | 'DEBIT';
  totalAmount: number;
  amountPaid: number;
  changeAmount: number;
  createdAt: string;
  items?: Array<{
    id: string;
    medicineId: string;
    medicineName?: string;
    uomUnitName: string;
    qtyInUom: number;
    multiplierToBase: number;
    totalBaseQty: number;
    unitSellingPrice: number;
    subtotal: number;
    allocations?: Array<{
      batchId: string;
      batchNumber: string;
      expiryDate: string;
      allocatedBaseQty: number;
      unitCostPriceSnapshot?: string;
    }>;
  }>;
}

export interface PurchaseOrderDto {
  id: string;
  spNumber: string;
  supplierId: string;
  supplierName?: string;
  supplierEmail?: string;
  pharmacistId: string;
  pharmacistFullName?: string;
  pharmacistSipaSnapshot: string;
  status: PurchaseOrderStatus;
  emailSentAt: string | null;
  notes: string | null;
  createdAt: string;
  items?: Array<{
    id?: string;
    medicineId: string;
    medicineName?: string;
    baseUnit?: string;
    orderedBaseQty: number;
    estimatedUnitCost?: string | null;
  }>;
}

function buildUrlWithParams(
  path: string,
  params?: Record<string, string | number | boolean | null | undefined>,
): string {
  if (!params) {
    return path;
  }
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  }
  const queryString = searchParams.toString();
  if (!queryString) {
    return path;
  }
  return path.includes('?') ? `${path}&${queryString}` : `${path}?${queryString}`;
}

function extractMessageFromErrorPayload(status: number, payload: unknown): {
  message: string;
  errorCode: string;
  details?: unknown;
} {
  if (status === 413) {
    return {
      errorCode: 'PAYLOAD_TOO_LARGE',
      message:
        'Ukuran berkas melebihi batas maksimal server 5 MB (HTTP 413 Payload Too Large). Kompres berkas menjadi di bawah 5 MB lalu unggah kembali.',
      details: payload,
    };
  }

  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    const rawCode =
      (typeof obj.errorCode === 'string' && obj.errorCode) ||
      (typeof obj.code === 'string' && obj.code) ||
      (typeof obj.error === 'string' && obj.error) ||
      `HTTP_${status}`;

    if (Array.isArray(obj.message)) {
      return {
        errorCode: rawCode,
        message: obj.message.join('; '),
        details: obj.details ?? obj,
      };
    }

    if (typeof obj.message === 'string' && obj.message.trim().length > 0) {
      return {
        errorCode: rawCode,
        message: obj.message,
        details: obj.details ?? obj,
      };
    }
  }

  if (status === 401) {
    return {
      errorCode: 'UNAUTHORIZED',
      message:
        'Sesi autentikasi berakhir atau kredensial tidak valid (HTTP 401). Silakan masuk kembali untuk melanjutkan pekerjaan.',
    };
  }

  if (status === 403) {
    return {
      errorCode: 'FORBIDDEN',
      message:
        'Akses ditolak karena peran akun atau masa berlaku SIPA tidak memenuhi syarat otorisasi (HTTP 403). Gunakan akun berwenang atau perbarui SIPA melalui Pemilik Sarana.',
    };
  }

  return {
    errorCode: `HTTP_${status}`,
    message: `Permintaan ke server gagal dengan kode status HTTP ${status}. Periksa kembali data masukan lalu coba lagi.`,
  };
}

function unwrapEnvelope<T>(payload: unknown): T {
  if (
    payload &&
    typeof payload === 'object' &&
    'data' in (payload as Record<string, unknown>) &&
    !('items' in (payload as Record<string, unknown>)) &&
    !('accessToken' in (payload as Record<string, unknown>))
  ) {
    const inner = (payload as Record<string, unknown>).data;
    if (inner !== undefined) {
      return inner as T;
    }
  }
  return payload as T;
}

export function normalizePaginated<T>(
  payload: PaginatedResponse<T> | T[] | { data?: T[]; items?: T[]; meta?: PaginatedResponse<T>['meta'] },
  fallbackPage = 1,
  fallbackLimit = 20,
): PaginatedResponse<T> {
  if (Array.isArray(payload)) {
    return {
      items: payload,
      meta: {
        page: fallbackPage,
        limit: fallbackLimit,
        totalItems: payload.length,
        totalPages: Math.max(1, Math.ceil(payload.length / fallbackLimit)),
      },
    };
  }

  if (payload && typeof payload === 'object') {
    const items = Array.isArray(payload.items)
      ? payload.items
      : Array.isArray((payload as { data?: T[] }).data)
        ? ((payload as { data: T[] }).data)
        : [];
    const meta = payload.meta ?? {
      page: fallbackPage,
      limit: fallbackLimit,
      totalItems: items.length,
      totalPages: Math.max(1, Math.ceil(items.length / fallbackLimit)),
    };
    return { items, meta };
  }

  return {
    items: [],
    meta: {
      page: fallbackPage,
      limit: fallbackLimit,
      totalItems: 0,
      totalPages: 1,
    },
  };
}

let activeRefreshPromise: Promise<string | null> | null = null;

async function attemptSilentRefresh(): Promise<string | null> {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  const { refreshToken, setSession, clearSession, user } = useAuthStore.getState();
  if (!refreshToken) {
    clearSession();
    return null;
  }

  activeRefreshPromise = (async () => {
    try {
      const response = await fetch(API_ROUTES.AUTH.REFRESH, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${refreshToken}`,
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        clearSession();
        return null;
      }

      const rawJson: unknown = await response.json();
      const tokenPayload = unwrapEnvelope<Partial<AuthTokenResponseDto>>(rawJson);

      if (!tokenPayload?.accessToken) {
        clearSession();
        return null;
      }

      const nextUser = tokenPayload.user ?? user;
      if (nextUser) {
        setSession({
          accessToken: tokenPayload.accessToken,
          refreshToken: tokenPayload.refreshToken ?? refreshToken,
          user: nextUser,
        });
      }
      return tokenPayload.accessToken;
    } catch {
      clearSession();
      return null;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}

export async function apiRequest<TResponse = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<TResponse> {
  const { body, params, skipAuth = false, skipRefresh = false, headers, ...restInit } = options;
  const url = buildUrlWithParams(path, params);

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const requestHeaders = new Headers(headers);

  if (!isFormData && body !== undefined && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  if (!skipAuth && !requestHeaders.has('Authorization')) {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      requestHeaders.set('Authorization', `Bearer ${token}`);
    }
  }

  const serializedBody: BodyInit | undefined =
    body === undefined
      ? undefined
      : isFormData
        ? body
        : typeof body === 'string'
          ? body
          : JSON.stringify(body);

  let response = await fetch(url, {
    ...restInit,
    headers: requestHeaders,
    body: serializedBody,
  });

  if (
    response.status === 401 &&
    !skipAuth &&
    !skipRefresh &&
    path !== API_ROUTES.AUTH.LOGIN &&
    path !== API_ROUTES.AUTH.REGISTER &&
    path !== API_ROUTES.AUTH.REFRESH
  ) {
    const refreshedAccessToken = await attemptSilentRefresh();
    if (refreshedAccessToken) {
      requestHeaders.set('Authorization', `Bearer ${refreshedAccessToken}`);
      response = await fetch(url, {
        ...restInit,
        headers: requestHeaders,
        body: serializedBody,
      });
    }
  }

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const parsedPayload: unknown = isJson
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);

  if (!response.ok) {
    const { message, errorCode, details } = extractMessageFromErrorPayload(
      response.status,
      parsedPayload,
    );
    throw new ApiError(response.status, message, errorCode, details);
  }

  return unwrapEnvelope<TResponse>(parsedPayload);
}

export const apiClient = {
  get: <TResponse = unknown>(
    path: string,
    params?: Record<string, string | number | boolean | null | undefined>,
    options?: Omit<ApiRequestOptions, 'method' | 'params'>,
  ) => apiRequest<TResponse>(path, { ...options, method: 'GET', params }),

  post: <TResponse = unknown>(
    path: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, 'method' | 'body'>,
  ) => apiRequest<TResponse>(path, { ...options, method: 'POST', body }),

  patch: <TResponse = unknown>(
    path: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, 'method' | 'body'>,
  ) => apiRequest<TResponse>(path, { ...options, method: 'PATCH', body }),

  delete: <TResponse = unknown>(
    path: string,
    options?: Omit<ApiRequestOptions, 'method'>,
  ) => apiRequest<TResponse>(path, { ...options, method: 'DELETE' }),

  upload: <TResponse = unknown>(
    path: string,
    file: File,
    fieldName = 'file',
    extraFields?: Record<string, string>,
  ) => {
    const formData = new FormData();
    formData.append(fieldName, file);
    if (extraFields) {
      for (const [k, v] of Object.entries(extraFields)) {
        formData.append(k, v);
      }
    }
    return apiRequest<TResponse>(path, {
      method: 'POST',
      body: formData,
    });
  },
};

export const authApi = {
  login: (dto: LoginRequestDto) =>
    apiClient.post<AuthTokenResponseDto>(API_ROUTES.AUTH.LOGIN, dto, { skipAuth: true }),
  register: (dto: RegisterRequestDto) =>
    apiClient.post<AuthTokenResponseDto | AuthUserDto>(API_ROUTES.AUTH.REGISTER, dto, {
      skipAuth: true,
    }),
  refresh: (refreshToken: string) =>
    apiClient.post<AuthTokenResponseDto>(
      API_ROUTES.AUTH.REFRESH,
      { refreshToken },
      { skipRefresh: true },
    ),
  logout: () => apiClient.post<{ message?: string }>(API_ROUTES.AUTH.LOGOUT),
  me: () => apiClient.get<AuthUserDto>(API_ROUTES.AUTH.ME),
};

export const usersApi = {
  list: async () => {
    const res = await apiClient.get<AuthUserDto[] | PaginatedResponse<AuthUserDto>>(
      API_ROUTES.USERS.LIST,
    );
    return Array.isArray(res) ? res : res.items ?? [];
  },
  updateRoleSipa: (id: string, dto: UpdateUserRoleSipaRequestDto) =>
    apiClient.patch<AuthUserDto>(API_ROUTES.USERS.UPDATE_ROLE_SIPA(id), dto),
};

export const categoriesApi = {
  list: async (): Promise<CategoryDto[]> => {
    const res = await apiClient.get<CategoryDto[] | PaginatedResponse<CategoryDto>>(
      API_ROUTES.CATEGORIES.LIST,
    );
    return Array.isArray(res) ? res : res.items ?? [];
  },
  create: (dto: { name: string; description?: string }) =>
    apiClient.post<CategoryDto>(API_ROUTES.CATEGORIES.CREATE, dto),
};

export interface MedicineFilterParams {
  search?: string;
  activeIngredient?: string;
  categoryId?: string;
  classification?: DrugClassification | '';
  paretoClass?: ParetoClass | '';
  page?: number;
  limit?: number;
}

export const medicinesApi = {
  list: async (params?: MedicineFilterParams): Promise<PaginatedResponse<MedicineSummaryDto>> => {
    const res = await apiClient.get<
      PaginatedResponse<MedicineSummaryDto> | MedicineSummaryDto[]
    >(API_ROUTES.MEDICINES.LIST, params as Record<string, string | number | undefined>);
    return normalizePaginated(res, params?.page ?? 1, params?.limit ?? 20);
  },
  detail: (id: string) => apiClient.get<MedicineSummaryDto>(API_ROUTES.MEDICINES.DETAIL(id)),
  create: (dto: CreateMedicineRequestDto) =>
    apiClient.post<MedicineSummaryDto>(API_ROUTES.MEDICINES.CREATE, dto),
  update: (id: string, dto: Partial<CreateMedicineRequestDto>) =>
    apiClient.patch<MedicineSummaryDto>(API_ROUTES.MEDICINES.UPDATE(id), dto),
  remove: (id: string) =>
    apiClient.delete<{ message?: string; id?: string }>(API_ROUTES.MEDICINES.DELETE(id)),
  uploadImage: (id: string, file: File) =>
    apiClient.upload<MedicineSummaryDto | { imagePath: string }>(
      API_ROUTES.MEDICINES.UPLOAD_IMAGE(id),
      file,
      'file',
    ),
};

export const suppliersApi = {
  list: async (params?: { search?: string; page?: number; limit?: number }): Promise<SupplierDto[]> => {
    const res = await apiClient.get<SupplierDto[] | PaginatedResponse<SupplierDto>>(
      API_ROUTES.SUPPLIERS.LIST,
      params,
    );
    return Array.isArray(res) ? res : res.items ?? [];
  },
  create: (dto: Omit<SupplierDto, 'id' | 'isActive'>) =>
    apiClient.post<SupplierDto>(API_ROUTES.SUPPLIERS.CREATE, dto),
  update: (id: string, dto: Partial<Omit<SupplierDto, 'id'>>) =>
    apiClient.patch<SupplierDto>(API_ROUTES.SUPPLIERS.UPDATE(id), dto),
};

export const invoicesApi = {
  list: async (params?: {
    supplierId?: string;
    paymentStatus?: PaymentStatus | '';
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<PbfInvoiceSummaryDto>> => {
    const res = await apiClient.get<
      PaginatedResponse<PbfInvoiceSummaryDto> | PbfInvoiceSummaryDto[]
    >(API_ROUTES.INVOICES.LIST, params);
    return normalizePaginated(res, params?.page ?? 1, params?.limit ?? 20);
  },
  detail: (id: string) => apiClient.get<PbfInvoiceSummaryDto>(API_ROUTES.INVOICES.DETAIL(id)),
  create: (dto: CreatePbfInvoiceRequestDto) =>
    apiClient.post<PbfInvoiceSummaryDto>(API_ROUTES.INVOICES.CREATE, dto),
  uploadScan: (id: string, file: File) =>
    apiClient.upload<PbfInvoiceSummaryDto | { scanFilePath: string }>(
      API_ROUTES.INVOICES.UPLOAD_SCAN(id),
      file,
      'file',
    ),
};

export const inventoryApi = {
  listBatches: async (params?: {
    medicineId?: string;
    status?: BatchExpiryStatus | '';
    expiryStatus?: BatchExpiryStatus | '';
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<BatchStockItemDto>> => {
    const queryParams = {
      ...params,
      status: params?.status || params?.expiryStatus || undefined,
      expiryStatus: params?.expiryStatus || params?.status || undefined,
    };
    const res = await apiClient.get<
      PaginatedResponse<BatchStockItemDto> | BatchStockItemDto[]
    >(API_ROUTES.INVENTORY.BATCHES, queryParams);
    return normalizePaginated(res, params?.page ?? 1, params?.limit ?? 50);
  },
  listStockCards: async (params?: {
    medicineId?: string;
    batchId?: string;
    movementType?: StockMovementType | '';
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<StockCardEntryDto>> => {
    const res = await apiClient.get<
      PaginatedResponse<StockCardEntryDto> | StockCardEntryDto[]
    >(API_ROUTES.INVENTORY.STOCK_CARDS, params);
    return normalizePaginated(res, params?.page ?? 1, params?.limit ?? 30);
  },
};

export const salesApi = {
  previewFefo: (dto: PreviewFefoRequestDto) =>
    apiClient.post<
      | { items: FefoItemPreviewDto[]; totalAmount?: number; allSufficient?: boolean }
      | FefoItemPreviewDto[]
    >(API_ROUTES.SALES.PREVIEW_FEFO, dto),
  checkout: (dto: CheckoutSaleRequestDto) =>
    apiClient.post<SaleTransactionDto>(API_ROUTES.SALES.CHECKOUT, dto),
  list: async (params?: { page?: number; limit?: number }) => {
    const res = await apiClient.get<
      PaginatedResponse<SaleTransactionDto> | SaleTransactionDto[]
    >(API_ROUTES.SALES.LIST, params);
    return normalizePaginated(res, params?.page ?? 1, params?.limit ?? 20);
  },
  detail: (id: string) => apiClient.get<SaleTransactionDto>(API_ROUTES.SALES.DETAIL(id)),
};

export const analyticsApi = {
  getPareto: async (params?: { days?: number }) => {
    const res = await apiClient.get<
      | ParetoItemAnalyticsDto[]
      | { items: ParetoItemAnalyticsDto[]; totalRevenue?: number; periodDays?: number }
    >(API_ROUTES.ANALYTICS.PARETO, params);
    return Array.isArray(res) ? res : res.items ?? [];
  },
  recalculatePareto: (body?: { days?: number }) =>
    apiClient.post<
      | ParetoItemAnalyticsDto[]
      | { items: ParetoItemAnalyticsDto[]; updatedCount?: number; totalRevenue?: number }
    >(API_ROUTES.ANALYTICS.RECALCULATE_PARETO, body ?? {}),
};

export const procurementApi = {
  getDefekta: async () => {
    const res = await apiClient.get<DefektaItemDto[] | { items: DefektaItemDto[] }>(
      API_ROUTES.PROCUREMENT.DEFEKTA,
    );
    return Array.isArray(res) ? res : res.items ?? [];
  },
  listPurchaseOrders: async (params?: { page?: number; limit?: number }) => {
    const res = await apiClient.get<
      PaginatedResponse<PurchaseOrderDto> | PurchaseOrderDto[]
    >(API_ROUTES.PROCUREMENT.PURCHASE_ORDERS, params);
    return normalizePaginated(res, params?.page ?? 1, params?.limit ?? 20);
  },
  createPurchaseOrder: (dto: CreatePurchaseOrderRequestDto) =>
    apiClient.post<PurchaseOrderDto>(API_ROUTES.PROCUREMENT.PURCHASE_ORDERS, dto),
};

export const notificationsApi = {
  sendNearExpiryDigest: (body?: { recipientEmail?: string; thresholdDays?: number }) =>
    apiClient.post<{ sent?: boolean; message?: string; batchCount?: number }>(
      API_ROUTES.NOTIFICATIONS.NEAR_EXPIRY_DIGEST,
      body ?? {},
    ),
};
