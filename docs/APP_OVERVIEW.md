# Raddina Health Service (RHS): System Architecture and Technical Reference

Raddina Health Service (RHS) is a fullstack pharmacy management platform. It combines a high-speed point-of-sale station with atomic **First-Expired, First-Out (FEFO)** batch allocation, active pharmacist practice license (SIPA) enforcement, **Pareto ABC (80/20)** sales analytics, automated **Defekta** reordering, and physical 3D dosage inspection.

---

## 1. Product Overview and Strategic Scope

Community pharmacies face distinct operational constraints: strict regulatory standards under national health authorities, financial losses from expired inventory, and cashier throughput bottlenecks during peak customer hours.

Raddina Health Service addresses these challenges through three architectural pillars:
1. **Deterministic FEFO Inventory Allocation**: Automatic stock deductions prioritized by nearest expiration date under database row locks, preventing expired medicine from reaching patients.
2. **Regulatory License Verification (SIPA Guard)**: Electronic Purchase Orders (SP-el) dispatched to pharmaceutical distributors require an active pharmacist license number. Expired licenses automatically freeze ordering privileges.
3. **Zero-Latency Keyboard Ergonomics**: Full point-of-sale operation using keyboard shortcuts (`F1`, `F2`, `F4`, `F8`), sub-millisecond audio feedback, and procedural 3D WebGL dosage form rendering.

---

## 2. Monorepo Architecture and Stack

The repository uses a pnpm monorepo structure separating concerns into distinct services:

```
RaddinaHealthService/
├── backend/                  # NestJS 12 + Express REST API
│   ├── src/
│   │   ├── common/           # Decorators, Guards (JWT, Roles, SIPA), Pipes, Filters
│   │   ├── db/               # Drizzle ORM schema, PostgreSQL connection, Seed scripts
│   │   └── modules/          # Auth, Users, Categories, Medicines, Suppliers, Invoices,
│   │                         # Inventory, Sales (FEFO), Analytics (Pareto), Procurement, Mail
│   └── test/                 # Supertest E2E integration test suite (40 scenarios)
├── frontend/                 # React 19 + Vite 6 Single Page Application
│   ├── src/
│   │   ├── components/       # UI modules (POS command, Cart table, 3D viewers, Modals)
│   │   ├── lib/              # Typed API client, Web Audio feedback synthesizer, Formatters
│   │   ├── pages/            # Page controllers (Login, Register, POS, Catalog, Invoices, etc.)
│   │   └── stores/           # Zustand stores for client auth and 0ms cart operations
│   └── index.html
├── shared/                   # Shared TypeScript contracts, routes, and DTO types
│   └── api-contracts.ts
└── docs/                     # Technical specifications and documentation
```

### Technology Matrix
- **Backend API**: NestJS 12 on Express (`@nestjs/platform-express`). Express is selected for native Multer file-handling compatibility, returning `413 Payload Too Large` on oversized files and `400 Bad Request` on invalid binary signatures.
- **Database**: PostgreSQL 17 managed via Docker Compose, accessed using Drizzle ORM (`drizzle-orm/node-postgres`). Supports ACID transactions with row-level locking (`SELECT ... FOR UPDATE`) and database check constraints.
- **Frontend SPA**: React 19, Vite 6, Tailwind CSS v4, TanStack Query v5, and Zustand.
- **Graphics**: Three.js WebGL with physically based materials (PBR) and memory cleanup on component dismount.
- **Email Service**: Nodemailer over SMTP with local Mailpit integration (`:1025` SMTP, `:8025` web UI).

---

## 3. Relational Database Schema (PostgreSQL 17)

The database schema defines 12 relational tables with foreign keys and check constraints:

1. **`users`**: User identity, roles (`OWNER`, `PHARMACIST`, `CASHIER`), SIPA license numbers, and license expiry dates.
2. **`refresh_tokens`**: Hashed session refresh tokens with cryptographic rotation.
3. **`categories`**: Medicine therapeutic categories.
4. **`medicines`**: Master medicine entity including SKU, name, active ingredient, regulatory classification, dosage form, and base unit.
5. **`medicine_uom_conversions`**: Packaging unit conversions with integer multipliers to the base unit, regular selling prices, and partner selling prices.
6. **`suppliers`**: Authorized pharmaceutical distributors with official license codes and procurement email addresses.
7. **`pbf_invoices`**: Distributor intake invoices recording delivery dates, payment due dates, and scan file paths.
8. **`pbf_invoice_items`**: Line items per invoice recording packaging units, quantities, purchase prices, and computed base unit costs.
9. **`medicine_batches`**: Physical lots tracking batch numbers, expiration dates, initial received stock, current available stock, and base unit costs.
10. **`stock_cards`**: Immutable, append-only inventory mutation ledger recording actor user IDs, reference numbers, quantity changes, and point-in-time balances.
11. **`sales_transactions`**, **`sale_items`**, and **`sale_item_batch_allocations`**: Point-of-sale transactions and item allocations detailing which physical lots fulfilled each sale line.
12. **`purchase_orders`** and **`purchase_order_items`**: Electronic Purchase Orders (SP-el) freezing the authorizing pharmacist's license snapshot.

---

## 4. Six Core Workflows (US-01 through US-06)

### US-01: Authentication, RBAC, and Pharmacist SIPA Compliance
- Public registration (`POST /api/v1/auth/register`) strictly sets new users to `CASHIER`.
- Attempts to pass `role`, `noSipa`, or `sipaExpiryDate` in the registration payload are rejected with `400 Bad Request`.
- Only users with the `OWNER` role can promote an account to `PHARMACIST` and configure license credentials via `PATCH /api/v1/users/:id/role`.
- Passwords use Argon2id hashing. Access tokens expire after 15 minutes; refresh tokens use cryptographic hash rotation with a 7-day lifetime.

### US-02: Master Medicine Catalog and Multi-UOM Hierarchy
- Each medicine specifies a base unit (`Tablet`, `Capsule`, `Bottle`) and conversions (`Box`, `Strip`, `Tablet`) with integer multipliers $\ge 1$.
- Dual pricing supports retail clients (`selling_price_regular`) and partner health facilities (`selling_price_partner`).
- Pharmacists can upload packaging photos up to 5 MB, validated using binary magic byte inspection for JPEG, PNG, and WebP formats.
- The command palette allows searching by active ingredient (`active_ingredient`) to identify bioequivalent alternatives when a specific brand is out of stock.

### US-03: Supplier Invoice Intake and Stock Card Ledger
- Invoices intake medicine shipments into explicit batch records with expiration dates.
- Base unit costs are calculated inside the database transaction:
  $$\text{costPricePerBaseUnit} = \frac{\text{purchasePricePerUom}}{\text{multiplierToBase}}$$
- Every stock movement writes an immutable audit record to `stock_cards` with the mutation type (`IN_INVOICE`, `OUT_SALE`, `ADJUSTMENT`), quantity change, and resulting balance.
- Physical invoice scan uploads accept PDF and image formats up to 5 MB with file signature validation.

### US-04: High-Throughput POS Station and Atomic FEFO Dispensing
- The checkout engine filters active, unexpired batches (`current_stock > 0 AND expiry_date > CURRENT_DATE`) sorted by `expiry_date ASC, created_at ASC`.
- Batch rows are locked using `SELECT ... FOR UPDATE` during allocation to prevent race conditions during concurrent checkouts.
- When active stock is insufficient, the transaction rolls back and returns `422 Unprocessable Entity` with a list of generic substitutes sharing the same active ingredient.
- Point-of-sale operations provide keyboard navigation (`F1` search, `F2` price tier toggle, `F4` unit cycle, `F8` checkout) with zero-millisecond interface latency.
- Receipt printing formats an 80mm ESC/POS thermal layout with official pharmacy headers, per-line batch traceability, tax exemption notices, and print media isolation.

### US-05: Pareto ABC (80/20) Analytics and Automated Defekta
- Pareto classification ranks medicines by gross revenue over a selectable window (default 90 days). It uses cumulative revenue share before item $k$ ($C_{k-1}$):
  - **Class A**: $R_{(k)} > 0 \land C_{k-1} < 0.80$ (Top 80% of sales volume)
  - **Class B**: $R_{(k)} > 0 \land 0.80 \le C_{k-1} < 0.95$ (Next 15% of sales volume)
  - **Class C**: $C_{k-1} \ge 0.95 \lor R_{(k)} = 0$ (Remaining 5% or zero sales)
