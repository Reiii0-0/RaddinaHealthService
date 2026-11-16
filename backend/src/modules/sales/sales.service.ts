import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import {
  FefoItemPreviewDto,
  PaginatedResponse,
} from '@shared/api-contracts';
import { DRIZZLE_DB, DrizzleDB } from '../../db';
import {
  medicines,
  saleItemBatchAllocations,
  saleItems,
  salesTransactions,
  users,
} from '../../db/schema';
import { CheckoutSaleDto } from './dto/checkout-sale.dto';
import { PreviewFefoDto } from './dto/preview-fefo.dto';
import { FefoEngine, ResolvedMedicineCartItem } from './fefo.engine';

export interface ListSalesQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export interface SalesDetailResponse {
  id: string;
  receiptNumber: string;
  cashierId: string;
  cashierName: string;
  pricingTier: string;
  customerName: string | null;
  paymentMethod: string;
  totalAmount: number;
  amountPaid: number;
  changeAmount: number;
  createdAt: string;
  items: Array<{
    id: string;
    medicineId: string;
    medicineName: string;
    medicineSku: string;
    baseUnit: string;
    uomUnitName: string;
    qtyInUom: number;
    multiplierToBase: number;
    totalBaseQty: number;
    unitSellingPrice: number;
    subtotal: number;
    batchAllocations: Array<{
      id: string;
      batchId: string;
      batchNumber: string;
      expiryDate: string;
      allocatedBaseQty: number;
      unitCostPrice: string;
    }>;
  }>;
}

