import * as argon2 from 'argon2';
import { db, pgPool } from './index';
import {
  categories,
  medicineBatches,
  medicines,
  medicineUomConversions,
  pbfInvoiceItems,
  pbfInvoices,
  purchaseOrderItems,
  purchaseOrders,
  refreshTokens,
  saleItemBatchAllocations,
  saleItems,
  salesTransactions,
  stockCards,
  suppliers,
  users,
} from './schema';

function addDaysIso(daysOffset: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysOffset);
  return date.toISOString().slice(0, 10);
}

export async function seedDatabase(): Promise<void> {
  const [
    ownerPasswordHash,
    aptRinaPasswordHash,
    aptExpiredPasswordHash,
    kasirBudiPasswordHash,
  ] = await Promise.all([
    argon2.hash('RaddinaOwner123!'),
    argon2.hash('RaddinaApt123!'),
    argon2.hash('RaddinaExp123!'),
    argon2.hash('RaddinaKasir123!'),
  ]);

  await db.transaction(async (tx) => {
    // Bersihkan tabel dari child ke parent agar eksekusi ulang selalu idempoten dan deterministik
    await tx.delete(purchaseOrderItems);
    await tx.delete(purchaseOrders);
    await tx.delete(saleItemBatchAllocations);
    await tx.delete(saleItems);
    await tx.delete(salesTransactions);
    await tx.delete(stockCards);
    await tx.delete(pbfInvoiceItems);
    await tx.delete(pbfInvoices);
    await tx.delete(medicineBatches);
    await tx.delete(medicineUomConversions);
    await tx.delete(medicines);
    await tx.delete(suppliers);
    await tx.delete(categories);
    await tx.delete(refreshTokens);
    await tx.delete(users);

    // 1. Seed 4 Akun Pengguna (OWNER, PHARMACIST SIPA Aktif, PHARMACIST SIPA Kedaluwarsa, CASHIER)
    const [ownerUser, aptRinaUser, aptExpiredUser, kasirBudiUser] = await tx
      .insert(users)
      .values([
        {
          email: 'owner@raddina.id',
          passwordHash: ownerPasswordHash,
          fullName: 'Hj. Raddina Kusuma, S.Farm.',
          role: 'OWNER',
          noSipa: null,
          sipaExpiryDate: null,
          isActive: true,
        },
        {
          email: 'apt.rina@raddina.id',
          passwordHash: aptRinaPasswordHash,
          fullName: 'apt. Rina Kartika, S.Farm.',
          role: 'PHARMACIST',
          noSipa: '19940812/SIPA_35.78/2024/1088',
          sipaExpiryDate: '2028-12-31',
          isActive: true,
        },
        {
          email: 'apt.expired@raddina.id',
          passwordHash: aptExpiredPasswordHash,
          fullName: 'apt. Hendra Wijaya, S.Farm.',
          role: 'PHARMACIST',
          noSipa: '19890304/SIPA_35.78/2019/0412',
          sipaExpiryDate: '2024-01-01',
          isActive: true,
        },
        {
          email: 'kasir.budi@raddina.id',
          passwordHash: kasirBudiPasswordHash,
          fullName: 'Budi Santoso, A.Md.Farm.',
          role: 'CASHIER',
          noSipa: null,
          sipaExpiryDate: null,
          isActive: true,
        },
      ])
      .returning();

    void ownerUser;
    void aptExpiredUser;

    // 2. Seed 4 Kategori Obat
    const [catAnalgesik, catAntibiotik, catAntihipertensi, catSaluranCerna] =
      await tx
        .insert(categories)
        .values([
          {
            name: 'Analgesik & Antipiretik',
            description:
              'Obat pereda nyeri ringan hingga sedang serta penurun demam.',
          },
          {
            name: 'Antibiotik Sistemik',
            description:
              'Obat keras antibakteri sistemik yang memerlukan pengawasan Apoteker.',
          },
          {
            name: 'Antihipertensi & Kardiovaskular',
            description:
              'Obat pengendali tekanan darah tinggi dan terapi pemeliharaan jantung.',
          },
          {
            name: 'Saluran Cerna & Antasida',
            description:
              'Obat penetral asam lambung, pelindung mukosa usus, dan antiflatulen.',
          },
        ])
        .returning();

    // 3. Seed 3 Pemasok PBF Resmi
    const [supKftd, supEnseval, supAam] = await tx
      .insert(suppliers)
      .values([
        {
          code: 'PBF-KFTD-01',
          name: 'PT Kimia Farma Trading & Distribution',
          email: 'order.sby@kftd.co.id',
          phone: '031-5319281',
          izinPbfNo: 'FP.01.04/IV/0218-e/2023',
          address: 'Jl. Kaliasin Pompa No. 78, Genteng, Surabaya, Jawa Timur',
          isActive: true,
        },
        {
          code: 'PBF-EPM-02',
          name: 'PT Enseval Putera Megatrading Tbk',
          email: 'pesanan.surabaya@enseval.com',
          phone: '031-8438872',
          izinPbfNo: 'FP.01.04/IV/0544-e/2023',
          address: 'Jl. Rungkut Industri Raya No. 18, Surabaya, Jawa Timur',
          isActive: true,
        },
        {
          code: 'PBF-AAM-03',
          name: 'PT Anugrah Argon Medica',
          email: 'sp.jatim@anugrah-argon.com',
          phone: '031-8492105',
          izinPbfNo: 'FP.01.04/IV/0819-e/2024',
          address: 'Jl. Berbek Industri III No. 9, Waru, Sidoarjo, Jawa Timur',
          isActive: true,
        },
      ])
      .returning();

    // 4. Seed 6 Obat Realistis
    const [medSanmol, medPamol, medAmoxsan, medCefspan, medNorvask, medPolysilane] =
      await tx
        .insert(medicines)
        .values([
          {
            sku: 'MED-PCT-500',
            name: 'Sanmol 500 mg Tablet',
            categoryId: catAnalgesik.id,
            activeIngredient: 'Paracetamol 500 mg',
            baseUnit: 'Tablet',
            classification: 'BEBAS',
            paretoClass: 'A',
            minStockBaseUnit: 200,
            imagePath: null,
            isActive: true,
          },
          {
            sku: 'MED-PCM-500',
            name: 'Pamol 500 mg Tablet',
            categoryId: catAnalgesik.id,
            activeIngredient: 'Paracetamol 500 mg',
            baseUnit: 'Tablet',
            classification: 'BEBAS',
            paretoClass: 'B',
            minStockBaseUnit: 150,
            imagePath: null,
            isActive: true,
          },
          {
            sku: 'MED-AMX-500',
            name: 'Amoxsan 500 mg Kapsul',
            categoryId: catAntibiotik.id,
            activeIngredient: 'Amoxicillin Trihydrate 500 mg',
            baseUnit: 'Tablet',
            classification: 'KERAS',
            paretoClass: 'A',
            minStockBaseUnit: 300,
            imagePath: null,
            isActive: true,
          },
          {
            sku: 'MED-CEF-100',
            name: 'Cefspan 100 mg Kapsul',
            categoryId: catAntibiotik.id,
            activeIngredient: 'Cefixime Trihydrate 100 mg',
            baseUnit: 'Tablet',
            classification: 'KERAS',
            paretoClass: 'A',
            minStockBaseUnit: 120,
            imagePath: null,
            isActive: true,
          },
          {
            sku: 'MED-AML-010',
            name: 'Norvask 10 mg Tablet',
            categoryId: catAntihipertensi.id,
            activeIngredient: 'Amlodipine Besylate 10 mg',
            baseUnit: 'Tablet',
            classification: 'KERAS',
            paretoClass: 'B',
            minStockBaseUnit: 180,
            imagePath: null,
            isActive: true,
          },
          {
            sku: 'MED-ANT-060',
            name: 'Polysilane Suspensi 100 mL',
            categoryId: catSaluranCerna.id,
            activeIngredient: 'Simethicone 80 mg + Aluminium Hydroxide 200 mg',
            baseUnit: 'Botol',
            classification: 'BEBAS',
            paretoClass: 'C',
            minStockBaseUnit: 24,
            imagePath: null,
            isActive: true,
          },
        ])
        .returning();

    // 5. Seed Multi-UOM Conversions (Box, Strip, Tablet / Botol)
    await tx.insert(medicineUomConversions).values([
      // Sanmol 500 mg
      {
        medicineId: medSanmol.id,
        unitName: 'Tablet',
        multiplierToBase: 1,
        sellingPriceRegular: 600,
        sellingPricePartner: 500,
        barcode: '8992761100011',
      },
      {
        medicineId: medSanmol.id,
        unitName: 'Strip',
        multiplierToBase: 4,
        sellingPriceRegular: 2300,
        sellingPricePartner: 1950,
        barcode: '8992761100012',
      },
      {
        medicineId: medSanmol.id,
        unitName: 'Box',
        multiplierToBase: 100,
        sellingPriceRegular: 54000,
        sellingPricePartner: 47000,
        barcode: '8992761100013',
      },
      // Pamol 500 mg
      {
        medicineId: medPamol.id,
        unitName: 'Tablet',
        multiplierToBase: 1,
        sellingPriceRegular: 650,
        sellingPricePartner: 550,
        barcode: '8992761100021',
      },
      {
        medicineId: medPamol.id,
        unitName: 'Strip',
        multiplierToBase: 10,
        sellingPriceRegular: 6200,
        sellingPricePartner: 5200,
        barcode: '8992761100022',
      },
      {
        medicineId: medPamol.id,
        unitName: 'Box',
        multiplierToBase: 100,
        sellingPriceRegular: 59000,
        sellingPricePartner: 50000,
        barcode: '8992761100023',
      },
      // Amoxsan 500 mg
      {
        medicineId: medAmoxsan.id,
        unitName: 'Tablet',
        multiplierToBase: 1,
        sellingPriceRegular: 4200,
        sellingPricePartner: 3600,
        barcode: '8992761100031',
      },
      {
        medicineId: medAmoxsan.id,
        unitName: 'Strip',
        multiplierToBase: 10,
        sellingPriceRegular: 40000,
        sellingPricePartner: 34500,
        barcode: '8992761100032',
      },
      {
        medicineId: medAmoxsan.id,
        unitName: 'Box',
        multiplierToBase: 100,
        sellingPriceRegular: 385000,
        sellingPricePartner: 335000,
        barcode: '8992761100033',
      },
      // Cefspan 100 mg
      {
        medicineId: medCefspan.id,
        unitName: 'Tablet',
        multiplierToBase: 1,
        sellingPriceRegular: 11500,
        sellingPricePartner: 9800,
        barcode: '8992761100041',
      },
      {
        medicineId: medCefspan.id,
        unitName: 'Strip',
        multiplierToBase: 10,
        sellingPriceRegular: 110000,
        sellingPricePartner: 95000,
        barcode: '8992761100042',
      },
      {
        medicineId: medCefspan.id,
        unitName: 'Box',
        multiplierToBase: 30,
        sellingPriceRegular: 320000,
        sellingPricePartner: 280000,
        barcode: '8992761100043',
      },
      // Norvask 10 mg
      {
        medicineId: medNorvask.id,
        unitName: 'Tablet',
        multiplierToBase: 1,
        sellingPriceRegular: 6800,
        sellingPricePartner: 5900,
        barcode: '8992761100051',
      },
      {
        medicineId: medNorvask.id,
        unitName: 'Strip',
        multiplierToBase: 10,
        sellingPriceRegular: 65000,
        sellingPricePartner: 57000,
        barcode: '8992761100052',
      },
      {
        medicineId: medNorvask.id,
        unitName: 'Box',
        multiplierToBase: 30,
        sellingPriceRegular: 190000,
        sellingPricePartner: 168000,
        barcode: '8992761100053',
      },
      // Polysilane Suspensi 100 mL
      {
        medicineId: medPolysilane.id,
        unitName: 'Botol',
        multiplierToBase: 1,
        sellingPriceRegular: 28000,
        sellingPricePartner: 24500,
        barcode: '8992761100061',
      },
      {
        medicineId: medPolysilane.id,
        unitName: 'Box',
        multiplierToBase: 12,
        sellingPriceRegular: 320000,
        sellingPricePartner: 282000,
        barcode: '8992761100062',
      },
    ]);

    // 6. Seed Medicine Batches (Multi-batch FEFO, 1 Near-ED < 60 hari, 1 EXPIRED)
    const expSanmolEarly = addDaysIso(140);
    const expSanmolLate = addDaysIso(320);
    const expPamolActive = addDaysIso(210);
    const expAmoxsanExpired = '2024-06-15';
    const expAmoxsanActive = addDaysIso(190);
    const expCefspanNearEd = addDaysIso(28); // Near-ED (< 60 hari)
    const expNorvaskEpm = addDaysIso(240);
    const expNorvaskAam = addDaysIso(300);
    const expPolysilaneActive = addDaysIso(360);

    const [
      batchSanmolEarly,
      batchSanmolLate,
      batchPamolActive,
      batchAmoxsanExpired,
      batchAmoxsanActive,
      batchCefspanNear,
      batchNorvaskEpm,
      batchNorvaskAam,
      batchPolysilane,
    ] = await tx
      .insert(medicineBatches)
      .values([
        {
          medicineId: medSanmol.id,
          supplierId: supKftd.id,
          batchNumber: 'BATCH-SNM-26A',
          expiryDate: expSanmolEarly,
          initialStock: 200,
          currentStock: 80,
          costPricePerBaseUnit: '410.0000',
        },
        {
          medicineId: medSanmol.id,
          supplierId: supEnseval.id,
          batchNumber: 'BATCH-SNM-26B',
          expiryDate: expSanmolLate,
          initialStock: 300,
          currentStock: 300,
          costPricePerBaseUnit: '420.0000',
        },
        {
          medicineId: medPamol.id,
          supplierId: supEnseval.id,
          batchNumber: 'BATCH-PML-26A',
          expiryDate: expPamolActive,
          initialStock: 400,
          currentStock: 300,
          costPricePerBaseUnit: '440.0000',
        },
        {
          medicineId: medAmoxsan.id,
          supplierId: supKftd.id,
          batchNumber: 'BATCH-AMX-EXP24',
          expiryDate: expAmoxsanExpired,
          initialStock: 100,
          currentStock: 40,
          costPricePerBaseUnit: '3100.0000',
        },
        {
          medicineId: medAmoxsan.id,
          supplierId: supKftd.id,
          batchNumber: 'BATCH-AMX-26A',
          expiryDate: expAmoxsanActive,
          initialStock: 300,
          currentStock: 90,
          costPricePerBaseUnit: '3200.0000',
        },
        {
          medicineId: medCefspan.id,
          supplierId: supAam.id,
          batchNumber: 'BATCH-CEF-NEAR01',
          expiryDate: expCefspanNearEd,
          initialStock: 150,
          currentStock: 60,
          costPricePerBaseUnit: '8400.0000',
        },
        {
          medicineId: medNorvask.id,
          supplierId: supEnseval.id,
          batchNumber: 'BATCH-NVK-26A',
          expiryDate: expNorvaskEpm,
          initialStock: 150,
          currentStock: 50,
          costPricePerBaseUnit: '4950.0000',
        },
        {
          medicineId: medNorvask.id,
          supplierId: supAam.id,
          batchNumber: 'BATCH-NVK-26B',
          expiryDate: expNorvaskAam,
          initialStock: 120,
          currentStock: 40,
          costPricePerBaseUnit: '4750.0000',
        },
        {
          medicineId: medPolysilane.id,
          supplierId: supKftd.id,
          batchNumber: 'BATCH-PLS-26A',
          expiryDate: expPolysilaneActive,
          initialStock: 48,
          currentStock: 36,
          costPricePerBaseUnit: '20500.0000',
        },
      ])
      .returning();

    // 7. Seed PBF Invoices & PBF Invoice Items
    const invoiceDate1 = addDaysIso(-25);
    const dueDate1 = addDaysIso(5);
    const invoiceDate2 = addDaysIso(-18);
    const dueDate2 = addDaysIso(12);
    const invoiceDate3 = addDaysIso(-10);
    const dueDate3 = addDaysIso(20);

    const [invKftd, invEnseval, invAam] = await tx
      .insert(pbfInvoices)
      .values([
        {
          invoiceNumber: 'INV/KFTD/2026/1001',
          supplierId: supKftd.id,
          receivedByUserId: aptRinaUser.id,
          invoiceDate: invoiceDate1,
          dueDate: dueDate1,
          totalAmount: 2336000,
          scanFilePath: null,
          paymentStatus: 'PAID',
          notes:
            'Penerimaan faktur PBF Kimia Farma untuk stok analgesik, antibiotik, dan suspensi antasida.',
        },
        {
          invoiceNumber: 'INV/EPM/2026/1002',
          supplierId: supEnseval.id,
          receivedByUserId: aptRinaUser.id,
          invoiceDate: invoiceDate2,
          dueDate: dueDate2,
          totalAmount: 1044500,
          scanFilePath: null,
          paymentStatus: 'UNPAID',
          notes:
            'Penerimaan faktur PBF Enseval untuk stok cadangan paracetamol dan antihipertensi.',
        },
        {
          invoiceNumber: 'INV/AAM/2026/1003',
          supplierId: supAam.id,
          receivedByUserId: aptRinaUser.id,
          invoiceDate: invoiceDate3,
          dueDate: dueDate3,
          totalAmount: 1830000,
          scanFilePath: null,
          paymentStatus: 'UNPAID',
          notes:
            'Penerimaan faktur PBF Anugrah Argon Medica untuk sefalosporin dan amlodipine.',
        },
      ])
      .returning();

    await tx.insert(pbfInvoiceItems).values([
      {
        invoiceId: invKftd.id,
        medicineId: medSanmol.id,
        batchId: batchSanmolEarly.id,
        batchNumber: batchSanmolEarly.batchNumber,
        expiryDate: expSanmolEarly,
        uomUnitName: 'Box',
        qtyInUom: 2,
        multiplierToBase: 100,
        receivedBaseQty: 200,
        purchasePricePerUom: 41000,
        costPricePerBaseUnit: '410.0000',
        lineTotal: 82000,
      },
      {
        invoiceId: invKftd.id,
        medicineId: medAmoxsan.id,
        batchId: batchAmoxsanExpired.id,
        batchNumber: batchAmoxsanExpired.batchNumber,
        expiryDate: expAmoxsanExpired,
        uomUnitName: 'Box',
        qtyInUom: 1,
        multiplierToBase: 100,
        receivedBaseQty: 100,
        purchasePricePerUom: 310000,
        costPricePerBaseUnit: '3100.0000',
        lineTotal: 310000,
      },
      {
        invoiceId: invKftd.id,
        medicineId: medAmoxsan.id,
        batchId: batchAmoxsanActive.id,
        batchNumber: batchAmoxsanActive.batchNumber,
        expiryDate: expAmoxsanActive,
        uomUnitName: 'Box',
        qtyInUom: 3,
        multiplierToBase: 100,
        receivedBaseQty: 300,
        purchasePricePerUom: 320000,
        costPricePerBaseUnit: '3200.0000',
        lineTotal: 960000,
      },
      {
        invoiceId: invKftd.id,
        medicineId: medPolysilane.id,
        batchId: batchPolysilane.id,
        batchNumber: batchPolysilane.batchNumber,
        expiryDate: expPolysilaneActive,
        uomUnitName: 'Box',
        qtyInUom: 4,
        multiplierToBase: 12,
        receivedBaseQty: 48,
        purchasePricePerUom: 246000,
        costPricePerBaseUnit: '20500.0000',
        lineTotal: 984000,
      },
      {
        invoiceId: invEnseval.id,
        medicineId: medSanmol.id,
        batchId: batchSanmolLate.id,
        batchNumber: batchSanmolLate.batchNumber,
        expiryDate: expSanmolLate,
        uomUnitName: 'Box',
        qtyInUom: 3,
        multiplierToBase: 100,
        receivedBaseQty: 300,
        purchasePricePerUom: 42000,
        costPricePerBaseUnit: '420.0000',
        lineTotal: 126000,
      },
      {
        invoiceId: invEnseval.id,
        medicineId: medPamol.id,
        batchId: batchPamolActive.id,
        batchNumber: batchPamolActive.batchNumber,
        expiryDate: expPamolActive,
        uomUnitName: 'Box',
        qtyInUom: 4,
        multiplierToBase: 100,
        receivedBaseQty: 400,
        purchasePricePerUom: 44000,
        costPricePerBaseUnit: '440.0000',
        lineTotal: 176000,
      },
      {
        invoiceId: invEnseval.id,
        medicineId: medNorvask.id,
        batchId: batchNorvaskEpm.id,
        batchNumber: batchNorvaskEpm.batchNumber,
        expiryDate: expNorvaskEpm,
        uomUnitName: 'Box',
        qtyInUom: 5,
        multiplierToBase: 30,
        receivedBaseQty: 150,
        purchasePricePerUom: 148500,
        costPricePerBaseUnit: '4950.0000',
        lineTotal: 742500,
      },
      {
        invoiceId: invAam.id,
        medicineId: medCefspan.id,
        batchId: batchCefspanNear.id,
        batchNumber: batchCefspanNear.batchNumber,
        expiryDate: expCefspanNearEd,
        uomUnitName: 'Box',
        qtyInUom: 5,
        multiplierToBase: 30,
        receivedBaseQty: 150,
        purchasePricePerUom: 252000,
        costPricePerBaseUnit: '8400.0000',
        lineTotal: 1260000,
      },
      {
        invoiceId: invAam.id,
        medicineId: medNorvask.id,
        batchId: batchNorvaskAam.id,
        batchNumber: batchNorvaskAam.batchNumber,
        expiryDate: expNorvaskAam,
        uomUnitName: 'Box',
        qtyInUom: 4,
        multiplierToBase: 30,
        receivedBaseQty: 120,
        purchasePricePerUom: 142500,
        costPricePerBaseUnit: '4750.0000',
        lineTotal: 570000,
      },
    ]);

    // 8. Seed Sales Transactions, Sale Items, & Batch Allocations (Untuk Analitik Pareto ABC & Defekta)
    const [sale1, sale2, sale3] = await tx
      .insert(salesTransactions)
      .values([
        {
          receiptNumber: 'POS-20261101-0001',
          cashierId: kasirBudiUser.id,
          pricingTier: 'REGULAR',
          customerName: 'Pasien Umum Rawat Jalan',
          paymentMethod: 'QRIS',
          totalAmount: 1909000,
          amountPaid: 1909000,
          changeAmount: 0,
        },
        {
          receiptNumber: 'POS-20261102-0002',
          cashierId: kasirBudiUser.id,
          pricingTier: 'PARTNER',
          customerName: 'Klinik Pratama Sehat Bersama',
          paymentMethod: 'DEBIT',
          totalAmount: 1094000,
          amountPaid: 1094000,
          changeAmount: 0,
        },
        {
          receiptNumber: 'POS-20261103-0003',
          cashierId: kasirBudiUser.id,
          pricingTier: 'REGULAR',
          customerName: 'Tn. Rahmat Hidayat',
          paymentMethod: 'CASH',
          totalAmount: 398000,
          amountPaid: 400000,
          changeAmount: 2000,
        },
      ])
      .returning();

    const [
      saleItemAmox,
      saleItemCefspan,
      saleItemSanmol,
      saleItemNorvask,
      saleItemPamol,
      saleItemPoly,
    ] = await tx
      .insert(saleItems)
      .values([
        // Sale 1: Amoxsan 21 Strip (210 Tablet) + Cefspan 9 Strip (90 Tablet) + Sanmol 30 Strip (120 Tablet)
        {
          saleId: sale1.id,
          medicineId: medAmoxsan.id,
          uomUnitName: 'Strip',
          qtyInUom: 21,
          multiplierToBase: 10,
          totalBaseQty: 210,
          unitSellingPrice: 40000,
          subtotal: 840000,
        },
        {
          saleId: sale1.id,
          medicineId: medCefspan.id,
          uomUnitName: 'Strip',
          qtyInUom: 9,
          multiplierToBase: 10,
          totalBaseQty: 90,
          unitSellingPrice: 110000,
          subtotal: 990000,
        },
        {
          saleId: sale1.id,
          medicineId: medSanmol.id,
          uomUnitName: 'Strip',
          qtyInUom: 30,
          multiplierToBase: 4,
          totalBaseQty: 120,
          unitSellingPrice: 2300,
          subtotal: 69000,
        },
        // Sale 2: Norvask 18 Strip (180 Tablet) Partner Tier
        {
          saleId: sale2.id,
          medicineId: medNorvask.id,
          uomUnitName: 'Strip',
          qtyInUom: 18,
          multiplierToBase: 10,
          totalBaseQty: 180,
          unitSellingPrice: 57000,
          subtotal: 1026000,
        },
        // Sale 3: Pamol 1 Box (100 Tablet) + Polysilane 12 Botol
        {
          saleId: sale3.id,
          medicineId: medPamol.id,
          uomUnitName: 'Box',
          qtyInUom: 1,
          multiplierToBase: 100,
          totalBaseQty: 100,
          unitSellingPrice: 59000,
          subtotal: 59000,
        },
        {
          saleId: sale3.id,
          medicineId: medPolysilane.id,
          uomUnitName: 'Botol',
          qtyInUom: 12,
          multiplierToBase: 1,
          totalBaseQty: 12,
          unitSellingPrice: 28000,
          subtotal: 336000,
        },
      ])
      .returning();

    await tx.insert(saleItemBatchAllocations).values([
      {
        saleItemId: saleItemAmox.id,
        batchId: batchAmoxsanActive.id,
        batchNumberSnapshot: batchAmoxsanActive.batchNumber,
        expiryDateSnapshot: expAmoxsanActive,
        allocatedBaseQty: 210,
        unitCostPriceSnapshot: '3200.0000',
      },
      {
        saleItemId: saleItemCefspan.id,
        batchId: batchCefspanNear.id,
        batchNumberSnapshot: batchCefspanNear.batchNumber,
        expiryDateSnapshot: expCefspanNearEd,
        allocatedBaseQty: 90,
        unitCostPriceSnapshot: '8400.0000',
      },
      {
        saleItemId: saleItemSanmol.id,
        batchId: batchSanmolEarly.id,
        batchNumberSnapshot: batchSanmolEarly.batchNumber,
        expiryDateSnapshot: expSanmolEarly,
        allocatedBaseQty: 120,
        unitCostPriceSnapshot: '410.0000',
      },
      {
        saleItemId: saleItemNorvask.id,
        batchId: batchNorvaskEpm.id,
        batchNumberSnapshot: batchNorvaskEpm.batchNumber,
        expiryDateSnapshot: expNorvaskEpm,
        allocatedBaseQty: 100,
        unitCostPriceSnapshot: '4950.0000',
      },
      {
        saleItemId: saleItemNorvask.id,
        batchId: batchNorvaskAam.id,
        batchNumberSnapshot: batchNorvaskAam.batchNumber,
        expiryDateSnapshot: expNorvaskAam,
        allocatedBaseQty: 80,
        unitCostPriceSnapshot: '4750.0000',
      },
      {
        saleItemId: saleItemPamol.id,
        batchId: batchPamolActive.id,
        batchNumberSnapshot: batchPamolActive.batchNumber,
        expiryDateSnapshot: expPamolActive,
        allocatedBaseQty: 100,
        unitCostPriceSnapshot: '440.0000',
      },
      {
        saleItemId: saleItemPoly.id,
        batchId: batchPolysilane.id,
        batchNumberSnapshot: batchPolysilane.batchNumber,
        expiryDateSnapshot: expPolysilaneActive,
        allocatedBaseQty: 12,
        unitCostPriceSnapshot: '20500.0000',
      },
    ]);

    // 9. Seed Kartu Stok Digital (IN_INVOICE & OUT_SALE)
    await tx.insert(stockCards).values([
      {
        medicineId: medSanmol.id,
        batchId: batchSanmolEarly.id,
        actorUserId: aptRinaUser.id,
        movementType: 'IN_INVOICE',
        referenceId: invKftd.invoiceNumber,
        qtyChange: 200,
        balanceAfter: 200,
        notes: 'Penerimaan faktur PBF Kimia Farma',
      },
      {
        medicineId: medSanmol.id,
        batchId: batchSanmolLate.id,
        actorUserId: aptRinaUser.id,
        movementType: 'IN_INVOICE',
        referenceId: invEnseval.invoiceNumber,
        qtyChange: 300,
        balanceAfter: 300,
        notes: 'Penerimaan faktur PBF Enseval',
      },
      {
        medicineId: medSanmol.id,
        batchId: batchSanmolEarly.id,
        actorUserId: kasirBudiUser.id,
        movementType: 'OUT_SALE',
        referenceId: sale1.receiptNumber,
        qtyChange: -120,
        balanceAfter: 80,
        notes: 'Penjualan POS FEFO otomatis',
      },
      {
        medicineId: medPamol.id,
        batchId: batchPamolActive.id,
        actorUserId: aptRinaUser.id,
        movementType: 'IN_INVOICE',
        referenceId: invEnseval.invoiceNumber,
        qtyChange: 400,
        balanceAfter: 400,
        notes: 'Penerimaan faktur PBF Enseval',
      },
      {
        medicineId: medPamol.id,
        batchId: batchPamolActive.id,
        actorUserId: kasirBudiUser.id,
        movementType: 'OUT_SALE',
        referenceId: sale3.receiptNumber,
        qtyChange: -100,
        balanceAfter: 300,
        notes: 'Penjualan POS FEFO otomatis',
      },
      {
        medicineId: medAmoxsan.id,
        batchId: batchAmoxsanActive.id,
        actorUserId: aptRinaUser.id,
        movementType: 'IN_INVOICE',
        referenceId: invKftd.invoiceNumber,
        qtyChange: 300,
        balanceAfter: 300,
        notes: 'Penerimaan faktur PBF Kimia Farma',
      },
      {
        medicineId: medAmoxsan.id,
        batchId: batchAmoxsanActive.id,
        actorUserId: kasirBudiUser.id,
        movementType: 'OUT_SALE',
        referenceId: sale1.receiptNumber,
        qtyChange: -210,
        balanceAfter: 90,
        notes: 'Penjualan POS FEFO otomatis (batch kedaluwarsa dilewati)',
      },
      {
        medicineId: medCefspan.id,
        batchId: batchCefspanNear.id,
        actorUserId: aptRinaUser.id,
        movementType: 'IN_INVOICE',
        referenceId: invAam.invoiceNumber,
        qtyChange: 150,
        balanceAfter: 150,
        notes: 'Penerimaan faktur PBF Anugrah Argon Medica',
      },
      {
        medicineId: medCefspan.id,
        batchId: batchCefspanNear.id,
        actorUserId: kasirBudiUser.id,
        movementType: 'OUT_SALE',
        referenceId: sale1.receiptNumber,
        qtyChange: -90,
        balanceAfter: 60,
        notes: 'Penjualan POS FEFO otomatis',
      },
      {
        medicineId: medNorvask.id,
        batchId: batchNorvaskEpm.id,
        actorUserId: aptRinaUser.id,
        movementType: 'IN_INVOICE',
        referenceId: invEnseval.invoiceNumber,
        qtyChange: 150,
        balanceAfter: 150,
        notes: 'Penerimaan faktur PBF Enseval',
      },
      {
        medicineId: medNorvask.id,
        batchId: batchNorvaskEpm.id,
        actorUserId: kasirBudiUser.id,
        movementType: 'OUT_SALE',
        referenceId: sale2.receiptNumber,
        qtyChange: -100,
        balanceAfter: 50,
        notes: 'Penjualan POS mitra klinik FEFO batch pertama',
      },
      {
        medicineId: medNorvask.id,
        batchId: batchNorvaskAam.id,
        actorUserId: aptRinaUser.id,
        movementType: 'IN_INVOICE',
        referenceId: invAam.invoiceNumber,
        qtyChange: 120,
        balanceAfter: 120,
        notes: 'Penerimaan faktur PBF Anugrah Argon Medica',
      },
      {
        medicineId: medNorvask.id,
        batchId: batchNorvaskAam.id,
        actorUserId: kasirBudiUser.id,
        movementType: 'OUT_SALE',
        referenceId: sale2.receiptNumber,
        qtyChange: -80,
        balanceAfter: 40,
        notes: 'Penjualan POS mitra klinik FEFO batch kedua',
      },
      {
        medicineId: medPolysilane.id,
        batchId: batchPolysilane.id,
        actorUserId: aptRinaUser.id,
        movementType: 'IN_INVOICE',
        referenceId: invKftd.invoiceNumber,
        qtyChange: 48,
        balanceAfter: 48,
        notes: 'Penerimaan faktur PBF Kimia Farma',
      },
      {
        medicineId: medPolysilane.id,
        batchId: batchPolysilane.id,
        actorUserId: kasirBudiUser.id,
        movementType: 'OUT_SALE',
        referenceId: sale3.receiptNumber,
        qtyChange: -12,
        balanceAfter: 36,
        notes: 'Penjualan POS FEFO otomatis',
      },
    ]);
  });
}

if (require.main === module) {
  seedDatabase()
    .then(async () => {
      console.log(
        'Seed basis data Raddina Health Service selesai dijalankan secara idempoten.',
      );
      await pgPool.end();
      process.exit(0);
    })
    .catch(async (error: unknown) => {
      console.error('Gagal menjalankan seed basis data:', error);
      await pgPool.end();
      process.exit(1);
    });
}
