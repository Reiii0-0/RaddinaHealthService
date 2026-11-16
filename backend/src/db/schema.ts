import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  bigint,
  numeric,
  boolean,
  date,
  timestamp,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ============================================================================
// 1. POSTGRESQL ENUMS
// ============================================================================

export const userRoleEnum = pgEnum('user_role', [
  'OWNER',
  'PHARMACIST',
  'CASHIER',
]);

export const drugClassEnum = pgEnum('drug_class', [
  'BEBAS',
  'BEBAS_TERBATAS',
  'KERAS',
  'PSIKOTROPIKA',
  'NARKOTIKA',
]);

export const paretoClassEnum = pgEnum('pareto_class', ['A', 'B', 'C']);

export const paymentStatusEnum = pgEnum('payment_status', ['UNPAID', 'PAID']);

export const stockMovementTypeEnum = pgEnum('stock_movement_type', [
  'IN_INVOICE',
  'OUT_SALE',
  'ADJUSTMENT',
]);

export const pricingTierEnum = pgEnum('pricing_tier', ['REGULAR', 'PARTNER']);

export const paymentMethodEnum = pgEnum('payment_method', [
  'CASH',
  'QRIS',
  'DEBIT',
]);

export const poStatusEnum = pgEnum('po_status', [
  'ISSUED',
  'SENT_EMAIL',
  'RECEIVED',
]);

// ============================================================================
// 2. DOMAIN TABLES (US-01: AUTH, RBAC, & SIPA)
// ============================================================================

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull().default('CASHIER'),
  noSipa: varchar('no_sipa', { length: 100 }),
  sipaExpiryDate: date('sipa_expiry_date'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ============================================================================
// 3. DOMAIN TABLES (US-02: MASTER OBAT, KATEGORI, MULTI-UOM, & DUAL-PRICING)
// ============================================================================

export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 120 }).notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const medicines = pgTable(
  'medicines',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sku: varchar('sku', { length: 64 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    activeIngredient: varchar('active_ingredient', { length: 255 }).notNull(),
    baseUnit: varchar('base_unit', { length: 32 }).notNull(),
    classification: drugClassEnum('classification').notNull().default('BEBAS'),
    paretoClass: paretoClassEnum('pareto_class').notNull().default('C'),
    minStockBaseUnit: integer('min_stock_base_unit').notNull().default(0),
    imagePath: text('image_path'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_medicines_active_ingredient').on(table.activeIngredient),
    index('idx_medicines_name').on(table.name),
    check('chk_medicines_min_stock_nonneg', sql`${table.minStockBaseUnit} >= 0`),
  ],
);

export const medicineUomConversions = pgTable(
  'medicine_uom_conversions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    medicineId: uuid('medicine_id')
      .notNull()
      .references(() => medicines.id, { onDelete: 'cascade' }),
    unitName: varchar('unit_name', { length: 32 }).notNull(),
    multiplierToBase: integer('multiplier_to_base').notNull(),
    sellingPriceRegular: integer('selling_price_regular').notNull(),
    sellingPricePartner: integer('selling_price_partner').notNull(),
    barcode: varchar('barcode', { length: 64 }),
  },
  (table) => [
    uniqueIndex('uq_medicine_uom_unit').on(table.medicineId, table.unitName),
    check('chk_uom_multiplier_positive', sql`${table.multiplierToBase} >= 1`),
    check(
      'chk_uom_price_regular_nonneg',
      sql`${table.sellingPriceRegular} >= 0`,
    ),
    check(
      'chk_uom_price_partner_nonneg',
      sql`${table.sellingPricePartner} >= 0`,
    ),
  ],
);

// ============================================================================
// 4. DOMAIN TABLES (US-03: SUPPLIERS, PBF INVOICES, BATCHES, & STOCK CARDS)
// ============================================================================

export const suppliers = pgTable('suppliers', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 32 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }).notNull(),
  izinPbfNo: varchar('izin_pbf_no', { length: 100 }).notNull(),
  address: text('address').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const medicineBatches = pgTable(
  'medicine_batches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    medicineId: uuid('medicine_id')
      .notNull()
      .references(() => medicines.id, { onDelete: 'restrict' }),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'restrict' }),
    batchNumber: varchar('batch_number', { length: 100 }).notNull(),
    expiryDate: date('expiry_date').notNull(),
    initialStock: integer('initial_stock').notNull(),
    currentStock: integer('current_stock').notNull(),
    costPricePerBaseUnit: numeric('cost_price_per_base_unit', {
      precision: 14,
      scale: 4,
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_medicine_batch_supplier').on(
      table.medicineId,
      table.batchNumber,
      table.supplierId,
    ),
    index('idx_batches_fefo').on(
      table.medicineId,
      table.expiryDate,
      table.createdAt,
    ),
    check('chk_batch_initial_stock_nonneg', sql`${table.initialStock} >= 0`),
    check('chk_batch_current_stock_nonneg', sql`${table.currentStock} >= 0`),
  ],
);

