import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CheckoutSaleRequestDto,
  PaymentMethod,
  PricingTier,
} from '@shared/api-contracts';
import { CartItemDto } from './preview-fefo.dto';

export class CheckoutSaleDto implements CheckoutSaleRequestDto {
  @IsNotEmpty({
    message:
      'Validasi skema harga transaksi gagal. Tingkat harga (pricingTier) wajib dipilih antara REGULAR atau PARTNER. Silakan pilih skema tarif pelanggan yang sesuai.',
  })
  @IsIn(['REGULAR', 'PARTNER'], {
    message:
      'Validasi pilihan skema harga gagal. Nilai pricingTier hanya diizinkan bernilai REGULAR atau PARTNER. Silakan tentukan salah satu dari opsi tersebut.',
  })
  pricingTier!: PricingTier;

  @IsOptional()
  @IsString({
    message:
      'Validasi identitas pelanggan gagal. Kolom customerName harus berupa teks nama lengkap pelanggan. Silakan masukkan nama pelanggan dengan format yang benar.',
  })
  customerName?: string;

  @IsNotEmpty({
    message:
      'Validasi metode pembayaran gagal. Pilihan metode bayar (paymentMethod) wajib ditentukan. Silakan pilih CASH, QRIS, atau DEBIT.',
  })
  @IsIn(['CASH', 'QRIS', 'DEBIT'], {
    message:
      'Validasi opsi pembayaran gagal. Nilai paymentMethod hanya mendukung metode bayar CASH, QRIS, atau DEBIT. Silakan pilih salah satu opsi pembayaran kasir.',
  })
  paymentMethod!: PaymentMethod;

  @IsInt({
    message:
      'Validasi nilai pembayaran gagal. Jumlah uang yang diterima kasir (amountPaid) harus berupa bilangan bulat dalam satuan Rupiah. Silakan masukkan nominal pembayaran utuh.',
  })
  @Min(0, {
    message:
      'Validasi jumlah bayar gagal. Nominal pembayaran (amountPaid) tidak boleh bernilai negatif. Silakan masukkan nominal pembayaran kasir yang valid.',
  })
  amountPaid!: number;

  @IsArray({
    message:
      'Validasi daftar item checkout gagal. Kolom items harus berupa deretan item belanja kasir. Silakan tambahkan minimal satu obat.',
  })
  @ArrayMinSize(1, {
    message:
      'Validasi transaksi kosong gagal. Transaksi kasir minimal harus memuat 1 item obat untuk dapat diselesaikan. Silakan tambahkan obat ke keranjang belanja.',
  })
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items!: CartItemDto[];
}
