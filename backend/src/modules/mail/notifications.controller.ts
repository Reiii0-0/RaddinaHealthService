import {
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { and, asc, eq, gt, sql } from 'drizzle-orm';
import { BatchExpiryStatus, BatchStockItemDto } from '@shared/api-contracts';
import { CurrentUser, JwtAuthGuard, JwtUserPayload, Roles, RolesGuard } from '../../common';
import { DRIZZLE_DB, DrizzleDB } from '../../db';
import { medicineBatches, medicines, suppliers } from '../../db/schema';
import { MailService } from './mail.service';

export interface NearExpiryDigestResponse {
  message: string;
  recipientEmail: string;
  batchCount: number;
  batches: BatchStockItemDto[];
}

@Controller('api/v1/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    private readonly mailService: MailService,
  ) {}

  @Post('near-expiry-digest')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'PHARMACIST')
  async triggerNearExpiryDigest(
    @CurrentUser() user: JwtUserPayload,
    @Query('recipient') recipient?: string,
  ): Promise<NearExpiryDigestResponse> {
    const targetEmail = recipient?.trim() || user.email;

    // Ambil seluruh batch aktif yang mendekati kedaluwarsa (1 sampai 90 hari ke depan)
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
      .where(
        and(
          gt(medicineBatches.currentStock, 0),
          sql`(${medicineBatches.expiryDate}::date - CURRENT_DATE)::int BETWEEN 1 AND 90`,
        ),
      )
      .orderBy(asc(medicineBatches.expiryDate), asc(medicineBatches.createdAt));

    const batches: BatchStockItemDto[] = rows.map(
      ({
        batch,
        medicineName,
        medicineSku,
        baseUnit,
        supplierName,
        daysUntilExpiry,
      }) => {
        const days = Number(daysUntilExpiry);
        const expiryStatus: BatchExpiryStatus =
          days <= 0 ? 'EXPIRED' : days <= 90 ? 'NEAR_EXPIRY' : 'ACTIVE';

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
          expiryStatus,
          initialStock: batch.initialStock,
          currentStock: batch.currentStock,
          costPricePerBaseUnit: Number(batch.costPricePerBaseUnit).toFixed(4),
        };
      },
    );

    if (batches.length > 0) {
      await this.mailService.sendNearExpiryDigestEmail(targetEmail, batches);
    }

    return {
      message:
        batches.length > 0
          ? `Laporan ringkasan kedaluwarsa berhasil dikirim ke alamat email ${targetEmail}. Sebanyak ${batches.length} batch obat berstatus mendekati kedaluwarsa (< 90 hari) terdeteksi untuk diprioritaskan alokasi FEFO.`
          : `Pemeriksaan stok obat selesai. Tidak ditemukan batch obat yang mendekati kedaluwarsa (< 90 hari) pada sistem saat ini.`,
      recipientEmail: targetEmail,
      batchCount: batches.length,
      batches,
    };
  }
}