@Injectable()
export class SalesService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    private readonly fefoEngine: FefoEngine,
  ) {}

  /**
   * Menghitung pratinjau alokasi FEFO untuk seluruh item keranjang tanpa mengubah basis data.
   */
  async previewFefo(dto: PreviewFefoDto): Promise<FefoItemPreviewDto[]> {
    const results: FefoItemPreviewDto[] = [];
    for (const item of dto.items) {
      const preview = await this.fefoEngine.previewAllocationForItem(
        this.db,
        item,
        dto.pricingTier,
      );
      results.push(preview);
    }
    return results;
  }

  /**
   * Memproses checkout transaksi kasir secara atomik di dalam database transaction.
   * Mengunci batch terkait, memotong stok secara FEFO, mencatat struk, item, dan kartu stok.
   */
  async checkout(
    dto: CheckoutSaleDto,
    cashierId: string,
  ): Promise<SalesDetailResponse> {
    const saleId = await this.db.transaction(async (tx) => {
      // 1. Selesaikan dan validasi setiap item dalam keranjang
      const resolvedList: ResolvedMedicineCartItem[] = [];
      let totalAmount = 0;

      for (const item of dto.items) {
        const resolved = await this.fefoEngine.resolveCartItem(
          tx,
          item,
          dto.pricingTier,
        );
        resolvedList.push(resolved);
        totalAmount += resolved.subtotal;
      }

      // 2. Validasi pembayaran kasir
      if (dto.amountPaid < totalAmount) {
        const shortage = totalAmount - dto.amountPaid;
        throw new BadRequestException(
          `Pembayaran transaksi penjualan gagal divalidasi. Jumlah uang yang diterima kasir (Rp ${dto.amountPaid.toLocaleString('id-ID')}) kurang dari total belanja (Rp ${totalAmount.toLocaleString('id-ID')}) dengan selisih kekurangan sebesar Rp ${shortage.toLocaleString('id-ID')}. Silakan terima nominal pembayaran yang mencukupi atau sama persis dengan total tagihan.`,
        );
      }

      const changeAmount = dto.amountPaid - totalAmount;

      // 3. Buat nomor struk unik: TRX-YYYYMMDD-XXXXXX
      const now = new Date();
      const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(100000 + Math.random() * 900000);
      const receiptNumber = `TRX-${datePart}-${randomSuffix}`;

      // 4. Simpan header transaksi penjualan
      const [insertedSale] = await tx
        .insert(salesTransactions)
        .values({
          receiptNumber,
          cashierId,
          pricingTier: dto.pricingTier,
          customerName: dto.customerName?.trim() || null,
          paymentMethod: dto.paymentMethod,
          totalAmount,
          amountPaid: dto.amountPaid,
          changeAmount,
        })
        .returning();

      // 5. Simpan item transaksi dan jalankan alokasi stok FEFO terkunci
      for (const resolved of resolvedList) {
        const [insertedSaleItem] = await tx
          .insert(saleItems)
          .values({
            saleId: insertedSale.id,
            medicineId: resolved.medicineId,
            uomUnitName: resolved.uomUnitName,
            qtyInUom: resolved.qtyInUom,
            multiplierToBase: resolved.multiplierToBase,
            totalBaseQty: resolved.requiredBaseQty,
            unitSellingPrice: resolved.unitSellingPrice,
            subtotal: resolved.subtotal,
          })
          .returning();

        // Eksekusi mutasi FEFO terkunci (SELECT ... FOR UPDATE)
        await this.fefoEngine.executeAllocationWithLock(
          tx,
          resolved,
          insertedSaleItem.id,
          cashierId,
          receiptNumber,
        );
      }

      return insertedSale.id;
    });

    return this.findOne(saleId);
  }

  /**
   * Mengambil riwayat seluruh transaksi penjualan dengan pagination dan pencarian.
   */
  async findAll(query: ListSalesQuery): Promise<PaginatedResponse<any>> {
    const rawPage = Number(query.page ?? 1);
    const rawLimit = Number(query.limit ?? 20);
    const page =
      Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
    const limit =
      Number.isFinite(rawLimit) && rawLimit >= 1
        ? Math.min(Math.floor(rawLimit), 100)
        : 20;
    const offset = (page - 1) * limit;

    const conditions: any[] = [];
    if (query.search && query.search.trim().length > 0) {
      const pattern = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(salesTransactions.receiptNumber, pattern),
          ilike(salesTransactions.customerName, pattern),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const totalRows = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(salesTransactions)
      .where(whereClause);

    const totalItems = totalRows[0]?.total ?? 0;
    const totalPages = Math.ceil(totalItems / limit);

    const rows = await this.db
      .select({
        sale: salesTransactions,
        cashierFullName: users.fullName,
      })
      .from(salesTransactions)
      .innerJoin(users, eq(salesTransactions.cashierId, users.id))
      .where(whereClause)
      .orderBy(desc(salesTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    const items = rows.map(({ sale, cashierFullName }) => ({
      id: sale.id,
      receiptNumber: sale.receiptNumber,
      cashierId: sale.cashierId,
      cashierName: cashierFullName,
      pricingTier: sale.pricingTier,
      customerName: sale.customerName,
      paymentMethod: sale.paymentMethod,
      totalAmount: sale.totalAmount,
      amountPaid: sale.amountPaid,
      changeAmount: sale.changeAmount,
      createdAt: sale.createdAt.toISOString(),
    }));

    return {
      items,
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
      },
    };
  }

  /**
   * Mengambil rincian 1 transaksi penjualan beserta daftar item dan pemotongan batch FEFO.
   */
  async findOne(id: string): Promise<SalesDetailResponse> {
    const saleRows = await this.db
      .select({
        sale: salesTransactions,
        cashierFullName: users.fullName,
      })
      .from(salesTransactions)
      .innerJoin(users, eq(salesTransactions.cashierId, users.id))
      .where(eq(salesTransactions.id, id))
      .limit(1);

    if (saleRows.length === 0) {
      throw new NotFoundException(
        `Pencarian transaksi kasir gagal. Transaksi dengan nomor ID ${id} tidak ditemukan pada catatan sistem. Silakan periksa kembali daftar riwayat penjualan kasir.`,
      );
    }

    const { sale, cashierFullName } = saleRows[0];

    // Ambil item transaksi
    const itemRows = await this.db
      .select({
        item: saleItems,
        medicineName: medicines.name,
        medicineSku: medicines.sku,
        baseUnit: medicines.baseUnit,
      })
      .from(saleItems)
      .innerJoin(medicines, eq(saleItems.medicineId, medicines.id))
      .where(eq(saleItems.saleId, sale.id));

    const itemsWithAllocations: SalesDetailResponse['items'] = [];

    for (const { item, medicineName, medicineSku, baseUnit } of itemRows) {
      const allocations = await this.db
        .select()
        .from(saleItemBatchAllocations)
        .where(eq(saleItemBatchAllocations.saleItemId, item.id));

      itemsWithAllocations.push({
        id: item.id,
        medicineId: item.medicineId,
        medicineName,
        medicineSku,
        baseUnit,
        uomUnitName: item.uomUnitName,
        qtyInUom: item.qtyInUom,
        multiplierToBase: item.multiplierToBase,
        totalBaseQty: item.totalBaseQty,
        unitSellingPrice: item.unitSellingPrice,
        subtotal: item.subtotal,
        batchAllocations: allocations.map((a) => ({
          id: a.id,
          batchId: a.batchId,
          batchNumber: a.batchNumberSnapshot,
          expiryDate: a.expiryDateSnapshot,
          allocatedBaseQty: a.allocatedBaseQty,
          unitCostPrice: Number(a.unitCostPriceSnapshot).toFixed(4),
        })),
      });
    }

    return {
      id: sale.id,
      receiptNumber: sale.receiptNumber,
      cashierId: sale.cashierId,
      cashierName: cashierFullName,
      pricingTier: sale.pricingTier,
      customerName: sale.customerName,
      paymentMethod: sale.paymentMethod,
      totalAmount: sale.totalAmount,
      amountPaid: sale.amountPaid,
      changeAmount: sale.changeAmount,
      createdAt: sale.createdAt.toISOString(),
      items: itemsWithAllocations,
    };
  }
}
