import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SupplierDetailDto, SuppliersService } from './suppliers.service';

@Controller('api/v1/suppliers')
@UseGuards(JwtAuthGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  async findAll(): Promise<SupplierDetailDto[]> {
    return this.suppliersService.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'PHARMACIST')
  async create(@Body() dto: CreateSupplierDto): Promise<SupplierDetailDto> {
    return this.suppliersService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'PHARMACIST')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ): Promise<SupplierDetailDto> {
    return this.suppliersService.update(id, dto);
  }
}