- The Defekta reorder book calculates average daily consumption ($\bar{d}_m$) over 30 days and determines the Reorder Point ($\text{ROP}_m$):
  $$\text{ROP}_m = \max(M_m, \lceil 7 \times \bar{d}_m \rceil)$$
- Medicines enter the Defekta list when $\text{ROP}_m > 0$ and active stock $S_m^{\text{active}} \le \text{ROP}_m$. The system recommends order quantities for 14 days of demand and identifies the supplier offering the lowest cost over the last 90 days.

### US-06: SIPA-Protected Electronic Purchase Orders (SP-el)
- Pharmacists can convert Defekta items into an Electronic Purchase Order (SP-el) with one click.
- `ActiveSipaGuard` validates that the requesting user holds the `PHARMACIST` role, possesses a registered `no_sipa`, and has an unexpired license (`sipa_expiry_date > CURRENT_DATE`). Expired licenses return `403 Forbidden`.
- Approved purchase orders store a snapshot of the pharmacist license and dispatch a formatted HTML order document to the distributor email address via SMTP.

---

## 5. Mathematical Specifications

### 5.1 Multi-UOM Unit Conversion
For any medicine $m$ and packaging unit $u$, the base unit quantity is:
$$Q_{\text{base}} = Q_u \times M(u)$$
Where $M(u) \in \mathbb{Z}^+$ is the multiplier configured in `medicine_uom_conversions`.

### 5.2 FEFO Batch Allocation
For a requested base quantity $Q_{\text{req}}$, let active batches be ordered such that:
$$\text{expiryDate}_{b_1} \le \text{expiryDate}_{b_2} \le \dots \le \text{expiryDate}_{b_k}$$
For each batch $i$ while remaining required quantity $r_{i-1} > 0$ (with $r_0 = Q_{\text{req}}$):
$$a_i = \min(r_{i-1}, s_i), \quad r_i = r_{i-1} - a_i, \quad s_i^{\text{new}} = s_i - a_i$$
Where $s_i$ is `current_stock` for batch $b_i$. Each step updates the batch stock, creates a sale item allocation row, and appends an `OUT_SALE` audit entry to `stock_cards`.

### 5.3 Pareto ABC (80/20) Revenue Classification
Given $M$ medicines ranked in descending order of gross revenue $R_{(1)} \ge R_{(2)} \ge \dots \ge R_{(M)}$ and total revenue $R_{\text{total}} = \sum_{m=1}^M R_m$:
$$p_k = \frac{R_{(k)}}{R_{\text{total}}}, \quad C_{k-1} = \sum_{j=1}^{k-1} p_j \quad (C_0 = 0)$$
$$\text{Class}(k) = \begin{cases} 
\text{'A'}, & \text{if } R_{(k)} > 0 \land C_{k-1} < 0.80 \\
\text{'B'}, & \text{if } R_{(k)} > 0 \land 0.80 \le C_{k-1} < 0.95 \\
\text{'C'}, & \text{if } C_{k-1} \ge 0.95 \lor R_{(k)} = 0 
\end{cases}$$

### 5.4 Defekta Reorder Point (ROP)
Average daily consumption over 30 days:
$$\bar{d}_m = \frac{\sum_{t=1}^{30} D_{m, t}}{30}$$
Reorder Point with a 7-day supplier lead time:
$$\text{ROP}_m = \max\left( M_m, \lceil 7 \times \bar{d}_m \rceil \right)$$
Defekta eligibility:
$$\text{EnterDefekta}_m \iff \left( \text{ROP}_m > 0 \land S_m^{\text{active}} \le \text{ROP}_m \right)$$
Recommended order quantity for 14 days of coverage:
$$Q_m^{\text{order}} = \max\left( 1, \max(2 \times M_m, \lceil 14 \times \bar{d}_m \rceil) - S_m^{\text{active}} \right)$$

---

## 6. Design System and Interface Standards

