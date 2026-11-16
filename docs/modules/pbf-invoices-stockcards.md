---
title: Supplier Invoice Intake and Append-Only Stock Cards
tags:
  - module
  - inventory
  - invoices
  - stock-cards
  - audit-trail
status: production
owner: "Backend Engineering"
layer: fullstack
coverage: "100%"
e2e_scenarios: "US-03 Scenario 12"
---

# Supplier Invoices and Append-Only Stock Cards (US-03)

This module handles receiving medicine supplies from authorized pharmaceutical distributors (PBF), recording invoice identifiers and payment due dates, calculating Cost of Goods Sold (HPP) per base unit, updating active batches, and writing an append-only audit trail to stock cards.

---

## 1. Supplier Invoice Processing Flow

When the pharmacy receives a medicine shipment:
1. The pharmacist (`PHARMACIST`) or owner (`OWNER`) inputs the distributor invoice number, invoice date, payment due date, and line items.
2. Each item row specifies:
   - Packaging unit name ($u$).
   - Received quantity in that unit ($Q_u$).
   - Purchase price per unit ($P_u$).
   - Manufacturer batch number.
   - Batch expiration date.

### 1.1 Base Unit Cost Calculation
The engine automatically calculates the base unit quantity and base unit cost:

$$
Q_{\text{base}} = Q_u \times M(u)
$$

$$
\text{costPricePerBaseUnit} = \frac{P_u}{M(u)}
$$

$$
\text{lineTotal} = Q_u \times P_u
$$

Where:
- $M(u)$: Multiplier for packaging unit $u$ against the base unit (from `medicine_uom_conversions`).
- $\text{costPricePerBaseUnit}$: Stored as `numeric(14, 4)` to preserve 4-decimal financial precision.

---

## 2. Batch Inventory Model (`medicine_batches`)

Each unique combination of `(medicineId, batchNumber, supplierId)` is tracked in `medicine_batches`:
- `initialStock`: Total base units originally received for this lot.
- `currentStock`: Remaining physical base units available for sale.
- `expiryDate`: Expiration date determining FEFO allocation precedence.
- `costPricePerBaseUnit`: Base unit cost recorded at reception.

> [!note] Batch Idempotence
> If the same batch number from the same supplier is received on a subsequent invoice, the system increments `initialStock` and `currentStock` by $Q_{\text{base}}$ and updates the unit cost in a single atomic transaction.

---

## 3. Append-Only Stock Card Ledger (`stock_cards`)

In compliance with Good Distribution Practice (GDP) standards, stock cards are immutable: no `UPDATE` or `DELETE` operations are permitted. Every movement writes a permanent row:

```typescript
// backend/src/db/schema.ts
export const stockMovementTypeEnum = pgEnum('stock_movement_type', [
  'IN_INVOICE',          // Stock received from supplier invoice
  'OUT_SALE',            // Stock dispensed via POS cashier checkout
  'ADJUSTMENT_IN',       // Positive inventory reconciliation
  'ADJUSTMENT_OUT',      // Negative inventory reconciliation
  'EXPIRED_DISPOSAL',    // Expired stock disposal
]);

export const stockCards = pgTable('stock_cards', {
  id: uuid('id').defaultRandom().primaryKey(),
  medicineId: uuid('medicine_id').references(() => medicines.id).notNull(),
  batchId: uuid('batch_id').references(() => medicine_batches.id).notNull(),
  movementType: stockMovementTypeEnum('movement_type').notNull(),
  referenceId: varchar('reference_id', { length: 128 }).notNull(),
  qtyChange: integer('qty_change').notNull(),
  balanceAfter: integer('balance_after').notNull(),
  notes: text('notes'),
  actorUserId: uuid('actor_user_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### Integrity Guarantees
1. **Full Transactionality**: Invoice persistence, batch updates, and stock card insertions run inside an atomic `db.transaction`.
2. **Actor Traceability**: The `actorUserId` column records the specific user who authorized the movement.
3. **Point-in-Time Balances**: The `balanceAfter` column records the resulting batch balance at the exact millisecond of the mutation, providing an immediate chronological audit trail without scanning historical aggregates.

---

## 4. Physical Invoice Scan Uploads
Pharmacies must retain physical proof of supplier invoices for regulatory audits. Endpoint `POST /api/v1/invoices/:id/scan` accepts PDF, JPEG, and PNG files up to 5 MB, validated using `FileSignatureValidationPipe('IMAGE_OR_PDF')`.

---

## 5. Related Subsystems
- Integrates with [[catalog-multi-uom]] for packaging unit multipliers.
- Supplies inventory balances for [[sales-pos-fefo]] cashier deductions.
- Supplies historical unit costs for supplier recommendations in [[pareto-defekta-spel]].
