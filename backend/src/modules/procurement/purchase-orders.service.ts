import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { JwtUserPayload } from '../../common';
import { DRIZZLE_DB, DrizzleDB } from '../../db';
import {
  medicines,
  purchaseOrderItems,
  purchaseOrders,
  suppliers,
  users,
} from '../../db/schema';
import { MailService, PurchaseOrderEmailPayload } from '../mail/mail.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';

export interface PurchaseOrderDetailDto {
  id: string;
  spNumber: string;
  supplierId: string;
  supplierName: string;
  supplierEmail: string;
  supplierAddress: string;
  supplierPhone: string;
  pharmacistId: string;
  pharmacistName: string;
  pharmacistSipaSnapshot: string;
  status: string;
  emailSentAt: string | null;
  notes: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    medicineId: string;
    medicineName: string;
    medicineSku: string;
    activeIngredient: string;
    baseUnit: string;
    orderedBaseQty: number;
    estimatedUnitCost: string | null;
  }>;
}

@Injectable()
export class PurchaseOrdersService {
  private readonly logger = new Logger(PurchaseOrdersService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    private readonly mailService: MailService,
  ) {}

  /**
   * Menerbitkan Surat Pesanan Elektronik (SP-el) resmi apotek, memvalidasi SIPA Apoteker,
   * menyimpan entitas pesanan ke basis data, dan memicu pengiriman email ke PBF tujuan.
   */
  async createPurchaseOrder(
    dto: CreatePurchaseOrderDto,
    pharmacist: JwtUserPayload,
  ): Promise<PurchaseOrderDetailDto> {
    // 1. Validasi keberadaan dan status aktif pemasok PBF
    const supplierRows = await this.db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.id, dto.supplierId), eq(suppliers.isActive, true)))
      .limit(1);

    if (supplierRows.length === 0) {
      throw new NotFoundException(
        `Pencarian Pedagang Besar Farmasi gagal. Pemasok PBF dengan ID ${dto.supplierId} tidak ditemukan dalam database atau telah dinonaktifkan. Silakan pilih pemasok PBF aktif dari daftar rekanan resmi.`,
      );
    }

    const supplier = supplierRows[0];

    // 2. Validasi kelayakan nomor SIPA apoteker pembuat
    const trimmedSipa = pharmacist.noSipa?.trim();
    if (!trimmedSipa) {
      throw new BadRequestException(
        `Penerbitan Surat Pesanan gagal divalidasi. Apoteker ${pharmacist.fullName} belum memiliki nomor SIPA yang tercatat pada profil akun. Sesuai regulasi kefarmasian, setiap SP-el wajib memuat nomor SIPA Apoteker Penanggung Jawab aktif.`,
      );
    }

    // 3. Validasi keberadaan obat yang dipesan
    const medicineIds = dto.items.map((i) => i.medicineId);
    const existingMedicines = await this.db
      .select()
      .from(medicines)
      .where(inArray(medicines.id, medicineIds));

    if (existingMedicines.length !== medicineIds.length) {
      throw new NotFoundException(
        `Validasi daftar obat pesanan gagal. Terdapat satu atau lebih item obat yang tidak ditemukan dalam katalog master apotek. Silakan periksa kembali daftar item obat yang dipilih.`,
      );
    }

    // 4. Pembentukan nomor urut SP unik: SP-YYYY-XXXX
    const currentYear = new Date().getFullYear();
    const countRows = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(purchaseOrders)
      .where(sql`EXTRACT(YEAR FROM ${purchaseOrders.createdAt}) = ${currentYear}`);

    const seqNumber = (countRows[0]?.total ?? 0) + 1;
    const spNumber = `SP-${currentYear}-${String(seqNumber).padStart(4, '0')}`;

    // 5. Simpan SP dan item di dalam transaksi database
    const createdPoId = await this.db.transaction(async (tx) => {
      const [insertedPo] = await tx
        .insert(purchaseOrders)
        .values({
          spNumber,
          supplierId: dto.supplierId,
          pharmacistId: pharmacist.id,
          pharmacistSipaSnapshot: trimmedSipa,
          status: 'ISSUED',
          notes: dto.notes?.trim() || null,
        })
        .returning();

      for (const item of dto.items) {
        await tx.insert(purchaseOrderItems).values({
          purchaseOrderId: insertedPo.id,
          medicineId: item.medicineId,
          orderedBaseQty: item.orderedBaseQty,
          estimatedUnitCost: item.estimatedUnitCost || null,
        });
      }

      return insertedPo.id;
    });

    // 6. Ambil data lengkap PO untuk pengiriman email
    const poDetails = await this.findOnePurchaseOrder(createdPoId);

    // 7. Kirim email SP-el resmi ke supplier PBF
    try {
      const emailPayload: PurchaseOrderEmailPayload = {
        id: poDetails.id,
        spNumber: poDetails.spNumber,
        supplierId: poDetails.supplierId,
        supplierName: poDetails.supplierName,
        supplierEmail: poDetails.supplierEmail,
        supplierAddress: poDetails.supplierAddress,
        supplierPhone: poDetails.supplierPhone,
        pharmacistId: poDetails.pharmacistId,
        pharmacistName: poDetails.pharmacistName,
        pharmacistSipaSnapshot: poDetails.pharmacistSipaSnapshot,
        status: poDetails.status,
        notes: poDetails.notes,
        createdAt: poDetails.createdAt,
        items: poDetails.items.map((it) => ({
          medicineId: it.medicineId,
          medicineName: it.medicineName,
          medicineSku: it.medicineSku,
          activeIngredient: it.activeIngredient,
          baseUnit: it.baseUnit,
          orderedBaseQty: it.orderedBaseQty,
          estimatedUnitCost: it.estimatedUnitCost,
        })),
      };

      await this.mailService.sendPurchaseOrderEmail(emailPayload);

      // Pembaruan status SP menjadi SENT_EMAIL
      await this.db
        .update(purchaseOrders)
        .set({
          status: 'SENT_EMAIL',
          emailSentAt: new Date(),
        })
        .where(eq(purchaseOrders.id, createdPoId));

      poDetails.status = 'SENT_EMAIL';
      poDetails.emailSentAt = new Date().toISOString();
    } catch (err) {
      this.logger.error(
        `Surat pesanan ${spNumber} tersimpan di basis data tetapi pengiriman email ke ${supplier.email} mengalami kendala: ${(err as Error).message}`,
      );
      // Status tetap ISSUED jika SMTP mengalami galat
    }

    return poDetails;
  }

  /**
   * Mengambil daftar seluruh Surat Pesanan Elektronik yang terbit diurutkan dari yang terbaru.
   */
  async findAllPurchaseOrders(): Promise<PurchaseOrderDetailDto[]> {
    const poRows = await this.db
      .select({
        po: purchaseOrders,
        supplierName: suppliers.name,
        supplierEmail: suppliers.email,
        supplierAddress: suppliers.address,
        supplierPhone: suppliers.phone,
        pharmacistName: users.fullName,
      })
      .from(purchaseOrders)
      .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .innerJoin(users, eq(purchaseOrders.pharmacistId, users.id))
      .orderBy(desc(purchaseOrders.createdAt));

    const results: PurchaseOrderDetailDto[] = [];

    for (const row of poRows) {
      const items = await this.db
        .select({
          item: purchaseOrderItems,
          medicineName: medicines.name,
          medicineSku: medicines.sku,
          activeIngredient: medicines.activeIngredient,
          baseUnit: medicines.baseUnit,
        })
        .from(purchaseOrderItems)
        .innerJoin(medicines, eq(purchaseOrderItems.medicineId, medicines.id))
        .where(eq(purchaseOrderItems.purchaseOrderId, row.po.id));

      results.push({
        id: row.po.id,
        spNumber: row.po.spNumber,
        supplierId: row.po.supplierId,
        supplierName: row.supplierName,
        supplierEmail: row.supplierEmail,
        supplierAddress: row.supplierAddress,
        supplierPhone: row.supplierPhone,
        pharmacistId: row.po.pharmacistId,
        pharmacistName: row.pharmacistName,
        pharmacistSipaSnapshot: row.po.pharmacistSipaSnapshot,
        status: row.po.status,
        emailSentAt: row.po.emailSentAt?.toISOString() ?? null,
        notes: row.po.notes,
        createdAt: row.po.createdAt.toISOString(),
        items: items.map(
          ({
            item,
            medicineName,
            medicineSku,
            activeIngredient,
            baseUnit,
          }) => ({
            id: item.id,
            medicineId: item.medicineId,
            medicineName,
            medicineSku,
            activeIngredient,
            baseUnit,
            orderedBaseQty: item.orderedBaseQty,
            estimatedUnitCost: item.estimatedUnitCost
              ? Number(item.estimatedUnitCost).toFixed(4)
              : null,
          }),
        ),
      });
    }

    return results;
  }

  /**
   * Mengambil rincian satu Surat Pesanan Elektronik berdasarkan ID.
   */
  async findOnePurchaseOrder(id: string): Promise<PurchaseOrderDetailDto> {
    const poRows = await this.db
      .select({
        po: purchaseOrders,
        supplierName: suppliers.name,
        supplierEmail: suppliers.email,
        supplierAddress: suppliers.address,
        supplierPhone: suppliers.phone,
        pharmacistName: users.fullName,
      })
      .from(purchaseOrders)
      .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .innerJoin(users, eq(purchaseOrders.pharmacistId, users.id))
      .where(eq(purchaseOrders.id, id))
      .limit(1);

    if (poRows.length === 0) {
      throw new NotFoundException(
        `Pencarian Surat Pesanan gagal. Surat Pesanan dengan ID ${id} tidak ditemukan pada catatan sistem apotek. Silakan periksa kembali daftar arsip pengadaan.`,
      );
    }

    const row = poRows[0];

    const items = await this.db
      .select({
        item: purchaseOrderItems,
        medicineName: medicines.name,
        medicineSku: medicines.sku,
        activeIngredient: medicines.activeIngredient,
        baseUnit: medicines.baseUnit,
      })
      .from(purchaseOrderItems)
      .innerJoin(medicines, eq(purchaseOrderItems.medicineId, medicines.id))
      .where(eq(purchaseOrderItems.purchaseOrderId, row.po.id));

    return {
      id: row.po.id,
      spNumber: row.po.spNumber,
      supplierId: row.po.supplierId,
      supplierName: row.supplierName,
      supplierEmail: row.supplierEmail,
      supplierAddress: row.supplierAddress,
      supplierPhone: row.supplierPhone,
      pharmacistId: row.po.pharmacistId,
      pharmacistName: row.pharmacistName,
      pharmacistSipaSnapshot: row.po.pharmacistSipaSnapshot,
      status: row.po.status,
      emailSentAt: row.po.emailSentAt?.toISOString() ?? null,
      notes: row.po.notes,
      createdAt: row.po.createdAt.toISOString(),
      items: items.map(
        ({
          item,
          medicineName,
          medicineSku,
          activeIngredient,
          baseUnit,
        }) => ({
          id: item.id,
          medicineId: item.medicineId,
          medicineName,
          medicineSku,
          activeIngredient,
          baseUnit,
          orderedBaseQty: item.orderedBaseQty,
          estimatedUnitCost: item.estimatedUnitCost
            ? Number(item.estimatedUnitCost).toFixed(4)
            : null,
        }),
      ),
    };
  }
}
