# Pava Steel Hardware — Internal System

Quotes, invoices, receipts, product catalogue, customers, contacts, and
role-based dashboards for a single hardware store (steel products).

Single-tenant, built for this shop only.

## Stack
- **API**: NestJS + Prisma + PostgreSQL, JWT auth (PIN for staff, email/password for admin)
- **Web**: Next.js (App Router) + Tailwind, role-based dashboards (Admin / Marketing / POS)

## Structure
```
apps/api   -> NestJS backend
apps/web   -> Next.js frontend
```

## Getting started

1. Start Postgres (local, Docker, or Dokploy like your other projects) and set `DATABASE_URL` in `apps/api/.env` (copy from `.env.example`).
2. Use Node 24.20 LTS and Bun 1.4, then run `bun install` at the repo root (workspaces install both apps).
3. `bun run prisma:migrate` — creates tables.
4. `bun run prisma:seed` — creates an initial admin user, a couple of units/brands/categories, and sample products so the UI isn't empty.
5. `bun run dev:api` in one terminal, `bun run dev:web` in another.
6. Visit the web app, log in as admin with the seeded credentials (printed by the seed script), then create PIN logins for the marketing and POS/cashier accounts from the Admin > Users screen.

## Status against the Pava OS spec

The financial core is the priority in the spec, and it's the most complete
part of this build. Breadth (Leads, Marketing export, HR/Payroll/Expenses,
Reports/Analytics, Settings) is what's left.

**Solidly implemented (real logic, matches the spec's invariants):**
- **Auth & access**: JWT + refresh sessions, PIN login (staff) and
  email/password login (admin), password/PIN hashing, sliding inactivity
  timeout (30 min admin / 60 min staff, configurable, separate from the
  absolute session cap). Granular `Module[]` permissions on `User`, enforced
  server-side via `PermissionsGuard` — never frontend-only. Users & Access
  page supports PIN reset and module toggles.
- **Catalogue & search**: `Product` carries both a technical `name` and a
  customer-facing `displayName`, plus structured attributes (`shape`,
  `nominalSize`, `widthMm`, `heightMm`, `thicknessMm`, `gauge`). `ProductAlias`
  and `ProductFamily` exist and are used by search.
  `search-normalize.ts` genuinely normalizes inch notation, unicode
  fractions, gauge phrasing, and dimension pairs before matching — this is
  not a stub.
- **Inventory**: real ledger — `InventoryReceipt` → `InventoryBatch` →
  `InventoryMovement`, FIFO consumption, `Product.stockQuantity`/`lastCost`
  are cached projections written inside the same transaction as the
  movement that changes them. Receiving UI exists.
- **POS / documents**: finalizing a sale is one transaction — discount-limit
  validation, transport allocation (by quantity, by line value, or manual),
  commercial rounding with any leftover tracked in `roundingAdjustment`
  (never silently dropped), FIFO inventory consumption, and a frozen
  `DocumentItem` snapshot (`basePrice`/`unitPrice`/`transportAllocated`/
  `roundingAdjustment`/`lineTotal`) that's never re-read from `Product`
  afterward. Quote → invoice → paid lifecycle, cancel, 80mm thermal print
  stylesheet.
- **Customer credit**: `CustomerLedgerEntry` is a real ledger (invoice,
  payment, adjustment, opening, refund, write-off), not a bare mutable
  balance — with a credit UI badge and detail drawer.
- **Price history**: editing `Product.basePrice` writes a
  `ProductPriceHistory` row (old/new price, who, when) via
  `GET /products/:id/price-history`.

**Partially built:**
- Contacts: full CRUD API exists but has **no frontend page** yet.
- Audit: `AuditLog` is written from auth/users/customers/inventory/documents,
  but there's no Audit Trail page to view it yet.
- Product aliases/families: manageable via API, no admin UI for them yet.
- Receiving-time "suggest new selling price" prompt (spec §23) — not wired
  into the receiving UI yet.

**Not started:**
- Leads (no model, no pipeline)
- Marketing / WhatsApp-friendly pricelist export
- HR, Payroll, Advances, Expenses (no schema, no modules)
- Settings module (`BusinessSetting`) — rounding increment, document
  prefixes, etc. are currently request-time parameters, not persisted
  business config
- Reports/Analytics beyond the dashboard chart and one sales-summary
  endpoint — no gross-profit, margin, discount, or transport reporting yet

This is meant to match the phased build order in the spec: get the schema
and the pricing/inventory/transport invariants right first, then layer
Leads/Marketing/HR/Reports on top without a rewrite.

## Runtime / dependency baseline

This repo targets Node.js 24 LTS and Bun 1.4. Prisma is on the current stable v7 line, NestJS 12, Next.js 16, React 19, and Tailwind CSS 4. Keep `bun.lock` as the source of truth for installed versions.