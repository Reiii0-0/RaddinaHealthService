import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MedicineSummaryDto, PaginatedResponse } from '@shared/api-contracts';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  createMulterDiskOptions,
  FileSignatureValidationPipe,
} from '../../common/pipes/file-signature-validation.pipe';
import {
  DeleteMedicineResponseDto,
  MedicineDetailDto,
  MedicinesService,
} from './medicines.service';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';

@Controller('api/v1/medicines')
@UseGuards(JwtAuthGuard)
export class MedicinesController {
  constructor(private readonly medicinesService: MedicinesService) {}

  @Get()
  async findAll(
    @Query('search') search?: string,
    @Query('activeIngredient') activeIngredient?: string,
    @Query('categoryId') categoryId?: string,
    @Query('classification') classification?: string,
    @Query('paretoClass') paretoClass?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<PaginatedResponse<MedicineSummaryDto>> {
    return this.medicinesService.findAll({
      search,
      activeIngredient,
      categoryId,
      classification,
      paretoClass,
      isActive,
      page,
      limit,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<MedicineDetailDto> {
    return this.medicinesService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'PHARMACIST')
  async create(@Body() dto: CreateMedicineDto): Promise<MedicineDetailDto> {
    return this.medicinesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'PHARMACIST')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMedicineDto,
  ): Promise<MedicineDetailDto> {
    return this.medicinesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'PHARMACIST')
  async remove(@Param('id') id: string): Promise<DeleteMedicineResponseDto> {
    return this.medicinesService.remove(id);
  }

  @Post(':id/image')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'PHARMACIST')
  @UseInterceptors(
    FileInterceptor('file', createMulterDiskOptions('medicines')),
  )
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile(new FileSignatureValidationPipe('IMAGE_ONLY'))
    file: Express.Multer.File,
  ): Promise<MedicineDetailDto> {
    return this.medicinesService.uploadImage(id, file);
  }
}
