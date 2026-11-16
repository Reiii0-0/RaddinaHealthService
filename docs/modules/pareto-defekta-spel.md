---
title: Pareto ABC Financial Analytics, Defekta Reordering, and SIPA Purchase Orders
tags:
  - module
  - procurement
  - analytics
  - pareto
  - defekta
  - spel
  - email
status: production
owner: "Fullstack Engineering"
layer: fullstack
coverage: "100%"
e2e_scenarios: "US-05 Scenarios 16-17, US-06 Scenarios 18-20"
---

# Pareto ABC Analytics, Defekta Reordering, and SP-el Purchase Orders (US-05 & US-06)

This module handles pharmaceutical inventory optimization and procurement: **Pareto ABC (80/20)** sales classification, an automated **Defekta** reorder book based on consumption velocity and Reorder Point (ROP), and regulatory **Electronic Purchase Orders (SP-el)** verified against active pharmacist practice licenses (SIPA) and dispatched via SMTP email.

---

## 1. Pareto ABC (80/20) Revenue Analysis

In retail pharmacies, roughly 80% of revenue is driven by approximately 20% of inventory items (vital medications, chronic therapies, and high-demand antibiotics).

### 1.1 Cumulative Revenue Share Formulation
Medicines are ranked in descending order by total gross revenue during the evaluation period:

$$
R_{(1)} \ge R_{(2)} \ge \dots \ge R_{(N)}
$$

Total pharmacy revenue is $R_{\text{total}} = \sum_{i=1}^N R_{(i)}$.
The cumulative revenue share prior to evaluating rank $k$ is defined as:

$$
C_{k-1} = \frac{\sum_{i=1}^{k-1} R_{(i)}}{R_{\text{total}}} \quad (\text{with } C_0 = 0)
$$

Class boundaries are assigned according to the following thresholds:

$$
\text{Class}(k) = \begin{cases} 
\text{'A'}, & \text{if } C_{k-1} < 0.80 \land R_{(k)} > 0 \\
\text{'B'}, & \text{if } 0.80 \le C_{k-1} < 0.95 \land R_{(k)} > 0 \\
\text{'C'}, & \text{otherwise (including } R_{(k)} = 0)
\end{cases}
$$

> [!important] Mathematical Boundary Invariant
> By evaluating the cumulative proportion *prior to item $k$* ($C_{k-1}$), the algorithm ensures that if a single top-selling medicine accounts for more than 80% of total revenue on its own (for instance, 85%), it is correctly classified as **Class A** because $C_0 = 0 < 0.80$.

---

## 2. Automated Defekta Book and Reorder Point (ROP)

The Defekta book maintains the list of medicines requiring immediate replenishment to avoid stockouts.

### 2.1 Consumption Velocity and Lead Time Parameters
1. **Average Daily Consumption** ($\bar{d}_m$): Calculated from the total quantity dispensed (`OUT_SALE`) over the preceding 30 days divided by 30.
2. **Supplier Lead Time** ($L$): Standardized at 7 days for distributor delivery cycles.
3. **Reorder Point (ROP)**:

$$
\text{ROP}_m = \max(M_m, \lceil 7 \times \bar{d}_m \rceil)
$$

Where $M_m$ is the static minimum stock threshold configured on the medicine record (`minStockAlert`).

### 2.2 Defekta Entry Criteria
A medicine enters the Defekta list if and only if:

$$
\text{ROP}_m > 0 \land S_m^{\text{active}} \le \text{ROP}_m
$$

### 2.3 Lowest-Cost Supplier Recommendation
The procurement engine inspects the preceding 90 days of invoices in `pbf_invoice_items` for the given medicine and recommends the distributor offering the lowest `costPricePerBaseUnit` to maximize operating margins.

---

## 3. SIPA-Protected Electronic Purchase Orders (SP-el)

Orders sent to licensed distributors are strictly regulated under Indonesian pharmaceutical law:

### 3.1 Active SIPA License Verification
The `POST /api/v1/procurement/purchase-orders` endpoint is protected by `ActiveSipaGuard`.
- Non-pharmacists or pharmacists with expired licenses are rejected with **HTTP 403 Forbidden**.
- Authenticated pharmacists with active licenses freeze their license number into `purchase_orders.sipaNumberSnapshot` and record their identity in `purchase_orders.issuedByPharmacistName`.

### 3.2 SMTP Email Integration (Mailpit)
Once the order record is committed, `MailService` generates an HTML order document and dispatches it via Nodemailer to the distributor email address over SMTP (`:1025`):
- Subject: `Electronic Purchase Order - Apotek Raddina [Order Number]`
- Content: Line items with packaging units, quantities, estimated costs, Pharmacist-in-Charge (APJ) name, and verified SIPA number.

---

## 4. Near-Expiry Early Warning Digest

Endpoint `POST /api/v1/notifications/near-expiry-digest` scans active batches with remaining shelf life between 1 and 90 days (`1 <= daysUntilExpiry <= 90`) and sends a summary report to pharmacy management, facilitating vendor returns or targeted dispensing prior to expiration.

---

## 5. Related Subsystems
- Integrates with [[auth-rbac-sipa]] for pharmacist license validation.
- Reads checkout velocity from [[sales-pos-fefo]].
- Reads historical purchase costs and distributor directories from [[pbf-invoices-stockcards]].