export const pbfInvoices = pgTable('pbf_invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceNumber: varchar('invoice_number', { length: 100 }).notNull().unique(),
  supplierId: uuid('supplier_id')
    .notNull()
    .references(() => suppliers.id, { onDelete: 'restrict' }),
  receivedByUserId: uuid('received_by_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  invoiceDate: date('invoice_date').notNull(),
  dueDate: date('due_date').notNull(),
  totalAmount: bigint('total_amount', { mode: 'number' }).notNull(),
  scanFilePath: text('scan_file_path'),
  paymentStatus: paymentStatusEnum('payment_status')
    .notNull()
    .default('UNPAID'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const pbfInvoiceItems = pgTable('pbf_invoice_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => pbfInvoices.id, { onDelete: 'cascade' }),
  medicineId: uuid('medicine_id')
    .notNull()
    .references(() => medicines.id, { onDelete: 'restrict' }),
  batchId: uuid('batch_id')
    .notNull()
    .references(() => medicineBatches.id, { onDelete: 'restrict' }),
  batchNumber: varchar('batch_number', { length: 100 }).notNull(),
  expiryDate: date('expiry_date').notNull(),
  uomUnitName: varchar('uom_unit_name', { length: 32 }).notNull(),
  qtyInUom: integer('qty_in_uom').notNull(),
  multiplierToBase: integer('multiplier_to_base').notNull(),
  receivedBaseQty: integer('received_base_qty').notNull(),
  purchasePricePerUom: integer('purchase_price_per_uom').notNull(),
  costPricePerBaseUnit: numeric('cost_price_per_base_unit', {
    precision: 14,
    scale: 4,
  }).notNull(),
  lineTotal: bigint('line_total', { mode: 'number' }).notNull(),
});

export const stockCards = pgTable(
  'stock_cards',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    medicineId: uuid('medicine_id')
      .notNull()
      .references(() => medicines.id, { onDelete: 'restrict' }),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => medicineBatches.id, { onDelete: 'restrict' }),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    movementType: stockMovementTypeEnum('movement_type').notNull(),
    referenceId: varchar('reference_id', { length: 100 }).notNull(),
    qtyChange: integer('qty_change').notNull(),
    balanceAfter: integer('balance_after').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_stock_cards_medicine_created').on(
      table.medicineId,
      table.createdAt,
    ),
    check('chk_stock_card_balance_nonneg', sql`${table.balanceAfter} >= 0`),
  ],
);

// ============================================================================
// 5. DOMAIN TABLES (US-04: POS SALES & ATOMIC FEFO ALLOCATIONS)
// ============================================================================

