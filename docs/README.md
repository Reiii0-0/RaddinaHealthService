# Raddina Health Service (RHS) Documentation

This directory contains technical documentation for Raddina Health Service (RHS). The files are formatted in standard Markdown with optional support for Obsidian notes, visual canvases, and metadata bases.

## Main Entry Points

- [System Overview](APP_OVERVIEW.md): Comprehensive architectural breakdown, database models, and domain workflows.
- [REST API Specification](API_spec.md): Complete reference for all 30+ endpoints, authorization rules, and JSON payloads.
- [Entity-Relationship Diagram](ERD.mmd): Mermaid ERD representing the PostgreSQL database schema.
- [Architecture Canvas](architecture.canvas): Visual map of fullstack system components and data flows.
- [Knowledge Base Index](index.md): Map of content connecting all domain modules.

## Directory Layout

```
docs/
├── APP_OVERVIEW.md           # Comprehensive architectural reference
├── API_spec.md               # REST API v1 endpoint specifications
├── ERD.mmd                   # Mermaid relational database diagram
├── index.md                  # Map of content and documentation index
├── modules.base              # Metadata view for subsystem documentation
├── architecture.canvas       # Visual system architecture map
└── modules/                  # Technical notes for specific subsystems
    ├── auth-rbac-sipa.md     # Authentication, RBAC, and SIPA license rules
    ├── catalog-multi-uom.md  # Master medicine catalog and Multi-UOM conversions
    ├── pbf-invoices-stockcards.md # Supplier invoices and append-only stock cards
    ├── sales-pos-fefo.md     # Point-of-sale station and FEFO batch allocation
    ├── pareto-defekta-spel.md# Pareto ABC 80/20, Defekta, and purchase orders
    ├── threejs-bio-intelligence.md # WebGL 3D dosage inspection
    └── design-system.md      # UI design system and freshness palette
```
