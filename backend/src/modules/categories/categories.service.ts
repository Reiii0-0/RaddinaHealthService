import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { asc, ilike } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDB } from '../../db';
import { categories } from '../../db/schema';
import { CreateCategoryDto } from './dto/create-category.dto';

export interface CategoryItemDto {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

@Injectable()
export class CategoriesService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  async findAll(): Promise<CategoryItemDto[]> {
    const rows = await this.db
      .select()
      .from(categories)
      .orderBy(asc(categories.name));

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async create(dto: CreateCategoryDto): Promise<CategoryItemDto> {
    const trimmedName = dto.name?.trim();
    if (!trimmedName) {
      throw new BadRequestException(
        'Pembuatan kategori obat gagal diproses. Nama kategori yang dikirim hanya berisi spasi kosong (0 karakter bermakna). Silakan masukkan nama kategori yang sah seperti Antibiotik atau Vitamin.',
      );
    }

    const [existing] = await this.db
      .select()
      .from(categories)
      .where(ilike(categories.name, trimmedName))
      .limit(1);

    if (existing) {
      throw new ConflictException(
        `Pembuatan kategori obat gagal karena terjadi duplikasi data. Kategori bernama "${trimmedName}" sudah terdaftar di basis data dengan ID ${existing.id}. Silakan gunakan nama kategori lain atau pilih kategori yang sudah tersedia.`,
      );
    }

    const [inserted] = await this.db
      .insert(categories)
      .values({
        name: trimmedName,
        description: dto.description?.trim() || null,
      })
      .returning();

    return {
      id: inserted.id,
      name: inserted.name,
      description: inserted.description ?? null,
      createdAt: inserted.createdAt.toISOString(),
    };
  }
}
