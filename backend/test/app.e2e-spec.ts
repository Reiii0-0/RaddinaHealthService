import { INestApplication, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/main';
import { resetAndSeedDatabase, closeDatabasePool } from './helpers/test-db.helper';
import { db } from '../src/db';
import { categories, medicines, suppliers, medicineBatches, stockCards } from '../src/db/schema';
import { eq } from 'drizzle-orm';

describe('Raddina Health Service (RHS) - Comprehensive E2E Test Suite', () => {
  let app: INestApplication;
  let ownerToken: string;
  let pharmacistToken: string;
  let expiredPharmacistToken: string;
  let cashierToken: string;

  let seededCategoryId: string;
  let seededSupplierId: string;
  let seededSanmolId: string;
  let seededNorvaskId: string;
  let seededAmoxsanId: string;
  let seededPamolId: string;

  beforeAll(async () => {
    // 1. Reset dan inisialisasi basis data idempoten
    await resetAndSeedDatabase();

    // 2. Ambil ID entitas yang telah di-seed untuk digunakan di seluruh skenario
    const [cat] = await db.select().from(categories).limit(1);
    seededCategoryId = cat.id;

    const [sup] = await db.select().from(suppliers).limit(1);
    seededSupplierId = sup.id;

    const medRows = await db.select().from(medicines);
    for (const med of medRows) {
      if (med.sku === 'MED-PCT-500') seededSanmolId = med.id;
      if (med.sku === 'MED-AML-010') seededNorvaskId = med.id;
      if (med.sku === 'MED-AMX-500') seededAmoxsanId = med.id;
      if (med.sku === 'MED-PCM-500') seededPamolId = med.id;
    }

    // 3. Inisialisasi NestJS TestingModule dan konfigurasi Express App
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const expressApp = moduleFixture.createNestApplication<NestExpressApplication>();
    await configureApp(expressApp);
    app = expressApp;
    await app.init();

    // 4. Siapkan token autentikasi awal untuk masing-masing peran
    const ownerLoginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'owner@raddina.id', password: 'RaddinaOwner123!' });
    ownerToken = ownerLoginRes.body.accessToken;

    const aptLoginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'apt.rina@raddina.id', password: 'RaddinaApt123!' });
    pharmacistToken = aptLoginRes.body.accessToken;

    const aptExpLoginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'apt.expired@raddina.id', password: 'RaddinaExp123!' });
    expiredPharmacistToken = aptExpLoginRes.body.accessToken;

    const kasirLoginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'kasir.budi@raddina.id', password: 'RaddinaKasir123!' });
    cashierToken = kasirLoginRes.body.accessToken;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await closeDatabasePool();
  });

  // ==========================================================================
  // US-01: AUTENTIKASI, RBAC, & LISENSI SIPA (SKENARIO 1 - 7)
  // ==========================================================================

  describe('US-01: Autentikasi, RBAC, dan Validasi Lisensi SIPA', () => {
    let newlyRegisteredCashierId: string;
    let newlyRegisteredCashierEmail: string;

    it('US-01 Skenario 1: Registrasi publik berhasil (201 Created) dan peran otomatis terkunci sebagai CASHIER', async () => {
      newlyRegisteredCashierEmail = `kasir.baru.${Date.now()}@raddina.id`;
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: newlyRegisteredCashierEmail,
          password: 'RaddinaKasirBaru123!',
          fullName: 'Siti Aminah, A.Md.Farm.',
        })
        .expect(HttpStatus.CREATED);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(newlyRegisteredCashierEmail);
      expect(response.body.user.role).toBe('CASHIER');
      expect(response.body.user.noSipa).toBeNull();
      expect(response.body.user.isSipaActive).toBe(false);

      newlyRegisteredCashierId = response.body.user.id;
    });

    it('US-01 Skenario 2: Upaya eskalasi hak akses pada registrasi publik (mengirim role: OWNER atau noSipa) ditolak HTTP 400 Bad Request', async () => {
      const escalateRoleResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: `attacker.role.${Date.now()}@raddina.id`,
          password: 'AttackerPassword123!',
          fullName: 'Hacker Privilege',
          role: 'OWNER',
        })
        .expect(HttpStatus.BAD_REQUEST);

      expect(escalateRoleResponse.body.statusCode).toBe(400);

      const escalateSipaResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: `attacker.sipa.${Date.now()}@raddina.id`,
          password: 'AttackerPassword123!',
          fullName: 'Hacker Fake SIPA',
          noSipa: '123456/SIPA_PALSU/2026',
        })
        .expect(HttpStatus.BAD_REQUEST);

      expect(escalateSipaResponse.body.statusCode).toBe(400);
    });

    it('US-01 Skenario 3: Login kasir dengan kredensial valid berhasil (200 OK) dan mengembalikan accessToken, refreshToken, serta profil user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'kasir.budi@raddina.id',
          password: 'RaddinaKasir123!',
        })
        .expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('kasir.budi@raddina.id');
      expect(response.body.user.role).toBe('CASHIER');
      expect(response.body.user.fullName).toBe('Budi Santoso, A.Md.Farm.');
    });

    it('US-01 Skenario 4: Login gagal dengan kata sandi salah menghasilkan HTTP 401 Unauthorized', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'kasir.budi@raddina.id',
          password: 'PasswordSalahTotal999!',
        })
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body.statusCode).toBe(401);
      expect(response.body.errorCode).toBe('UNAUTHORIZED');
    });

    it('US-01 Skenario 5: Rotasi refresh token berhasil menghasilkan token baru, dan token lama dicabut', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: newlyRegisteredCashierEmail,
          password: 'RaddinaKasirBaru123!',
        })
        .expect(HttpStatus.OK);

      const oldRefreshToken = loginRes.body.refreshToken;

      // Rotasi token
      const refreshRes = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: oldRefreshToken })
        .expect(HttpStatus.OK);

      expect(refreshRes.body).toHaveProperty('accessToken');
      expect(refreshRes.body).toHaveProperty('refreshToken');
      expect(refreshRes.body.refreshToken).not.toBe(oldRefreshToken);

      // Coba gunakan token lama yang sudah dicabut -> Wajib ditolak HTTP 401
      const replayRes = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: oldRefreshToken })
        .expect(HttpStatus.UNAUTHORIZED);

      expect(replayRes.body.statusCode).toBe(401);
      expect(replayRes.body.errorCode).toBe('UNAUTHORIZED');
    });

    it('US-01 Skenario 6: Penegakan RBAC — Akun kasir mencoba mengakses rute khusus OWNER ditolak HTTP 403 Forbidden', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/users/${newlyRegisteredCashierId}/role`)
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          role: 'PHARMACIST',
          noSipa: '19950101/SIPA_35.78/2026/0011',
          sipaExpiryDate: '2029-12-31',
        })
        .expect(HttpStatus.FORBIDDEN);

      expect(response.body.statusCode).toBe(403);
      expect(response.body.errorCode).toBe('FORBIDDEN');
    });

    it('US-01 Skenario 7: Akun OWNER berhasil mengubah peran kasir menjadi PHARMACIST dengan nomor SIPA dan tanggal kedaluwarsa sah (200 OK)', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/users/${newlyRegisteredCashierId}/role`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          role: 'PHARMACIST',
          noSipa: '19950101/SIPA_35.78/2026/0011',
          sipaExpiryDate: '2029-12-31',
        })
        .expect(HttpStatus.OK);

      expect(response.body.id).toBe(newlyRegisteredCashierId);
      expect(response.body.role).toBe('PHARMACIST');
      expect(response.body.noSipa).toBe('19950101/SIPA_35.78/2026/0011');
      expect(response.body.sipaExpiryDate).toBe('2029-12-31');
      expect(response.body.isSipaActive).toBe(true);
    });
  });

  // ==========================================================================
  // US-02: MASTER OBAT, MULTI-UOM, & VALIDASI BERKAS UNGGAH (SKENARIO 8 - 11)
  // ==========================================================================

  describe('US-02: Master Obat, Konversi Multi-UOM, dan Validasi Berkas', () => {
    let createdMedicineId: string;

    it('US-02 Skenario 8: Pembuatan master obat baru dengan konversi Multi-UOM oleh Apoteker berhasil (201 Created)', async () => {
      const newSku = `MED-IBU-${Date.now().toString().slice(-4)}`;
      const response = await request(app.getHttpServer())
        .post('/api/v1/medicines')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          sku: newSku,
          name: 'Ibuprofen 400 mg Tablet Forte',
          categoryId: seededCategoryId,
          activeIngredient: 'Ibuprofen 400 mg',
          baseUnit: 'Tablet',
          classification: 'BEBAS_TERBATAS',
          minStockBaseUnit: 100,
          uomConversions: [
            {
              unitName: 'Tablet',
              multiplierToBase: 1,
              sellingPriceRegular: 1200,
              sellingPricePartner: 1000,
              barcode: '899123450001',
            },
            {
              unitName: 'Strip',
              multiplierToBase: 10,
              sellingPriceRegular: 11500,
              sellingPricePartner: 9800,
              barcode: '899123450002',
            },
            {
              unitName: 'Box',
              multiplierToBase: 100,
              sellingPriceRegular: 110000,
              sellingPricePartner: 95000,
              barcode: '899123450003',
            },
          ],
        })
        .expect(HttpStatus.CREATED);

      expect(response.body).toHaveProperty('id');
      expect(response.body.sku).toBe(newSku);
      expect(response.body.name).toBe('Ibuprofen 400 mg Tablet Forte');
      expect(response.body.uomConversions).toHaveLength(3);
      expect(response.body.classification).toBe('BEBAS_TERBATAS');

      createdMedicineId = response.body.id;
    });

    it('US-02 Skenario 9: Pengunggahan foto obat valid (JPEG asli dengan magic bytes FF D8 FF) berhasil (201 Created)', async () => {
      // Magic bytes JPEG valid: FF D8 FF E0
      const validJpegBuffer = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
      ]);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/medicines/${createdMedicineId}/image`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .attach('file', validJpegBuffer, 'ibuprofen-box.jpg')
        .expect(HttpStatus.CREATED);

      expect(response.body.id).toBe(createdMedicineId);
      expect(response.body.imagePath).toBeDefined();
      expect(response.body.imagePath).toContain('/uploads/medicines/');
      expect(response.body.imagePath).toMatch(/\.jpg$/i);
    });

    it('US-02 Skenario 10: Pengunggahan berkas manipulasi (.jpg palsu berisi teks acak) ditolak FileSignatureValidationPipe HTTP 400 Bad Request', async () => {
      const fakeImageContent = Buffer.from(
        'INI_BUKAN_GAMBAR_JPEG_ASLI_TETAPI_TEKS_BIASA_YANG_DIMANIPULASI',
      );

      const response = await request(app.getHttpServer())
        .post(`/api/v1/medicines/${createdMedicineId}/image`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .attach('file', fakeImageContent, 'hacker-fake.jpg')
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.message).toContain('magic bytes');
    });

    it('US-02 Skenario 11: Pengunggahan berkas melebihi ukuran 5 MB ditolak dengan HTTP 413 Payload Too Large', async () => {
      // Buat buffer melebihi 5 MB (5 * 1024 * 1024 + 1024 byte)
      const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 1024);
      oversizedBuffer[0] = 0xff;
      oversizedBuffer[1] = 0xd8;
      oversizedBuffer[2] = 0xff;
      oversizedBuffer[3] = 0xe0;

      const response = await request(app.getHttpServer())
        .post(`/api/v1/medicines/${createdMedicineId}/image`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .attach('file', oversizedBuffer, 'oversized-packaging.jpg')
        .expect(HttpStatus.PAYLOAD_TOO_LARGE);

      expect(response.body.statusCode).toBe(413);
      expect(response.body.errorCode).toBe('PAYLOAD_TOO_LARGE');
    });
  });

  // ==========================================================================
  // US-03: PENERIMAAN FAKTUR PBF & KARTU STOK APPEND-ONLY (SKENARIO 12)
  // ==========================================================================

  describe('US-03: Penerimaan Faktur PBF, Konversi Multiplier, dan Kartu Stok', () => {
    it('US-03 Skenario 12: Penerimaan faktur PBF multi-item menghitung kuantitas dasar via multiplier, HPP dasar, menambah stok batch, dan mencatat stock_cards (201 Created)', async () => {
      const invNumber = `INV-E2E-${Date.now()}`;
      const batchNoSanmol = `BATCH-SNM-E2E-${Date.now().toString().slice(-4)}`;
      const batchNoNorvask = `BATCH-NVK-E2E-${Date.now().toString().slice(-4)}`;

      // Tanggal ED di masa depan (misal 1 tahun ke depan)
      const futureExpiry = new Date();
      futureExpiry.setFullYear(futureExpiry.getFullYear() + 2);
      const expiryDateStr = futureExpiry.toISOString().slice(0, 10);

      const invoiceDateStr = new Date().toISOString().slice(0, 10);
      const dueDateStr = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

      // Item 1: Sanmol beli 2 Box (multiplier 100 -> receivedBaseQty = 200 Tab), harga beli Rp40.000/Box -> HPP Tab = Rp400,0000
      // Item 2: Norvask beli 3 Box (multiplier 30 -> receivedBaseQty = 90 Tab), harga beli Rp150.000/Box -> HPP Tab = Rp5.000,0000
      const payload = {
        invoiceNumber: invNumber,
        supplierId: seededSupplierId,
        invoiceDate: invoiceDateStr,
        dueDate: dueDateStr,
        notes: 'Penerimaan faktur pengujian E2E supertest',
        items: [
          {
            medicineId: seededSanmolId,
            batchNumber: batchNoSanmol,
            expiryDate: expiryDateStr,
            uomUnitName: 'Box',
            qtyInUom: 2,
            purchasePricePerUom: 40000,
          },
          {
            medicineId: seededNorvaskId,
            batchNumber: batchNoNorvask,
            expiryDate: expiryDateStr,
            uomUnitName: 'Box',
            qtyInUom: 3,
            purchasePricePerUom: 150000,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send(payload)
        .expect(HttpStatus.CREATED);

      expect(response.body).toHaveProperty('id');
      expect(response.body.invoiceNumber).toBe(invNumber);
      expect(response.body.totalAmount).toBe(2 * 40000 + 3 * 150000); // 80.000 + 450.000 = 530.000
      expect(response.body.items).toHaveLength(2);

      const itemSanmol = response.body.items.find(
        (i: any) => i.medicineId === seededSanmolId,
      );
      expect(itemSanmol).toBeDefined();
      expect(itemSanmol.receivedBaseQty).toBe(200);
      expect(Number(itemSanmol.costPricePerBaseUnit)).toBe(400);

      const itemNorvask = response.body.items.find(
        (i: any) => i.medicineId === seededNorvaskId,
      );
      expect(itemNorvask).toBeDefined();
      expect(itemNorvask.receivedBaseQty).toBe(90);
      expect(Number(itemNorvask.costPricePerBaseUnit)).toBe(5000);

      // Verifikasi batch terbentuk di database
      const [batchSanmolDb] = await db
        .select()
        .from(medicineBatches)
        .where(eq(medicineBatches.batchNumber, batchNoSanmol));
      expect(batchSanmolDb).toBeDefined();
      expect(batchSanmolDb.currentStock).toBe(200);

      // Verifikasi mutasi IN_INVOICE di kartu stok
      const stockCardEntries = await db
        .select()
        .from(stockCards)
        .where(eq(stockCards.referenceId, invNumber));
      expect(stockCardEntries.length).toBeGreaterThanOrEqual(2);
      expect(
        stockCardEntries.every((sc) => sc.movementType === 'IN_INVOICE' && sc.qtyChange > 0),
      ).toBe(true);
    });
  });

  // ==========================================================================
  // US-04: MESIN KASIR POS, ATOMIC FEFO, & DEFENSIVE SHORTAGE (SKENARIO 13 - 15)
  // ==========================================================================

  describe('US-04: Transaksi Kasir POS dan Alokasi FEFO Multi-Batch', () => {
    it('US-04 Skenario 13: Pratinjau alokasi FEFO kasir POS mengembalikan urutan batch FEFO terpotong terurut dari ED terdekat (200 OK)', async () => {
      // Norvask di seeder memiliki 2 batch aktif:
      // BATCH-NVK-26A: ED 240 hari, stok 50
      // BATCH-NVK-26B: ED 300 hari, stok 40
      // Kasir meminta 6 Strip (6 * 10 = 60 Tablet)
      const response = await request(app.getHttpServer())
        .post('/api/v1/sales/preview-fefo')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          pricingTier: 'REGULAR',
          items: [
            {
              medicineId: seededNorvaskId,
              uomUnitName: 'Strip',
              qtyInUom: 6,
            },
          ],
        })
        .expect(HttpStatus.OK);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);

      const preview = response.body[0];
      expect(preview.medicineId).toBe(seededNorvaskId);
      expect(preview.requiredBaseQty).toBe(60);
      expect(preview.isSufficient).toBe(true);
      expect(preview.allocations.length).toBeGreaterThanOrEqual(2);

      // Alokasi pertama harus mengambil seluruh 50 tablet dari batch ber-ED terdekat (BATCH-NVK-26A)
      expect(preview.allocations[0].batchNumber).toBe('BATCH-NVK-26A');
      expect(preview.allocations[0].allocatedBaseQty).toBe(50);

      // Alokasi kedua mengambil sisa 10 tablet dari batch berikutnya (BATCH-NVK-26B)
      expect(preview.allocations[1].batchNumber).toBe('BATCH-NVK-26B');
      expect(preview.allocations[1].allocatedBaseQty).toBe(10);
    });

    it('US-04 Skenario 14: Transaksi kasir checkout memotong stok batch secara atomik, mencatat alokasi batch, dan menambahkan kartu stok OUT_SALE (201 Created)', async () => {
      // Ambil stok awal kedua batch Norvask sebelum checkout
      const [batchA_before] = await db
        .select()
        .from(medicineBatches)
        .where(eq(medicineBatches.batchNumber, 'BATCH-NVK-26A'));
      const [batchB_before] = await db
        .select()
        .from(medicineBatches)
        .where(eq(medicineBatches.batchNumber, 'BATCH-NVK-26B'));

      const stockABefore = batchA_before.currentStock;
      const stockBBefore = batchB_before.currentStock;

      // Harga Norvask Reguler: 1 Strip = Rp65.000, 6 Strip = Rp390.000
      const checkoutRes = await request(app.getHttpServer())
        .post('/api/v1/sales/checkout')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          pricingTier: 'REGULAR',
          customerName: 'Ny. Fatimah Az-Zahra',
          paymentMethod: 'CASH',
          amountPaid: 400000,
          items: [
            {
              medicineId: seededNorvaskId,
              uomUnitName: 'Strip',
              qtyInUom: 6,
            },
          ],
        })
        .expect(HttpStatus.CREATED);

      expect(checkoutRes.body).toHaveProperty('id');
      expect(checkoutRes.body).toHaveProperty('receiptNumber');
      expect(checkoutRes.body.totalAmount).toBe(390000);
      expect(checkoutRes.body.amountPaid).toBe(400000);
      expect(checkoutRes.body.changeAmount).toBe(10000);
      expect(checkoutRes.body.items).toHaveLength(1);

      const receiptNumber = checkoutRes.body.receiptNumber;

      // Verifikasi stok batch A berkurang sebesar 50
      const [batchA_after] = await db
        .select()
        .from(medicineBatches)
        .where(eq(medicineBatches.batchNumber, 'BATCH-NVK-26A'));
      expect(batchA_after.currentStock).toBe(stockABefore - 50);

      // Verifikasi stok batch B berkurang sebesar 10
      const [batchB_after] = await db
        .select()
        .from(medicineBatches)
        .where(eq(medicineBatches.batchNumber, 'BATCH-NVK-26B'));
      expect(batchB_after.currentStock).toBe(stockBBefore - 10);

      // Verifikasi catatan kartu stok OUT_SALE di database
      const stockCardSales = await db
        .select()
        .from(stockCards)
        .where(eq(stockCards.referenceId, receiptNumber));
      expect(stockCardSales).toHaveLength(2);
      expect(
        stockCardSales.every((sc) => sc.movementType === 'OUT_SALE' && sc.qtyChange < 0),
      ).toBe(true);
    });

    it('US-04 Skenario 15: Transaksi kasir checkout ditolak HTTP 422 Unprocessable Entity (INSUFFICIENT_FEFO_STOCK) jika melebihi stok aktif layak jual, serta mengembalikan obat pengganti', async () => {
      // Amoxsan di database hanya memiliki 90 tablet aktif (batch kedaluwarsa 40 tablet wajib dilewati)
      // Coba beli 20 Box (20 * 100 = 2000 Tablet)
      const response = await request(app.getHttpServer())
        .post('/api/v1/sales/checkout')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          pricingTier: 'REGULAR',
          customerName: 'Pasien Meminta Jumlah Raksasa',
          paymentMethod: 'CASH',
          amountPaid: 10000000,
          items: [
            {
              medicineId: seededAmoxsanId,
              uomUnitName: 'Box',
              qtyInUom: 20,
            },
          ],
        })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY);

      expect(response.body.statusCode).toBe(422);
      expect(response.body.errorCode).toBe('INSUFFICIENT_FEFO_STOCK');
      expect(response.body.message).toContain('Stok layak jual obat');
      expect(response.body.details).toBeDefined();
      expect(Array.isArray(response.body.details.substitutes)).toBe(true);
    });
  });

  // ==========================================================================
  // US-05: ANALITIK PARETO ABC & KALKULASI DEFEKTA OTOMATIS (SKENARIO 16 - 17)
  // ==========================================================================

  describe('US-05: Analitik Pareto ABC 80/20 dan Buku Defekta Otomatis', () => {
    it('US-05 Skenario 16: Kalkulasi analitik Pareto ABC mengklasifikasikan item secara presisi dengan batas C_{k-1} < 0.80 masuk Kelas A (200 OK)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/analytics/pareto/recalculate?days=90')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('updatedCount');
      expect(response.body).toHaveProperty('summary');
      expect(response.body.summary).toHaveProperty('classA');
      expect(response.body.summary).toHaveProperty('classB');
      expect(response.body.summary).toHaveProperty('classC');

      // Ambil daftar analitik Pareto untuk memverifikasi obat urutan pertama masuk Kelas A
      const listRes = await request(app.getHttpServer())
        .get('/api/v1/analytics/pareto?days=90')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray(listRes.body)).toBe(true);
      expect(listRes.body.length).toBeGreaterThan(0);

      const topItem = listRes.body[0];
      expect(topItem.rank).toBe(1);
      expect(topItem.paretoClass).toBe('A');
      expect(topItem.totalRevenue).toBeGreaterThan(0);
    });

    it('US-05 Skenario 17: Kalkulasi buku Defekta hanya menampilkan obat dengan ROP > 0 dan S <= ROP, serta merekomendasikan pemasok PBF termurah 90 hari terakhir (200 OK)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/procurement/defekta')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray(response.body)).toBe(true);

      for (const item of response.body) {
        expect(item.reorderPointRop).toBeGreaterThan(0);
        expect(item.currentActiveStock).toBeLessThanOrEqual(item.reorderPointRop);
        expect(item.recommendedOrderQty).toBeGreaterThanOrEqual(1);

        // Jika obat pernah dibeli, recommendedSupplier wajib terisi
        if (item.recommendedSupplier !== null) {
          expect(item.recommendedSupplier.supplierName).toBeDefined();
          expect(item.recommendedSupplier.lowestCostPerBaseUnit).toBeDefined();
        }
      }
    });
  });

  // ==========================================================================
  // US-06: SURAT PESANAN ELEKTRONIK (SP-EL) & NOTIFIKASI EMAIL (SKENARIO 18 - 20)
  // ==========================================================================

  describe('US-06: Penerbitan SP-el Berpelindung SIPA dan Notifikasi Email Mailpit', () => {
    it('US-06 Skenario 18: Penerbitan SP-el oleh Apoteker dengan SIPA kedaluwarsa ditolak ActiveSipaGuard HTTP 403 Forbidden', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/procurement/purchase-orders')
        .set('Authorization', `Bearer ${expiredPharmacistToken}`)
        .send({
          supplierId: seededSupplierId,
          notes: 'Percobaan pesanan oleh apoteker ber-SIPA kedaluwarsa',
          items: [
            {
              medicineId: seededSanmolId,
              orderedBaseQty: 500,
            },
          ],
        })
        .expect(HttpStatus.FORBIDDEN);

      expect(response.body.statusCode).toBe(403);
      expect(response.body.message).toContain('KEDALUWARSA');
    });

    it('US-06 Skenario 19: Penerbitan SP-el oleh Apoteker dengan SIPA aktif berhasil (201 Created), mencatat snapshot nomor SIPA, dan berstatus SENT_EMAIL', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/procurement/purchase-orders')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          supplierId: seededSupplierId,
          notes: 'Surat Pesanan Resmi Restock Paracetamol ke Kimia Farma',
          items: [
            {
              medicineId: seededSanmolId,
              orderedBaseQty: 300,
              estimatedUnitCost: '410.0000',
            },
          ],
        })
        .expect(HttpStatus.CREATED);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('spNumber');
      expect(response.body.pharmacistSipaSnapshot).toBe('19940812/SIPA_35.78/2024/1088');
      expect(response.body.status).toBe('SENT_EMAIL');
      expect(response.body.emailSentAt).toBeDefined();
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].orderedBaseQty).toBe(300);
    });

    it('US-06 Skenario 20: Pemicuan notifikasi digest obat mendekati kedaluwarsa berhasil (200 OK) dan mengirimkan ringkasan email ke Mailpit', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/notifications/near-expiry-digest')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .expect(HttpStatus.OK);

      expect(response.status).toBe(200);
      expect(response.body.batchCount).toBeGreaterThan(0);
      expect(Array.isArray(response.body.batches)).toBe(true);

      // Verifikasi batch Cefspan Near-ED (28 hari) ada di dalam daftar digest
      const cefspanNearBatch = response.body.batches.find(
        (b: any) => b.batchNumber === 'BATCH-CEF-NEAR01',
      );
      expect(cefspanNearBatch).toBeDefined();
      expect(cefspanNearBatch.expiryStatus).toBe('NEAR_EXPIRY');
    });
  });

  // ==========================================================================
  // SKENARIO TAMBAHAN: CAKUPAN PENUH (PAGINASI, UPDATE/DELETE OBAT, KONKURENSI)
  // ==========================================================================

  describe('Skenario Tambahan: Keamanan Token, CRUD Master, Scan Faktur, dan Konkurensi', () => {
    it('Skenario 21: Akses endpoint terproteksi tanpa token otentikasi ditolak HTTP 401 Unauthorized', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body.statusCode).toBe(401);
    });

    it('Skenario 22: Kasir logout berhasil mencabut sesi pengguna (200 OK)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${cashierToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.message).toContain('berhasil');
    });

    it('Skenario 23: Pencarian obat berdasarkan filter zat aktif mengembalikan daftar obat sekomposisi (200 OK)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/medicines?activeIngredient=Paracetamol')
        .set('Authorization', `Bearer ${cashierToken}`)
        .expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('items');
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body.items.length).toBeGreaterThanOrEqual(2);

      const names = response.body.items.map((i: any) => i.name);
      expect(names.some((n: string) => n.includes('Sanmol'))).toBe(true);
      expect(names.some((n: string) => n.includes('Pamol'))).toBe(true);
    });

    it('Skenario 24: Pembaruan master obat (PATCH /api/v1/medicines/:id) berhasil diperbarui (200 OK)', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/medicines/${seededSanmolId}`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          minStockBaseUnit: 250,
        })
        .expect(HttpStatus.OK);

      expect(response.body.id).toBe(seededSanmolId);
      expect(response.body.minStockBaseUnit).toBe(250);
    });

    it('Skenario 25: Pengunggahan berkas scan faktur PBF berformat PDF valid (magic bytes %PDF) berhasil (201 Created)', async () => {
      // Ambil faktur pertama dari database
      const [inv] = await request(app.getHttpServer())
        .get('/api/v1/invoices')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .expect(HttpStatus.OK)
        .then((r) => r.body);

      const validPdfBuffer = Buffer.from(
        '%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF',
      );

      const response = await request(app.getHttpServer())
        .post(`/api/v1/invoices/${inv.id}/scan`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .attach('file', validPdfBuffer, 'faktur-pbf-kftd.pdf')
        .expect(HttpStatus.CREATED);

      expect(response.body.id).toBe(inv.id);
      expect(response.body.scanFilePath).toBeDefined();
      expect(response.body.scanFilePath).toContain('/uploads/invoices/');
      expect(response.body.scanFilePath).toMatch(/\.pdf$/i);
    });

    it('Skenario 26: Kueri audit daftar batch dan riwayat mutasi kartu stok dengan paginasi berhasil (200 OK)', async () => {
      const batchesRes = await request(app.getHttpServer())
        .get('/api/v1/inventory/batches')
        .set('Authorization', `Bearer ${cashierToken}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray(batchesRes.body)).toBe(true);
      expect(batchesRes.body.length).toBeGreaterThan(0);

      const stockCardsRes = await request(app.getHttpServer())
        .get('/api/v1/inventory/stock-cards?limit=10')
        .set('Authorization', `Bearer ${cashierToken}`)
        .expect(HttpStatus.OK);

      expect(stockCardsRes.body).toHaveProperty('items');
      expect(Array.isArray(stockCardsRes.body.items)).toBe(true);
      expect(stockCardsRes.body.meta).toBeDefined();
      expect(stockCardsRes.body.meta.limit).toBe(10);
    });

    it('Skenario 27: Uji Balapan Konkurensi FEFO Atomik — Dua transaksi checkout kasir simultan memperebutkan sisa stok tanpa terjadi overselling', async () => {
      // Pamol memiliki sisa stok 300 tablet di batch BATCH-PML-26A
      // Jika dua kasir checkout secara simultan masing-masing meminta 2 Box (200 tablet), total 400 tablet
      // Salah satu kasir harus berhasil (201), dan kasir lainnya harus ditolak (422 INSUFFICIENT_FEFO_STOCK)
      // Tidak boleh ada saldo minus atau pemotongan melebihi 300 tablet!
      const checkoutA = request(app.getHttpServer())
        .post('/api/v1/sales/checkout')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          pricingTier: 'REGULAR',
          customerName: 'Kasir Balapan A',
          paymentMethod: 'CASH',
          amountPaid: 200000,
          items: [
            {
              medicineId: seededPamolId,
              uomUnitName: 'Box',
              qtyInUom: 2,
            },
          ],
        });

      const checkoutB = request(app.getHttpServer())
        .post('/api/v1/sales/checkout')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          pricingTier: 'REGULAR',
          customerName: 'Kasir Balapan B',
          paymentMethod: 'CASH',
          amountPaid: 200000,
          items: [
            {
              medicineId: seededPamolId,
              uomUnitName: 'Box',
              qtyInUom: 2,
            },
          ],
        });

      const [resA, resB] = await Promise.all([checkoutA, checkoutB]);

      const statuses = [resA.status, resB.status];
      expect(statuses).toContain(201);
      expect(statuses).toContain(422);

      // Verifikasi sisa stok di database tidak minus dan persis 100 tablet
      const [pamolBatch] = await db
        .select()
        .from(medicineBatches)
        .where(eq(medicineBatches.batchNumber, 'BATCH-PML-26A'));
      expect(pamolBatch.currentStock).toBe(100);
      expect(pamolBatch.currentStock).toBeGreaterThanOrEqual(0);
    });

    it('Skenario 28: Profil pengguna terautentikasi (GET /api/v1/auth/me) dan daftar pengguna oleh Apoteker (GET /api/v1/users) berhasil (200 OK)', async () => {
      const meRes = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .expect(HttpStatus.OK);

      expect(meRes.body.email).toBe('apt.rina@raddina.id');
      expect(meRes.body.role).toBe('PHARMACIST');

      const usersRes = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray(usersRes.body)).toBe(true);
      expect(usersRes.body.length).toBeGreaterThanOrEqual(4);
    });

    it('Skenario 29: Manajemen Kategori Obat — Apoteker membuat kategori baru dan membaca daftar kategori (201 & 200 OK)', async () => {
      const categoryName = `Kategori Herbal ${Date.now()}`;
      const createCatRes = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          name: categoryName,
          description: 'Obat tradisional terstandar dan fitofarmaka',
        })
        .expect(HttpStatus.CREATED);

      expect(createCatRes.body.name).toBe(categoryName);

      const listCatRes = await request(app.getHttpServer())
        .get('/api/v1/categories')
        .set('Authorization', `Bearer ${cashierToken}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray(listCatRes.body)).toBe(true);
      expect(listCatRes.body.some((c: any) => c.name === categoryName)).toBe(true);
    });

    it('Skenario 30: Manajemen Pemasok PBF — Apoteker membuat, membaca, dan memperbarui data pemasok PBF (201 & 200 OK)', async () => {
      const supplierCode = `PBF-TEST-${Date.now().toString().slice(-4)}`;
      const createSupRes = await request(app.getHttpServer())
        .post('/api/v1/suppliers')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          code: supplierCode,
          name: 'PT Distribusi Farmasi Nusantara',
          email: 'order@pbf-nusantara.test',
          phone: '021-5551234',
          izinPbfNo: 'FP.01.04/IV/9999-e/2026',
          address: 'Jl. Farmasi Raya No. 100, Jakarta Pusat',
        })
        .expect(HttpStatus.CREATED);

      expect(createSupRes.body.code).toBe(supplierCode);
      const supplierId = createSupRes.body.id;

      const listSupRes = await request(app.getHttpServer())
        .get('/api/v1/suppliers')
        .set('Authorization', `Bearer ${cashierToken}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray(listSupRes.body)).toBe(true);
      expect(listSupRes.body.some((s: any) => s.id === supplierId)).toBe(true);

      const updateSupRes = await request(app.getHttpServer())
        .patch(`/api/v1/suppliers/${supplierId}`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          phone: '021-5559876',
        })
        .expect(HttpStatus.OK);

      expect(updateSupRes.body.phone).toBe('021-5559876');
    });

    it('Skenario 31: Kueri detail obat, penonaktifan obat, serta kueri dengan ID acak menghasilkan 404 Not Found', async () => {
      const detailRes = await request(app.getHttpServer())
        .get(`/api/v1/medicines/${seededSanmolId}`)
        .set('Authorization', `Bearer ${cashierToken}`)
        .expect(HttpStatus.OK);

      expect(detailRes.body.id).toBe(seededSanmolId);
      expect(Array.isArray(detailRes.body.batches)).toBe(true);

      const deleteRes = await request(app.getHttpServer())
        .delete(`/api/v1/medicines/${seededSanmolId}`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .expect(HttpStatus.OK);

      expect(deleteRes.body.id).toBe(seededSanmolId);
      expect(deleteRes.body.isActive).toBe(false);

      const notFoundRes = await request(app.getHttpServer())
        .get('/api/v1/medicines/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${cashierToken}`)
        .expect(HttpStatus.NOT_FOUND);

      expect(notFoundRes.body.statusCode).toBe(404);
    });

    it('Skenario 32: Kueri detail faktur PBF (GET /api/v1/invoices/:id) berhasil (200 OK)', async () => {
      const [firstInv] = await request(app.getHttpServer())
        .get('/api/v1/invoices')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .expect(HttpStatus.OK)
        .then((r) => r.body);

      const detailRes = await request(app.getHttpServer())
        .get(`/api/v1/invoices/${firstInv.id}`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .expect(HttpStatus.OK);

      expect(detailRes.body.id).toBe(firstInv.id);
      expect(detailRes.body.invoiceNumber).toBe(firstInv.invoiceNumber);
      expect(Array.isArray(detailRes.body.items)).toBe(true);
    });

    it('Skenario 33: Kueri daftar pesanan dan detail Purchase Order (GET /procurement/purchase-orders) berhasil (200 OK)', async () => {
      const listPoRes = await request(app.getHttpServer())
        .get('/api/v1/procurement/purchase-orders')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray(listPoRes.body)).toBe(true);
      expect(listPoRes.body.length).toBeGreaterThan(0);

      const firstPo = listPoRes.body[0];
      const detailPoRes = await request(app.getHttpServer())
        .get(`/api/v1/procurement/purchase-orders/${firstPo.id}`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .expect(HttpStatus.OK);

      expect(detailPoRes.body.id).toBe(firstPo.id);
      expect(detailPoRes.body.spNumber).toBe(firstPo.spNumber);
      expect(Array.isArray(detailPoRes.body.items)).toBe(true);
    });

    it('Skenario 34: Kueri riwayat transaksi penjualan kasir (GET /sales & /sales/:id) berhasil (200 OK), dan checkout ditolak jika nominal kurang (400 Bad Request)', async () => {
      const salesRes = await request(app.getHttpServer())
        .get('/api/v1/sales?limit=5')
        .set('Authorization', `Bearer ${cashierToken}`)
        .expect(HttpStatus.OK);

      expect(salesRes.body).toHaveProperty('items');
      expect(Array.isArray(salesRes.body.items)).toBe(true);
      expect(salesRes.body.items.length).toBeGreaterThan(0);

      const firstSale = salesRes.body.items[0];
      const saleDetailRes = await request(app.getHttpServer())
        .get(`/api/v1/sales/${firstSale.id}`)
        .set('Authorization', `Bearer ${cashierToken}`)
        .expect(HttpStatus.OK);

      expect(saleDetailRes.body.id).toBe(firstSale.id);
      expect(saleDetailRes.body.receiptNumber).toBe(firstSale.receiptNumber);
      expect(Array.isArray(saleDetailRes.body.items)).toBe(true);

      // Coba checkout dengan nominal kurang dari subtotal tagihan
      const underpayRes = await request(app.getHttpServer())
        .post('/api/v1/sales/checkout')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          pricingTier: 'REGULAR',
          paymentMethod: 'CASH',
          amountPaid: 100, // hanya Rp100, kurang dari harga 1 strip
          items: [
            {
              medicineId: seededPamolId,
              uomUnitName: 'Strip',
              qtyInUom: 1,
            },
          ],
        })
        .expect(HttpStatus.BAD_REQUEST);

      expect(underpayRes.body.statusCode).toBe(400);
      expect(underpayRes.body.message).toContain('Pembayaran');
    });

    it('Skenario 35: Validasi format berkas PNG dan WEBP serta penolakan unggah tanpa berkas (FileSignatureValidationPipe)', async () => {
      // PNG valid header
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52,
      ]);
      const pngRes = await request(app.getHttpServer())
        .post(`/api/v1/medicines/${seededSanmolId}/image`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .attach('file', pngBuffer, 'sanmol.png')
        .expect(HttpStatus.CREATED);
      expect(pngRes.body.imagePath).toMatch(/\.png$/i);

      // WEBP valid header (RIFF....WEBP)
      const webpBuffer = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
        0x56, 0x50, 0x38, 0x20,
      ]);
      const webpRes = await request(app.getHttpServer())
        .post(`/api/v1/medicines/${seededSanmolId}/image`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .attach('file', webpBuffer, 'sanmol.webp')
        .expect(HttpStatus.CREATED);
      expect(webpRes.body.imagePath).toMatch(/\.webp$/i);

      // Unggah tanpa berkas sama sekali
      const emptyUploadRes = await request(app.getHttpServer())
        .post(`/api/v1/medicines/${seededSanmolId}/image`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .expect(HttpStatus.BAD_REQUEST);
      expect(emptyUploadRes.body.message).toContain('Tidak ada berkas');
    });

    it('Skenario 36: Penolakan duplikasi email pendaftaran dan login akun yang tidak terdaftar', async () => {
      const dupEmailRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'owner@raddina.id',
          password: 'PasswordAnyar123!',
          fullName: 'Pemilik Duplikat',
        })
        .expect(HttpStatus.CONFLICT);
      expect(dupEmailRes.body.statusCode).toBe(409);

      const notFoundUserRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'tidak.terdaftar@raddina.id',
          password: 'PasswordBebas123!',
        })
        .expect(HttpStatus.UNAUTHORIZED);
      expect(notFoundUserRes.body.statusCode).toBe(401);
    });

    it('Skenario 37: Penolakan duplikasi kategori obat dan duplikasi kode pemasok PBF', async () => {
      // Duplikasi kategori
      const dupCatRes = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          name: 'Analgesik & Antipiretik',
        })
        .expect(HttpStatus.CONFLICT);
      expect(dupCatRes.body.statusCode).toBe(409);

      // Duplikasi kode supplier
      const dupSupRes = await request(app.getHttpServer())
        .post('/api/v1/suppliers')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          code: 'PBF-KFTD-01',
          name: 'PT Kimia Farma Duplikat',
          email: 'duplikat@kftd.co.id',
          phone: '031-1111111',
          izinPbfNo: 'FP.01.04/IV/0218-e/2023',
          address: 'Alamat Surabaya',
        })
        .expect(HttpStatus.CONFLICT);
      expect(dupSupRes.body.statusCode).toBe(409);
    });

    it('Skenario 38: Validasi pertahanan input master obat (kategori tidak valid, UOM tanpa multiplier 1, duplikasi SKU)', async () => {
      // Kategori fiktif
      const fakeCatRes = await request(app.getHttpServer())
        .post('/api/v1/medicines')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          sku: `SKU-TEST-${Date.now()}`,
          name: 'Obat Kategori Fiktif',
          categoryId: '00000000-0000-0000-0000-000000000000',
          activeIngredient: 'Test 100 mg',
          baseUnit: 'Tablet',
          classification: 'BEBAS',
          minStockBaseUnit: 10,
          uomConversions: [
            {
              unitName: 'Tablet',
              multiplierToBase: 1,
              sellingPriceRegular: 1000,
              sellingPricePartner: 900,
            },
          ],
        })
        .expect(HttpStatus.BAD_REQUEST);
      expect(fakeCatRes.body.message).toContain('Kategori');

      // UOM tanpa multiplier 1
      const noBaseUomRes = await request(app.getHttpServer())
        .post('/api/v1/medicines')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          sku: `SKU-NOBASE-${Date.now()}`,
          name: 'Obat Tanpa Satuan Dasar',
          categoryId: seededCategoryId,
          activeIngredient: 'Test 200 mg',
          baseUnit: 'Tablet',
          classification: 'BEBAS',
          minStockBaseUnit: 10,
          uomConversions: [
            {
              unitName: 'Box',
              multiplierToBase: 100,
              sellingPriceRegular: 100000,
              sellingPricePartner: 90000,
            },
          ],
        })
        .expect(HttpStatus.BAD_REQUEST);
      expect(noBaseUomRes.body.message).toContain('multiplierToBase');

      // Duplikasi SKU
      const dupSkuRes = await request(app.getHttpServer())
        .post('/api/v1/medicines')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          sku: 'MED-PCT-500',
          name: 'Sanmol Duplikat',
          categoryId: seededCategoryId,
          activeIngredient: 'Paracetamol 500 mg',
          baseUnit: 'Tablet',
          classification: 'BEBAS',
          minStockBaseUnit: 10,
          uomConversions: [
            {
              unitName: 'Tablet',
              multiplierToBase: 1,
              sellingPriceRegular: 600,
              sellingPricePartner: 500,
            },
          ],
        })
        .expect(HttpStatus.CONFLICT);
      expect(dupSkuRes.body.statusCode).toBe(409);
    });

    it('Skenario 39: Validasi pertahanan faktur PBF (pemasok fiktif & duplikasi nomor faktur)', async () => {
      const fakeSupInvRes = await request(app.getHttpServer())
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          invoiceNumber: `INV-FAKESUP-${Date.now()}`,
          supplierId: '00000000-0000-0000-0000-000000000000',
          invoiceDate: '2026-11-01',
          dueDate: '2026-12-01',
          items: [
            {
              medicineId: seededSanmolId,
              batchNumber: 'BATCH-FAKESUP-01',
              expiryDate: '2028-12-31',
              uomUnitName: 'Box',
              qtyInUom: 1,
              purchasePricePerUom: 40000,
            },
          ],
        })
        .expect(HttpStatus.BAD_REQUEST);
      expect(fakeSupInvRes.body.message).toContain('Pemasok');

      // Duplikasi invoice number
      const dupInvRes = await request(app.getHttpServer())
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          invoiceNumber: 'INV/KFTD/2026/1001', // faktur seeder yang sudah ada
          supplierId: seededSupplierId,
          invoiceDate: '2026-11-01',
          dueDate: '2026-12-01',
          items: [
            {
              medicineId: seededSanmolId,
              batchNumber: `BATCH-DUPINV-${Date.now()}`,
              expiryDate: '2028-12-31',
              uomUnitName: 'Box',
              qtyInUom: 1,
              purchasePricePerUom: 40000,
            },
          ],
        })
        .expect(HttpStatus.CONFLICT);
      expect(dupInvRes.body.statusCode).toBe(409);
    });

    it('Skenario 40: Penanganan entitas tidak ditemukan (404) pada faktur, PO, transaksi penjualan, dan pemasok', async () => {
      const nonExistentUuid = '00000000-0000-0000-0000-000000000000';

      const inv404 = await request(app.getHttpServer())
        .get(`/api/v1/invoices/${nonExistentUuid}`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .expect(HttpStatus.NOT_FOUND);
      expect(inv404.body.statusCode).toBe(404);

      const po404 = await request(app.getHttpServer())
        .get(`/api/v1/procurement/purchase-orders/${nonExistentUuid}`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .expect(HttpStatus.NOT_FOUND);
      expect(po404.body.statusCode).toBe(404);

      const sale404 = await request(app.getHttpServer())
        .get(`/api/v1/sales/${nonExistentUuid}`)
        .set('Authorization', `Bearer ${cashierToken}`)
        .expect(HttpStatus.NOT_FOUND);
      expect(sale404.body.statusCode).toBe(404);

      const sup404 = await request(app.getHttpServer())
        .patch(`/api/v1/suppliers/${nonExistentUuid}`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({ phone: '08123456789' })
        .expect(HttpStatus.NOT_FOUND);
      expect(sup404.body.statusCode).toBe(404);
    });
  });
});
