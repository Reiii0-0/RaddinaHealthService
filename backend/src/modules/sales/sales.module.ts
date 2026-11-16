import { Module } from '@nestjs/common';
import { FefoEngine } from './fefo.engine';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  controllers: [SalesController],
  providers: [SalesService, FefoEngine],
  exports: [SalesService, FefoEngine],
})
export class SalesModule {}
