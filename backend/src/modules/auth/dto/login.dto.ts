import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { LoginRequestDto } from '@shared/api-contracts';

export class LoginDto implements LoginRequestDto {
  @IsEmail(
    {},
    {
      message:
        'Proses masuk gagal. Format alamat email yang Anda masukkan tidak sah. Silakan periksa kembali penulisan email Anda.',
    },
  )
  @IsNotEmpty({
    message:
      'Proses masuk gagal. Alamat email tidak boleh kosong. Silakan isi alamat email akun staf Anda.',
  })
  email!: string;

  @IsString({
    message:
      'Proses masuk gagal. Kata sandi harus berupa teks. Silakan masukkan kata sandi akun Anda.',
  })
  @IsNotEmpty({
    message:
      'Proses masuk gagal. Kata sandi tidak boleh kosong. Silakan masukkan kata sandi akun staf Anda.',
  })
  password!: string;
}
