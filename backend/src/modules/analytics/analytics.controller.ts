import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ParetoItemAnalyticsDto } from '@shared/api-contracts';
import { JwtAuthGuard, Roles, RolesGuard } from '../../common';
import { AnalyticsService, ParetoRecalculateResponse } from './analytics.service';

@Controller('api/v1/analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('pareto')
  async getPareto(
    @Query('days') days?: string,
  ): Promise<ParetoItemAnalyticsDto[]> {
    const parsedDays = days && Number(days) > 0 ? Number(days) : 90;
    return this.analyticsService.getParetoAnalytics(parsedDays);
  }

  @Post('pareto/recalculate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'PHARMACIST')
  async recalculatePareto(
    @Query('days') days?: string,
  ): Promise<ParetoRecalculateResponse> {
    const parsedDays = days && Number(days) > 0 ? Number(days) : 90;
    return this.analyticsService.recalculateAndPersistPareto(parsedDays);
  }
}
