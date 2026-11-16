import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { ParetoEngine } from './pareto.engine';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, ParetoEngine],
  exports: [AnalyticsService, ParetoEngine],
})
export class AnalyticsModule {}
