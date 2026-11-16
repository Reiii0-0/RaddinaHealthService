import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreatePurchaseOrderRequestDto } from '@shared/api-contracts';

export class PurchaseOrderItemInputDto {
  @IsNotEmpty({
    message:
      'Validasi item Surat Pesanan gagal. Kolom medicineId wajib diisi. Silakan pilih obat dari daftar Defekta atau katalog.',
  })
  @IsUUID('4', {
    message:
      'Validasi identifier obat gagal. Kolom medicineId harus berupa UUID v4 yang valid. Silakan periksa kembali referensi obat.',
  })
  medicineId!: string;

  @IsInt({
    message:
      'Validasi kuantitas pesanan gagal. Kuantitas pesan (orderedBaseQty) harus berupa bilangan bulat satuan dasar. Silakan masukkan angka utuh tanpa desimal.',
  })
  @Min(1, {
    message:
      'Validasi kuantitas minimum pesanan gagal. Kuantitas pesanan minimal berjumlah 1 satuan dasar. Silakan masukkan kuantitas pemesanan 1 atau lebih.',
  })
  orderedBaseQty!: number;

  @IsOptional()
  @IsString({
    message:
      'Validasi estimasi harga gagal. Kolom estimatedUnitCost harus berupa string desimal biaya per satuan dasar. Silakan periksa format biaya.',
  })
  estimatedUnitCost?: string;
}

export class CreatePurchaseOrderDto implements CreatePurchaseOrderRequestDto {
  @IsNotEmpty({
    message:
      'Validasi pemasok Surat Pesanan gagal. Kolom supplierId wajib diisi. Silakan pilih Pedagang Besar Farmasi (PBF) yang sah.',
  })
  @IsUUID('4', {
    message:
      'Validasi identifier pemasok gagal. Kolom supplierId harus berupa format UUID v4. Silakan pilih pemasok terdaftar dari data master PBF.',
  })
  supplierId!: string;

  @IsOptional()
  @IsString({
    message:
      'Validasi catatan pesanan gagal. Kolom notes harus berupa teks catatan operasional. Silakan periksa teks yang dimasukkan.',
  })
  notes?: string;

  @IsArray({
    message:
      'Validasi daftar pesanan gagal. Kolom items harus berupa deretan item obat yang dipesan. Silakan sertakan minimal satu sediaan farmasi.',
  })
  @ArrayMinSize(1, {
    message:
      'Validasi isi Surat Pesanan gagal. Surat Pesanan minimal harus memuat 1 item obat yang dipesan ke PBF. Silakan tambahkan obat ke dalam daftar pesanan.',
  })
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemInputDto)
  items!: PurchaseOrderItemInputDto[];
}
