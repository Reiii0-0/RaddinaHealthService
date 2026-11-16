import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, ilike, ne } from 'drizzle-orm';
import { SupplierDto } from '@shared/api-contracts';
import { DRIZZLE_DB, DrizzleDB } from '../../db';
import { SupplierRow, suppliers } from '../../db/schema';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SupplierDetailDto extends SupplierDto {
  createdAt: string;
}

@Injectable()
export class SuppliersService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  private toSupplierDto(row: SupplierRow): SupplierDetailDto {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      email: row.email,
      phone: row.phone,
      izinPbfNo: row.izinPbfNo,
      address: row.address,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async findAll(): Promise<SupplierDetailDto[]> {
    const rows = await this.db
      .select()
      .from(suppliers)
      .orderBy(asc(suppliers.name));

    return rows.map((r) => this.toSupplierDto(r));
  }

  async create(dto: CreateSupplierDto): Promise<SupplierDetailDto> {
    const trimmedCode = dto.code.trim();

    const [existingCode] = await this.db
      .select()
      .from(suppliers)
      .where(ilike(suppliers.code, trimmedCode))
      .limit(1);

    if (existingCode) {
      throw new ConflictException(
        `Pendaftaran pemasok PBF gagal karena kode duplikat. Kode pemasok "${trimmedCode}" sudah terdaftar atas nama "${existingCode.name}" (ID ${existingCode.id}). Silakan gunakan kode pemasok unik lainnya.`,
      );
    }

    const [inserted] = await this.db
      .insert(suppliers)
      .values({
        code: trimmedCode,
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        phone: dto.phone.trim(),
        izinPbfNo: dto.izinPbfNo.trim(),
        address: dto.address.trim(),
        isActive: dto.isActive ?? true,
      })
      .returning();

    return this.toSupplierDto(inserted);
  }

  async update(id: string, dto: UpdateSupplierDto): Promise<SupplierDetailDto> {
    if (!id || !UUID_REGEX.test(id)) {
      throw new NotFoundException(
        `Pembaruan data pemasok PBF gagal dilakukan. Identitas pemasok "${id}" bukan format UUID yang sah. Silakan pilih pemasok dari daftar PBF yang terdaftar.`,
      );
    }

    const [existing] = await this.db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(
        `Pembaruan data pemasok PBF gagal dilakukan. Pemasok dengan ID ${id} tidak ditemukan di basis data. Silakan segarkan daftar pemasok PBF terlebih dahulu.`,
      );
    }

    if (dto.code !== undefined) {
      const trimmedCode = dto.code.trim();
      const [duplicate] = await this.db
        .select()
        .from(suppliers)
        .where(and(ilike(suppliers.code, trimmedCode), ne(suppliers.id, id)))
        .limit(1);

      if (duplicate) {
        throw new ConflictException(
          `Pembaruan data pemasok PBF gagal karena kode duplikat. Kode "${trimmedCode}" sudah digunakan oleh "${duplicate.name}" (ID ${duplicate.id}). Silakan gunakan kode pemasok yang berbeda.`,
        );
      }
    }

    const [updated] = await this.db
      .update(suppliers)
      .set({
        code: dto.code !== undefined ? dto.code.trim() : existing.code,
        name: dto.name !== undefined ? dto.name.trim() : existing.name,
        email:
          dto.email !== undefined
            ? dto.email.trim().toLowerCase()
            : existing.email,
        phone: dto.phone !== undefined ? dto.phone.trim() : existing.phone,
        izinPbfNo:
          dto.izinPbfNo !== undefined
            ? dto.izinPbfNo.trim()
            : existing.izinPbfNo,
        address:
          dto.address !== undefined ? dto.address.trim() : existing.address,
        isActive:
          dto.isActive !== undefined ? dto.isActive : existing.isActive,
      })
      .where(eq(suppliers.id, id))
      .returning();

    return this.toSupplierDto(updated);
  }
}
