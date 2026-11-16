import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomUUID } from 'crypto';
import { and, eq, isNull } from 'drizzle-orm';
import {
  AuthTokenResponseDto,
  AuthUserDto,
} from '@shared/api-contracts';
import { DRIZZLE_DB, DrizzleDB } from '../../db';
import { refreshTokens, UserRow, users } from '../../db/schema';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const DEFAULT_ACCESS_SECRET = 'raddina_jwt_access_secret_key_2026_pbkk_its';
const DEFAULT_REFRESH_SECRET = 'raddina_jwt_refresh_secret_key_2026_pbkk_its';
const ACCESS_TOKEN_EXPIRES_IN_SECONDS = 15 * 60; // 15 menit (900 detik)
const REFRESH_TOKEN_EXPIRES_IN_SECONDS = 7 * 24 * 60 * 60; // 7 hari (604.800 detik)

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokenResponseDto> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const [existingUser] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingUser) {
      throw new ConflictException(
        `Pendaftaran akun ditolak karena alamat email ${normalizedEmail} sudah terdaftar di sistem Raddina Health Service. Satu alamat email hanya dapat dipakai untuk satu akun staf. Silakan masuk menggunakan email tersebut atau daftar dengan alamat email lain.`,
      );
    }

    const passwordHash = await argon2.hash(dto.password);

    const [createdUser] = await this.db
      .insert(users)
      .values({
        email: normalizedEmail,
        passwordHash,
        fullName: dto.fullName.trim(),
        role: 'CASHIER',
        noSipa: null,
        sipaExpiryDate: null,
        isActive: true,
      })
      .returning();

    return this.issueTokenPair(createdUser);
  }

  async login(dto: LoginDto): Promise<AuthTokenResponseDto> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException(
        `Otentikasi gagal dilakukan. Kombinasi email ${normalizedEmail} dan kata sandi tidak cocok dengan akun staf mana pun. Silakan periksa kembali ejaan email serta kata sandi Anda lalu coba lagi.`,
      );
    }

    if (!user.isActive) {
      throw new UnauthorizedException(
        `Otentikasi ditolak karena akun ${normalizedEmail} berstatus nonaktif. Staf dengan akun nonaktif tidak dapat mengakses sistem apotek. Silakan hubungi Pemilik Apotek (OWNER) untuk mengaktifkan kembali akun Anda.`,
      );
    }

    const isPasswordValid = await argon2.verify(
      user.passwordHash,
      dto.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException(
        `Otentikasi gagal dilakukan. Kombinasi email ${normalizedEmail} dan kata sandi tidak cocok dengan catatan keamanan kami. Silakan ketik ulang kata sandi Anda dengan benar atau hubungi Pemilik Apotek jika lupa kata sandi.`,
      );
    }

    return this.issueTokenPair(user);
  }

  async refresh(refreshTokenRaw: string): Promise<AuthTokenResponseDto> {
    let decoded: { sub?: string; email?: string; jti?: string };
    try {
      decoded = await this.jwtService.verifyAsync<{
        sub?: string;
        email?: string;
        jti?: string;
      }>(refreshTokenRaw, {
        secret: process.env.JWT_REFRESH_SECRET || DEFAULT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException(
        'Pembaruan sesi gagal dilakukan. Refresh token yang dikirim tidak sah atau masa berlakunya (7 hari) telah berakhir. Silakan masuk kembali melalui halaman login.',
      );
    }

    if (!decoded?.sub) {
      throw new UnauthorizedException(
        'Pembaruan sesi gagal dilakukan. Struktur payload refresh token tidak memuat pengenal pengguna (sub). Silakan masuk kembali untuk menerbitkan sesi baru.',
      );
    }

    const tokenHash = this.hashToken(refreshTokenRaw);

    const [storedToken] = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);

    if (!storedToken) {
      throw new UnauthorizedException(
        'Pembaruan sesi ditolak karena refresh token tidak terdaftar pada basis data sesi aktif. Token tersebut mungkin tidak pernah diterbitkan oleh server ini. Silakan masuk kembali menggunakan email dan kata sandi Anda.',
      );
    }

    if (storedToken.revokedAt !== null) {
      throw new UnauthorizedException(
        `Pembaruan sesi ditolak karena refresh token ini telah dicabut pada ${storedToken.revokedAt.toISOString()}. Demi keamanan rotasi token, satu refresh token hanya dapat dipakai satu kali. Silakan masuk kembali untuk memulai sesi baru.`,
      );
    }

    const now = new Date();
    if (storedToken.expiresAt <= now) {
      throw new UnauthorizedException(
        `Pembaruan sesi ditolak karena refresh token telah kedaluwarsa pada ${storedToken.expiresAt.toISOString()} (waktu server saat ini: ${now.toISOString()}). Silakan masuk kembali untuk memperbarui sesi kerja Anda.`,
      );
    }

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, storedToken.userId))
      .limit(1);

    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'Pembaruan sesi ditolak karena akun pengguna tidak ditemukan atau telah dinonaktifkan oleh Pemilik Apotek. Silakan hubungi Pemilik Apotek (OWNER) untuk konfirmasi status akun Anda.',
      );
    }

    await this.db
      .update(refreshTokens)
      .set({ revokedAt: now })
      .where(eq(refreshTokens.id, storedToken.id));

    return this.issueTokenPair(user);
  }

  async logout(
    userId: string,
    refreshTokenRaw?: string,
  ): Promise<{ message: string }> {
    const now = new Date();

    if (refreshTokenRaw && refreshTokenRaw.trim().length > 0) {
      const tokenHash = this.hashToken(refreshTokenRaw.trim());
      await this.db
        .update(refreshTokens)
        .set({ revokedAt: now })
        .where(
          and(
            eq(refreshTokens.userId, userId),
            eq(refreshTokens.tokenHash, tokenHash),
            isNull(refreshTokens.revokedAt),
          ),
        );
    }

    await this.db
      .update(refreshTokens)
      .set({ revokedAt: now })
      .where(
        and(
          eq(refreshTokens.userId, userId),
          isNull(refreshTokens.revokedAt),
        ),
      );

    return {
      message: 'Sesi pengguna berhasil diakhiri dan refresh token telah dicabut.',
    };
  }

  async getMe(userId: string): Promise<AuthUserDto> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException(
        `Pengambilan profil gagal dilakukan. Pengguna dengan ID ${userId} tidak ditemukan di basis data. Silakan masuk kembali ke aplikasi.`,
      );
    }

    return this.toAuthUserDto(user);
  }

  toAuthUserDto(user: UserRow): AuthUserDto {
    const todayIso = new Date().toISOString().slice(0, 10);
    const hasNonEmptySipa =
      typeof user.noSipa === 'string' && user.noSipa.trim().length > 0;
    const isNotExpired =
      Boolean(user.sipaExpiryDate) &&
      new Date(user.sipaExpiryDate as string) > new Date(todayIso);

    const isSipaActive =
      user.role === 'PHARMACIST' && hasNonEmptySipa && isNotExpired;

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      noSipa: user.noSipa ?? null,
      sipaExpiryDate: user.sipaExpiryDate ?? null,
      isSipaActive,
      isActive: user.isActive,
      createdAt:
        user.createdAt instanceof Date
          ? user.createdAt.toISOString()
          : String(user.createdAt),
    };
  }

  private async issueTokenPair(user: UserRow): Promise<AuthTokenResponseDto> {
    const accessPayload = {
      sub: user.id,
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      noSipa: user.noSipa ?? null,
      sipaExpiryDate: user.sipaExpiryDate ?? null,
    };

    const refreshJti = randomUUID();
    const refreshPayload = {
      sub: user.id,
      email: user.email,
      jti: refreshJti,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: process.env.JWT_ACCESS_SECRET || DEFAULT_ACCESS_SECRET,
        expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: process.env.JWT_REFRESH_SECRET || DEFAULT_REFRESH_SECRET,
        expiresIn: REFRESH_TOKEN_EXPIRES_IN_SECONDS,
      }),
    ]);

    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(
      Date.now() + REFRESH_TOKEN_EXPIRES_IN_SECONDS * 1000,
    );

    await this.db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
      revokedAt: null,
    });

    return {
      accessToken,
      refreshToken,
      user: this.toAuthUserDto(user),
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
