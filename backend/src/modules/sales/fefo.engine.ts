import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, asc, eq, gt, ne, sql } from 'drizzle-orm';
import {
  FefoBatchSliceDto,
  FefoItemPreviewDto,
  PricingTier,
} from '@shared/api-contracts';
import { DRIZZLE_DB, DrizzleDB } from '../../db';
import {
  medicineBatches,
  medicines,
  medicineUomConversions,
  saleItemBatchAllocations,
  stockCards,
} from '../../db/schema';
import { CartItemDto } from './dto/preview-fefo.dto';

export type DatabaseTransaction = Parameters<
  Parameters<DrizzleDB['transaction']>[0]
>[0];

export interface SubstituteMedicineInfo {
  medicineId: string;
  name: string;
  activeIngredient: string;
  availableActiveStock: number;
  baseUnit: string;
}

export interface ResolvedMedicineCartItem {
  medicineId: string;
  medicineName: string;
  activeIngredient: string;
  baseUnit: string;
  uomUnitName: string;
  multiplierToBase: number;
  qtyInUom: number;
  requiredBaseQty: number;
  unitSellingPrice: number;
  subtotal: number;
}

export interface ExecutedBatchAllocationResult {
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  allocatedBaseQty: number;
  unitCostPriceSnapshot: string;
  balanceAfter: number;
}

@Injectable()
export class FefoEngine {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  /**
   * Mengambil data obat beserta konversi UOM yang dipilih kasir,
   * memverifikasi eksistensi data, dan menghitung kuantitas satuan dasar.
   */
  async resolveCartItem(
    executor: DrizzleDB | DatabaseTransaction,
    item: CartItemDto,
    pricingTier: PricingTier,
  ): Promise<ResolvedMedicineCartItem> {
    const medList = await executor
      .select()
      .from(medicines)
      .where(and(eq(medicines.id, item.medicineId), eq(medicines.isActive, true)))
      .limit(1);

    if (medList.length === 0) {
      throw new NotFoundException(
        `Pencarian obat di katalog kasir gagal. Obat dengan ID ${item.medicineId} tidak ditemukan dalam database atau sedang dinonaktifkan. Silakan periksa kembali daftar obat aktif pada katalog master.`,
      );
    }

    const med = medList[0];

    // Ambil konversi satuan UOM
    const uomList = await executor
      .select()
      .from(medicineUomConversions)
      .where(
        and(
          eq(medicineUomConversions.medicineId, med.id),
          eq(medicineUomConversions.unitName, item.uomUnitName.trim()),
        ),
      )
      .limit(1);

    let multiplier = 1;
    let sellingPrice = 0;

    if (uomList.length > 0) {
      multiplier = uomList[0].multiplierToBase;
      sellingPrice =
        pricingTier === 'PARTNER'
          ? uomList[0].sellingPricePartner
          : uomList[0].sellingPriceRegular;
    } else if (
      item.uomUnitName.trim().toLowerCase() === med.baseUnit.trim().toLowerCase()
    ) {
      // Jika kasir memilih satuan dasar langsung, cari konversi faktor 1 atau gunakan konversi default
      multiplier = 1;
      const baseConversion = await executor
        .select()
        .from(medicineUomConversions)
        .where(
          and(
            eq(medicineUomConversions.medicineId, med.id),
            eq(medicineUomConversions.multiplierToBase, 1),
          ),
        )
        .limit(1);

      if (baseConversion.length > 0) {
        sellingPrice =
          pricingTier === 'PARTNER'
            ? baseConversion[0].sellingPricePartner
            : baseConversion[0].sellingPriceRegular;
      } else {
        throw new NotFoundException(
          `Pengambilan harga satuan dasar obat gagal. Satuan "${item.uomUnitName}" untuk obat "${med.name}" belum memiliki data tarif penjualan aktif. Silakan hubungi Apoteker atau Pemilik untuk melengkapi tabel konversi UOM.`,
        );
      }
    } else {
      throw new NotFoundException(
        `Konversi satuan kemasan tidak valid. Satuan "${item.uomUnitName}" tidak terdaftar pada tabel Multi-UOM obat "${med.name}". Silakan pilih satuan resmi yang terdaftar seperti ${med.baseUnit}.`,
      );
    }

    const requiredBaseQty = item.qtyInUom * multiplier;
    const subtotal = sellingPrice * item.qtyInUom;

    return {
      medicineId: med.id,
      medicineName: med.name,
      activeIngredient: med.activeIngredient,
      baseUnit: med.baseUnit,
      uomUnitName: item.uomUnitName,
      multiplierToBase: multiplier,
      qtyInUom: item.qtyInUom,
      requiredBaseQty,
      unitSellingPrice: sellingPrice,
      subtotal,
    };
  }

