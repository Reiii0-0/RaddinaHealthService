import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
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
  CreateMedicineRequestDto,
  DrugClassification,
  ParetoClass,
  UomConversionInputDto,
} from '@shared/api-contracts';

const DRUG_CLASSIFICATIONS: DrugClassification[] = [
  'BEBAS',
  'BEBAS_TERBATAS',
  'KERAS',
  'PSIKOTROPIKA',
  'NARKOTIKA',
];

const PARETO_CLASSES: ParetoClass[] = ['A', 'B', 'C'];

export class UomConversionItemDto implements UomConversionInputDto {
  @IsString({
    message:
      'Validasi satuan kemasan (UOM) gagal. Kolom unitName wajib berupa teks (string) maksimal 32 karakter. Silakan isi nama satuan seperti Tablet, Strip, atau Box.',
  })
  @IsNotEmpty({
    message:
      'Validasi satuan kemasan (UOM) gagal. Kolom unitName bernilai kosong (0 karakter). Silakan masukkan nama satuan kemasan minimal 1 karakter.',
  })
  @MaxLength(32, {
    message:
      'Validasi satuan kemasan (UOM) gagal. Panjang unitName melebihi batas maksimal 32 karakter. Silakan gunakan singkatan satuan yang lebih ringkas.',
  })
  unitName!: string;

  @Type(() => Number)
  @IsInt({
    message:
      'Validasi konversi satuan gagal. Kolom multiplierToBase wajib berupa bilangan bulat (integer). Silakan masukkan angka bulat positif minimal 1.',
  })
  @Min(1, {
    message:
      'Validasi konversi satuan gagal. Nilai multiplierToBase kurang dari 1. Silakan masukkan faktor pengali minimal 1 (gunakan angka 1 untuk satuan dasar terkecil).',
  })
  multiplierToBase!: number;

  @Type(() => Number)
  @IsInt({
    message:
      'Validasi harga jual reguler gagal. Kolom sellingPriceRegular wajib berupa bilangan bulat Rupiah tanpa desimal. Silakan masukkan angka bulat minimal 0.',
  })
  @Min(0, {
    message:
      'Validasi harga jual reguler gagal. Nilai sellingPriceRegular bernilai negatif (di bawah Rp0). Silakan masukkan harga jual reguler minimal 0.',
  })
  sellingPriceRegular!: number;

  @Type(() => Number)
  @IsInt({
    message:
      'Validasi harga jual mitra gagal. Kolom sellingPricePartner wajib berupa bilangan bulat Rupiah tanpa desimal. Silakan masukkan angka bulat minimal 0.',
  })
  @Min(0, {
    message:
      'Validasi harga jual mitra gagal. Nilai sellingPricePartner bernilai negatif (di bawah Rp0). Silakan masukkan harga jual mitra minimal 0.',
  })
  sellingPricePartner!: number;

  @IsOptional()
  @IsString({
    message:
      'Validasi kode batang (barcode) gagal. Kolom barcode wajib berupa teks (string) maksimal 64 karakter. Silakan perbaiki kode barcode atau kosongkan kolom ini.',
  })
  @MaxLength(64, {
    message:
      'Validasi kode batang (barcode) gagal. Panjang barcode melebihi batas maksimal 64 karakter. Silakan masukkan kode barcode maksimal 64 karakter.',
  })
  barcode?: string | null;
}

export class CreateMedicineDto implements CreateMedicineRequestDto {
  @IsString({
    message:
      'Validasi kode SKU obat gagal. Kolom sku wajib berupa teks (string) maksimal 64 karakter. Silakan masukkan kode SKU unik seperti MED-AMX-500.',
  })
  @IsNotEmpty({
    message:
      'Validasi kode SKU obat gagal. Kolom sku bernilai kosong (0 karakter). Silakan isi kode SKU obat minimal 1 karakter.',
  })
  @MaxLength(64, {
    message:
      'Validasi kode SKU obat gagal. Panjang sku melebihi batas maksimal 64 karakter. Silakan ringkas kode SKU obat Anda.',
  })
  sku!: string;

