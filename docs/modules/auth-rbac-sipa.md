---
title: Authentication, Role-Based Access Control (RBAC), and SIPA Compliance
tags:
  - module
  - security
  - backend
  - auth
  - sipa
status: production
owner: "Backend Engineering"
layer: backend
coverage: "100%"
e2e_scenarios: "US-01 Scenarios 1-7"
---

# Authentication, RBAC, and Pharmacist License Verification (US-01)

This module handles identity lifecycle management, session security, role-based authorization, and regulatory compliance for pharmacist practice licenses (SIPA) under Indonesian Ministry of Health standards (Permenkes No. 73/2016).

> [!important] Core Security Invariants
> 1. Public user registration (`POST /api/v1/auth/register`) enforces the `CASHIER` role on new accounts.
> 2. Role elevation to `PHARMACIST` or `OWNER` requires an explicit request from an authenticated `OWNER` via `PATCH /api/v1/users/:id/role`.
> 3. Any attempt to supply role or license parameters during public registration is rejected by `ValidationPipe` (`forbidNonWhitelisted: true`) with **HTTP 400 Bad Request**.

---

## 1. Credentials and Session Token Architecture

### 1.1 Password Hashing (Argon2id)
Passwords are encrypted using Argon2id with memory-hard cost settings:
- Algorithm: `argon2` (Argon2id variant).
- Minimum password length: 8 characters.

### 1.2 Dual-Token Architecture and Token Rotation
The application uses a two-tier JWT token model:
1. **Access Token**:
   - Lifetime: 15 minutes.
   - Algorithm: HMAC-SHA256.
   - Payload: `sub`, `email`, `fullName`, `role`, `noSipa`, `sipaExpiryDate`.
2. **Refresh Token**:
   - Lifetime: 7 days.
   - Raw tokens are cryptographically random strings issued to the client.
   - SHA-256 hashes of the refresh tokens are stored in the `refresh_tokens` table.
   - **Token Rotation**: Every call to `POST /api/v1/auth/refresh` revokes the current token (`revokedAt = NOW()`) and issues a fresh token pair atomically.

---

## 2. Role Hierarchy and RBAC Matrix

The system separates operational duties into three roles:

| Role | Operational Scope | Key Permissions |
| :--- | :--- | :--- |
| `OWNER` | Pharmacy owner and primary administrator | Staff management, SIPA license verification, Pareto ABC analytics, financial reporting |
| `PHARMACIST` | Licensed Pharmacist-in-Charge (APJ) | Invoice intake, stock card audits, Electronic Purchase Order (SP-el) dispatch |
| `CASHIER` | Point-of-sale operator | POS transactions, active ingredient search, payment processing |

### NestJS Guard Hierarchy
HTTP requests pass through three verification tiers:
1. `JwtAuthGuard`: Validates the bearer token in the `Authorization` header. Routes decorated with `@Public()` bypass this check.
2. `RolesGuard`: Verifies that `request.user.role` matches the metadata specified by `@Roles(...)`.
3. `ActiveSipaGuard`: Protects high-risk pharmaceutical procurement endpoints by verifying that the pharmacist holds an active SIPA license.

---

## 3. Active SIPA Enforcement Logic (`ActiveSipaGuard`)

Electronic purchase orders for prescription and regulated medicines require authorization from a licensed pharmacist holding a valid SIPA.

```typescript
// backend/src/common/guards/active-sipa.guard.ts
@Injectable()
export class ActiveSipaGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (!user || user.role !== 'PHARMACIST') {
      throw new ForbiddenException({
        statusCode: 403,
        errorCode: 'SIPA_PERMISSION_DENIED',
        message: 'This action requires a Pharmacist-in-Charge (APJ) account.'
      });
    }

    if (!user.noSipa || !user.sipaExpiryDate) {
      throw new ForbiddenException({
        statusCode: 403,
        errorCode: 'SIPA_NOT_CONFIGURED',
        message: 'Pharmacist SIPA license number or expiry date is not configured. Contact the pharmacy owner.'
      });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const expiryStr = new Date(user.sipaExpiryDate).toISOString().slice(0, 10);
    if (expiryStr < todayStr) {
      throw new ForbiddenException({
        statusCode: 403,
        errorCode: 'SIPA_EXPIRED',
        message: `SIPA license (${user.noSipa}) expired on ${expiryStr}. Purchase order creation is suspended.`
      });
    }

    return true;
  }
}
```

> [!warning] Expired License Handling
> If a pharmacist account holds an expired license (such as the demo account `apt.expired@raddina.id`), the frontend locks the order button and the backend rejects requests with **HTTP 403 Forbidden**. See [[pareto-defekta-spel]].

---

## 4. Key Files and Implementation Symbols

- User Schema: `backend/src/db/schema.ts` (`users`, `refresh_tokens`)
- Authentication Guard: `backend/src/common/guards/jwt-auth.guard.ts`
- Role Guard: `backend/src/common/guards/roles.guard.ts`
- SIPA Guard: `backend/src/common/guards/active-sipa.guard.ts`
- Authentication Controller: `backend/src/modules/auth/auth.controller.ts`
- Users Controller: `backend/src/modules/users/users.controller.ts`
- Staff and SIPA Interface: `frontend/src/pages/UsersSipaPage.tsx`

---

## 5. Related Subsystems
- Integrates with [[catalog-multi-uom]] for catalog modification authorization.
- Integrates with [[pbf-invoices-stockcards]] for supplier invoice intake authorization.
- Integrates with [[sales-pos-fefo]] for cashier station authorization.
- Integrates with [[pareto-defekta-spel]] for SIPA-protected purchase orders.
