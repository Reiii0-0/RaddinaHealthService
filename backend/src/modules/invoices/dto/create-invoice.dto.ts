import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CreateInvoiceItemInputDto,
  CreatePbfInvoiceRequestDto,
  PaymentStatus,
} from '@shared/api-contracts';

const PAYMENT_STATUSES: PaymentStatus[] = ['UNPAID', 'PAID'];

export class CreateInvoiceItemDto implements CreateInvoiceItemInputDto {
  @IsUUID('all', {
    message:
      'Validasi item faktur PBF gagal. Kolom medicineId bukan berformat UUID yang sah. Silakan pilih obat yang terdaftar di katalog master obat.',
  })
  medicineId!: string;

  @IsString({
    message:
      'Validasi nomor batch item faktur gagal. Kolom batchNumber wajib berupa teks (string) maksimal 100 karakter. Silakan isi nomor batch fisik yang tertera pada kemasan obat.',
  })
  @IsNotEmpty({
    message:
      'Validasi nomor batch item faktur gagal. Kolom batchNumber bernilai kosong (0 karakter). Silakan masukkan nomor batch seperti B260401.',
  })
  @MaxLength(100, {
    message:
      'Validasi nomor batch item faktur gagal. Panjang batchNumber melebihi batas maksimal 100 karakter. Silakan ringkas kode nomor batch.',
  })
  batchNumber!: string;

  @IsDateString(
    {},
    {
      message:
        'Validasi tanggal kedaluwarsa (ED) batch gagal. Kolom expiryDate harus berformat tanggal ISO YYYY-MM-DD (contoh: 2028-12-31). Silakan masukkan tanggal kedaluwarsa yang benar.',
    },
  )
  expiryDate!: string;

  @IsString({
    message:
      'Validasi satuan beli (UOM) item faktur gagal. Kolom uomUnitName wajib berupa teks (string) maksimal 32 karakter. Silakan isi satuan kemasan seperti Box, Strip, atau Tablet.',
  })
  @IsNotEmpty({
    message:
      'Validasi satuan beli (UOM) item faktur gagal. Kolom uomUnitName bernilai kosong (0 karakter). Silakan pilih satuan beli yang terdaftar pada obat tersebut.',
  })
  @MaxLength(32, {
    message:
      'Validasi satuan beli (UOM) item faktur gagal. Panjang uomUnitName melebihi batas maksimal 32 karakter. Silakan gunakan nama satuan yang lebih pendek.',
  })
  uomUnitName!: string;

  @Type(() => Number)
  @IsInt({
    message:
      'Validasi kuantitas beli gagal. Kolom qtyInUom wajib berupa bilangan bulat positif. Silakan masukkan jumlah barang minimal 1.',
  })
  @Min(1, {
    message:
      'Validasi kuantitas beli gagal. Nilai qtyInUom kurang dari 1. Silakan masukkan kuantitas penerimaan barang minimal 1 satuan.',
  })
  qtyInUom!: number;

  @Type(() => Number)
  @IsInt({
    message:
      'Validasi harga beli per satuan gagal. Kolom purchasePricePerUom wajib berupa bilangan bulat Rupiah tanpa desimal. Silakan masukkan angka harga beli minimal 0.',
  })
  @Min(0, {
    message:
      'Validasi harga beli per satuan gagal. Nilai purchasePricePerUom bernilai negatif (di bawah Rp0). Silakan masukkan harga beli minimal 0.',
  })
  purchasePricePerUom!: number;
}

export class CreateInvoiceDto implements CreatePbfInvoiceRequestDto {
  @IsString({
    message:
      'Validasi nomor faktur PBF gagal. Kolom invoiceNumber wajib berupa teks (string) maksimal 100 karakter. Silakan masukkan nomor faktur resmi dari pemasok PBF.',
  })
  @IsNotEmpty({
    message:
      'Validasi nomor faktur PBF gagal. Kolom invoiceNumber bernilai kosong (0 karakter). Silakan masukkan nomor faktur PBF minimal 1 karakter.',
  })
  @MaxLength(100, {
    message:
      'Validasi nomor faktur PBF gagal. Panjang invoiceNumber melebihi batas maksimal 100 karakter. Silakan ringkas nomor faktur tersebut.',
  })
  invoiceNumber!: string;

  @IsUUID('all', {
    message:
      'Validasi pemasok PBF gagal. Kolom supplierId bukan berformat UUID yang sah. Silakan pilih pemasok PBF yang terdaftar.',
  })
  supplierId!: string;

  @IsDateString(
    {},
    {
      message:
        'Validasi tanggal faktur gagal. Kolom invoiceDate harus berformat tanggal ISO YYYY-MM-DD (contoh: 2026-11-05). Silakan periksa penulisan tanggal faktur.',
    },
  )
  invoiceDate!: string;

  @IsDateString(
    {},
    {
      message:
        'Validasi tanggal jatuh tempo faktur gagal. Kolom dueDate harus berformat tanggal ISO YYYY-MM-DD (contoh: 2026-12-05). Silakan periksa penulisan tanggal jatuh tempo.',
    },
  )
  dueDate!: string;

  @IsOptional()
  @IsIn(PAYMENT_STATUSES, {
    message:
      'Validasi status pembayaran faktur gagal. Nilai paymentStatus harus bernilai UNPAID atau PAID. Silakan pilih UNPAID atau PAID.',
  })
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsString({
    message:
      'Validasi catatan faktur gagal. Kolom notes wajib berupa teks (string). Silakan isi catatan teks atau kosongkan kolom ini.',
  })
  @MaxLength(1000, {
    message:
      'Validasi catatan faktur gagal. Panjang notes melebihi batas maksimal 1000 karakter. Silakan ringkas catatan penerimaan faktur.',
  })
  notes?: string;

  @IsArray({
    message:
      'Validasi daftar item faktur gagal. Kolom items wajib berupa larik (array) rincian barang. Silakan tambahkan minimal 1 item obat ke dalam faktur PBF.',
  })
  @ArrayMinSize(1, {
    message:
      'Validasi daftar item faktur gagal. Larik items memiliki 0 elemen. Silakan masukkan minimal 1 item obat yang diterima dari PBF.',
  })
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items!: CreateInvoiceItemDto[];
}