  @IsString({
    message:
      'Validasi nama obat gagal. Kolom name wajib berupa teks (string) maksimal 255 karakter. Silakan isi nama lengkap obat beserta dosisnya.',
  })
  @IsNotEmpty({
    message:
      'Validasi nama obat gagal. Kolom name bernilai kosong (0 karakter). Silakan masukkan nama obat minimal 1 karakter.',
  })
  @MaxLength(255, {
    message:
      'Validasi nama obat gagal. Panjang nama obat melebihi batas maksimal 255 karakter. Silakan ringkas nama obat hingga maksimal 255 karakter.',
  })
  name!: string;

  @IsUUID('all', {
    message:
      'Validasi kategori obat gagal. Kolom categoryId bukan berformat UUID yang sah. Silakan pilih kategori obat yang terdaftar di sistem.',
  })
  categoryId!: string;

  @IsString({
    message:
      'Validasi komposisi zat aktif gagal. Kolom activeIngredient wajib berupa teks (string) maksimal 255 karakter. Silakan isi zat aktif obat seperti Amoxicillin Trihydrate 500 mg.',
  })
  @IsNotEmpty({
    message:
      'Validasi komposisi zat aktif gagal. Kolom activeIngredient bernilai kosong (0 karakter). Silakan isi zat aktif obat untuk mendukung fitur pencarian obat substitusi.',
  })
  @MaxLength(255, {
    message:
      'Validasi komposisi zat aktif gagal. Panjang activeIngredient melebihi batas maksimal 255 karakter. Silakan ringkas penulisan komposisi zat aktif.',
  })
  activeIngredient!: string;

  @IsString({
    message:
      'Validasi satuan dasar gagal. Kolom baseUnit wajib berupa teks (string) maksimal 32 karakter. Silakan isi satuan terkecil obat seperti Tablet, Kapsul, Botol, atau Tube.',
  })
  @IsNotEmpty({
    message:
      'Validasi satuan dasar gagal. Kolom baseUnit bernilai kosong (0 karakter). Silakan isi satuan dasar terkecil obat.',
  })
  @MaxLength(32, {
    message:
      'Validasi satuan dasar gagal. Panjang baseUnit melebihi batas maksimal 32 karakter. Silakan ringkas nama satuan dasar obat.',
  })
  baseUnit!: string;

  @IsIn(DRUG_CLASSIFICATIONS, {
    message:
      'Validasi golongan obat gagal. Nilai classification harus salah satu dari 5 golongan resmi: BEBAS, BEBAS_TERBATAS, KERAS, PSIKOTROPIKA, atau NARKOTIKA. Silakan pilih golongan obat yang sesuai.',
  })
  classification!: DrugClassification;

  @IsOptional()
  @IsIn(PARETO_CLASSES, {
    message:
      'Validasi kelas Pareto gagal. Nilai paretoClass harus salah satu dari 3 kelas: A, B, atau C. Silakan pilih kelas A, B, atau C.',
  })
  paretoClass?: ParetoClass;

  @Type(() => Number)
  @IsInt({
    message:
      'Validasi batas stok minimum gagal. Kolom minStockBaseUnit wajib berupa bilangan bulat (integer). Silakan masukkan angka bulat minimal 0.',
  })
  @Min(0, {
    message:
      'Validasi batas stok minimum gagal. Nilai minStockBaseUnit bernilai negatif (di bawah 0). Silakan masukkan angka stok minimum minimal 0 dalam satuan dasar.',
  })
  minStockBaseUnit!: number;

  @IsArray({
    message:
      'Validasi daftar konversi satuan (uomConversions) gagal. Kolom uomConversions wajib berupa larik (array) objek satuan. Silakan sertakan minimal 1 satuan dasar dengan multiplierToBase bernilai 1.',
  })
  @ArrayMinSize(1, {
    message:
      'Validasi daftar konversi satuan (uomConversions) gagal. Larik uomConversions memiliki 0 elemen. Silakan tambahkan minimal 1 konversi satuan dasar.',
  })
  @ValidateNested({ each: true })
  @Type(() => UomConversionItemDto)
  uomConversions!: UomConversionItemDto[];
}
