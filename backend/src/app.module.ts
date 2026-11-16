import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './db';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { MedicinesModule } from './modules/medicines/medicines.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { SalesModule } from './modules/sales/sales.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ProcurementModule } from './modules/procurement/procurement.module';
import { MailModule } from './modules/mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    MedicinesModule,
    SuppliersModule,
    InvoicesModule,
    InventoryModule,
    SalesModule,
    AnalyticsModule,
    ProcurementModule,
    MailModule,
  ],
})
export class AppModule {}

