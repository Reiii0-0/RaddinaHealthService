import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { AuthUserDto } from '@shared/api-contracts';
import { DRIZZLE_DB, DrizzleDB } from '../../db';
import { UserRow, users } from '../../db/schema';
import { UpdateRoleSipaDto } from './dto/update-role-sipa.dto';

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  async findAll(): Promise<AuthUserDto[]> {
    const allUsers = await this.db
      .select()
      .from(users)
      .orderBy(asc(users.createdAt));

    return allUsers.map((u) => this.toAuthUserDto(u));
  }

  async updateRoleAndSipa(
    userId: string,
    dto: UpdateRoleSipaDto,
  ): Promise<AuthUserDto> {
    const [existingUser] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!existingUser) {
      throw new NotFoundException(
        `Pembaruan peran pengguna gagal dilakukan. Pengguna dengan ID ${userId} tidak ditemukan pada basis data Raddina Health Service. Silakan muat ulang daftar pengguna dan pilih staf yang terdaftar.`,
      );
    }

    const cleanedNoSipa =
      typeof dto.noSipa === 'string' && dto.noSipa.trim().length > 0
        ? dto.noSipa.trim()
        : null;

    const cleanedSipaExpiry =
      typeof dto.sipaExpiryDate === 'string' &&
      dto.sipaExpiryDate.trim().length > 0
        ? dto.sipaExpiryDate.trim().slice(0, 10)
        : null;

    if (dto.role === 'PHARMACIST') {
      const effectiveNoSipa = cleanedNoSipa ?? existingUser.noSipa;
      if (!effectiveNoSipa || effectiveNoSipa.trim().length === 0) {
        throw new BadRequestException(
          `Penetapan peran PHARMACIST untuk pengguna ${existingUser.fullName} ditolak karena nomor SIPA (noSipa) kosong. Regulasi kefarmasian mewajibkan setiap Apoteker memiliki nomor SIPA yang tercatat. Silakan isi nomor SIPA beserta tanggal masa berlakunya lalu simpan kembali.`,
        );
      }
    }

    const nextNoSipa =
      dto.role === 'PHARMACIST'
        ? (cleanedNoSipa ?? existingUser.noSipa)
        : cleanedNoSipa;

    const nextSipaExpiryDate =
      dto.role === 'PHARMACIST'
        ? (cleanedSipaExpiry ?? existingUser.sipaExpiryDate)
        : cleanedSipaExpiry;

    const [updatedUser] = await this.db
      .update(users)
      .set({
        role: dto.role,
        noSipa: nextNoSipa,
        sipaExpiryDate: nextSipaExpiryDate,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return this.toAuthUserDto(updatedUser);
  }

  private toAuthUserDto(user: UserRow): AuthUserDto {
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
}
