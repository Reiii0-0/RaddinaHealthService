import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { JwtUserPayload } from '../decorators/current-user.decorator';

@Injectable()
export class ActiveSipaGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: JwtUserPayload }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException(
        'Validasi lisensi SIPA gagal dilakukan. Data sesi pengguna tidak ditemukan pada permintaan ini. Silakan masuk kembali menggunakan akun Apoteker Penanggung Jawab.',
      );
    }

    if (user.role !== 'PHARMACIST') {
      throw new ForbiddenException(
        `Otorisasi tindakan kefarmasian ditolak. Peran akun Anda adalah ${user.role}, padahal tindakan ini hanya diizinkan bagi peran PHARMACIST dengan SIPA aktif. Silakan masuk menggunakan akun Apoteker Penanggung Jawab yang sah.`,
      );
    }

    const trimmedSipa = user.noSipa?.trim() ?? '';
    if (!trimmedSipa || !user.sipaExpiryDate) {
      throw new ForbiddenException(
        `Otorisasi tindakan kefarmasian ditolak karena profil Apoteker ${user.fullName} belum memiliki nomor SIPA atau tanggal kedaluwarsa SIPA yang lengkap (status SIPA: TIDAK_TERDAFTAR). Regulasi kefarmasian mewajibkan pencantuman SIPA aktif pada setiap Surat Pesanan. Silakan minta Pemilik Apotek (OWNER) memperbarui data SIPA Anda di menu Manajemen Pengguna.`,
      );
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const isSipaValid = new Date(user.sipaExpiryDate) > new Date(todayIso);

    if (!isSipaValid) {
      throw new ForbiddenException(
        `Otorisasi tindakan kefarmasian ditolak karena SIPA Apoteker (${trimmedSipa}) berstatus KEDALUWARSA sejak tanggal ${user.sipaExpiryDate} (tanggal pemeriksaan: ${todayIso}). Penerbitan Surat Pesanan hanya dapat diproses apabila tanggal masa berlaku SIPA lebih besar daripada tanggal hari ini. Silakan perbarui masa berlaku SIPA Anda melalui Pemilik Apotek (OWNER) sebelum melanjutkan.`,
      );
    }

    return true;
  }
}
