import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ActiveSipaGuard,
  CurrentUser,
  JwtAuthGuard,
  JwtUserPayload,
  Roles,
  RolesGuard,
} from '../../common';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import {
  PurchaseOrderDetailDto,
  PurchaseOrdersService,
} from './purchase-orders.service';

@Controller('api/v1/procurement/purchase-orders')
@UseGuards(JwtAuthGuard)
export class PurchaseOrdersController {
  constructor(
    private readonly purchaseOrdersService: PurchaseOrdersService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard, ActiveSipaGuard)
  @Roles('PHARMACIST')
  async create(
    @Body() dto: CreatePurchaseOrderDto,
    @CurrentUser() user: JwtUserPayload,
  ): Promise<PurchaseOrderDetailDto> {
    return this.purchaseOrdersService.createPurchaseOrder(dto, user);
  }

  @Get()
  async findAll(): Promise<PurchaseOrderDetailDto[]> {
    return this.purchaseOrdersService.findAllPurchaseOrders();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<PurchaseOrderDetailDto> {
    return this.purchaseOrdersService.findOnePurchaseOrder(id);
  }
}
