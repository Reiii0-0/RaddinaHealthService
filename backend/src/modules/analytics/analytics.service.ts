import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { ParetoItemAnalyticsDto } from '@shared/api-contracts';
import { DRIZZLE_DB, DrizzleDB } from '../../db';
import { medicines } from '../../db/schema';
import { ParetoEngine } from './pareto.engine';

export interface ParetoRecalculateResponse {
  message: string;
  updatedCount: number;
  summary: {
    classA: number;
    classB: number;
    classC: number;
  };
  items: ParetoItemAnalyticsDto[];
}

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    private readonly paretoEngine: ParetoEngine,
  ) {}

  /**
   * Mengambil daftar peringkat analitik Pareto ABC seluruh obat aktif.
   */
  async getParetoAnalytics(days = 90): Promise<ParetoItemAnalyticsDto[]> {
    return this.paretoEngine.calculatePareto({ days });
  }

  /**
   * Menghitung ulang klasifikasi Pareto ABC berdasarkan omzet 90 hari terakhir,
   * lalu memperbarui kolom medicines.pareto_class di basis data secara massal.
   */
  async recalculateAndPersistPareto(
    days = 90,
  ): Promise<ParetoRecalculateResponse> {
    const items = await this.paretoEngine.calculatePareto({ days });

    let classA = 0;
    let classB = 0;
    let classC = 0;

    await this.db.transaction(async (tx) => {
      for (const item of items) {
        if (item.paretoClass === 'A') classA++;
        else if (item.paretoClass === 'B') classB++;
        else classC++;

        await tx
          .update(medicines)
          .set({ paretoClass: item.paretoClass })
          .where(eq(medicines.id, item.medicineId));
      }
    });

    const summary = { classA, classB, classC };

    return {
      message: `Kalkulasi ulang klasifikasi Pareto ABC berhasil diselesaikan untuk ${items.length} obat aktif. Hasil pembaruan database mencatat ${classA} obat dalam Kelas A, ${classB} obat dalam Kelas B, dan ${classC} obat dalam Kelas C berdasarkan kontribusi omzet penjualan apotek.`,
      updatedCount: items.length,
      summary,
      items,
    };
  }
}