export const salesTransactions = pgTable('sales_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  receiptNumber: varchar('receipt_number', { length: 64 }).notNull().unique(),
  cashierId: uuid('cashier_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  pricingTier: pricingTierEnum('pricing_tier').notNull().default('REGULAR'),
  customerName: varchar('customer_name', { length: 255 }),
  paymentMethod: paymentMethodEnum('payment_method').notNull().default('CASH'),
  totalAmount: bigint('total_amount', { mode: 'number' }).notNull(),
  amountPaid: bigint('amount_paid', { mode: 'number' }).notNull(),
  changeAmount: bigint('change_amount', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const saleItems = pgTable('sale_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  saleId: uuid('sale_id')
    .notNull()
    .references(() => salesTransactions.id, { onDelete: 'cascade' }),
  medicineId: uuid('medicine_id')
    .notNull()
    .references(() => medicines.id, { onDelete: 'restrict' }),
  uomUnitName: varchar('uom_unit_name', { length: 32 }).notNull(),
  qtyInUom: integer('qty_in_uom').notNull(),
  multiplierToBase: integer('multiplier_to_base').notNull(),
  totalBaseQty: integer('total_base_qty').notNull(),
  unitSellingPrice: integer('unit_selling_price').notNull(),
  subtotal: bigint('subtotal', { mode: 'number' }).notNull(),
});

export const saleItemBatchAllocations = pgTable(
  'sale_item_batch_allocations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    saleItemId: uuid('sale_item_id')
      .notNull()
      .references(() => saleItems.id, { onDelete: 'cascade' }),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => medicineBatches.id, { onDelete: 'restrict' }),
    batchNumberSnapshot: varchar('batch_number_snapshot', {
      length: 100,
    }).notNull(),
    expiryDateSnapshot: date('expiry_date_snapshot').notNull(),
    allocatedBaseQty: integer('allocated_base_qty').notNull(),
    unitCostPriceSnapshot: numeric('unit_cost_price_snapshot', {
      precision: 14,
      scale: 4,
    }).notNull(),
  },
  (table) => [
    check(
      'chk_allocated_base_qty_positive',
      sql`${table.allocatedBaseQty} > 0`,
    ),
  ],
);

// ============================================================================
// 6. DOMAIN TABLES (US-05 & US-06: DEFEKTA & ELECTRONIC PURCHASE ORDERS / SP-EL)
// ============================================================================

export const purchaseOrders = pgTable('purchase_orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  spNumber: varchar('sp_number', { length: 64 }).notNull().unique(),
  supplierId: uuid('supplier_id')
    .notNull()
    .references(() => suppliers.id, { onDelete: 'restrict' }),
  pharmacistId: uuid('pharmacist_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  pharmacistSipaSnapshot: varchar('pharmacist_sipa_snapshot', {
    length: 100,
  }).notNull(),
  status: poStatusEnum('status').notNull().default('ISSUED'),
  emailSentAt: timestamp('email_sent_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const purchaseOrderItems = pgTable(
  'purchase_order_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    purchaseOrderId: uuid('purchase_order_id')
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: 'cascade' }),
    medicineId: uuid('medicine_id')
      .notNull()
      .references(() => medicines.id, { onDelete: 'restrict' }),
    orderedBaseQty: integer('ordered_base_qty').notNull(),
    estimatedUnitCost: numeric('estimated_unit_cost', {
      precision: 14,
      scale: 4,
    }),
  },
  (table) => [
    check('chk_ordered_base_qty_positive', sql`${table.orderedBaseQty} > 0`),
  ],
);

// ============================================================================
// 7. DRIZZLE RELATIONS
// ============================================================================

export const categoriesRelations = relations(categories, ({ many }) => ({
  medicines: many(medicines),
}));

export const medicinesRelations = relations(medicines, ({ one, many }) => ({
  category: one(categories, {
    fields: [medicines.categoryId],
    references: [categories.id],
  }),
  uomConversions: many(medicineUomConversions),
  batches: many(medicineBatches),
  stockCards: many(stockCards),
}));

export const medicineUomConversionsRelations = relations(
  medicineUomConversions,
  ({ one }) => ({
    medicine: one(medicines, {
      fields: [medicineUomConversions.medicineId],
      references: [medicines.id],
    }),
  }),
);

