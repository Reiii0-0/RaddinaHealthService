import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, sql } from 'drizzle-orm';
import { ParetoClass, ParetoItemAnalyticsDto } from '@shared/api-contracts';
import { DRIZZLE_DB, DrizzleDB } from '../../db';
import {
  medicines,
  saleItems,
  salesTransactions,
} from '../../db/schema';

export interface ParetoCalculationOptions {
  days?: number;
  startDate?: Date;
  endDate?: Date;
}

@Injectable()
export class ParetoEngine {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  /**
   * Menghitung klasifikasi Pareto ABC 80/20 bebas cacat batas atas.
   * Menggunakan C_{k-1} < 0.80 untuk memastikan item peringkat pertama dengan omzet >80% selalu masuk Kelas A.
   */
  async calculatePareto(
    options: ParetoCalculationOptions = {},
  ): Promise<ParetoItemAnalyticsDto[]> {
    const days = options.days ?? 90;
    const sinceDate =
      options.startDate ?? new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // 1. Ambil seluruh obat aktif dari katalog master
    const allMedicines = await this.db
      .select({
        id: medicines.id,
        sku: medicines.sku,
        name: medicines.name,
        activeIngredient: medicines.activeIngredient,
        baseUnit: medicines.baseUnit,
        currentParetoClass: medicines.paretoClass,
      })
      .from(medicines)
      .where(eq(medicines.isActive, true));

    if (allMedicines.length === 0) {
      return [];
    }

    // 2. Ambil agregat penjualan per obat pada rentang waktu analisis
    const salesAggregate = await this.db
      .select({
        medicineId: saleItems.medicineId,
        totalRevenue: sql<number>`COALESCE(SUM(${saleItems.subtotal}), 0)`,
        totalQtySoldBase: sql<number>`COALESCE(SUM(${saleItems.totalBaseQty}), 0)`,
      })
      .from(saleItems)
      .innerJoin(
        salesTransactions,
        eq(saleItems.saleId, salesTransactions.id),
      )
      .where(gte(salesTransactions.createdAt, sinceDate))
      .groupBy(saleItems.medicineId);

    // Petakan agregat berdasarkan medicineId
    const salesMap = new Map<
      string,
      { totalRevenue: number; totalQtySoldBase: number }
    >();
    for (const row of salesAggregate) {
      salesMap.set(row.medicineId, {
        totalRevenue: Number(row.totalRevenue) || 0,
        totalQtySoldBase: Number(row.totalQtySoldBase) || 0,
      });
    }

    // 3. Gabungkan data obat dengan data penjualan
    const rawItems = allMedicines.map((med) => {
      const sales = salesMap.get(med.id) ?? {
        totalRevenue: 0,
        totalQtySoldBase: 0,
      };
      return {
        medicineId: med.id,
        sku: med.sku,
        name: med.name,
        activeIngredient: med.activeIngredient,
        baseUnit: med.baseUnit,
        totalRevenue: sales.totalRevenue,
        totalQtySoldBase: sales.totalQtySoldBase,
      };
    });

    // 4. Urutkan seluruh obat secara menurun berdasarkan total omzet (R_{(k)}),
    // pemecah seri: total kuantitas terjual menurun, lalu SKU menaik
    rawItems.sort((a, b) => {
      if (b.totalRevenue !== a.totalRevenue) {
        return b.totalRevenue - a.totalRevenue;
      }
      if (b.totalQtySoldBase !== a.totalQtySoldBase) {
        return b.totalQtySoldBase - a.totalQtySoldBase;
      }
      return a.sku.localeCompare(b.sku);
    });

    // 5. Hitung total omzet apotek: R_total = sum(R_m)
    const totalRevenueSum = rawItems.reduce(
      (sum, item) => sum + item.totalRevenue,
      0,
    );

    // 6. Terapkan algoritma Pareto ABC
    const result: ParetoItemAnalyticsDto[] = [];
    let cumulativeSum = 0;

    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i];
      const rank = i + 1;

      if (totalRevenueSum === 0 || item.totalRevenue === 0) {
        // Jika tidak ada penjualan sama sekali atau omzet item 0, masuk kelas C
        result.push({
          rank,
          medicineId: item.medicineId,
          sku: item.sku,
          name: item.name,
          activeIngredient: item.activeIngredient,
          baseUnit: item.baseUnit,
          totalQtySoldBase: item.totalQtySoldBase,
          totalRevenue: item.totalRevenue,
          revenueShareRatio: 0,
          cumulativeShareBefore: 0,
          cumulativeShareAfter: 0,
          paretoClass: 'C',
        });
      } else {
        const shareRatio = item.totalRevenue / totalRevenueSum;
        const cumulativeShareBefore = cumulativeSum;
        const cumulativeShareAfter = cumulativeSum + shareRatio;

        let paretoClass: ParetoClass = 'C';
        if (item.totalRevenue > 0 && cumulativeShareBefore < 0.8) {
          paretoClass = 'A';
        } else if (
          item.totalRevenue > 0 &&
          cumulativeShareBefore >= 0.8 &&
          cumulativeShareBefore < 0.95
        ) {
          paretoClass = 'B';
        } else {
          paretoClass = 'C';
        }

        cumulativeSum = cumulativeShareAfter;

        result.push({
          rank,
          medicineId: item.medicineId,
          sku: item.sku,
          name: item.name,
          activeIngredient: item.activeIngredient,
          baseUnit: item.baseUnit,
          totalQtySoldBase: item.totalQtySoldBase,
          totalRevenue: item.totalRevenue,
          revenueShareRatio: Math.round(shareRatio * 10000) / 10000,
          cumulativeShareBefore:
            Math.round(cumulativeShareBefore * 10000) / 10000,
          cumulativeShareAfter:
            Math.round(cumulativeShareAfter * 10000) / 10000,
          paretoClass,
        });
      }
    }

    return result;
  }
}