The user interface follows clean operational standards for health software:
- **Calibrated Color Palette**: Mint (`#B6D8C0`), Sage (`#C8D9BF`), Sand (`#DADABD`), Cream (`#ECDBBC`), and Peach (`#FEDCBA`).
- **High-Contrast Typography**: Plus Jakarta Sans for body prose and JetBrains Mono with `.tabular-nums` for currency, stock counts, batch numbers, and dates.
- **Freshness Band Scale**: Visual indicator displaying remaining shelf life across inventory and point-of-sale carts.
- **Strict Layout Rules**: Zero kickers or eyebrows, zero nested card containers, zero fake metric blocks, zero em dashes, and solid semantic text colors.

---

## 7. Quality Assurance and Automated Testing

| Verification Target | Test Method | Criteria | Result |
| :--- | :--- | :--- | :--- |
| **Backend TypeScript** | `pnpm --filter backend exec tsc --noEmit` | 0 errors | Passed |
| **Frontend TypeScript** | `pnpm --filter frontend exec tsc --noEmit` | 0 errors | Passed |
| **Production Build** | `pnpm build` | Clean bundle output | Passed |
| **E2E Integration Suite** | `pnpm --filter backend test:e2e` | 40/40 scenarios passing (100%) | Passed |
| **Code Coverage** | `pnpm --filter backend test:cov` | Statements $\ge 80\%$, Lines $\ge 80\%$ | Passed (87.12%) |

### E2E Test Suite Scope (40 Scenarios)
- **US-01 (Auth & SIPA)**: Public registration locked to `CASHIER`, rejection of role injection (`400`), successful login (`200`), invalid credentials (`401`), token rotation, cashier RBAC rejection (`403`), and owner SIPA promotion (`200`).
- **US-02 (Catalog & Uploads)**: Multi-UOM creation (`201`), valid JPEG upload (`201`), fake MIME extension rejection (`400`), and file size $> 5\text{ MB}$ rejection (`413`).
- **US-03 (Invoices & Stock Cards)**: Multi-item invoice intake, base quantity conversion, unit cost calculation, batch creation, and `IN_INVOICE` stock card append.
- **US-04 (POS & FEFO)**: FEFO preview ordered by expiration date, atomic batch deduction under row locks, `OUT_SALE` audit entry, and insufficient stock rejection (`422`) with generic substitute recommendations.
- **US-05 (Pareto & Defekta)**: Exact 80/20 Pareto revenue classification and Defekta book filtering with lowest-cost supplier identification.
- **US-06 (SP-el & Email)**: Expired SIPA license rejection (`403`), active pharmacist purchase order creation (`201`), Nodemailer SMTP dispatch, and near-expiry digest notification.
- **Concurrency & Edge Cases**: Parallel cashier checkouts preventing inventory overselling, duplicate email rejections, duplicate SKU rejections, and `404 Not Found` handling.

---

## 8. Installation and Local Setup

### 8.1 System Prerequisites
- **Node.js**: Version 22 or higher (LTS recommended)
- **pnpm**: Version 10 or higher
- **Docker & Docker Compose**: For PostgreSQL 17 and Mailpit

### 8.2 Setup Commands

```bash
# 1. Start PostgreSQL 17 and Mailpit SMTP containers
docker compose up -d

# 2. Install workspace dependencies
pnpm install

# 3. Apply Drizzle database schema and seed initial data
pnpm db:push
pnpm db:seed

# 4. Start backend (port 3000) and frontend (port 5173) in development mode
pnpm dev
```

The web application is accessible at `http://localhost:5173`, and the Mailpit web inspector is accessible at `http://localhost:8025`.

### 8.3 Demo Accounts (`pnpm db:seed`)

| Role | Email | Password | License Status |
| :--- | :--- | :--- | :--- |
| **Owner (`OWNER`)** | `owner@raddina.id` | `RaddinaOwner123!` | Not required |
| **Active Pharmacist (`PHARMACIST`)** | `apt.rina@raddina.id` | `RaddinaApt123!` | Active (expires 2028-12-31) |
| **Expired Pharmacist (`PHARMACIST`)** | `apt.expired@raddina.id` | `RaddinaExp123!` | Expired (ended 2024-01-01) |
| **POS Cashier (`CASHIER`)** | `kasir.budi@raddina.id` | `RaddinaKasir123!` | Not required |

### 8.4 Automated Test Commands

```bash
# Run backend E2E integration test suite
pnpm --filter backend test:e2e

# Run E2E tests with coverage report
pnpm --filter backend test:cov
```
