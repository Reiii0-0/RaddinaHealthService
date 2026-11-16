# REST API Specification (v1)

This document specifies all REST API endpoints for **Raddina Health Service (RHS)**. The backend is built with NestJS 12 (`@nestjs/platform-express`), Drizzle ORM, and PostgreSQL 17. All endpoint routes, payload contracts, and response envelopes adhere to `shared/api-contracts.ts` and `backend/src/db/schema.ts`.

---

## 1. General Conventions, Authorization, and Error Envelopes

### 1.1 Authentication Header
Protected endpoints require a valid JSON Web Token (JWT) in the `Authorization` request header:
```http
Authorization: Bearer <accessToken>
```
Access tokens expire after 15 minutes. Session refresh uses `POST /api/v1/auth/refresh` with a 7-day cryptographic refresh token.

### 1.2 User Roles (`UserRole`) and License Verification (`ActiveSipaGuard`)
| Role | Access Scope |
| :--- | :--- |
| `OWNER` | Staff management, pharmacist role assignment, SIPA configuration, master catalog, supplier invoices, and financial reports. |
| `PHARMACIST` | Master catalog management, Multi-UOM conversion hierarchy, invoice intake, POS checkout, Pareto analytics, Defekta book, and electronic purchase orders (`no_sipa` present and `sipa_expiry_date > CURRENT_DATE`). |
| `CASHIER` | Medicine catalog search, active ingredient substitution, FEFO allocation preview, and point-of-sale cashier checkout. |

