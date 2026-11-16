import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateSupplierDto {
  @IsString({
    message:
      'Validasi kode pemasok PBF gagal. Kolom code wajib berupa teks (string) maksimal 32 karakter. Silakan masukkan kode PBF seperti PBF-KIMIA-01.',
  })
  @IsNotEmpty({
    message:
      'Validasi kode pemasok PBF gagal. Kolom code bernilai kosong (0 karakter). Silakan masukkan kode unik pemasok PBF.',
  })
  @MaxLength(32, {
    message:
      'Validasi kode pemasok PBF gagal. Panjang code melebihi batas maksimal 32 karakter. Silakan ringkas kode pemasok PBF.',
  })
  code!: string;

  @IsString({
    message:
      'Validasi nama pemasok PBF gagal. Kolom name wajib berupa teks (string) maksimal 255 karakter. Silakan masukkan nama resmi perusahaan PBF.',
  })
  @IsNotEmpty({
    message:
      'Validasi nama pemasok PBF gagal. Kolom name bernilai kosong (0 karakter). Silakan masukkan nama perusahaan PBF minimal 1 karakter.',
  })
  @MaxLength(255, {
    message:
      'Validasi nama pemasok PBF gagal. Panjang nama melebihi batas maksimal 255 karakter. Silakan ringkas nama perusahaan PBF.',
  })
  name!: string;

  @IsEmail(
    {},
    {
      message:
        'Validasi alamat surel PBF gagal. Kolom email tidak memiliki format alamat email yang sah (contoh: pengadaan@pbf.co.id). Silakan periksa penulisan karakter @ dan domain email PBF.',
    },
  )
  @MaxLength(255, {
    message:
      'Validasi alamat surel PBF gagal. Panjang email melebihi batas maksimal 255 karakter. Silakan gunakan alamat email resmi yang lebih pendek.',
  })
  email!: string;

  @IsString({
    message:
      'Validasi nomor telepon PBF gagal. Kolom phone wajib berupa teks (string) maksimal 50 karakter. Silakan masukkan nomor telepon aktif PBF.',
  })
  @IsNotEmpty({
    message:
      'Validasi nomor telepon PBF gagal. Kolom phone bernilai kosong (0 karakter). Silakan masukkan nomor telepon kontak pemasok PBF.',
  })
  @MaxLength(50, {
    message:
      'Validasi nomor telepon PBF gagal. Panjang phone melebihi batas maksimal 50 karakter. Silakan masukkan nomor telepon maksimal 50 karakter.',
  })
  phone!: string;

  @IsString({
    message:
      'Validasi nomor izin PBF gagal. Kolom izinPbfNo wajib berupa teks (string) maksimal 100 karakter. Silakan masukkan nomor sertifikat distribusi/izin resmi PBF.',
  })
  @IsNotEmpty({
    message:
      'Validasi nomor izin PBF gagal. Kolom izinPbfNo bernilai kosong (0 karakter). Silakan isi nomor izin resmi PBF sesuai regulasi BPOM/Kemenkes.',
  })
  @MaxLength(100, {
    message:
      'Validasi nomor izin PBF gagal. Panjang izinPbfNo melebihi batas maksimal 100 karakter. Silakan masukkan nomor izin PBF maksimal 100 karakter.',
  })
  izinPbfNo!: string;

  @IsString({
    message:
      'Validasi alamat kantor/gudang PBF gagal. Kolom address wajib berupa teks (string). Silakan masukkan alamat lengkap gudang distribusi PBF.',
  })
  @IsNotEmpty({
    message:
      'Validasi alamat kantor/gudang PBF gagal. Kolom address bernilai kosong (0 karakter). Silakan isi alamat lengkap pemasok PBF.',
  })
  @MaxLength(1000, {
    message:
      'Validasi alamat kantor/gudang PBF gagal. Panjang address melebihi batas maksimal 1000 karakter. Silakan ringkas penulisan alamat PBF.',
  })
  address!: string;

  @IsOptional()
  @IsBoolean({
    message:
      'Validasi status aktif pemasok gagal. Kolom isActive wajib bernilai boolean (true atau false). Silakan kirim nilai true atau false.',
  })
  isActive?: boolean;
}
