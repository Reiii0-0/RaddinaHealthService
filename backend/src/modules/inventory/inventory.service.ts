import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import {
  BatchExpiryStatus,
  BatchStockItemDto,
  PaginatedResponse,
  StockCardEntryDto,
  StockMovementType,
} from '@shared/api-contracts';
import { DRIZZLE_DB, DrizzleDB } from '../../db';
import {
  medicineBatches,
  medicines,
  stockCards,
  suppliers,
  users,
} from '../../db/schema';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ListBatchesQuery {
  medicineId?: string;
  status?: string;
  expiryStatus?: string;
  search?: string;
}

export interface ListStockCardsQuery {
  medicineId?: string;
  batchId?: string;
  movementType?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class InventoryService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  private computeExpiryStatus(daysUntilExpiry: number): BatchExpiryStatus {
    if (daysUntilExpiry <= 0) {
      return 'EXPIRED';
    }
    if (daysUntilExpiry <= 90) {
      return 'NEAR_EXPIRY';
    }
    return 'ACTIVE';
  }

  async findBatches(query: ListBatchesQuery): Promise<BatchStockItemDto[]> {
    const conditions: any[] = [];

    if (query.medicineId && query.medicineId.trim().length > 0) {
      const medId = query.medicineId.trim();
      if (!UUID_REGEX.test(medId)) {
        return [];
      }
      conditions.push(eq(medicineBatches.medicineId, medId));
    }

    if (query.search && query.search.trim().length > 0) {
      const pattern = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(medicineBatches.batchNumber, pattern),
          ilike(medicines.name, pattern),
          ilike(medicines.sku, pattern),
          ilike(suppliers.name, pattern),
        ),
      );
    }

    const requestedStatus = (query.status || query.expiryStatus || '')
      .trim()
      .toUpperCase();

    if (requestedStatus === 'EXPIRED') {
      conditions.push(
        sql`(${medicineBatches.expiryDate}::date - CURRENT_DATE)::int <= 0`,
      );
    } else if (requestedStatus === 'NEAR_EXPIRY') {
      conditions.push(
        sql`(${medicineBatches.expiryDate}::date - CURRENT_DATE)::int BETWEEN 1 AND 90`,
      );
    } else if (requestedStatus === 'ACTIVE') {
      conditions.push(
        sql`(${medicineBatches.expiryDate}::date - CURRENT_DATE)::int > 90`,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await this.db
      .select({
        batch: medicineBatches,
        medicineName: medicines.name,
        medicineSku: medicines.sku,
        baseUnit: medicines.baseUnit,
        supplierName: suppliers.name,
        daysUntilExpiry: sql<number>`(${medicineBatches.expiryDate}::date - CURRENT_DATE)::int`,
      })
      .from(medicineBatches)
      .innerJoin(medicines, eq(medicineBatches.medicineId, medicines.id))
      .innerJoin(suppliers, eq(medicineBatches.supplierId, suppliers.id))
      .where(whereClause)
      .orderBy(
        asc(medicineBatches.expiryDate),
        asc(medicineBatches.createdAt),
      );

    return rows.map(
      ({
        batch,
        medicineName,
        medicineSku,
        baseUnit,
        supplierName,
        daysUntilExpiry,
      }) => {
        const days = Number(daysUntilExpiry);
        return {
          id: batch.id,
          medicineId: batch.medicineId,
          medicineName,
          medicineSku,
          baseUnit,
          supplierId: batch.supplierId,
          supplierName,
          batchNumber: batch.batchNumber,
          expiryDate: batch.expiryDate,
          daysUntilExpiry: days,
          expiryStatus: this.computeExpiryStatus(days),
          initialStock: batch.initialStock,
          currentStock: batch.currentStock,
          costPricePerBaseUnit: Number(batch.costPricePerBaseUnit).toFixed(4),
        };
      },
    );
  }

  async findStockCards(
    query: ListStockCardsQuery,
  ): Promise<PaginatedResponse<StockCardEntryDto>> {
    const rawPage = Number(query.page ?? 1);
    const rawLimit = Number(query.limit ?? 30);
    const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
    const limit =
      Number.isFinite(rawLimit) && rawLimit >= 1
        ? Math.min(Math.floor(rawLimit), 100)
        : 30;
    const offset = (page - 1) * limit;

    const conditions: any[] = [];

    if (query.medicineId && query.medicineId.trim().length > 0) {
      const medId = query.medicineId.trim();
      if (!UUID_REGEX.test(medId)) {
        return {
          items: [],
          meta: { page, limit, totalItems: 0, totalPages: 0 },
        };
      }
      conditions.push(eq(stockCards.medicineId, medId));
    }

    if (query.batchId && query.batchId.trim().length > 0) {
      const bId = query.batchId.trim();
      if (!UUID_REGEX.test(bId)) {
        return {
          items: [],
          meta: { page, limit, totalItems: 0, totalPages: 0 },
        };
      }
      conditions.push(eq(stockCards.batchId, bId));
    }

    if (
      query.movementType &&
      ['IN_INVOICE', 'OUT_SALE', 'ADJUSTMENT'].includes(
        query.movementType.trim().toUpperCase(),
      )
    ) {
      conditions.push(
        eq(
          stockCards.movementType,
          query.movementType.trim().toUpperCase() as StockMovementType,
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ totalCount }] = await this.db
      .select({ totalCount: count() })
      .from(stockCards)
      .where(whereClause);

    const totalItems = Number(totalCount ?? 0);
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);

    const rows = await this.db
      .select({
        card: stockCards,
        medicineName: medicines.name,
        baseUnit: medicines.baseUnit,
        batchNumber: medicineBatches.batchNumber,
        actorFullName: users.fullName,
      })
      .from(stockCards)
      .innerJoin(medicines, eq(stockCards.medicineId, medicines.id))
      .innerJoin(medicineBatches, eq(stockCards.batchId, medicineBatches.id))
      .innerJoin(users, eq(stockCards.actorUserId, users.id))
      .where(whereClause)
      .orderBy(desc(stockCards.createdAt))
      .limit(limit)
      .offset(offset);

    const items: StockCardEntryDto[] = rows.map(
      ({ card, medicineName, baseUnit, batchNumber, actorFullName }) => ({
        id: card.id,
        medicineId: card.medicineId,
        medicineName,
        baseUnit,
        batchId: card.batchId,
        batchNumber,
        actorUserId: card.actorUserId,
        actorFullName,
        movementType: card.movementType as StockMovementType,
        referenceId: card.referenceId,
        qtyChange: card.qtyChange,
        balanceAfter: card.balanceAfter,
        notes: card.notes ?? null,
        createdAt: card.createdAt.toISOString(),
      }),
    );

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
}
