import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateSupplierDto {
  @IsOptional()
  @IsString({
    message:
      'Validasi kode pemasok PBF gagal. Kolom code wajib berupa teks (string) maksimal 32 karakter. Silakan masukkan kode PBF yang sah.',
  })
  @IsNotEmpty({
    message:
      'Validasi kode pemasok PBF gagal. Kolom code tidak boleh diisi string kosong (0 karakter). Silakan isi kode PBF minimal 1 karakter.',
  })
  @MaxLength(32, {
    message:
      'Validasi kode pemasok PBF gagal. Panjang code melebihi batas maksimal 32 karakter. Silakan ringkas kode pemasok PBF.',
  })
  code?: string;

  @IsOptional()
  @IsString({
    message:
      'Validasi nama pemasok PBF gagal. Kolom name wajib berupa teks (string) maksimal 255 karakter. Silakan isi nama perusahaan PBF.',
  })
  @IsNotEmpty({
    message:
      'Validasi nama pemasok PBF gagal. Kolom name tidak boleh diisi string kosong (0 karakter). Silakan masukkan nama PBF minimal 1 karakter.',
  })
  @MaxLength(255, {
    message:
      'Validasi nama pemasok PBF gagal. Panjang nama melebihi batas maksimal 255 karakter. Silakan ringkas nama perusahaan PBF.',
  })
  name?: string;

  @IsOptional()
  @IsEmail(
    {},
    {
      message:
        'Validasi alamat surel PBF gagal. Kolom email tidak memiliki format alamat email yang sah. Silakan masukkan alamat email dengan tanda @ dan domain yang benar.',
    },
  )
  @MaxLength(255, {
    message:
      'Validasi alamat surel PBF gagal. Panjang email melebihi batas maksimal 255 karakter. Silakan gunakan alamat email yang lebih pendek.',
  })
  email?: string;

  @IsOptional()
  @IsString({
    message:
      'Validasi nomor telepon PBF gagal. Kolom phone wajib berupa teks (string) maksimal 50 karakter. Silakan isi nomor telepon aktif PBF.',
  })
  @IsNotEmpty({
    message:
      'Validasi nomor telepon PBF gagal. Kolom phone tidak boleh kosong (0 karakter). Silakan masukkan nomor telepon kontak PBF.',
  })
  @MaxLength(50, {
    message:
      'Validasi nomor telepon PBF gagal. Panjang phone melebihi batas maksimal 50 karakter. Silakan ringkas nomor telepon PBF.',
  })
  phone?: string;

  @IsOptional()
  @IsString({
    message:
      'Validasi nomor izin PBF gagal. Kolom izinPbfNo wajib berupa teks (string) maksimal 100 karakter. Silakan isi nomor izin resmi PBF.',
  })
  @IsNotEmpty({
    message:
      'Validasi nomor izin PBF gagal. Kolom izinPbfNo tidak boleh kosong (0 karakter). Silakan masukkan nomor izin PBF.',
  })
  @MaxLength(100, {
    message:
      'Validasi nomor izin PBF gagal. Panjang izinPbfNo melebihi batas maksimal 100 karakter. Silakan masukkan nomor izin PBF maksimal 100 karakter.',
  })
  izinPbfNo?: string;

  @IsOptional()
  @IsString({
    message:
      'Validasi alamat PBF gagal. Kolom address wajib berupa teks (string). Silakan isi alamat lengkap gudang PBF.',
  })
  @IsNotEmpty({
    message:
      'Validasi alamat PBF gagal. Kolom address tidak boleh kosong (0 karakter). Silakan isi alamat lengkap pemasok PBF.',
  })
  @MaxLength(1000, {
    message:
      'Validasi alamat PBF gagal. Panjang address melebihi batas maksimal 1000 karakter. Silakan ringkas penulisan alamat PBF.',
  })
  address?: string;

  @IsOptional()
  @IsBoolean({
    message:
      'Validasi status aktif pemasok gagal. Kolom isActive wajib bernilai boolean (true atau false). Silakan kirim nilai true atau false.',
  })
  isActive?: boolean;
}
