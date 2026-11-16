import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  UpdateUserRoleSipaRequestDto,
  UserRole,
} from '@shared/api-contracts';

export class UpdateRoleSipaDto implements UpdateUserRoleSipaRequestDto {
  @IsIn(['OWNER', 'PHARMACIST', 'CASHIER'], {
    message:
      'Pembaruan peran pengguna gagal. Nilai peran yang dikirim tidak sah dan wajib berupa salah satu dari OWNER, PHARMACIST, atau CASHIER. Silakan pilih peran yang sesuai dari daftar.',
  })
  role!: UserRole;

  @IsOptional()
  @IsString({
    message:
      'Pembaruan data SIPA gagal. Nomor SIPA harus berupa teks karakter. Silakan masukkan nomor SIPA resmi sesuai sertifikat kompetensi.',
  })
  @MaxLength(100, {
    message:
      'Pembaruan data SIPA gagal karena panjang nomor SIPA melebihi batas maksimum 100 karakter. Silakan periksa kembali penulisan nomor SIPA.',
  })
  noSipa?: string | null;

  @IsOptional()
  @IsDateString(
    {},
    {
      message:
        'Pembaruan tanggal masa berlaku SIPA gagal. Format tanggal wajib mengikuti standar ISO YYYY-MM-DD (contoh: 2028-12-31). Silakan pilih tanggal yang sah.',
    },
  )
  sipaExpiryDate?: string | null;
}