### 1.3 Standard Error Format
All errors return normalized JSON envelopes from `AllExceptionsFilter`:
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Invoice processing failed. Unit \"Bottle\" is not defined for medicine \"Amoxicillin 500mg\" (SKU: MED-AMX-500). Use an existing unit or add a new conversion in the master catalog.",
  "path": "/api/v1/invoices",
  "timestamp": "2026-11-05T01:20:00.000Z"
}
```

---

## 2. Endpoint Route Directory

| # | Contract Key (`API_ROUTES`) | Method & Path | Authorization Guard | Success Status |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `AUTH.REGISTER` | `POST /api/v1/auth/register` | Public (`@Public()`) | `201 Created` |
| 2 | `AUTH.LOGIN` | `POST /api/v1/auth/login` | Public (`@Public()`) | `200 OK` |
| 3 | `AUTH.REFRESH` | `POST /api/v1/auth/refresh` | Public (`@Public()`) | `200 OK` |
| 4 | `AUTH.LOGOUT` | `POST /api/v1/auth/logout` | `JwtAuthGuard` | `200 OK` |
| 5 | `AUTH.ME` | `GET /api/v1/auth/me` | `JwtAuthGuard` | `200 OK` |
| 6 | `USERS.LIST` | `GET /api/v1/users` | `JwtAuthGuard`, `RolesGuard` (`OWNER`) | `200 OK` |
| 7 | `USERS.UPDATE_ROLE_SIPA` | `PATCH /api/v1/users/:id/role` | `JwtAuthGuard`, `RolesGuard` (`OWNER`) | `200 OK` |
| 8 | `CATEGORIES.LIST` | `GET /api/v1/categories` | `JwtAuthGuard` | `200 OK` |
| 9 | `CATEGORIES.CREATE` | `POST /api/v1/categories` | `JwtAuthGuard`, `RolesGuard` (`OWNER`, `PHARMACIST`) | `201 Created` |
| 10 | `MEDICINES.LIST` | `GET /api/v1/medicines` | `JwtAuthGuard` | `200 OK` |
| 11 | `MEDICINES.DETAIL` | `GET /api/v1/medicines/:id` | `JwtAuthGuard` | `200 OK` |
| 12 | `MEDICINES.CREATE` | `POST /api/v1/medicines` | `JwtAuthGuard`, `RolesGuard` (`OWNER`, `PHARMACIST`) | `201 Created` |
| 13 | `MEDICINES.UPDATE` | `PATCH /api/v1/medicines/:id` | `JwtAuthGuard`, `RolesGuard` (`OWNER`, `PHARMACIST`) | `200 OK` |
| 14 | `MEDICINES.DELETE` | `DELETE /api/v1/medicines/:id` | `JwtAuthGuard`, `RolesGuard` (`OWNER`, `PHARMACIST`) | `200 OK` |
| 15 | `MEDICINES.UPLOAD_IMAGE` | `POST /api/v1/medicines/:id/image` | `JwtAuthGuard`, `RolesGuard` (`OWNER`, `PHARMACIST`) | `201 Created` |
| 16 | `SUPPLIERS.LIST` | `GET /api/v1/suppliers` | `JwtAuthGuard` | `200 OK` |
| 17 | `SUPPLIERS.CREATE` | `POST /api/v1/suppliers` | `JwtAuthGuard`, `RolesGuard` (`OWNER`, `PHARMACIST`) | `201 Created` |
| 18 | `SUPPLIERS.UPDATE` | `PATCH /api/v1/suppliers/:id` | `JwtAuthGuard`, `RolesGuard` (`OWNER`, `PHARMACIST`) | `200 OK` |
| 19 | `INVOICES.LIST` | `GET /api/v1/invoices` | `JwtAuthGuard` | `200 OK` |
| 20 | `INVOICES.DETAIL` | `GET /api/v1/invoices/:id` | `JwtAuthGuard` | `200 OK` |
| 21 | `INVOICES.CREATE` | `POST /api/v1/invoices` | `JwtAuthGuard`, `RolesGuard` (`OWNER`, `PHARMACIST`) | `201 Created` |
| 22 | `INVOICES.UPLOAD_SCAN` | `POST /api/v1/invoices/:id/scan` | `JwtAuthGuard`, `RolesGuard` (`OWNER`, `PHARMACIST`) | `201 Created` |
| 23 | `INVENTORY.BATCHES` | `GET /api/v1/inventory/batches` | `JwtAuthGuard` | `200 OK` |
| 24 | `INVENTORY.STOCK_CARDS` | `GET /api/v1/inventory/stock-cards` | `JwtAuthGuard` | `200 OK` |
| 25 | `SALES.PREVIEW_FEFO` | `POST /api/v1/sales/preview-fefo` | `JwtAuthGuard` | `200 OK` |
| 26 | `SALES.CHECKOUT` | `POST /api/v1/sales/checkout` | `JwtAuthGuard` | `201 Created` |
| 27 | `SALES.LIST` | `GET /api/v1/sales` | `JwtAuthGuard` | `200 OK` |
| 28 | `SALES.DETAIL` | `GET /api/v1/sales/:id` | `JwtAuthGuard` | `200 OK` |
| 29 | `ANALYTICS.PARETO` | `GET /api/v1/analytics/pareto` | `JwtAuthGuard`, `RolesGuard` (`OWNER`, `PHARMACIST`) | `200 OK` |
| 30 | `ANALYTICS.RECALCULATE_PARETO` | `POST /api/v1/analytics/pareto/recalculate` | `JwtAuthGuard`, `RolesGuard` (`OWNER`, `PHARMACIST`) | `200 OK` |
| 31 | `PROCUREMENT.DEFEKTA` | `GET /api/v1/procurement/defekta` | `JwtAuthGuard`, `RolesGuard` (`OWNER`, `PHARMACIST`) | `200 OK` |
| 32 | `PROCUREMENT.PURCHASE_ORDERS` | `GET /api/v1/procurement/purchase-orders` | `JwtAuthGuard`, `RolesGuard` (`OWNER`, `PHARMACIST`) | `200 OK` |
| 33 | `PROCUREMENT.PURCHASE_ORDERS` | `POST /api/v1/procurement/purchase-orders` | `JwtAuthGuard`, `RolesGuard` (`PHARMACIST`), `ActiveSipaGuard` | `201 Created` |
| 34 | `NOTIFICATIONS.NEAR_EXPIRY_DIGEST` | `POST /api/v1/notifications/near-expiry-digest` | `JwtAuthGuard`, `RolesGuard` (`OWNER`, `PHARMACIST`) | `200 OK` |

---

## 3. Domain Route Specifications (US-01 through US-06)

### 3.1 Authentication, Staff Roles, and SIPA Compliance (US-01)

#### `POST /api/v1/auth/register`
Registers a staff account with the enforced role of `CASHIER`. Requests providing forbidden fields such as `role`, `noSipa`, or `sipaExpiryDate` are rejected by `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` with `400 Bad Request`.
- **Request Body (`RegisterRequestDto`)**:
  ```json
  {
    "email": "cashier.new@raddina.id",
    "password": "StrongPassword123!",
    "fullName": "Nadia Putri"
  }
  ```
- **Response `201 Created` (`AuthTokenResponseDto`)**:
  ```json
  {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "e178087a-633c-4f2d-84a2-88735455f7f3",
      "email": "cashier.new@raddina.id",
      "fullName": "Nadia Putri",
      "role": "CASHIER",
      "noSipa": null,
      "sipaExpiryDate": null,
      "isSipaActive": false,
      "isActive": true,
      "createdAt": "2026-11-05T01:00:00.000Z"
    }
  }
  ```
- **Errors**: `400 Bad Request` (unwhitelisted properties or passwords under 8 characters), `409 Conflict` (email already exists).

#### `POST /api/v1/auth/login`
Authenticates user credentials and issues an `accessToken` and `refreshToken` pair.
- **Request Body (`LoginRequestDto`)**:
  ```json
  {
    "email": "pharmacist@raddina.id",
    "password": "Password123!"
  }
  ```
- **Response `200 OK`**: Returns `AuthTokenResponseDto`.
- **Errors**: `401 Unauthorized` (invalid email or password).

#### `POST /api/v1/auth/refresh`
Rotates the session by revoking the old refresh token hash in `refresh_tokens` and returning a new token pair.
- **Request Body**: `{ "refreshToken": "<token>" }`
- **Response `200 OK`**: Returns `AuthTokenResponseDto`.

#### `POST /api/v1/auth/logout`
Revokes the caller's active refresh token session.
- **Response `200 OK`**: `{ "revoked": true, "message": "Logged out successfully." }`

#### `GET /api/v1/auth/me`
Returns the authenticated profile and calculates `isSipaActive` (`role === 'PHARMACIST' && noSipa !== null && sipaExpiryDate > CURRENT_DATE`).

#### `GET /api/v1/users` and `PATCH /api/v1/users/:id/role`
Owner-only endpoints. Used to list staff and promote an account to `PHARMACIST` with a registered SIPA license number and expiration date.
- **Request Body `PATCH /api/v1/users/:id/role` (`UpdateUserRoleSipaRequestDto`)**:
  ```json
  {
    "role": "PHARMACIST",
    "noSipa": "19940817/SIPA_35.78/2025/2088",
    "sipaExpiryDate": "2028-12-31"
  }
  ```
- **Response `200 OK`**: Returns `AuthUserDto`.

---

### 3.2 Categories, Master Medicines, Multi-UOM, and Photo Uploads (US-02)

#### `GET /api/v1/categories` and `POST /api/v1/categories`
- `GET`: Returns medicine categories ordered by name ascending.
- `POST`: Creates a category (`@Roles('OWNER', 'PHARMACIST')`). Rejects duplicates with `409 Conflict`.

#### `GET /api/v1/medicines`
Returns a paginated list (`PaginatedResponse<MedicineSummaryDto>`) including packaging conversions (`uomConversions`), total active dispensable stock in base units (`totalActiveStockBaseUnit`), and earliest batch expiration date (`earliestExpiryDate`).
- **Query Parameters**:
  - `search`: Case-insensitive search on `name`, `sku`, or `activeIngredient`.
  - `activeIngredient`: Filter by active ingredient for generic substitution.
  - `categoryId`: Filter by category UUID.
  - `classification`: Filter by regulatory tier (`BEBAS`, `BEBAS_TERBATAS`, `KERAS`, etc.).
  - `paretoClass`: Filter by Pareto class (`A`, `B`, `C`).
  - `page` (default `1`) and `limit` (default `20`, maximum `100`).

#### `GET /api/v1/medicines/:id`
Returns full medicine details including UOM conversions and active batches sorted by FEFO. Returns `404 Not Found` if the ID does not exist.

#### `POST /api/v1/medicines` and `PATCH /api/v1/medicines/:id`
Creates or updates a medicine record and packaging hierarchy in an atomic `db.transaction`. Requires at least one packaging unit with `multiplierToBase === 1`.
- **Request Body `POST /api/v1/medicines` (`CreateMedicineRequestDto`)**:
  ```json
  {
    "sku": "MED-AMX-500",
    "name": "Amoxicillin Trihydrate 500 mg",
    "categoryId": "11111111-1111-1111-1111-111111111111",
    "activeIngredient": "Amoxicillin Trihydrate 500 mg",
    "baseUnit": "Tablet",
    "classification": "KERAS",
    "dosageForm": "TABLET",
    "minStockBaseUnit": 100,
    "uomConversions": [
      {
        "unitName": "Tablet",
        "multiplierToBase": 1,
        "sellingPriceRegular": 1200,
        "sellingPricePartner": 1000,
        "barcode": "8991002003011"
      },
      {
        "unitName": "Strip",
        "multiplierToBase": 10,
        "sellingPriceRegular": 11500,
        "sellingPricePartner": 9500,
        "barcode": "8991002003012"
      }
    ]
  }
  ```

#### `DELETE /api/v1/medicines/:id`
Permanently deletes a medicine (`mode: "HARD_DELETE"`) if no batches or transactions reference it, or deactivates the record (`isActive = false`, `mode: "SOFT_DEACTIVATE"`) if historical records exist.

#### `POST /api/v1/medicines/:id/image`
Uploads a packaging photograph (`multipart/form-data`, form field `file`).
- Files larger than 5 MB return **`413 Payload Too Large`**.
- Files lacking JPEG, PNG, or WebP magic bytes return **`400 Bad Request`**.
- Valid files are saved to `/uploads/medicines/<uuid>.<ext>` and return **`201 Created`**.

---

### 3.3 Suppliers, Invoices, Batches, and Stock Cards (US-03)

#### `GET /api/v1/suppliers`, `POST /api/v1/suppliers`, and `PATCH /api/v1/suppliers/:id`
Manages authorized pharmaceutical distributors including company name, tax/license code, procurement email, phone, and distribution address.

#### `GET /api/v1/invoices` and `GET /api/v1/invoices/:id`
Retrieves distributor intake invoices with nested item rows.

#### `POST /api/v1/invoices`
Records received shipments inside a database transaction:
1. Validates `uomUnitName` against configured conversions for each medicine.
2. Calculates `receivedBaseQty = qtyInUom * multiplierToBase` and base unit cost `costPricePerBaseUnit = (purchasePricePerUom / multiplierToBase).toFixed(4)`.
3. Creates or updates rows in `medicine_batches` for matching `(medicineId, batchNumber, supplierId)`.
4. Writes records to `pbf_invoices` and `pbf_invoice_items`.
5. Appends immutable audit records to `stock_cards` with `movementType: 'IN_INVOICE'`.

#### `POST /api/v1/invoices/:id/scan`
Uploads a physical invoice scan (`multipart/form-data`, form field `file`). Accepts PDF, JPEG, PNG, or WebP up to 5 MB with binary signature validation.

#### `GET /api/v1/inventory/batches`
Returns active batches sorted by FEFO (`expiryDate ASC, createdAt ASC`) with `daysUntilExpiry` and `expiryStatus` (`ACTIVE`, `NEAR_EXPIRY`, `EXPIRED`).

#### `GET /api/v1/inventory/stock-cards`
Returns paginated stock card records (`PaginatedResponse<StockCardEntryDto>`) sorted newest first (`createdAt DESC`). Supports filtering by `medicineId`, `batchId`, and `movementType`.

---

### 3.4 POS Cashier Station and FEFO Allocation (US-04)

#### `POST /api/v1/sales/preview-fefo`
Calculates an in-memory FEFO simulation for a cart without writing to the database. Returns batch allocation breakdowns, shortage quantities, and generic substitutes sharing the same active ingredient when stock is insufficient.

#### `POST /api/v1/sales/checkout`
Executes point-of-sale checkout within a database transaction holding row locks (`SELECT ... FOR UPDATE`):
1. Filters unexpired batches (`current_stock > 0 AND expiry_date > CURRENT_DATE`).
2. Sorts batches by `expiry_date ASC, created_at ASC`.
3. If active stock is insufficient, rolls back and returns **`422 Unprocessable Entity`** with generic alternatives.
4. Enforces official prices from `medicine_uom_conversions` according to `pricingTier`.
5. Deducts batch balances, stores allocation records in `sale_item_batch_allocations`, and appends `OUT_SALE` records to `stock_cards`.

#### `GET /api/v1/sales` and `GET /api/v1/sales/:id`
Retrieves past sales transactions, item breakdowns, and allocated batch details.

---

### 3.5 Pareto ABC Analytics, Defekta, and Electronic Purchase Orders (US-05 and US-06)

#### `GET /api/v1/analytics/pareto` and `POST /api/v1/analytics/pareto/recalculate`
Calculates gross revenue contributions over a selectable window (default 90 days) and assigns Pareto tiers using cumulative revenue prior to item $k$ ($C_{k-1}$):
- Class `A`: $R_{(k)} > 0 \land C_{k-1} < 0.80$
- Class `B`: $R_{(k)} > 0 \land 0.80 \le C_{k-1} < 0.95$
- Class `C`: $C_{k-1} \ge 0.95 \lor R_{(k)} = 0$

`POST /api/v1/analytics/pareto/recalculate` persists updated tiers to `medicines.pareto_class`.

#### `GET /api/v1/procurement/defekta`
Returns medicines requiring reordering using:
- Average daily consumption: $\bar{d}_m = Q_{m, 30} / 30$
- Reorder point: $\text{ROP}_m = \max(M_m, \lceil 7 \times \bar{d}_m \rceil)$
- Qualification condition: $\text{ROP}_m > 0 \land S_m^{\text{active}} \le \text{ROP}_m$
- Recommended quantity: $Q_m^{\text{order}} = \max(1, \max(2 \times M_m, \lceil 14 \times \bar{d}_m \rceil) - S_m^{\text{active}})$
- Includes the distributor offering the lowest unit cost over the last 90 days.

#### `GET /api/v1/procurement/purchase-orders` and `POST /api/v1/procurement/purchase-orders`
- `GET`: Lists issued purchase orders.
- `POST`: Protected by `JwtAuthGuard`, `RolesGuard('PHARMACIST')`, and `ActiveSipaGuard`. If the pharmacist holds an expired license or no SIPA number, the request is rejected with **`403 Forbidden`**. If active, creates the order and sends a formatted HTML email to the distributor via SMTP.

#### `POST /api/v1/notifications/near-expiry-digest`
Scans for batches with remaining shelf life under 90 days and dispatches a summary digest to pharmacy management.
