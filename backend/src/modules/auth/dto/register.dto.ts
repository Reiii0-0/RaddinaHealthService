import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { RegisterRequestDto } from '@shared/api-contracts';

export class RegisterDto implements RegisterRequestDto {
  @IsEmail(
    {},
    {
      message:
        'Pendaftaran akun gagal. Format alamat email yang dikirim tidak sah. Silakan masukkan alamat email resmi seperti nama@raddina.id.',
    },
  )
  @IsNotEmpty({
    message:
      'Pendaftaran akun gagal. Kolom alamat email wajib diisi. Silakan lengkapi alamat email Anda.',
  })
  email!: string;

  @IsString({
    message:
      'Pendaftaran akun gagal. Kata sandi harus berupa teks. Silakan masukkan kata sandi minimal 8 karakter.',
  })
  @MinLength(8, {
    message:
      'Pendaftaran akun gagal karena panjang kata sandi kurang dari batas minimum 8 karakter. Kata sandi pendek rentan terhadap tebakan otomatis. Silakan gunakan kombinasi minimal 8 karakter.',
  })
  @MaxLength(128, {
    message:
      'Pendaftaran akun gagal karena panjang kata sandi melampaui batas maksimum 128 karakter. Silakan gunakan kata sandi antara 8 sampai 128 karakter.',
  })
  password!: string;

  @IsString({
    message:
      'Pendaftaran akun gagal. Nama lengkap harus berupa teks. Silakan isi nama lengkap sesuai identitas resmi.',
  })
  @MinLength(3, {
    message:
      'Pendaftaran akun gagal karena nama lengkap kurang dari batas minimum 3 karakter. Silakan masukkan nama lengkap staf minimal 3 karakter.',
  })
  @MaxLength(255, {
    message:
      'Pendaftaran akun gagal karena nama lengkap melebihi batas maksimum 255 karakter. Silakan ringkas penulisan nama lengkap Anda.',
  })
  fullName!: string;
}
