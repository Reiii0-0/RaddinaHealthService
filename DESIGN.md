# Design Specifications: Raddina Health Service (RHS)

Version 2.0. This document defines the visual interface and interaction standards for all RHS screens.

**Scope.** This document specifies interface layout, typography, palette tokens, and interaction kinetics. APIs, database schemas, business invariants (FEFO, SIPA, Pareto, ROP), and keyboard shortcuts (`F1`, `F2`, `F4`, `F8`, `Escape`) remain unchanged.

---

## 1. Design Direction

**Domain.** Pharmacy operations: rapid cashier throughput, accurate inventory balances, and regulatory compliance.

### Target Users and Key Tasks

| User | Primary Task | Critical Ergonomic Requirement |
| :--- | :--- | :--- |
| **Cashier** | Serve customer queues | High transaction speed, keyboard-first navigation, deterministic lot selection |
| **Pharmacist (APJ)** | Receive supplier shipments, order inventory | Numerical accuracy, clear SIPA license verification |
| **Owner** | Monitor sales and inventory health | Actionable revenue and inventory turnover summaries |

**Design Concept: Calm, Legible, and Fast.**
Soft clinical backgrounds, flat white panels, a single prominent action color, and ample whitespace. Elements do not compete for visual attention, preserving focus during extended shifts.

**Signature Element: The Freshness Band.**
A sequential five-color scale (mint to peach) representing medicine shelf life. The band appears on checkout receipts, stock drawers, and catalog tables. The rest of the interface remains quiet so this indicator stands out.

### Six Core Principles

1. **One Primary Action per Screen**: Each screen features a single prominent button styled with the action token.
2. **Keyboard and Mouse Parity**: Every keyboard shortcut has a visible on-screen badge.
3. **Multi-Channel Status Indicators**: Status indicators pair semantic color with clear descriptive text and icons.
4. **Structured Tabular Numbers**: Prices, stock quantities, lot numbers, and license codes use monospaced fonts with right alignment.
5. **Concrete Operational Copy**: Menu names and buttons use direct action verbs (`Pay & Print Receipt (F8)`, `Save Incoming Invoice`, `Promote to Pharmacist`).
6. **Constructive Errors and Empty States**: Messages explain what occurred, why it occurred, and the exact next step.

### Absolute Craft Rules

- Zero em dashes (`—`) in interface text or documentation.
- Zero AI buzzwords ("crucial", "landscape", "realm", "seamless", "synergy", "comprehensive", "cutting-edge").
- Zero kickers or eyebrows above headings. Headings stand independently.
- Zero nested cards. Container borders appear only once per task module; internal divisions use clean 1px dividers.
- Zero fake metric blocks with non-interactive decorative sparklines.
- Strict `.tabular-nums` formatting on all currency, inventory quantities, lot numbers, and dates.
- Sentence case capitalization for all titles, headings, and buttons.
- No decorative text gradients.

---

## 2. Color Palette

### 2.1 Core Five-Color Palette

| Token | Hex | Name | Interface Role |
| :--- | :---: | :--- | :--- |
| `mint` | `#B6D8C0` | Mint | Active navigation items, selected states, longest shelf-life band |
| `sage` | `#C8D9BF` | Sage | Secondary summary panel backgrounds, charts, good shelf-life band |
| `sand` | `#DADABD` | Sand | Cashier role indicators, moderate shelf-life band |
| `cream` | `#ECDBBC` | Cream | On-screen receipt backgrounds, soft warnings, near-expiry band |
| `peach` | `#FEDCBA` | Peach | Urgent alerts, inventory expiring within 30 days |

These pastel tokens are calibrated for background fills. Because their contrast against white is low (1.3:1 to 1.6:1), they are never used as standalone text or thin borders. They are always paired with dark text and crisp container boundaries.

### 2.2 Surface, Text, and Semantic Tokens

