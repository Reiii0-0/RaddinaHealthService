# Product Truth: Raddina Health Service (RHS)

## Platform
web

## Purpose
Raddina Health Service (RHS) is a high-precision, high-throughput pharmacy management and bio-intelligence operating system engineered for retail and clinical pharmacies in Indonesia. It replaces error-prone legacy POS and inventory tools with an atomic, FEFO-first engine compliant with BPOM and Kemenkes RI standards.

## Target Users & Primary Jobs
1. **Kasir POS (Cashier)**:
   - Needs: Zero-friction transaction throughput (100+ transactions/day), keyboard-only operation (`F1` Search, `F2` Pricing Tier, `F4` Cycle UOM, `F8` Checkout), real-time change calculation, instant FEFO batch visibility, and authentic 80mm thermal receipt printing.
2. **Apoteker Penanggung Jawab / APJ (Pharmacist)**:
   - Needs: Legal SIPA enforcement, active ingredient substitution lookup, receiving multi-item PBF invoices with automatic base unit cost calculation, near-expiry batch monitoring (<90 days), Pareto ABC 80/20 revenue optimization, automated Defekta reordering, and legal electronic purchase order (SP-el) dispatch.
3. **Pemilik Sarana Apotek / PSA (Owner)**:
   - Needs: Staff role governance, SIPA license verification, append-only stock card audit trail, and high-level inventory turnover analytics.

## Core Capabilities
- **FEFO Multi-Batch Atomic Allocation**: Automatic stock deduction by earliest expiration date under SQL `SELECT ... FOR UPDATE` row locks.
- **Dynamic Multi-UOM Tiering**: Flexible unit conversion hierarchy (Box -> Strip -> Tablet) with dual pricing (Regular vs Partner/Faskes).
- **Automated Defekta & Pareto ABC (80/20)**: Real-time reorder point thresholding ($\text{ROP}_m = \max(M_m, \lceil 7 \times \bar{d}_m \rceil)$) with cheapest 90-day PBF supplier recommendations.
- **SIPA Guard & SP-el Dispatch**: Strict RBAC preventing unauthorized or expired-license purchase orders, dispatched via HTML email over SMTP (Mailpit).
- **80mm ESC/POS Thermal Receipt**: Standards-compliant pharmacy receipt with official SIA/SIPA header, FEFO lot trace per line item, 0% VAT prescription status, simulated barcode, and print isolation.
- **WebGL Three.js Bio-Intelligence**: 3D interactive Asclepius hero and real-time physical dosage form inspector (Tablets, Capsules, Syrup Bottles).

## Hard Constraints
- Pure Indonesian operational copy without AI slop, em-dashes (`—`), or generic buzzwords.
- Strict `.tabular-nums` alignment on all currency, inventory counts, lot numbers, and dates.
- 0ms animation latency on high-frequency cashier keyboard actions.
- Magic bytes validation and 5MB size limit on all document and image uploads.
