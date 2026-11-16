import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, ilike, inArray } from 'drizzle-orm';
import * as fs from 'fs';
import { PaymentStatus } from '@shared/api-contracts';
import { JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { DRIZZLE_DB, DrizzleDB } from '../../db';
import {
  medicineBatches,
  medicines,
  medicineUomConversions,
  pbfInvoiceItems,
  pbfInvoices,
  stockCards,
  suppliers,
  users,
} from '../../db/schema';
import { CreateInvoiceDto } from './dto/create-invoice.dto';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PbfInvoiceItemDetailDto {
  id: string;
  invoiceId: string;
  medicineId: string;
  medicineName: string;
  medicineSku: string;
  baseUnit: string;
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  uomUnitName: string;
  qtyInUom: number;
  multiplierToBase: number;
  receivedBaseQty: number;
  purchasePricePerUom: number;
  costPricePerBaseUnit: string;
  lineTotal: number;
}

export interface PbfInvoiceDetailDto {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  supplierCode: string;
  receivedByUserId: string;
  receivedByFullName: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  scanFilePath: string | null;
  paymentStatus: PaymentStatus;
  notes: string | null;
  createdAt: string;
  items: PbfInvoiceItemDetailDto[];
}

export interface ListInvoicesQuery {
  supplierId?: string;
  paymentStatus?: string;
}

@Injectable()
export class InvoicesService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  async findAll(query?: ListInvoicesQuery): Promise<PbfInvoiceDetailDto[]> {
    const conditions: any[] = [];

    if (query?.supplierId && query.supplierId.trim().length > 0) {
      const supId = query.supplierId.trim();
      if (!UUID_REGEX.test(supId)) {
        return [];
      }
      conditions.push(eq(pbfInvoices.supplierId, supId));
    }

    if (
      query?.paymentStatus &&
      ['UNPAID', 'PAID'].includes(query.paymentStatus.trim().toUpperCase())
    ) {
      conditions.push(
        eq(
          pbfInvoices.paymentStatus,
          query.paymentStatus.trim().toUpperCase() as PaymentStatus,
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const invoiceRows = await this.db
      .select({
        invoice: pbfInvoices,
        supplierName: suppliers.name,
        supplierCode: suppliers.code,
        receivedByFullName: users.fullName,
      })
      .from(pbfInvoices)
      .innerJoin(suppliers, eq(pbfInvoices.supplierId, suppliers.id))
      .innerJoin(users, eq(pbfInvoices.receivedByUserId, users.id))
      .where(whereClause)
      .orderBy(desc(pbfInvoices.invoiceDate), desc(pbfInvoices.createdAt));

    if (invoiceRows.length === 0) {
      return [];
    }

    const invoiceIds = invoiceRows.map((r) => r.invoice.id);

    const itemRows = await this.db
      .select({
        item: pbfInvoiceItems,
        medicineName: medicines.name,
        medicineSku: medicines.sku,
        baseUnit: medicines.baseUnit,
      })
      .from(pbfInvoiceItems)
      .innerJoin(medicines, eq(pbfInvoiceItems.medicineId, medicines.id))
      .where(inArray(pbfInvoiceItems.invoiceId, invoiceIds));

    const itemsByInvoice = new Map<string, PbfInvoiceItemDetailDto[]>();
    for (const { item, medicineName, medicineSku, baseUnit } of itemRows) {
      const list = itemsByInvoice.get(item.invoiceId) ?? [];
      list.push({
        id: item.id,
        invoiceId: item.invoiceId,
        medicineId: item.medicineId,
        medicineName,
        medicineSku,
        baseUnit,
        batchId: item.batchId,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        uomUnitName: item.uomUnitName,
        qtyInUom: item.qtyInUom,
        multiplierToBase: item.multiplierToBase,
        receivedBaseQty: item.receivedBaseQty,
        purchasePricePerUom: item.purchasePricePerUom,
        costPricePerBaseUnit: Number(item.costPricePerBaseUnit).toFixed(4),
        lineTotal: Number(item.lineTotal),
      });
      itemsByInvoice.set(item.invoiceId, list);
    }

    return invoiceRows.map(
      ({ invoice, supplierName, supplierCode, receivedByFullName }) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        supplierId: invoice.supplierId,
        supplierName,
        supplierCode,
        receivedByUserId: invoice.receivedByUserId,
        receivedByFullName,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        totalAmount: Number(invoice.totalAmount),
        scanFilePath: invoice.scanFilePath ?? null,
        paymentStatus: invoice.paymentStatus as PaymentStatus,
        notes: invoice.notes ?? null,
        createdAt: invoice.createdAt.toISOString(),
        items: itemsByInvoice.get(invoice.id) ?? [],
      }),
    );
  }

  async findOne(id: string): Promise<PbfInvoiceDetailDto> {
    if (!id || !UUID_REGEX.test(id)) {
      throw new NotFoundException(
        `Pencarian detail faktur PBF gagal dilakukan. Identitas faktur "${id}" bukan format UUID yang sah. Silakan pilih faktur dari daftar penerimaan barang.`,
      );
    }

    const [row] = await this.db
      .select({
        invoice: pbfInvoices,
        supplierName: suppliers.name,
        supplierCode: suppliers.code,
        receivedByFullName: users.fullName,
      })
      .from(pbfInvoices)
      .innerJoin(suppliers, eq(pbfInvoices.supplierId, suppliers.id))
      .innerJoin(users, eq(pbfInvoices.receivedByUserId, users.id))
      .where(eq(pbfInvoices.id, id))
      .limit(1);

    if (!row) {
      throw new NotFoundException(
        `Pencarian detail faktur PBF gagal dilakukan. Faktur dengan ID ${id} tidak ditemukan di basis data. Silakan segarkan halaman daftar faktur PBF.`,
      );
    }

    const itemRows = await this.db
      .select({
        item: pbfInvoiceItems,
        medicineName: medicines.name,
        medicineSku: medicines.sku,
        baseUnit: medicines.baseUnit,
      })
      .from(pbfInvoiceItems)
      .innerJoin(medicines, eq(pbfInvoiceItems.medicineId, medicines.id))
      .where(eq(pbfInvoiceItems.invoiceId, id));

    const items: PbfInvoiceItemDetailDto[] = itemRows.map(
      ({ item, medicineName, medicineSku, baseUnit }) => ({
        id: item.id,
        invoiceId: item.invoiceId,
        medicineId: item.medicineId,
        medicineName,
        medicineSku,
        baseUnit,
        batchId: item.batchId,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        uomUnitName: item.uomUnitName,
        qtyInUom: item.qtyInUom,
        multiplierToBase: item.multiplierToBase,
        receivedBaseQty: item.receivedBaseQty,
        purchasePricePerUom: item.purchasePricePerUom,
        costPricePerBaseUnit: Number(item.costPricePerBaseUnit).toFixed(4),
        lineTotal: Number(item.lineTotal),
      }),
    );

    return {
      id: row.invoice.id,
      invoiceNumber: row.invoice.invoiceNumber,
      supplierId: row.invoice.supplierId,
      supplierName: row.supplierName,
      supplierCode: row.supplierCode,
      receivedByUserId: row.invoice.receivedByUserId,
      receivedByFullName: row.receivedByFullName,
      invoiceDate: row.invoice.invoiceDate,
      dueDate: row.invoice.dueDate,
      totalAmount: Number(row.invoice.totalAmount),
      scanFilePath: row.invoice.scanFilePath ?? null,
      paymentStatus: row.invoice.paymentStatus as PaymentStatus,
      notes: row.invoice.notes ?? null,
      createdAt: row.invoice.createdAt.toISOString(),
      items,
    };
  }

  async create(
    dto: CreateInvoiceDto,
    user: JwtUserPayload,
  ): Promise<PbfInvoiceDetailDto> {
    const trimmedInvoiceNumber = dto.invoiceNumber.trim();

    const [existingInvoice] = await this.db
      .select()
      .from(pbfInvoices)
      .where(ilike(pbfInvoices.invoiceNumber, trimmedInvoiceNumber))
      .limit(1);

    if (existingInvoice) {
      throw new ConflictException(
        `Pencatatan faktur PBF gagal karena nomor faktur duplikat. Faktur bernomor "${trimmedInvoiceNumber}" sudah tercatat di sistem dengan ID ${existingInvoice.id}. Silakan periksa kembali nomor faktur fisik dari pemasok.`,
      );
    }

    const [supplier] = await this.db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, dto.supplierId))
      .limit(1);

    if (!supplier) {
      throw new BadRequestException(
        `Pencatatan faktur PBF gagal diproses. Pemasok dengan ID ${dto.supplierId} tidak ditemukan di basis data. Silakan pilih pemasok PBF yang terdaftar.`,
      );
    }

    const createdInvoiceId = await this.db.transaction(async (tx) => {
      interface ResolvedInvoiceLine {
        medicineId: string;
        batchNumber: string;
        expiryDate: string;
        uomUnitName: string;
        qtyInUom: number;
        multiplierToBase: number;
        receivedBaseQty: number;
        purchasePricePerUom: number;
        costPricePerBaseUnit: string;
        lineTotal: number;
      }

      const resolvedLines: ResolvedInvoiceLine[] = [];
      let totalAmount = 0;

      for (const item of dto.items) {
        const [medicine] = await tx
          .select()
          .from(medicines)
          .where(eq(medicines.id, item.medicineId))
          .limit(1);

        if (!medicine) {
          throw new BadRequestException(
            `Pencatatan faktur PBF gagal diproses. Obat dengan ID ${item.medicineId} pada daftar barang tidak ditemukan di basis data. Silakan pilih obat yang terdaftar di katalog master.`,
          );
        }

        const requestedUnit = item.uomUnitName.trim();
        const [uom] = await tx
          .select()
          .from(medicineUomConversions)
          .where(
            and(
              eq(medicineUomConversions.medicineId, item.medicineId),
              ilike(medicineUomConversions.unitName, requestedUnit),
            ),
          )
          .limit(1);

        if (!uom) {
          throw new BadRequestException(
            `Pencatatan faktur PBF gagal diproses. Satuan "${requestedUnit}" tidak terdaftar pada konversi satuan obat "${medicine.name}" (SKU: ${medicine.sku}). Silakan gunakan satuan yang terdaftar pada obat tersebut atau tambahkan satuan baru di menu Master Obat.`,
          );
        }

        const multiplierToBase = uom.multiplierToBase;
        const receivedBaseQty = item.qtyInUom * multiplierToBase;
        const costPricePerBaseUnit = (
          item.purchasePricePerUom / multiplierToBase
        ).toFixed(4);
        const lineTotal = item.qtyInUom * item.purchasePricePerUom;

        totalAmount += lineTotal;

        resolvedLines.push({
          medicineId: item.medicineId,
          batchNumber: item.batchNumber.trim(),
          expiryDate: item.expiryDate,
          uomUnitName: uom.unitName,
          qtyInUom: item.qtyInUom,
          multiplierToBase,
          receivedBaseQty,
          purchasePricePerUom: item.purchasePricePerUom,
          costPricePerBaseUnit,
          lineTotal,
        });
      }

      const [insertedInvoice] = await tx
        .insert(pbfInvoices)
        .values({
          invoiceNumber: trimmedInvoiceNumber,
          supplierId: dto.supplierId,
          receivedByUserId: user.id,
          invoiceDate: dto.invoiceDate,
          dueDate: dto.dueDate,
          totalAmount,
          paymentStatus: dto.paymentStatus ?? 'UNPAID',
          notes: dto.notes?.trim() || null,
        })
        .returning();

      for (const line of resolvedLines) {
        const [existingBatch] = await tx
          .select()
          .from(medicineBatches)
          .where(
            and(
              eq(medicineBatches.medicineId, line.medicineId),
              eq(medicineBatches.batchNumber, line.batchNumber),
              eq(medicineBatches.supplierId, dto.supplierId),
            ),
          )
          .limit(1);

        let targetBatchId: string;
        let balanceAfter: number;

        if (!existingBatch) {
          const [createdBatch] = await tx
            .insert(medicineBatches)
            .values({
              medicineId: line.medicineId,
              supplierId: dto.supplierId,
              batchNumber: line.batchNumber,
              expiryDate: line.expiryDate,
              initialStock: line.receivedBaseQty,
              currentStock: line.receivedBaseQty,
              costPricePerBaseUnit: line.costPricePerBaseUnit,
            })
            .returning();

          targetBatchId = createdBatch.id;
          balanceAfter = createdBatch.currentStock;
        } else {
          const [updatedBatch] = await tx
            .update(medicineBatches)
            .set({
              initialStock: existingBatch.initialStock + line.receivedBaseQty,
              currentStock: existingBatch.currentStock + line.receivedBaseQty,
              costPricePerBaseUnit: line.costPricePerBaseUnit,
              expiryDate: line.expiryDate,
            })
            .where(eq(medicineBatches.id, existingBatch.id))
            .returning();

          targetBatchId = updatedBatch.id;
          balanceAfter = updatedBatch.currentStock;
        }

        await tx.insert(pbfInvoiceItems).values({
          invoiceId: insertedInvoice.id,
          medicineId: line.medicineId,
          batchId: targetBatchId,
          batchNumber: line.batchNumber,
          expiryDate: line.expiryDate,
          uomUnitName: line.uomUnitName,
          qtyInUom: line.qtyInUom,
          multiplierToBase: line.multiplierToBase,
          receivedBaseQty: line.receivedBaseQty,
          purchasePricePerUom: line.purchasePricePerUom,
          costPricePerBaseUnit: line.costPricePerBaseUnit,
          lineTotal: line.lineTotal,
        });

        await tx.insert(stockCards).values({
          medicineId: line.medicineId,
          batchId: targetBatchId,
          actorUserId: user.id,
          movementType: 'IN_INVOICE',
          referenceId: trimmedInvoiceNumber,
          qtyChange: line.receivedBaseQty,
          balanceAfter,
          notes: `Penerimaan faktur PBF ${trimmedInvoiceNumber} (${line.qtyInUom} ${line.uomUnitName})`,
        });
      }

      return insertedInvoice.id;
    });

    return this.findOne(createdInvoiceId);
  }

  async uploadScan(
    id: string,
    file: Express.Multer.File,
  ): Promise<PbfInvoiceDetailDto> {
    if (!id || !UUID_REGEX.test(id)) {
      if (file?.path && fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch {
          // Ignore unlink error
        }
      }
      throw new NotFoundException(
        `Pengunggahan pindaian faktur PBF gagal. Identitas faktur "${id}" bukan format UUID yang sah. Silakan pilih faktur PBF yang terdaftar.`,
      );
    }

    const [existing] = await this.db
      .select()
      .from(pbfInvoices)
      .where(eq(pbfInvoices.id, id))
      .limit(1);

    if (!existing) {
      if (file?.path && fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch {
          // Ignore unlink error
        }
      }
      throw new NotFoundException(
        `Pengunggahan pindaian faktur PBF gagal. Faktur dengan ID ${id} tidak ditemukan di basis data. Silakan simpan faktur PBF terlebih dahulu sebelum mengunggah berkas pindaian.`,
      );
    }

    const scanFilePath = `/uploads/invoices/${file.filename}`;

    await this.db
      .update(pbfInvoices)
      .set({
        scanFilePath,
      })
      .where(eq(pbfInvoices.id, id));

    return this.findOne(id);
  }
}