| Token | Hex | Contrast Ratio | Usage |
| :--- | :---: | :---: | :--- |
| `canvas` | `#F4F9F5` | - | Full-window background |
| `surface` | `#FFFFFF` | - | Panels, table containers, modal sheets |
| `ink` | `#16281F` | 15.47 : 1 on white | Primary text, titles, numbers |
| `ink-soft` | `#3E5648` | 7.99 : 1 on white | Secondary prose, table headers |
| `ink-muted` | `#5A7164` | 5.28 : 1 on white | Helper text, input placeholders |
| `line` | `#D8E2DC` | - | 1px container dividers |
| `action` | `#2F6B4C` | 6.31 : 1 on white | Primary action buttons, active tabs, focus rings |
| `action-hover`| `#24543B` | 8.52 : 1 on white | Hover state on action buttons |
| `action-press`| `#1D422E` | 10.97 : 1 on white | Active press state on action buttons |
| `warn` | `#B57A2A` | 4.62 : 1 on white | Near-expiry warning badges |
| `danger` | `#B42318` | 5.02 : 1 on white | Expired stock badges, destructive actions |

---

## 3. Freshness Band Scale

The Freshness Band indicates remaining shelf life across inventory drawers, catalog tables, and POS carts:

| Remaining Shelf Life | Category | Fill Token | Text Token | Icon | Operational Action |
| :--- | :--- | :---: | :---: | :---: | :--- |
| $\ge 365$ days | Long | `mint` | `ink` | - | Normal turnover |
| 180 to 364 days | Good | `sage` | `ink` | - | Stable stock balance |
| 90 to 179 days | Moderate | `sand` | `ink` | - | Routine monitoring |
| 30 to 89 days | Near Expiry | `cream` | `warn-ink` | Clock | Added to Near-ED Digest report |
| 1 to 29 days | Urgent | `peach` + border | `warn-ink` | AlertTriangle | Prioritized for FEFO checkout |
| $\le 0$ days | Expired | `danger` | White | XCircle | Blocked from checkout, staged for disposal |

---

## 4. Typography and Formatting Rules

1. **Body Typography**: **Plus Jakarta Sans** for headings, prose, button labels, and navigation.
2. **Numeric Typography**: **JetBrains Mono** with `.tabular-nums` for currency, inventory counts, lot numbers, and dates.
3. **Sentence Case**: All titles, headings, and buttons use sentence case capitalization.

---

## 5. Interaction Kinetics and Latency

1. **Zero-Latency Keyboard Shortcuts (`0ms`)**:
   Pressing `F1` (search), `F2` (pricing tier toggle), `F4` (unit cycle), or `F8` (checkout) updates the interface with zero animation delay.
2. **Tactile Button Press Feedback**:
   Interactive buttons use `:active { transform: scale(0.97) }` with a 150ms transition.
3. **Modal and Drawer Transitions**:
   Drawers enter with `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)` over 220ms. Dialogs open with `scale(0.96) -> scale(1)` over 180ms.
4. **Motion Preference**:
   The interface respects `@media (prefers-reduced-motion: reduce)`, disabling non-essential transitions.

---

## 6. Thermal Receipt Printing (80mm ESC/POS)

Receipts format to an 80mm ESC/POS layout (76mm printable width) with complete print media isolation:

```css
@media print {
  body * {
    visibility: hidden;
  }
  #printable-thermal-receipt,
  #printable-thermal-receipt * {
    visibility: visible;
  }
  #printable-thermal-receipt {
    position: absolute;
    left: 0;
    top: 0;
    width: 76mm !important;
    background: #FFFFFF !important;
    color: #0F172A !important;
  }
}
```

---

## 7. Verification Checklist

- [ ] All action buttons use the primary `action` token with contrast $\ge 4.5:1$.
- [ ] Every status chip includes text and an icon alongside semantic color.
- [ ] Freshness band segments display 1px borders and clear categorical labels.
- [ ] Keyboard shortcuts (`F1`, `F2`, `F4`, `F8`, `Escape`) function with visible on-screen badges.
- [ ] Keyboard-opened dialogs and palettes appear with zero transition delay.
- [ ] All numeric figures use `tabular-nums` and right alignment.
- [ ] No nested card containers, uppercase text, decorative gradients, or em dashes.
- [ ] Thermal receipt prints standard 76mm output without page overflow.
- [ ] Full checkout workflow can be executed entirely via keyboard.
- [ ] Interface verified across desktop, tablet, and mobile viewports (1440px, 1024px, 768px, 390px).
- [ ] Design rules verified with zero lint violations.
- [ ] Backend integration suite passes all 40/40 E2E scenarios.