  /**
   * Menemukan daftar obat substitusi yang memiliki zat aktif sama (active_ingredient)
   * dan masih memiliki stok layak jual yang belum kedaluwarsa.
   */
  async findSubstitutes(
    executor: DrizzleDB | DatabaseTransaction,
    currentMedicineId: string,
    activeIngredient: string,
  ): Promise<SubstituteMedicineInfo[]> {
    if (!activeIngredient || activeIngredient.trim().length === 0) {
      return [];
    }

    const trimmedIngredient = activeIngredient.trim();

    // Cari obat lain yang memiliki zat aktif sama persis (case-insensitive)
    const candidates = await executor
      .select({
        medicineId: medicines.id,
        name: medicines.name,
        activeIngredient: medicines.activeIngredient,
        baseUnit: medicines.baseUnit,
      })
      .from(medicines)
      .where(
        and(
          ne(medicines.id, currentMedicineId),
          eq(medicines.isActive, true),
          sql`LOWER(${medicines.activeIngredient}) = LOWER(${trimmedIngredient})`,
        ),
      );

    const results: SubstituteMedicineInfo[] = [];

    for (const cand of candidates) {
      const stockRows = await executor
        .select({
          totalStock: sql<number>`COALESCE(SUM(${medicineBatches.currentStock}), 0)`,
        })
        .from(medicineBatches)
        .where(
          and(
            eq(medicineBatches.medicineId, cand.medicineId),
            gt(medicineBatches.currentStock, 0),
            sql`${medicineBatches.expiryDate}::date > CURRENT_DATE`,
          ),
        );

      const availableActiveStock = Number(stockRows[0]?.totalStock ?? 0);
      if (availableActiveStock > 0) {
        results.push({
          medicineId: cand.medicineId,
          name: cand.name,
          activeIngredient: cand.activeIngredient,
          availableActiveStock,
          baseUnit: cand.baseUnit,
        });
      }
    }

    return results;
  }

  /**
   * Menghitung simulasi alokasi FEFO untuk 1 item secara read-only (tanpa mutasi database).
   */
  async previewAllocationForItem(
    executor: DrizzleDB | DatabaseTransaction,
    item: CartItemDto,
    pricingTier: PricingTier,
  ): Promise<FefoItemPreviewDto> {
    const resolved = await this.resolveCartItem(executor, item, pricingTier);

    // Kueri kandidat batch layak jual FEFO: expiryDate > CURRENT_DATE & currentStock > 0
    const candidateBatches = await executor
      .select({
        id: medicineBatches.id,
        batchNumber: medicineBatches.batchNumber,
        expiryDate: medicineBatches.expiryDate,
        currentStock: medicineBatches.currentStock,
        daysUntilExpiry: sql<number>`(${medicineBatches.expiryDate}::date - CURRENT_DATE)::int`,
      })
      .from(medicineBatches)
      .where(
        and(
          eq(medicineBatches.medicineId, resolved.medicineId),
          gt(medicineBatches.currentStock, 0),
          sql`${medicineBatches.expiryDate}::date > CURRENT_DATE`,
        ),
      )
      .orderBy(asc(medicineBatches.expiryDate), asc(medicineBatches.createdAt));

    let totalAvailableActiveStock = 0;
    for (const b of candidateBatches) {
      totalAvailableActiveStock += b.currentStock;
    }

    const isSufficient = totalAvailableActiveStock >= resolved.requiredBaseQty;
    const shortageBaseQty = isSufficient
      ? 0
      : resolved.requiredBaseQty - totalAvailableActiveStock;

    // Alokasi bertahap FEFO secara simulasi
    const allocations: FefoBatchSliceDto[] = [];
    let remainingNeeded = resolved.requiredBaseQty;

    for (const b of candidateBatches) {
      if (remainingNeeded <= 0) {
        break;
      }
      const allocated = Math.min(remainingNeeded, b.currentStock);
      allocations.push({
        batchId: b.id,
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate,
        daysUntilExpiry: Number(b.daysUntilExpiry),
        allocatedBaseQty: allocated,
        availableStockBefore: b.currentStock,
        remainingStockAfter: b.currentStock - allocated,
      });
      remainingNeeded -= allocated;
    }

    // Cari obat substitusi jika persediaan kurang atau untuk informasi apoteker kasir
    const substitutes = await this.findSubstitutes(
      executor,
      resolved.medicineId,
      resolved.activeIngredient,
    );

    return {
      medicineId: resolved.medicineId,
      medicineName: resolved.medicineName,
      activeIngredient: resolved.activeIngredient,
      uomUnitName: resolved.uomUnitName,
      qtyInUom: resolved.qtyInUom,
      multiplierToBase: resolved.multiplierToBase,
      requiredBaseQty: resolved.requiredBaseQty,
      totalAvailableActiveStock,
      isSufficient,
      shortageBaseQty,
      unitSellingPrice: resolved.unitSellingPrice,
      subtotal: resolved.subtotal,
      allocations,
      substitutes,
    };
  }

