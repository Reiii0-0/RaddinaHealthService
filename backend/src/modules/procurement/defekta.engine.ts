import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gt, gte, sql } from 'drizzle-orm';
import { DefektaItemDto } from '@shared/api-contracts';
import { DRIZZLE_DB, DrizzleDB } from '../../db';
import {
  medicineBatches,
  medicines,
  pbfInvoiceItems,
  pbfInvoices,
  saleItems,
  salesTransactions,
  suppliers,
} from '../../db/schema';

@Injectable()
export class DefektaEngine {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  /**
   * Menghitung daftar buku Defekta otomatis dan rekomendasi pemasok PBF termurah
   * sesuai spesifikasi matematika Reorder Point (ROP).
   */
  async calculateDefektaList(): Promise<DefektaItemDto[]> {
    // 1. Ambil seluruh obat aktif dari katalog master
    const activeMedicines = await this.db
      .select({
        id: medicines.id,
        sku: medicines.sku,
        name: medicines.name,
        activeIngredient: medicines.activeIngredient,
        baseUnit: medicines.baseUnit,
        paretoClass: medicines.paretoClass,
        minStockBaseUnit: medicines.minStockBaseUnit,
      })
      .from(medicines)
      .where(eq(medicines.isActive, true))
      .orderBy(asc(medicines.name));

    if (activeMedicines.length === 0) {
      return [];
    }

    // 2. Kuantitas terjual dalam 30 hari terakhir (Q_{m, 30})
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const salesRows = await this.db
      .select({
        medicineId: saleItems.medicineId,
        soldLast30DaysBase: sql<number>`COALESCE(SUM(${saleItems.totalBaseQty}), 0)`,
      })
      .from(saleItems)
      .innerJoin(
        salesTransactions,
        eq(saleItems.saleId, salesTransactions.id),
      )
      .where(gte(salesTransactions.createdAt, thirtyDaysAgo))
      .groupBy(saleItems.medicineId);

    const salesMap = new Map<string, number>();
    for (const row of salesRows) {
      salesMap.set(row.medicineId, Number(row.soldLast30DaysBase) || 0);
    }

    // 3. Stok aktif saat ini yang layak jual (currentStock > 0 dan expiryDate > CURRENT_DATE)
    const stockRows = await this.db
      .select({
        medicineId: medicineBatches.medicineId,
        currentActiveStock: sql<number>`COALESCE(SUM(${medicineBatches.currentStock}), 0)`,
      })
      .from(medicineBatches)
      .where(
        and(
          gt(medicineBatches.currentStock, 0),
          sql`${medicineBatches.expiryDate}::date > CURRENT_DATE`,
        ),
      )
      .groupBy(medicineBatches.medicineId);

    const stockMap = new Map<string, number>();
    for (const row of stockRows) {
      stockMap.set(row.medicineId, Number(row.currentActiveStock) || 0);
    }

    // 4. Periksa syarat masuk Buku Defekta untuk setiap obat
    const defektaCandidates: Array<{
      med: (typeof activeMedicines)[0];
      soldLast30Days: number;
      avgDailyConsumption: number;
      currentActiveStock: number;
      reorderPointRop: number;
      recommendedOrderQty: number;
    }> = [];

    for (const med of activeMedicines) {
      const sold30 = salesMap.get(med.id) ?? 0;
      const avgDaily = sold30 / 30;
      const minStock = med.minStockBaseUnit;
      const currentStock = stockMap.get(med.id) ?? 0;

      // ROP_m = max(M_m, ceil(7 * d_bar_m))
      const rop = Math.max(minStock, Math.ceil(7 * avgDaily));

      // Syarat masuk buku Defekta ketat: ROP_m > 0 AND S_m^aktif <= ROP_m
      if (rop > 0 && currentStock <= rop) {
        // Q_target = max(2 * M_m, ceil(14 * d_bar_m))
        const qTarget = Math.max(2 * minStock, Math.ceil(14 * avgDaily));
        // Q_order = max(1, Q_target - S_m^aktif)
        const qOrder = Math.max(1, qTarget - currentStock);

        defektaCandidates.push({
          med,
          soldLast30Days: sold30,
          avgDailyConsumption: Math.round(avgDaily * 100) / 100,
          currentActiveStock: currentStock,
          reorderPointRop: rop,
          recommendedOrderQty: qOrder,
        });
      }
    }

    // 5. Cari rekomendasi PBF termurah untuk setiap kandidat Defekta
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const result: DefektaItemDto[] = [];

    for (const candidate of defektaCandidates) {
      const {
        med,
        soldLast30Days,
        avgDailyConsumption,
        currentActiveStock,
        reorderPointRop,
        recommendedOrderQty,
      } = candidate;

      // Kueri PBF dalam 90 hari terakhir
      let supplierRows = await this.db
        .select({
          supplierId: suppliers.id,
          supplierName: suppliers.name,
          supplierEmail: suppliers.email,
          costPricePerBaseUnit: pbfInvoiceItems.costPricePerBaseUnit,
          invoiceDate: pbfInvoices.invoiceDate,
        })
        .from(pbfInvoiceItems)
        .innerJoin(
          pbfInvoices,
          eq(pbfInvoiceItems.invoiceId, pbfInvoices.id),
        )
        .innerJoin(suppliers, eq(pbfInvoices.supplierId, suppliers.id))
        .where(
          and(
            eq(pbfInvoiceItems.medicineId, med.id),
            eq(suppliers.isActive, true),
            gte(pbfInvoices.invoiceDate, ninetyDaysAgo.toISOString().slice(0, 10)),
          ),
        )
        .orderBy(
          asc(pbfInvoiceItems.costPricePerBaseUnit),
          desc(pbfInvoices.invoiceDate),
        )
        .limit(1);

      // Jika belum pernah dibeli dalam 90 hari terakhir, perluas pencarian ke seluruh riwayat faktur
      if (supplierRows.length === 0) {
        supplierRows = await this.db
          .select({
            supplierId: suppliers.id,
            supplierName: suppliers.name,
            supplierEmail: suppliers.email,
            costPricePerBaseUnit: pbfInvoiceItems.costPricePerBaseUnit,
            invoiceDate: pbfInvoices.invoiceDate,
          })
          .from(pbfInvoiceItems)
          .innerJoin(
            pbfInvoices,
            eq(pbfInvoiceItems.invoiceId, pbfInvoices.id),
          )
          .innerJoin(suppliers, eq(pbfInvoices.supplierId, suppliers.id))
          .where(
            and(
              eq(pbfInvoiceItems.medicineId, med.id),
              eq(suppliers.isActive, true),
            ),
          )
          .orderBy(
            asc(pbfInvoiceItems.costPricePerBaseUnit),
            desc(pbfInvoices.invoiceDate),
          )
          .limit(1);
      }

      const recommendedSupplier =
        supplierRows.length > 0
          ? {
              supplierId: supplierRows[0].supplierId,
              supplierName: supplierRows[0].supplierName,
              supplierEmail: supplierRows[0].supplierEmail,
              lowestCostPerBaseUnit: Number(
                supplierRows[0].costPricePerBaseUnit,
              ).toFixed(4),
              lastInvoiceDate: supplierRows[0].invoiceDate,
            }
          : null;

      result.push({
        medicineId: med.id,
        sku: med.sku,
        name: med.name,
        activeIngredient: med.activeIngredient,
        baseUnit: med.baseUnit,
        paretoClass: med.paretoClass,
        currentActiveStock,
        minStockBaseUnit: med.minStockBaseUnit,
        soldLast30DaysBase: soldLast30Days,
        avgDailyConsumption,
        reorderPointRop,
        recommendedOrderQty,
        recommendedSupplier,
      });
    }

    return result;
  }
}