export const medicineBatchesRelations = relations(
  medicineBatches,
  ({ one, many }) => ({
    medicine: one(medicines, {
      fields: [medicineBatches.medicineId],
      references: [medicines.id],
    }),
    supplier: one(suppliers, {
      fields: [medicineBatches.supplierId],
      references: [suppliers.id],
    }),
    stockCards: many(stockCards),
  }),
);

export const pbfInvoicesRelations = relations(pbfInvoices, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [pbfInvoices.supplierId],
    references: [suppliers.id],
  }),
  receivedBy: one(users, {
    fields: [pbfInvoices.receivedByUserId],
    references: [users.id],
  }),
  items: many(pbfInvoiceItems),
}));

export const pbfInvoiceItemsRelations = relations(
  pbfInvoiceItems,
  ({ one }) => ({
    invoice: one(pbfInvoices, {
      fields: [pbfInvoiceItems.invoiceId],
      references: [pbfInvoices.id],
    }),
    medicine: one(medicines, {
      fields: [pbfInvoiceItems.medicineId],
      references: [medicines.id],
    }),
    batch: one(medicineBatches, {
      fields: [pbfInvoiceItems.batchId],
      references: [medicineBatches.id],
    }),
  }),
);

export const salesTransactionsRelations = relations(
  salesTransactions,
  ({ one, many }) => ({
    cashier: one(users, {
      fields: [salesTransactions.cashierId],
      references: [users.id],
    }),
    items: many(saleItems),
  }),
);

export const saleItemsRelations = relations(saleItems, ({ one, many }) => ({
  sale: one(salesTransactions, {
    fields: [saleItems.saleId],
    references: [salesTransactions.id],
  }),
  medicine: one(medicines, {
    fields: [saleItems.medicineId],
    references: [medicines.id],
  }),
  allocations: many(saleItemBatchAllocations),
}));

export const saleItemBatchAllocationsRelations = relations(
  saleItemBatchAllocations,
  ({ one }) => ({
    saleItem: one(saleItems, {
      fields: [saleItemBatchAllocations.saleItemId],
      references: [saleItems.id],
    }),
    batch: one(medicineBatches, {
      fields: [saleItemBatchAllocations.batchId],
      references: [medicineBatches.id],
    }),
  }),
);

export const purchaseOrdersRelations = relations(
  purchaseOrders,
  ({ one, many }) => ({
    supplier: one(suppliers, {
      fields: [purchaseOrders.supplierId],
      references: [suppliers.id],
    }),
    pharmacist: one(users, {
      fields: [purchaseOrders.pharmacistId],
      references: [users.id],
    }),
    items: many(purchaseOrderItems),
  }),
);

export const purchaseOrderItemsRelations = relations(
  purchaseOrderItems,
  ({ one }) => ({
    purchaseOrder: one(purchaseOrders, {
      fields: [purchaseOrderItems.purchaseOrderId],
      references: [purchaseOrders.id],
    }),
    medicine: one(medicines, {
      fields: [purchaseOrderItems.medicineId],
      references: [medicines.id],
    }),
  }),
);

// ============================================================================
// 8. INFERRED TYPESCRIPT TYPES FOR ZERO-HALLUCINATION GROUNDING
// ============================================================================

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type CategoryRow = typeof categories.$inferSelect;
export type MedicineRow = typeof medicines.$inferSelect;
export type MedicineUomRow = typeof medicineUomConversions.$inferSelect;
export type SupplierRow = typeof suppliers.$inferSelect;
export type MedicineBatchRow = typeof medicineBatches.$inferSelect;
export type PbfInvoiceRow = typeof pbfInvoices.$inferSelect;
export type PbfInvoiceItemRow = typeof pbfInvoiceItems.$inferSelect;
export type StockCardRow = typeof stockCards.$inferSelect;
export type SalesTransactionRow = typeof salesTransactions.$inferSelect;
export type SaleItemRow = typeof saleItems.$inferSelect;
export type SaleItemBatchAllocationRow =
  typeof saleItemBatchAllocations.$inferSelect;
export type PurchaseOrderRow = typeof purchaseOrders.$inferSelect;
export type PurchaseOrderItemRow = typeof purchaseOrderItems.$inferSelect;
