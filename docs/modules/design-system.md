---
title: UI Design System, Color Tokens, and Anti-Slop Layout Standards
tags:
  - module
  - design-system
  - ui-ux
  - typography
  - accessibility
status: production
owner: "Frontend Engineering"
layer: frontend
coverage: "100%"
e2e_scenarios: "Clean Design Audit"
---

# UI Design System, Color Tokens, and Layout Standards

This document establishes the user interface and interaction design specifications for Raddina Health Service (RHS) version 2.0. The system is engineered for retail pharmacy work: fast keyboard response, calm visual density for long shifts, WCAG-compliant contrast ratios, and clean layouts free of artificial decorative clutter.

---

## 1. Design Principles

1. **One Primary Action per Screen**: Each workflow highlights a single primary button styled with the dark green action token (`action`).
2. **First-Class Keyboard Ergonomics**: All keyboard shortcuts (`F1`, `F2`, `F4`, `F8`, `Escape`) display visible on-screen key badges.
3. **Multi-Channel Status Indicators**: Status chips pair color with descriptive text labels and semantic icons. Color is never the sole communicator of state.
4. **Structured Tabular Alignment**: All currency amounts, inventory counts, invoice IDs, batch numbers, and license codes use `JetBrains Mono` with `font-variant-numeric: tabular-nums` and right alignment.
5. **Direct Operational Copy**: Menus and action buttons use concrete verbs describing the exact outcome (`Pay & Print Receipt (F8)`, `Save Incoming Invoice`, `Promote to Pharmacist`).

---

## 2. Palette and Freshness Band

### 2.1 Five-Color Calibrated Palette
The palette provides a soft, clinical aesthetic:

| Token | Hex Value | Interface Role |
| :--- | :---: | :--- |
| `mint` | `#B6D8C0` | Active navigation, selected states, long-shelf-life freshness band |
| `sage` | `#C8D9BF` | Secondary summary panels, good-condition freshness band |
| `sand` | `#DADABD` | Cashier role badges, moderate-shelf-life freshness band |
| `cream` | `#ECDBBC` | On-screen receipt paper background, near-expiry warning alerts |
| `peach` | `#FEDCBA` | Urgent alerts, inventory lots expiring within 30 days |

### 2.2 Medicine Freshness Band Scale
The Freshness Band is a core visual feature in RHS. It appears in stock card drawers, medicine tables, and point-of-sale carts:

| Remaining Shelf Life | Category | Fill Token | Text Token | Icon | Operational Action |
| :--- | :--- | :---: | :---: | :---: | :--- |
| $\ge 365$ days | Long | `mint` | `ink` | - | Stable inventory, standard turnover |
| 180 to 364 days | Good | `sage` | `ink` | - | Healthy stock balance |
| 90 to 179 days | Moderate | `sand` | `ink` | - | Routine inventory monitoring |
| 30 to 89 days | Near Expiry | `cream` | `warn-ink` | Clock | Aggregated in Near-ED Digest report |
| 1 to 29 days | Urgent | `peach` + border | `warn-ink` | AlertTriangle | Highest FEFO checkout priority |
| $\le 0$ days | Expired | `danger` (`#B42318`) | White | XCircle | Blocked from sales, staged for disposal |

```typescript
// frontend/src/lib/freshness.ts
export type FreshnessBand = 'long' | 'good' | 'mid' | 'near' | 'urgent' | 'expired';

export function freshnessBand(daysLeft: number): FreshnessBand {
  if (daysLeft <= 0) return 'expired';
  if (daysLeft < 30) return 'urgent';
  if (daysLeft < 90) return 'near';
  if (daysLeft < 180) return 'mid';
  if (daysLeft < 365) return 'good';
  return 'long';
}
```

---

## 3. Surface, Text, and Action Colors

All interactive elements satisfy WCAG 2.1 AA/AAA contrast ratios:

| Token | Hex Value | Contrast Ratio | Usage |
| :--- | :---: | :---: | :--- |
| `canvas` | `#F4F9F5` | - | Full-window background |
| `surface` | `#FFFFFF` | - | Panels, table containers, modal drawers |
| `ink` | `#16281F` | 15.47 : 1 on white | Primary text, headings, numbers |
| `ink-soft` | `#3E5648` | 7.99 : 1 on white | Secondary labels, column headers |
| `ink-muted` | `#5A7164` | 5.28 : 1 on white | Helper descriptions, input placeholders |
| `action` | `#2F6B4C` | 6.31 : 1 on white | Primary buttons, active links, focus rings |

---

## 4. Typography and Formatting Rules

1. **Primary Interface Font**: **Plus Jakarta Sans** (variable) for headings, body prose, buttons, and navigation.
2. **Numeric and Financial Font**: **JetBrains Mono** with `.tabular-nums` utility classes for currency, quantities, lot numbers, and dates.
3. **Sentence Case**: All titles, headings, and buttons use sentence case capitalization. All-caps text is prohibited.

---

## 5. Clean Layout Standards

The codebase adheres to clear layout rules:
- **Zero Kickers or Eyebrows**: No small uppercase labels above page headings. Headings stand independently.
- **Zero Nested Cards**: No card containers nested inside other card containers. Visual grouping uses clean 1px hairline dividers.
- **Zero Fake Metric Blocks**: No decorative metric rows with non-interactive fake sparklines.
- **Zero Em Dashes**: Clean punctuation using commas, colons, or parentheses.
- **Zero Text Gradients**: Text uses solid semantic colors with clear typographical weights.

---

## 6. Related Subsystems
- Governs layouts and palette tokens for the point-of-sale station in [[sales-pos-fefo]].
- Defines visual themes for 3D dosage inspectors in [[threejs-bio-intelligence]].
- Provides expiration scales for inventory audits in [[pbf-invoices-stockcards]].
