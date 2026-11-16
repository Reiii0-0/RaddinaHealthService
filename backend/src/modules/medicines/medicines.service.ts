import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import * as fs from 'fs';
import {
  BatchExpiryStatus,
  BatchStockItemDto,
  DrugClassification,
  MedicineSummaryDto,
  MedicineUomDto,
  PaginatedResponse,
  ParetoClass,
} from '@shared/api-contracts';
import { DRIZZLE_DB, DrizzleDB } from '../../db';
import {
  categories,
  medicineBatches,
  medicines,
  medicineUomConversions,
  pbfInvoiceItems,
  purchaseOrderItems,
  saleItems,
  stockCards,
  suppliers,
} from '../../db/schema';
import { CreateMedicineDto, UomConversionItemDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ListMedicinesQuery {
  search?: string;
  activeIngredient?: string;
  categoryId?: string;
  classification?: string;
  paretoClass?: string;
  isActive?: string;
  page?: number;
  limit?: number;
}

export interface MedicineDetailDto extends MedicineSummaryDto {
  batches: BatchStockItemDto[];
  createdAt: string;
  updatedAt: string;
}

export interface DeleteMedicineResponseDto {
  id: string;
  deleted: boolean;
  mode: 'SOFT_DEACTIVATE' | 'HARD_DELETE';
  isActive: boolean;
}

@Injectable()
export class MedicinesService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  private assertValidUuidOrNotFound(id: string, entityLabel = 'Obat'): void {
    if (!id || !UUID_REGEX.test(id)) {
      throw new NotFoundException(
        `Pencarian ${entityLabel.toLowerCase()} gagal dilakukan. Identitas "${id}" bukan format UUID yang sah atau tidak terdaftar di basis data. Silakan pilih data ${entityLabel.toLowerCase()} dari daftar katalog yang aktif.`,
      );
    }
  }

  private computeExpiryStatus(daysUntilExpiry: number): BatchExpiryStatus {
    if (daysUntilExpiry <= 0) {
      return 'EXPIRED';
    }
    if (daysUntilExpiry <= 90) {
      return 'NEAR_EXPIRY';
    }
    return 'ACTIVE';
  }

  private validateUomConversions(
    uoms: UomConversionItemDto[],
    baseUnit: string,
  ): void {
    if (!Array.isArray(uoms) || uoms.length === 0) {
      throw new BadRequestException(
        'Validasi konversi satuan kemasan (UOM) gagal. Daftar uomConversions kosong (0 satuan). Silakan tambahkan minimal 1 satuan dasar dengan faktor konversi multiplierToBase bernilai 1.',
      );
    }

    const hasBaseMultiplier = uoms.some(
      (u) => Number(u.multiplierToBase) === 1,
    );
    if (!hasBaseMultiplier) {
      throw new BadRequestException(
        `Validasi konversi satuan kemasan (UOM) gagal. Tidak ditemukan satuan dasar "${baseUnit}" dengan nilai multiplierToBase = 1 dari ${uoms.length} satuan yang dikirim. Silakan pastikan minimal ada 1 baris satuan dengan multiplierToBase bernilai 1.`,
      );
    }

    const seenUnits = new Set<string>();
    for (const uom of uoms) {
      const normalizedUnit = uom.unitName.trim().toLowerCase();
      if (!normalizedUnit) {
        throw new BadRequestException(
          'Validasi konversi satuan kemasan (UOM) gagal. Terdapat baris satuan dengan nama kosong (0 karakter). Silakan isi nama satuan seperti Tablet, Strip, atau Box.',
        );
      }
      if (seenUnits.has(normalizedUnit)) {
        throw new BadRequestException(
          `Validasi konversi satuan kemasan (UOM) gagal. Satuan "${uom.unitName.trim()}" tercatat ganda di dalam daftar konversi obat yang sama. Silakan hapus duplikasi nama satuan tersebut.`,
        );
      }
      seenUnits.add(normalizedUnit);
    }
  }

  async findAll(
    query: ListMedicinesQuery,
  ): Promise<PaginatedResponse<MedicineSummaryDto>> {
    const rawPage = Number(query.page ?? 1);
    const rawLimit = Number(query.limit ?? 20);
    const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
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
          ilike(medicines.name, pattern),
          ilike(medicines.sku, pattern),
          ilike(medicines.activeIngredient, pattern),
        ),
      );
    }

    if (query.activeIngredient && query.activeIngredient.trim().length > 0) {
      const ingredientPattern = `%${query.activeIngredient.trim()}%`;
      conditions.push(ilike(medicines.activeIngredient, ingredientPattern));
    }

    if (query.categoryId && query.categoryId.trim().length > 0) {
      const catId = query.categoryId.trim();
      if (UUID_REGEX.test(catId)) {
        conditions.push(eq(medicines.categoryId, catId));
      } else {
        return {
          items: [],
          meta: {
            page,
            limit,
            totalItems: 0,
            totalPages: 0,
          },
        };
      }
    }

    if (
      query.classification &&
      [
        'BEBAS',
        'BEBAS_TERBATAS',
        'KERAS',
        'PSIKOTROPIKA',
        'NARKOTIKA',
      ].includes(query.classification.trim().toUpperCase())
    ) {
      conditions.push(
        eq(
          medicines.classification,
          query.classification.trim().toUpperCase() as DrugClassification,
        ),
      );
    }

    if (
      query.paretoClass &&
      ['A', 'B', 'C'].includes(query.paretoClass.trim().toUpperCase())
    ) {
      conditions.push(
        eq(
          medicines.paretoClass,
          query.paretoClass.trim().toUpperCase() as ParetoClass,
        ),
      );
    }

    if (query.isActive === 'true') {
      conditions.push(eq(medicines.isActive, true));
    } else if (query.isActive === 'false') {
      conditions.push(eq(medicines.isActive, false));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ totalCount }] = await this.db
      .select({ totalCount: count() })
      .from(medicines)
      .where(whereClause);

    const totalItems = Number(totalCount ?? 0);
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);

    const rows = await this.db
      .select({
        medicine: medicines,
        categoryName: categories.name,
      })
      .from(medicines)
      .innerJoin(categories, eq(medicines.categoryId, categories.id))
      .where(whereClause)
      .orderBy(desc(medicines.isActive), asc(medicines.name))
      .limit(limit)
      .offset(offset);

    if (rows.length === 0) {
      return {
        items: [],
        meta: {
          page,
          limit,
          totalItems,
          totalPages,
        },
      };
    }

    const medicineIds = rows.map((r) => r.medicine.id);

    const uomRows = await this.db
      .select()
      .from(medicineUomConversions)
      .where(inArray(medicineUomConversions.medicineId, medicineIds))
      .orderBy(asc(medicineUomConversions.multiplierToBase));

    const batchRows = await this.db
      .select({
        id: medicineBatches.id,
        medicineId: medicineBatches.medicineId,
        currentStock: medicineBatches.currentStock,
        expiryDate: medicineBatches.expiryDate,
        daysUntilExpiry: sql<number>`(${medicineBatches.expiryDate}::date - CURRENT_DATE)::int`,
      })
      .from(medicineBatches)
      .where(inArray(medicineBatches.medicineId, medicineIds))
      .orderBy(
        asc(medicineBatches.expiryDate),
        asc(medicineBatches.createdAt),
      );

    const uomsByMedicine = new Map<string, MedicineUomDto[]>();
    for (const u of uomRows) {
      const list = uomsByMedicine.get(u.medicineId) ?? [];
      list.push({
        id: u.id,
        medicineId: u.medicineId,
        unitName: u.unitName,
        multiplierToBase: u.multiplierToBase,
        sellingPriceRegular: u.sellingPriceRegular,
        sellingPricePartner: u.sellingPricePartner,
        barcode: u.barcode ?? null,
      });
      uomsByMedicine.set(u.medicineId, list);
    }

    const activeStockByMedicine = new Map<string, number>();
    const earliestExpiryByMedicine = new Map<string, string>();

    for (const b of batchRows) {
      const days = Number(b.daysUntilExpiry);
      if (days > 0 && b.currentStock > 0) {
        const prevStock = activeStockByMedicine.get(b.medicineId) ?? 0;
        activeStockByMedicine.set(b.medicineId, prevStock + b.currentStock);
        if (!earliestExpiryByMedicine.has(b.medicineId)) {
          earliestExpiryByMedicine.set(b.medicineId, b.expiryDate);
        }
      }
    }

    const items: MedicineSummaryDto[] = rows.map(({ medicine, categoryName }) => ({
      id: medicine.id,
      sku: medicine.sku,
      name: medicine.name,
      categoryId: medicine.categoryId,
      categoryName,
      activeIngredient: medicine.activeIngredient,
      baseUnit: medicine.baseUnit,
      classification: medicine.classification as DrugClassification,
      paretoClass: medicine.paretoClass as ParetoClass,
      minStockBaseUnit: medicine.minStockBaseUnit,
      totalActiveStockBaseUnit: activeStockByMedicine.get(medicine.id) ?? 0,
      earliestExpiryDate: earliestExpiryByMedicine.get(medicine.id) ?? null,
      imagePath: medicine.imagePath ?? null,
      isActive: medicine.isActive,
      uomConversions: uomsByMedicine.get(medicine.id) ?? [],
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

  async findOne(id: string): Promise<MedicineDetailDto> {
    this.assertValidUuidOrNotFound(id, 'Obat');

    const [row] = await this.db
      .select({
        medicine: medicines,
        categoryName: categories.name,
      })
      .from(medicines)
      .innerJoin(categories, eq(medicines.categoryId, categories.id))
      .where(eq(medicines.id, id))
      .limit(1);

    if (!row) {
      throw new NotFoundException(
        `Pencarian detail obat gagal dilakukan. Obat dengan ID ${id} tidak ditemukan di basis data. Silakan segarkan halaman katalog untuk memuat daftar obat terbaru.`,
      );
    }

    const uomRows = await this.db
      .select()
      .from(medicineUomConversions)
      .where(eq(medicineUomConversions.medicineId, id))
      .orderBy(asc(medicineUomConversions.multiplierToBase));

    const batchRows = await this.db
      .select({
        batch: medicineBatches,
        supplierName: suppliers.name,
        daysUntilExpiry: sql<number>`(${medicineBatches.expiryDate}::date - CURRENT_DATE)::int`,
      })
      .from(medicineBatches)
      .innerJoin(suppliers, eq(medicineBatches.supplierId, suppliers.id))
      .where(eq(medicineBatches.medicineId, id))
      .orderBy(
        asc(medicineBatches.expiryDate),
        asc(medicineBatches.createdAt),
      );

    let totalActiveStockBaseUnit = 0;
    let earliestExpiryDate: string | null = null;

    const batches: BatchStockItemDto[] = batchRows.map(
      ({ batch, supplierName, daysUntilExpiry }) => {
        const days = Number(daysUntilExpiry);
        const expiryStatus = this.computeExpiryStatus(days);
        if (days > 0 && batch.currentStock > 0) {
          totalActiveStockBaseUnit += batch.currentStock;
          if (!earliestExpiryDate) {
            earliestExpiryDate = batch.expiryDate;
          }
        }
        return {
          id: batch.id,
          medicineId: batch.medicineId,
          medicineName: row.medicine.name,
          medicineSku: row.medicine.sku,
          baseUnit: row.medicine.baseUnit,
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

    const uomConversions: MedicineUomDto[] = uomRows.map((u) => ({
      id: u.id,
      medicineId: u.medicineId,
      unitName: u.unitName,
      multiplierToBase: u.multiplierToBase,
      sellingPriceRegular: u.sellingPriceRegular,
      sellingPricePartner: u.sellingPricePartner,
      barcode: u.barcode ?? null,
    }));

    return {
      id: row.medicine.id,
      sku: row.medicine.sku,
      name: row.medicine.name,
      categoryId: row.medicine.categoryId,
      categoryName: row.categoryName,
      activeIngredient: row.medicine.activeIngredient,
      baseUnit: row.medicine.baseUnit,
      classification: row.medicine.classification as DrugClassification,
      paretoClass: row.medicine.paretoClass as ParetoClass,
      minStockBaseUnit: row.medicine.minStockBaseUnit,
      totalActiveStockBaseUnit,
      earliestExpiryDate,
      imagePath: row.medicine.imagePath ?? null,
      isActive: row.medicine.isActive,
      uomConversions,
      batches,
      createdAt: row.medicine.createdAt.toISOString(),
      updatedAt: row.medicine.updatedAt.toISOString(),
    };
  }

  async create(dto: CreateMedicineDto): Promise<MedicineDetailDto> {
    const trimmedSku = dto.sku.trim();
    const trimmedName = dto.name.trim();
    const trimmedIngredient = dto.activeIngredient.trim();
    const trimmedBaseUnit = dto.baseUnit.trim();

    this.validateUomConversions(dto.uomConversions, trimmedBaseUnit);

    const [category] = await this.db
      .select()
      .from(categories)
      .where(eq(categories.id, dto.categoryId))
      .limit(1);

    if (!category) {
      throw new BadRequestException(
        `Penyimpanan obat baru gagal diproses. Kategori dengan ID ${dto.categoryId} tidak ditemukan di basis data. Silakan pilih kategori obat yang sah atau buat kategori baru terlebih dahulu.`,
      );
    }

    const [existingSku] = await this.db
      .select()
      .from(medicines)
      .where(ilike(medicines.sku, trimmedSku))
      .limit(1);

    if (existingSku) {
      throw new ConflictException(
        `Penyimpanan obat baru gagal karena kode SKU duplikat. Kode SKU "${trimmedSku}" sudah digunakan oleh obat "${existingSku.name}" (ID ${existingSku.id}). Silakan gunakan kode SKU unik yang berbeda.`,
      );
    }

    const createdMedicineId = await this.db.transaction(async (tx) => {
      const [insertedMedicine] = await tx
        .insert(medicines)
        .values({
          sku: trimmedSku,
          name: trimmedName,
          categoryId: dto.categoryId,
          activeIngredient: trimmedIngredient,
          baseUnit: trimmedBaseUnit,
          classification: dto.classification,
          paretoClass: dto.paretoClass ?? 'C',
          minStockBaseUnit: dto.minStockBaseUnit,
        })
        .returning();

      const uomValues = dto.uomConversions.map((uom) => ({
        medicineId: insertedMedicine.id,
        unitName: uom.unitName.trim(),
        multiplierToBase: uom.multiplierToBase,
        sellingPriceRegular: uom.sellingPriceRegular,
        sellingPricePartner: uom.sellingPricePartner,
        barcode: uom.barcode?.trim() || null,
      }));

      await tx.insert(medicineUomConversions).values(uomValues);

      return insertedMedicine.id;
    });

    return this.findOne(createdMedicineId);
  }

  async update(id: string, dto: UpdateMedicineDto): Promise<MedicineDetailDto> {
    this.assertValidUuidOrNotFound(id, 'Obat');

    const [existing] = await this.db
      .select()
      .from(medicines)
      .where(eq(medicines.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(
        `Pembaruan obat gagal dilakukan. Obat dengan ID ${id} tidak ditemukan di basis data. Silakan segarkan halaman katalog dan pilih obat yang terdaftar.`,
      );
    }

    const targetBaseUnit = dto.baseUnit?.trim() || existing.baseUnit;

    if (dto.uomConversions !== undefined) {
      this.validateUomConversions(dto.uomConversions, targetBaseUnit);
    }

    if (dto.categoryId !== undefined) {
      const [cat] = await this.db
        .select()
        .from(categories)
        .where(eq(categories.id, dto.categoryId))
        .limit(1);

      if (!cat) {
        throw new BadRequestException(
          `Pembaruan obat gagal diproses. Kategori dengan ID ${dto.categoryId} tidak ditemukan di basis data. Silakan pilih kategori obat yang sah.`,
        );
      }
    }

    if (dto.sku !== undefined) {
      const trimmedSku = dto.sku.trim();
      const [duplicateSku] = await this.db
        .select()
        .from(medicines)
        .where(and(ilike(medicines.sku, trimmedSku), ne(medicines.id, id)))
        .limit(1);

      if (duplicateSku) {
        throw new ConflictException(
          `Pembaruan obat gagal karena kode SKU duplikat. Kode SKU "${trimmedSku}" sudah dipakai oleh obat "${duplicateSku.name}" (ID ${duplicateSku.id}). Silakan masukkan kode SKU lain.`,
        );
      }
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(medicines)
        .set({
          sku: dto.sku !== undefined ? dto.sku.trim() : existing.sku,
          name: dto.name !== undefined ? dto.name.trim() : existing.name,
          categoryId:
            dto.categoryId !== undefined ? dto.categoryId : existing.categoryId,
          activeIngredient:
            dto.activeIngredient !== undefined
              ? dto.activeIngredient.trim()
              : existing.activeIngredient,
          baseUnit: targetBaseUnit,
          classification:
            dto.classification !== undefined
              ? dto.classification
              : existing.classification,
          paretoClass:
            dto.paretoClass !== undefined
              ? dto.paretoClass
              : existing.paretoClass,
          minStockBaseUnit:
            dto.minStockBaseUnit !== undefined
              ? dto.minStockBaseUnit
              : existing.minStockBaseUnit,
          isActive:
            dto.isActive !== undefined ? dto.isActive : existing.isActive,
          updatedAt: new Date(),
        })
        .where(eq(medicines.id, id));

      if (dto.uomConversions !== undefined) {
        await tx
          .delete(medicineUomConversions)
          .where(eq(medicineUomConversions.medicineId, id));

        const uomValues = dto.uomConversions.map((uom) => ({
          medicineId: id,
          unitName: uom.unitName.trim(),
          multiplierToBase: uom.multiplierToBase,
          sellingPriceRegular: uom.sellingPriceRegular,
          sellingPricePartner: uom.sellingPricePartner,
          barcode: uom.barcode?.trim() || null,
        }));

        await tx.insert(medicineUomConversions).values(uomValues);
      }
    });

    return this.findOne(id);
  }

  async remove(id: string): Promise<DeleteMedicineResponseDto> {
    this.assertValidUuidOrNotFound(id, 'Obat');

    const [existing] = await this.db
      .select()
      .from(medicines)
      .where(eq(medicines.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(
        `Penghapusan obat gagal dilakukan. Obat dengan ID ${id} tidak ditemukan di basis data. Silakan segarkan daftar katalog obat Anda.`,
      );
    }

    const [[batchCount], [invoiceItemCount], [stockCardCount], [saleItemCount], [poItemCount]] =
      await Promise.all([
        this.db
          .select({ cnt: count() })
          .from(medicineBatches)
          .where(eq(medicineBatches.medicineId, id)),
        this.db
          .select({ cnt: count() })
          .from(pbfInvoiceItems)
          .where(eq(pbfInvoiceItems.medicineId, id)),
        this.db
          .select({ cnt: count() })
          .from(stockCards)
          .where(eq(stockCards.medicineId, id)),
        this.db
          .select({ cnt: count() })
          .from(saleItems)
          .where(eq(saleItems.medicineId, id)),
        this.db
          .select({ cnt: count() })
          .from(purchaseOrderItems)
          .where(eq(purchaseOrderItems.medicineId, id)),
      ]);

    const totalReferences =
      Number(batchCount?.cnt ?? 0) +
      Number(invoiceItemCount?.cnt ?? 0) +
      Number(stockCardCount?.cnt ?? 0) +
      Number(saleItemCount?.cnt ?? 0) +
      Number(poItemCount?.cnt ?? 0);

    if (totalReferences > 0) {
      await this.db
        .update(medicines)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(medicines.id, id));

      return {
        id,
        deleted: true,
        mode: 'SOFT_DEACTIVATE',
        isActive: false,
      };
    }

    await this.db.delete(medicines).where(eq(medicines.id, id));

    return {
      id,
      deleted: true,
      mode: 'HARD_DELETE',
      isActive: false,
    };
  }

  async uploadImage(
    id: string,
    file: Express.Multer.File,
  ): Promise<MedicineDetailDto> {
    if (!id || !UUID_REGEX.test(id)) {
      if (file?.path && fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch {
          // Ignore cleanup error
        }
      }
      throw new NotFoundException(
        `Pengunggahan foto kemasan obat gagal. Identitas obat "${id}" bukan format UUID yang sah. Silakan pilih obat yang terdaftar di katalog.`,
      );
    }

    const [existing] = await this.db
      .select()
      .from(medicines)
      .where(eq(medicines.id, id))
      .limit(1);

    if (!existing) {
      if (file?.path && fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch {
          // Ignore cleanup error
        }
      }
      throw new NotFoundException(
        `Pengunggahan foto kemasan obat gagal. Obat dengan ID ${id} tidak ditemukan di basis data. Silakan pilih obat yang terdaftar sebelum mengunggah foto.`,
      );
    }

    const imagePath = `/uploads/medicines/${file.filename}`;

    await this.db
      .update(medicines)
      .set({
        imagePath,
        updatedAt: new Date(),
      })
      .where(eq(medicines.id, id));

    return this.findOne(id);
  }
}
