import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FefoItemPreviewDto, PaginatedResponse } from '@shared/api-contracts';
import { CurrentUser, JwtAuthGuard, JwtUserPayload } from '../../common';
import { CheckoutSaleDto } from './dto/checkout-sale.dto';
import { PreviewFefoDto } from './dto/preview-fefo.dto';
import { SalesDetailResponse, SalesService } from './sales.service';

@Controller('api/v1/sales')
@UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post('preview-fefo')
  @HttpCode(HttpStatus.OK)
  async previewFefo(
    @Body() dto: PreviewFefoDto,
  ): Promise<FefoItemPreviewDto[]> {
    return this.salesService.previewFefo(dto);
  }

  @Post('checkout')
  @HttpCode(HttpStatus.CREATED)
  async checkout(
    @Body() dto: CheckoutSaleDto,
    @CurrentUser() user: JwtUserPayload,
  ): Promise<SalesDetailResponse> {
    return this.salesService.checkout(dto, user.id);
  }

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ): Promise<PaginatedResponse<any>> {
    return this.salesService.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<SalesDetailResponse> {
    return this.salesService.findOne(id);
  }
}
