import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CategoriesService, CategoryItemDto } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';

@Controller('api/v1/categories')
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  async findAll(): Promise<CategoryItemDto[]> {
    return this.categoriesService.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'PHARMACIST')
  async create(@Body() dto: CreateCategoryDto): Promise<CategoryItemDto> {
    return this.categoriesService.create(dto);
  }
}
