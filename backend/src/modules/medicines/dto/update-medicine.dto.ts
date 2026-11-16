import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
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
import { DrugClassification, ParetoClass } from '@shared/api-contracts';
import { UomConversionItemDto } from './create-medicine.dto';

const DRUG_CLASSIFICATIONS: DrugClassification[] = [
  'BEBAS',
  'BEBAS_TERBATAS',
  'KERAS',
  'PSIKOTROPIKA',
  'NARKOTIKA',
];

const PARETO_CLASSES: ParetoClass[] = ['A', 'B', 'C'];

export class UpdateMedicineDto {
  @IsOptional()
  @IsString({
    message:
      'Validasi kode SKU obat gagal. Kolom sku wajib berupa teks (string) maksimal 64 karakter. Silakan isi kode SKU yang sah.',
  })
  @IsNotEmpty({
    message:
      'Validasi kode SKU obat gagal. Kolom sku tidak boleh diisi string kosong (0 karakter). Silakan isi kode SKU minimal 1 karakter.',
  })
  @MaxLength(64, {
    message:
      'Validasi kode SKU obat gagal. Panjang sku melebihi batas maksimal 64 karakter. Silakan ringkas kode SKU obat Anda.',
  })
  sku?: string;

  @IsOptional()
  @IsString({
    message:
      'Validasi nama obat gagal. Kolom name wajib berupa teks (string) maksimal 255 karakter. Silakan isi nama obat yang sah.',
  })
  @IsNotEmpty({
    message:
      'Validasi nama obat gagal. Kolom name tidak boleh diisi string kosong (0 karakter). Silakan masukkan nama obat minimal 1 karakter.',
  })
  @MaxLength(255, {
    message:
      'Validasi nama obat gagal. Panjang nama obat melebihi batas maksimal 255 karakter. Silakan ringkas nama obat hingga maksimal 255 karakter.',
  })
  name?: string;

  @IsOptional()
  @IsUUID('all', {
    message:
      'Validasi kategori obat gagal. Kolom categoryId bukan berformat UUID yang sah. Silakan pilih ID kategori obat yang valid.',
  })
  categoryId?: string;

  @IsOptional()
  @IsString({
    message:
      'Validasi komposisi zat aktif gagal. Kolom activeIngredient wajib berupa teks (string) maksimal 255 karakter. Silakan masukkan zat aktif obat yang sah.',
  })
  @IsNotEmpty({
    message:
      'Validasi komposisi zat aktif gagal. Kolom activeIngredient tidak boleh kosong (0 karakter). Silakan isi nama zat aktif obat.',
  })
  @MaxLength(255, {
    message:
      'Validasi komposisi zat aktif gagal. Panjang activeIngredient melebihi batas maksimal 255 karakter. Silakan ringkas penulisan zat aktif.',
  })
  activeIngredient?: string;

  @IsOptional()
  @IsString({
    message:
      'Validasi satuan dasar gagal. Kolom baseUnit wajib berupa teks (string) maksimal 32 karakter. Silakan isi satuan terkecil seperti Tablet atau Kapsul.',
  })
  @IsNotEmpty({
    message:
      'Validasi satuan dasar gagal. Kolom baseUnit tidak boleh kosong (0 karakter). Silakan isi satuan dasar terkecil obat.',
  })
  @MaxLength(32, {
    message:
      'Validasi satuan dasar gagal. Panjang baseUnit melebihi batas maksimal 32 karakter. Silakan ringkas nama satuan dasar.',
  })
  baseUnit?: string;

  @IsOptional()
  @IsIn(DRUG_CLASSIFICATIONS, {
    message:
      'Validasi golongan obat gagal. Nilai classification harus salah satu dari 5 golongan: BEBAS, BEBAS_TERBATAS, KERAS, PSIKOTROPIKA, atau NARKOTIKA. Silakan pilih golongan yang sesuai.',
  })
  classification?: DrugClassification;

  @IsOptional()
  @IsIn(PARETO_CLASSES, {
    message:
      'Validasi kelas Pareto gagal. Nilai paretoClass harus salah satu dari 3 kelas: A, B, atau C. Silakan pilih kelas A, B, atau C.',
  })
  paretoClass?: ParetoClass;

  @IsOptional()
  @Type(() => Number)
  @IsInt({
    message:
      'Validasi batas stok minimum gagal. Kolom minStockBaseUnit wajib berupa bilangan bulat (integer). Silakan masukkan angka bulat minimal 0.',
  })
  @Min(0, {
    message:
      'Validasi batas stok minimum gagal. Nilai minStockBaseUnit bernilai negatif (di bawah 0). Silakan masukkan angka stok minimum minimal 0.',
  })
  minStockBaseUnit?: number;

  @IsOptional()
  @IsBoolean({
    message:
      'Validasi status aktif obat gagal. Kolom isActive wajib bernilai boolean (true atau false). Silakan kirim nilai true atau false.',
  })
  isActive?: boolean;

  @IsOptional()
  @IsArray({
    message:
      'Validasi daftar konversi satuan (uomConversions) gagal. Kolom uomConversions wajib berupa larik (array) objek satuan. Silakan sertakan minimal 1 satuan dasar.',
  })
  @ArrayMinSize(1, {
    message:
      'Validasi daftar konversi satuan (uomConversions) gagal. Larik uomConversions memiliki 0 elemen. Silakan sertakan minimal 1 satuan dasar dengan multiplierToBase bernilai 1.',
  })
  @ValidateNested({ each: true })
  @Type(() => UomConversionItemDto)
  uomConversions?: UomConversionItemDto[];
}
