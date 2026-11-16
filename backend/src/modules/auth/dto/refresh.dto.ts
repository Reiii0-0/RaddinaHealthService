import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshDto {
  @IsString({
    message:
      'Pembaruan sesi gagal. Refresh token harus berupa string JWT yang utuh. Silakan masuk kembali untuk mendapatkan sesi baru.',
  })
  @IsNotEmpty({
    message:
      'Pembaruan sesi gagal. Nilai refreshToken tidak ditemukan pada isi permintaan. Silakan kirim refreshToken yang sah atau masuk kembali.',
  })
  refreshToken!: string;
}
