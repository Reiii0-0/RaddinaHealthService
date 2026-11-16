---
title: POS Cashier Station, Multi-Batch FEFO Allocation, and Native Web Audio
tags:
  - module
  - sales
  - pos
  - fefo
  - audio
  - algorithms
status: production
owner: "Fullstack Engineering"
layer: fullstack
coverage: "100%"
e2e_scenarios: "US-04 Scenarios 13-15"
---

# POS Cashier Station and Multi-Batch FEFO Allocation (US-04)

This module provides high-throughput point-of-sale operations for retail pharmacies. It integrates keyboard-driven cashier navigation, First-Expired, First-Out (FEFO) inventory deductions using database row locking, zero-latency Web Audio haptic tones, and 80mm thermal receipt printing.

---

## 1. Keyboard-First Cashier Navigation

To maintain transaction speed during customer rushes, operators complete sales without touching a mouse:

| Key Shortcut | Operational Action | System Response |
| :--- | :--- | :--- |
| `F1` | Quick Medicine Search | Opens an instant command palette searching names, SKUs, and active ingredients |
| `F2` | Toggle Price Tier | Switches the entire cart between **Regular** and **Partner** pricing tiers |
| `F4` | Cycle Packaging Unit | Rotates the selected item unit (`Box` $\rightarrow$ `Strip` $\rightarrow$ `Tablet`) |
| `F8` | Payment and Receipt | Opens the payment modal with change calculation and thermal printing |
| `Escape` | Dismiss / Close | Closes open modals or clears active search filters |

---

## 2. Atomic Multi-Batch FEFO Allocation Engine

The FEFO principle dictates that medicines with the nearest expiration date must be dispensed first, while expired inventory must never reach patients.

### 2.1 Mathematical Allocation Specification
Let $Q_{\text{req}}$ be the required quantity in base units for medicine $m$.
The set of active, dispensable batches is:

$$
B_m^{\text{active}} = \{ b \in \text{Batches}_m \mid \text{currentStock}_b > 0 \land \text{expiryDate}_b > \text{CURRENT\_DATE} \}
$$

Batches are sorted in ascending order by expiration date and creation time:

$$
b_1, b_2, \dots, b_k \quad \text{where } \text{expiryDate}_{b_i} \le \text{expiryDate}_{b_{i+1}}
$$

Total available active capacity is:

$$
S_m^{\text{active}} = \sum_{b \in B_m^{\text{active}}} \text{currentStock}_b
$$

### 2.2 Boundary Conditions and Active Ingredient Substitution
If $Q_{\text{req}} > S_m^{\text{active}}$, the transaction immediately aborts on the backend:
1. Throws an `UnprocessableEntityException` (**HTTP 422 Unprocessable Entity**).
2. Sets error code: `INSUFFICIENT_FEFO_STOCK`.
3. Returns structured metadata: requested quantity, available active stock, shortage amount, and a list of alternative medicines sharing the same **active ingredient (`activeIngredient`)**.

```json
{
  "statusCode": 422,
  "errorCode": "INSUFFICIENT_FEFO_STOCK",
  "message": "Dispensable FEFO stock for Amoxicillin 500mg is insufficient (requested: 150, available: 120).",
  "details": {
    "requestedQty": 150,
    "availableActiveStock": 120,
    "shortage": 30,
    "activeIngredient": "Amoxicillin",
    "alternativeMedicines": [
      {
        "id": "89ab-...",
        "name": "Amoxsan 500mg",
        "activeIngredient": "Amoxicillin",
        "availableStock": 200
      }
    ]
  }
}
```

### 2.3 Incremental Batch Deduction Algorithm
When stock is sufficient, the allocation loop executes within a database transaction holding row locks (`SELECT ... FOR UPDATE`) to prevent multi-cashier race conditions:

```typescript
// backend/src/modules/sales/fefo.engine.ts
let remainingQty = requiredBaseQty;
const allocations = [];

for (const batch of candidateBatches) {
  if (remainingQty <= 0) break;
  const takeQty = Math.min(batch.currentStock, remainingQty);
  
  // Deduct from batch balance
  await tx.update(medicineBatches)
    .set({ currentStock: batch.currentStock - takeQty })
    .where(eq(medicineBatches.id, batch.id));

  // Record batch detail in sale item
  allocations.push({
    batchId: batch.id,
    allocatedQty: takeQty,
    costPricePerBaseUnit: batch.costPricePerBaseUnit,
  });

  // Write immutable audit trail to stock cards
  await tx.insert(stockCards).values({
    medicineId,
    batchId: batch.id,
    movementType: 'OUT_SALE',
    referenceId: transactionReceiptNumber,
    qtyChange: -takeQty,
    balanceAfter: batch.currentStock - takeQty,
    actorUserId,
  });

  remainingQty -= takeQty;
}
```

---

## 3. Tactile Audio Feedback: Native Web Audio Synthesizer (0 ms)

To confirm actions for operators working at speed, the application uses native `window.AudioContext` oscillators without network audio asset requests:

```typescript
// frontend/src/lib/web-audio.ts
export class PharmacyAudioSynthesizer {
  private ctx: AudioContext | null = null;

  playBeep(freq = 880, duration = 0.06, type: OscillatorType = 'sine') {
    if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }
}
```

| Event | Waveform and Frequency | Perceptual Meaning |
| :--- | :--- | :--- |
| Add item to cart | 880 Hz Sine | Crisp confirmation ping |
| Cycle packaging unit (`F4`) | 660 Hz Triangle | Mid-tone unit rotation tone |
| Toggle pricing tier (`F2`) | 550 Hz Square | Authoritative pricing tier switch |
| Successful payment | Tri-tone Major Chord (523, 659, 784 Hz) | Three-note harmonic resolution |
| Depleted stock alert | 150 Hz Sawtooth | Low warning buzzer |

---

## 4. 80mm ESC/POS Thermal Receipt Layout

Receipts are styled using monospace fonts with explicit alignment for print media (`@media print`). The receipt includes official pharmacy header licensing, cashier identity, line items, batch-level FEFO breakdowns, subtotal, tax exemption notes, payment received, and calculated change.

---

## 5. Related Subsystems
- Reads stock availability and packaging multipliers from [[catalog-multi-uom]].
- Updates batch balances and records stock cards in [[pbf-invoices-stockcards]].
- Supplies sales history for revenue analytics in [[pareto-defekta-spel]].
