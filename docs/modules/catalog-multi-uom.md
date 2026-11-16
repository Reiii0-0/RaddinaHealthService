---
title: Medicine Master Catalog, Multi-UOM Hierarchy, and File Upload Validation
tags:
  - module
  - inventory
  - catalog
  - multi-uom
  - security
status: production
owner: "Backend Engineering"
layer: fullstack
coverage: "100%"
e2e_scenarios: "US-02 Scenarios 8-11"
---

# Medicine Master Catalog, Multi-UOM, and File Uploads (US-02)

This module manages the medicine catalog, multi-tier Unit of Measure (Multi-UOM) conversion hierarchies, dual pricing tiers (Regular and Partner), and file upload security using magic bytes binary inspection.

---

## 1. Multi-UOM Hierarchy Architecture

Pharmacies purchase pharmaceutical products in bulk packages (such as a **Box**) and dispense them to patients in fractional units (such as a **Strip** or single **Tablet**).

### 1.1 Base Unit Conversion Equation
Every medicine $m$ defines a single smallest unit called the **Base Unit** ($u_{\text{base}}$), where the multiplier $M(u_{\text{base}}) = 1$.
For any packaging unit $u \in U_m$, the equivalent quantity in the base unit is calculated as:

$$
Q_{\text{base}} = Q_u \times M(u)
$$

Where:
- $Q_u$: Quantity measured in unit $u$.
- $M(u)$: Integer conversion factor to the base unit (`multiplierToBase`), where $M(u) \ge 1$.
- $Q_{\text{base}}$: Resulting quantity in the base unit.

### 1.2 Example: Amoxicillin 500mg
| Unit ($u$) | Multiplier $M(u)$ | Regular Price | Partner Price | Description |
| :--- | :---: | :---: | :---: | :--- |
| **Tablet** | $1$ | Rp 1,500 | Rp 1,200 | Base unit (smallest divisible unit) |
| **Strip** | $10$ | Rp 13,500 | Rp 11,500 | 1 Strip = 10 Tablets |
| **Box** | $100$ | Rp 125,000 | Rp 110,000 | 1 Box = 10 Strips = 100 Tablets |

> [!tip] Conversion Invariance
> During distributor invoice intake or point-of-sale checkouts, all inventory balances and FEFO lot allocations are calculated and stored in **base units**. This prevents rounding errors and fractional quantities in the database.

---

## 2. Database Entities (`medicines` and `medicine_uom_conversions`)

The Drizzle ORM schema separates medicine core attributes from packaging conversions:
```typescript
// backend/src/db/schema.ts
export const medicines = pgTable('medicines', {
  id: uuid('id').defaultRandom().primaryKey(),
  sku: varchar('sku', { length: 64 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  activeIngredient: varchar('active_ingredient', { length: 255 }).notNull(),
  categoryId: uuid('category_id').references(() => categories.id).notNull(),
  classification: medicineClassificationEnum('classification').notNull(),
  dosageForm: dosageFormEnum('dosage_form').notNull(),
  baseUnit: varchar('base_unit', { length: 64 }).notNull(),
  imagePath: varchar('image_path', { length: 512 }),
  minStockAlert: integer('min_stock_alert').default(10).notNull(),
  paretoClass: paretoClassEnum('pareto_class'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

---

## 3. File Signature Validation (`FileSignatureValidationPipe`)

The system inspects initial buffer bytes (*magic bytes*) directly from memory rather than trusting client-supplied file extensions or MIME headers:

```typescript
// backend/src/common/pipes/file-signature-validation.pipe.ts
export class FileSignatureValidationPipe implements PipeTransform {
  constructor(private readonly mode: 'IMAGE_ONLY' | 'IMAGE_OR_PDF' = 'IMAGE_ONLY') {}

  async transform(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('A physical file is required.');

    const buffer = file.buffer || (await fs.promises.readFile(file.path));
    const magic = buffer.subarray(0, 12);

    const isJpeg = magic[0] === 0xff && magic[1] === 0xd8 && magic[2] === 0xff;
    const isPng = magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4e && magic[3] === 0x47;
    const isWebp =
      magic[0] === 0x52 && magic[1] === 0x49 && magic[2] === 0x46 && magic[3] === 0x46 &&
      magic[8] === 0x57 && magic[9] === 0x45 && magic[10] === 0x42 && magic[11] === 0x50;
    const isPdf =
      this.mode === 'IMAGE_OR_PDF' &&
      magic[0] === 0x25 && magic[1] === 0x50 && magic[2] === 0x44 && magic[3] === 0x46;

    if (!isJpeg && !isPng && !isWebp && !isPdf) {
      if (file.path) await fs.promises.unlink(file.path).catch(() => {});
      throw new BadRequestException('Invalid file binary signature.');
    }

    return file;
  }
}
```

### File Size Limit Enforcement (HTTP 413)
Multer Express is configured with `limits: { fileSize: 5 * 1024 * 1024 }` (5 MB). Files exceeding this threshold trigger `LIMIT_FILE_SIZE`, which `AllExceptionsFilter` maps to **HTTP 413 Payload Too Large**.

---

## 4. 3D Dosage Form Inspector

Each medicine specifies a `dosageForm` attribute (`TABLET`, `CAPSULE`, `SYRUP`). In the frontend, `Medicine3DViewer` renders procedural 3D models of the physical form using Three.js WebGL and studio lighting. See [[threejs-bio-intelligence]].

---

## 5. Related Subsystems
- Integrates with [[auth-rbac-sipa]] for role verification on catalog updates.
- Integrates with [[pbf-invoices-stockcards]] for unit conversion during invoice intake.
- Integrates with [[sales-pos-fefo]] for cashier packaging unit selection (`F4`).
- Integrates with [[pareto-defekta-spel]] for revenue tiering and reorder thresholds.
