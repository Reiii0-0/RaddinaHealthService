import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString({
    message:
      'Validasi nama kategori gagal. Kolom name wajib berupa teks (string) dengan panjang maksimal 120 karakter. Silakan isi nama kategori obat seperti Antibiotik atau Analgesik.',
  })
  @IsNotEmpty({
    message:
      'Validasi nama kategori gagal. Kolom name bernilai kosong (0 karakter). Silakan masukkan nama kategori obat minimal 1 karakter.',
  })
  @MaxLength(120, {
    message:
      'Validasi nama kategori gagal. Panjang nama kategori melebihi batas maksimal 120 karakter. Silakan ringkas nama kategori agar tidak lebih dari 120 karakter.',
  })
  name!: string;

  @IsOptional()
  @IsString({
    message:
      'Validasi deskripsi kategori gagal. Kolom description wajib berupa teks (string). Silakan isi deskripsi berupa kalimat teks atau kosongkan kolom ini.',
  })
  @MaxLength(1000, {
    message:
      'Validasi deskripsi kategori gagal. Panjang deskripsi melebihi batas maksimal 1000 karakter. Silakan ringkas deskripsi kategori tersebut.',
  })
  description?: string | null;
}
