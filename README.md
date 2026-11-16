# Raddina Health Service (RHS)

> High-throughput pharmacy management, atomic FEFO dispensing, and regulatory compliance system.

Raddina Health Service (RHS) is a fullstack web application for retail and clinical pharmacies. It provides atomic **First-Expired, First-Out (FEFO)** inventory allocation, multi-level unit of measure (Multi-UOM) conversions, active ingredient substitution, **Pareto ABC (80/20)** sales analytics, automated **Defekta** reordering, and legal **Electronic Purchase Orders (SP-el)** verified against active pharmacist licenses (SIPA).

---

## Architecture and Technology Stack

| Layer | Technology | Key Engineering Decisions |
| :--- | :--- | :--- |
| **Backend** | **NestJS 12 + Express (`@nestjs/platform-express`)** | Modular architecture with inversion of control, dependency injection, and layered guards (`JwtAuthGuard`, `RolesGuard`, `ActiveSipaGuard`). Uses Multer with strict byte-signature inspection (`400 Bad Request` on invalid signatures, `413 Payload Too Large` on files over 5 MB). |
| **Database & ORM** | **PostgreSQL 17 + Drizzle ORM** | ACID transactions with `SELECT ... FOR UPDATE` row locks to prevent race conditions during concurrent checkouts. Enforces database constraints including `CHECK (current_stock >= 0)`. |
| **Monetary Precision** | **`bigint` / `integer` & `numeric(14, 4)`** | Whole Rupiah amounts use integers to prevent floating-point rounding errors. Base unit costs (HPP) use `numeric(14, 4)` for fractional precision when large packs convert to tablets. |
| **Frontend** | **React 19 + Vite 6 + Tailwind CSS v4** | High-density operational interface. Uses TanStack Query for server state, Zustand for instant cart state, Lucide icons, and Sonner toasts. Enforces `tabular-nums` on numbers and zero-latency keyboard shortcuts. |
| **3D Inspection** | **Three.js (WebGL)** | Procedural physical material rendering for pharmaceutical forms (scored tablets, bi-color capsules, amber bottles) and an interactive Asclepius model. |
| **Email Service** | **Nodemailer + Mailpit** | Automated HTML dispatch for electronic purchase orders and near-expiry stock digests via local SMTP (`localhost:1025`, web inspector on `:8025`). |

---

## Core Workflows

### 1. Authentication, RBAC, and Pharmacist SIPA Verification (US-01)
- Public user registration (`POST /api/v1/auth/register`) enforces the `CASHIER` role. Requests containing unauthorized role or license fields return `400 Bad Request`.
- Role elevation to `PHARMACIST` requires explicit configuration by an `OWNER` through `PATCH /api/v1/users/:id/role`, including a valid license number (`no_sipa`) and expiration date (`sipa_expiry_date`).
- Access tokens expire in 15 minutes; refresh tokens use cryptographic hash rotation with a 7-day lifetime.

### 2. Medicine Catalog, Active Ingredient Search, and Multi-UOM (US-02)
- Medicines maintain a base unit (`Tablet`, `Capsule`, `Bottle`) and dynamic packaging conversions (`Box`, `Strip`, `Tablet`) with integer multipliers.
- Dual pricing supports both retail customers (`selling_price_regular`) and healthcare partners (`selling_price_partner`).
- Cashiers can search by active ingredient (`active_ingredient`) to identify generic alternatives when a requested brand is depleted.
- Packaging photos support JPEG, PNG, and WebP uploads up to 5 MB.

### 3. Supplier Invoice Intake and Append-Only Stock Cards (US-03)
- Invoices from pharmaceutical distributors (PBF) intake items into specific batches with expiration dates and lot numbers.
- Base unit costs are calculated automatically in the database transaction:
  $$\text{costPricePerBaseUnit} = \frac{\text{purchasePricePerUom}}{\text{multiplierToBase}}$$
- Every stock movement writes an immutable audit record to `stock_cards` (`IN_INVOICE`, `OUT_SALE`, `ADJUSTMENT`) with the actor ID, reference ID, and resulting balance.
- Physical invoice scan uploads accept PDF and image formats with file signature validation.

### 4. POS Cashier Station and Atomic FEFO Dispensing (US-04)
- When a cashier processes items, the engine queries active, unexpired batches (`current_stock > 0 AND expiry_date > CURRENT_DATE`) sorted by `expiry_date ASC, created_at ASC`.
- The database transaction locks candidate batch rows with `SELECT ... FOR UPDATE`. If stock spans multiple lots, the engine allocates quantities across batches sequentially.
- If total unexpired stock is insufficient, the transaction rolls back and returns `422 Unprocessable Entity` with a list of generic substitutes sharing the same active ingredient.
- Point-of-sale operations provide keyboard shortcuts (`F1` search, `F2` price tier toggle, `F4` UOM cycle, `F8` checkout) with zero-millisecond interface latency.
- Receipt printing formats an 80mm ESC/POS thermal layout with official pharmacy headers, per-line batch traceability, tax exemption notices, and print media isolation.

