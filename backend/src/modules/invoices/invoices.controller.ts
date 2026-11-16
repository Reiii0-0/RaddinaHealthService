import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  CurrentUser,
  JwtUserPayload,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  createMulterDiskOptions,
  FileSignatureValidationPipe,
} from '../../common/pipes/file-signature-validation.pipe';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoicesService, PbfInvoiceDetailDto } from './invoices.service';

@Controller('api/v1/invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  async findAll(
    @Query('supplierId') supplierId?: string,
    @Query('paymentStatus') paymentStatus?: string,
  ): Promise<PbfInvoiceDetailDto[]> {
    return this.invoicesService.findAll({ supplierId, paymentStatus });
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<PbfInvoiceDetailDto> {
    return this.invoicesService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'PHARMACIST')
  async create(
    @Body() dto: CreateInvoiceDto,
    @CurrentUser() user: JwtUserPayload,
  ): Promise<PbfInvoiceDetailDto> {
    return this.invoicesService.create(dto, user);
  }

  @Post(':id/scan')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'PHARMACIST')
  @UseInterceptors(FileInterceptor('file', createMulterDiskOptions('invoices')))
  async uploadScan(
    @Param('id') id: string,
    @UploadedFile(new FileSignatureValidationPipe('IMAGE_OR_PDF'))
    file: Express.Multer.File,
  ): Promise<PbfInvoiceDetailDto> {
    return this.invoicesService.uploadScan(id, file);
  }
}
