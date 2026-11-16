import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CartItemInputDto,
  PreviewFefoRequestDto,
  PricingTier,
} from '@shared/api-contracts';

export class CartItemDto implements CartItemInputDto {
  @IsNotEmpty({
    message:
      'Validasi item keranjang gagal. Kolom medicineId wajib diisi dengan identifier obat yang valid. Silakan pilih obat dari katalog master.',
  })
  @IsUUID('4', {
    message:
      'Validasi identifier obat gagal. Kolom medicineId harus berupa UUID v4 yang sah. Silakan periksa kembali referensi obat yang dipilih.',
  })
  medicineId!: string;

  @IsNotEmpty({
    message:
      'Validasi satuan jual gagal. Nama satuan kemasan (uomUnitName) wajib diisi. Silakan pilih satuan kemasan obat yang tersedia.',
  })
  @IsString({
    message:
      'Validasi tipe data satuan jual gagal. Kolom uomUnitName harus berupa teks nama satuan kemasan. Silakan masukkan nama satuan yang sesuai.',
  })
  uomUnitName!: string;

  @IsInt({
    message:
      'Validasi kuantitas item gagal. Jumlah pembelian (qtyInUom) harus berupa bilangan bulat utuh. Silakan masukkan kuantitas tanpa angka pecahan.',
  })
  @Min(1, {
    message:
      'Validasi kuantitas minimum gagal. Kuantitas pembelian (qtyInUom) minimal berjumlah 1 satuan kemasan. Silakan tentukan kuantitas 1 atau lebih.',
  })
  qtyInUom!: number;
}

export class PreviewFefoDto implements PreviewFefoRequestDto {
  @IsNotEmpty({
    message:
      'Validasi skema harga gagal. Tingkat harga (pricingTier) wajib dipilih antara REGULAR atau PARTNER. Silakan pilih skema tarif pelanggan yang sesuai.',
  })
  @IsIn(['REGULAR', 'PARTNER'], {
    message:
      'Validasi pilihan skema harga gagal. Nilai pricingTier hanya diizinkan bernilai REGULAR atau PARTNER. Silakan pilih salah satu dari dua skema harga resmi tersebut.',
  })
  pricingTier!: PricingTier;

  @IsArray({
    message:
      'Validasi daftar item gagal. Kolom items harus berupa deretan item belanjaan keranjang kasir. Silakan sertakan minimal satu item penjualan.',
  })
  @ArrayMinSize(1, {
    message:
      'Validasi keranjang belanja gagal. Daftar items minimal harus memuat 1 item obat untuk menghitung alokasi FEFO. Silakan tambahkan obat ke dalam keranjang.',
  })
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items!: CartItemDto[];
}