### 5. Pareto ABC (80/20) Analytics and Automated Defekta (US-05)
- Pareto classification ranks medicines by gross revenue over a selectable window (default 90 days). It uses cumulative revenue share before item $k$ ($C_{k-1}$):
  - **Class A**: $R_{(k)} > 0 \land C_{k-1} < 0.80$ (Top 80% of sales volume)
  - **Class B**: $R_{(k)} > 0 \land 0.80 \le C_{k-1} < 0.95$ (Next 15% of sales volume)
  - **Class C**: $C_{k-1} \ge 0.95 \lor R_{(k)} = 0$ (Remaining 5% or zero sales)
- The Defekta reorder book calculates average daily consumption ($\bar{d}_m$) over 30 days and determines the Reorder Point ($\text{ROP}_m$):
  $$\text{ROP}_m = \max(M_m, \lceil 7 \times \bar{d}_m \rceil)$$
- Medicines appear in the Defekta list when $\text{ROP}_m > 0$ and active stock $S_m^{\text{active}} \le \text{ROP}_m$. The system recommends order quantities for 14 days of demand and identifies the supplier offering the lowest cost over the last 90 days.

### 6. SIPA-Protected Electronic Purchase Orders (US-06)
- Pharmacists can convert Defekta items into an Electronic Purchase Order (SP-el) with one click.
- `ActiveSipaGuard` validates that the requesting user holds the `PHARMACIST` role, possesses a registered `no_sipa`, and has an unexpired license (`sipa_expiry_date > CURRENT_DATE`). Expired licenses return `403 Forbidden`.
- Approved purchase orders store a snapshot of the pharmacist license and dispatch a formatted HTML order document to the distributor email address via SMTP.

---

## Quick Start Guide

### Prerequisites
- **Node.js** version 22 or higher
- **pnpm** version 10 or higher
- **Docker** and **Docker Compose**

### Installation and Setup

1. **Start PostgreSQL 17 and Mailpit services:**
   ```bash
   docker compose up -d
   ```
   Verify that PostgreSQL (`localhost:5432`) and Mailpit (`localhost:1025` SMTP, `localhost:8025` Web UI) are running.

2. **Install project dependencies:**
   ```bash
   pnpm install
   ```

3. **Apply database schema and seed initial data:**
   ```bash
   pnpm db:push
   pnpm db:seed
   ```

4. **Start the development servers:**
   ```bash
   pnpm dev
   ```
   The backend API starts on `http://localhost:3000` and the frontend application starts on `http://localhost:5173`.

---

## Pre-Configured Demo Accounts

The database seed command (`pnpm db:seed`) creates four testing accounts:

| Role | Email | Password | License Status | Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Pharmacy Owner (`OWNER`)** | `owner@raddina.id` | `RaddinaOwner123!` | Not required | Full administrative access, staff role governance, SIPA license assignment, financial analytics. |
| **Active Pharmacist (`PHARMACIST`)** | `apt.rina@raddina.id` | `RaddinaApt123!` | Active (expires 2028-12-31) | Catalog management, invoice receiving, POS cashier, Pareto analytics, Defekta, and SP-el order creation. |
| **Expired Pharmacist (`PHARMACIST`)** | `apt.expired@raddina.id` | `RaddinaExp123!` | Expired (ended 2024-01-01) | Read-only access to procurement; rejected with `403 Forbidden` on SP-el creation. |
| **POS Cashier (`CASHIER`)** | `kasir.budi@raddina.id` | `RaddinaKasir123!` | Not required | High-speed POS transactions, FEFO preview, active ingredient substitution. |

---

## Testing and Verification

Run the automated test suites using the following commands:

```bash
# Run backend end-to-end integration tests (Supertest)
pnpm test:e2e

# Run tests with code coverage report (target >= 80%)
pnpm test:cov

# Typecheck both backend and frontend codebases
pnpm --filter backend exec tsc --noEmit
pnpm --filter frontend exec tsc --noEmit

# Build production bundles
pnpm build
```

---

## Project Structure

```
RaddinaHealthService/
├── backend/                  # NestJS 12 application
│   ├── src/
│   │   ├── common/           # Decorators, guards, pipes, exception filters
│   │   ├── db/               # PostgreSQL connection, Drizzle schema, seed runner
│   │   └── modules/          # Domain modules (auth, users, medicines, sales, etc.)
│   └── test/                 # Supertest E2E integration test suites
├── frontend/                 # React 19 + Vite 6 application
│   ├── src/
│   │   ├── components/       # UI components (POS, inventory, layout, 3D viewers)
│   │   ├── lib/              # API client, audio feedback, formatters
│   │   ├── pages/            # Page controllers (Login, POS, Catalog, Defekta, etc.)
│   │   └── stores/           # Zustand client stores (auth, cart)
│   └── index.html
├── shared/                   # Shared TypeScript contracts and route definitions
│   └── api-contracts.ts
├── docs/                     # Technical specifications and architecture guides
│   ├── API_spec.md           # Full REST API endpoint reference
│   ├── APP_OVERVIEW.md       # Comprehensive system reference
│   ├── ERD.mmd               # Database relationship diagram (Mermaid)
│   └── modules/              # Subsystem documentation notes
└── docker-compose.yml        # PostgreSQL 17 and Mailpit configuration
```

---

## License

This project is developed for educational and portfolio demonstration purposes. All rights reserved.
