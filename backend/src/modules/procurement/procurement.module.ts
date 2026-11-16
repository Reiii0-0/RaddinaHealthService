import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { DefektaController } from './defekta.controller';
import { DefektaEngine } from './defekta.engine';
import { DefektaService } from './defekta.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';

@Module({
  imports: [MailModule],
  controllers: [DefektaController, PurchaseOrdersController],
  providers: [DefektaEngine, DefektaService, PurchaseOrdersService],
  exports: [DefektaEngine, DefektaService, PurchaseOrdersService],
})
export class ProcurementModule {}
