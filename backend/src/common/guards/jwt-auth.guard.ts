import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import { Request } from 'express';
import { DRIZZLE_DB, DrizzleDB } from '../../db';
import { users } from '../../db/schema';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtUserPayload } from '../decorators/current-user.decorator';

const DEFAULT_ACCESS_SECRET = 'raddina_jwt_access_secret_key_2026_pbkk_its';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly reflector: Reflector;
  private readonly jwtService: JwtService;

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    @Optional() reflector?: Reflector,
    @Optional() jwtService?: JwtService,
  ) {
    this.reflector = reflector ?? new Reflector();
    this.jwtService =
      jwtService ??
      new JwtService({
        secret: process.env.JWT_ACCESS_SECRET || DEFAULT_ACCESS_SECRET,
      });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtUserPayload }>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException(
        'Otentikasi gagal dilakukan. Header Authorization dengan format Bearer token tidak ditemukan pada permintaan ini. Silakan masuk kembali melalui halaman login untuk memperoleh token akses yang sah.',
      );
    }

    let decodedPayload: { sub?: string; email?: string };
    try {
      decodedPayload = await this.jwtService.verifyAsync<{
        sub?: string;
        email?: string;
      }>(token, {
        secret: process.env.JWT_ACCESS_SECRET || DEFAULT_ACCESS_SECRET,
      });
    } catch {
      throw new UnauthorizedException(
        'Verifikasi sesi gagal dilakukan. Token akses yang dikirim tidak sah atau masa berlakunya telah habis. Silakan perbarui sesi menggunakan refresh token atau masuk kembali ke aplikasi.',
      );
    }

    if (!decodedPayload?.sub) {
      throw new UnauthorizedException(
        'Verifikasi identitas pengguna gagal. Payload token tidak memuat pengenal pengguna (sub) yang utuh. Silakan keluar lalu masuk kembali untuk menerbitkan token baru.',
      );
    }

    const [activeUser] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, decodedPayload.sub))
      .limit(1);

    if (!activeUser) {
      throw new UnauthorizedException(
        `Akses ditolak karena akun pengguna dengan ID ${decodedPayload.sub} tidak ditemukan di basis data. Akun tersebut kemungkinan telah dihapus. Silakan masuk menggunakan akun staf yang terdaftar.`,
      );
    }

    if (!activeUser.isActive) {
      throw new UnauthorizedException(
        `Akses ditolak karena akun ${activeUser.email} berstatus nonaktif. Pengguna dengan status nonaktif tidak diizinkan menjalankan transaksi apotek. Silakan hubungi Pemilik Apotek (OWNER) untuk mengaktifkan kembali akun Anda.`,
      );
    }

    request.user = {
      sub: activeUser.id,
      id: activeUser.id,
      email: activeUser.email,
      fullName: activeUser.fullName,
      role: activeUser.role,
      noSipa: activeUser.noSipa ?? null,
      sipaExpiryDate: activeUser.sipaExpiryDate ?? null,
    };

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader || typeof authHeader !== 'string') {
      return undefined;
    }
    const [type, token] = authHeader.trim().split(/\s+/);
    return type === 'Bearer' && token ? token : undefined;
  }
}
