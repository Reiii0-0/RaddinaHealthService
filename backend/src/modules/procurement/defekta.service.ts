import { Injectable } from '@nestjs/common';
import { DefektaItemDto } from '@shared/api-contracts';
import { DefektaEngine } from './defekta.engine';

@Injectable()
export class DefektaService {
  constructor(private readonly defektaEngine: DefektaEngine) {}

  /**
   * Mengambil daftar buku Defekta otomatis berdasarkan analisis ROP dan stok aktif.
   */
  async getDefektaList(): Promise<DefektaItemDto[]> {
    return this.defektaEngine.calculateDefektaList();
  }
}