  /**
   * Menjalankan pemotongan FEFO atomik di dalam transaksi database dengan SELECT ... FOR UPDATE.
   * Apabila stok kurang dari kebutuhan, transaksi digagalkan dengan melempar UnprocessableEntityException (422).
   */
  async executeAllocationWithLock(
    tx: DatabaseTransaction,
    resolved: ResolvedMedicineCartItem,
    saleItemId: string,
    actorUserId: string,
    referenceReceiptNumber: string,
  ): Promise<ExecutedBatchAllocationResult[]> {
    // 1. Kueri kandidat batch dengan baris terkunci (FOR UPDATE)
    const candidateBatches = await tx
      .select({
        id: medicineBatches.id,
        batchNumber: medicineBatches.batchNumber,
        expiryDate: medicineBatches.expiryDate,
        currentStock: medicineBatches.currentStock,
        costPricePerBaseUnit: medicineBatches.costPricePerBaseUnit,
      })
      .from(medicineBatches)
      .where(
        and(
          eq(medicineBatches.medicineId, resolved.medicineId),
          gt(medicineBatches.currentStock, 0),
          sql`${medicineBatches.expiryDate}::date > CURRENT_DATE`,
        ),
      )
      .orderBy(asc(medicineBatches.expiryDate), asc(medicineBatches.createdAt))
      .for('update');

    let totalAvailableActiveStock = 0;
    for (const b of candidateBatches) {
      totalAvailableActiveStock += b.currentStock;
    }

    // 2. Pemeriksaan kelayakan stok aktif layak jual
    if (totalAvailableActiveStock < resolved.requiredBaseQty) {
      const shortageBaseQty =
        resolved.requiredBaseQty - totalAvailableActiveStock;
      const substitutes = await this.findSubstitutes(
        tx,
        resolved.medicineId,
        resolved.activeIngredient,
      );

      const substituteNames =
        substitutes.length > 0
          ? substitutes.map((s) => `${s.name} (stok: ${s.availableActiveStock} ${s.baseUnit})`).join(', ')
          : 'tidak ada obat substitusi terdaftar';

      throw new UnprocessableEntityException({
        errorCode: 'INSUFFICIENT_FEFO_STOCK',
        code: 'INSUFFICIENT_FEFO_STOCK',
        message: `Stok layak jual obat "${resolved.medicineName}" tidak mencukupi untuk memproses checkout transaksi. Kebutuhan dasar transaksi sebanyak ${resolved.requiredBaseQty} ${resolved.baseUnit}, tetapi stok aktif layak jual yang tersedia hanya ${totalAvailableActiveStock} ${resolved.baseUnit} (kekurangan stok: ${shortageBaseQty} ${resolved.baseUnit}). Silakan kurangi kuantitas pembelian atau pertimbangkan obat alternatif dengan zat aktif yang sama (${substituteNames}).`,
        details: {
          medicineId: resolved.medicineId,
          medicineName: resolved.medicineName,
          activeIngredient: resolved.activeIngredient,
          baseUnit: resolved.baseUnit,
          requiredBaseQty: resolved.requiredBaseQty,
          totalAvailableActiveStock,
          shortageBaseQty,
          substitutes,
        },
      });
    }

    // 3. Alokasi bertahap multi-batch greedy FEFO
    const results: ExecutedBatchAllocationResult[] = [];
    let remainingNeeded = resolved.requiredBaseQty;

    for (const batch of candidateBatches) {
      if (remainingNeeded <= 0) {
        break;
      }

      const allocated = Math.min(remainingNeeded, batch.currentStock);
      const balanceAfter = batch.currentStock - allocated;

      // Update current_stock pada tabel medicine_batches
      await tx
        .update(medicineBatches)
        .set({ currentStock: balanceAfter })
        .where(eq(medicineBatches.id, batch.id));

      // Catat baris di sale_item_batch_allocations
      await tx.insert(saleItemBatchAllocations).values({
        saleItemId,
        batchId: batch.id,
        batchNumberSnapshot: batch.batchNumber,
        expiryDateSnapshot: batch.expiryDate,
        allocatedBaseQty: allocated,
        unitCostPriceSnapshot: batch.costPricePerBaseUnit,
      });

      // Catat baris append-only di stock_cards
      await tx.insert(stockCards).values({
        medicineId: resolved.medicineId,
        batchId: batch.id,
        actorUserId,
        movementType: 'OUT_SALE',
        referenceId: referenceReceiptNumber,
        qtyChange: -allocated,
        balanceAfter,
        notes: `Penjualan kasir struk ${referenceReceiptNumber} (${allocated} ${resolved.baseUnit})`,
      });

      results.push({
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        allocatedBaseQty: allocated,
        unitCostPriceSnapshot: String(batch.costPricePerBaseUnit),
        balanceAfter,
      });

      remainingNeeded -= allocated;
    }

    return results;
  }
}
