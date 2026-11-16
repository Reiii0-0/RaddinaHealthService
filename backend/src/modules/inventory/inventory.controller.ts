import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  BatchStockItemDto,
  PaginatedResponse,
  StockCardEntryDto,
} from '@shared/api-contracts';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { InventoryService } from './inventory.service';

@Controller('api/v1/inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('batches')
  async findBatches(
    @Query('medicineId') medicineId?: string,
    @Query('status') status?: string,
    @Query('expiryStatus') expiryStatus?: string,
    @Query('search') search?: string,
  ): Promise<BatchStockItemDto[]> {
    return this.inventoryService.findBatches({
      medicineId,
      status,
      expiryStatus,
      search,
    });
  }

  @Get('stock-cards')
  async findStockCards(
    @Query('medicineId') medicineId?: string,
    @Query('batchId') batchId?: string,
    @Query('movementType') movementType?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<PaginatedResponse<StockCardEntryDto>> {
    return this.inventoryService.findStockCards({
      medicineId,
      batchId,
      movementType,
      page,
      limit,
    });
  }
}
