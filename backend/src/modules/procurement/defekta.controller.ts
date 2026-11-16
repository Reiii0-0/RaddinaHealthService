import { Controller, Get, UseGuards } from '@nestjs/common';
import { DefektaItemDto } from '@shared/api-contracts';
import { JwtAuthGuard } from '../../common';
import { DefektaService } from './defekta.service';

@Controller('api/v1/procurement/defekta')
@UseGuards(JwtAuthGuard)
export class DefektaController {
  constructor(private readonly defektaService: DefektaService) {}

  @Get()
  async getDefektaList(): Promise<DefektaItemDto[]> {
    return this.defektaService.getDefektaList();
  }
}
