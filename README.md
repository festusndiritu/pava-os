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
6. Visit the web app, log in as admin with the seeded credentials (printed by the seed script), then create PIN logins for the marketing and POS/cashier accounts from the Admin > Users screen (not yet built — see "What's stubbed" below; for now, create them via the API or seed script directly).

## What's actually implemented vs. scaffolded

**Implemented (working logic, not just placeholders):**
- Prisma schema: users/roles, brands, categories, units + subunits, products (with photo), product price-change history, customers, contacts, documents + document items
- Auth: JWT issuance, PIN login for staff (marketing/POS), email+password login for admin, roles guard
- Products CRUD (create/edit forms, not just a table) with brand/category/unit filtering and photo upload (served from `/uploads/products/...`)
- **Transaction immutability**: `DocumentItem` stores its own frozen `unitPrice`/`description`/`lineTotal` at creation time and is never re-read from `Product` afterward — there is no edit endpoint on documents, only status transitions. Changing a product's price today never changes yesterday's quote/invoice/receipt.
- **Price audit trail**: editing a product's `basePrice` writes a `ProductPriceHistory` row (old price, new price, who, when) via `GET /products/:id/price-history` — separate from and irrelevant to past transactions, purely so you can answer "what was this listed at on a given day"
- Documents: create as quote, convert to invoice, mark paid (generates receipt state), line items with per-line discount, transport handling (itemized vs distributed)
- Frontend: login page, role-based layout/sidebar per role (Admin/Marketing/POS), Admin dashboard with a real chart wired to real sales data, Products table with create/edit/photo, POS quick price-lookup + document builder, print stylesheet sized for an 80mm thermal printer
- Contacts CRUD (marketing "contact book") with follow-up date

**Deliberately stubbed / left for you to build next (so this ships instead of ballooning):**
- WhatsApp-shareable pricelist generator (image/PDF export) — the data and UI hook are there (`/marketing`), the actual html2canvas/jsPDF export button is a TODO
- Reports/analytics beyond the one dashboard chart and the price-history endpoint — schema supports more (every document/line item is queryable), no dedicated report pages built yet
- Credit customer balance tracking beyond the raw `creditBalance` field — no ledger/payment history yet
- User management UI (creating/resetting PINs) — currently only via seed script or direct API calls
- A UI screen for viewing a product's price history (the endpoint exists, no page consumes it yet)
- Any inventory *deduction* logic (stock is a status flag, not a quantity ledger, matching how the shop actually sells — full-length/whole-unit stock, not decremented per sale, per your description)

This is meant to match your workflow: build the schema right once, ship the
quote→invoice→receipt core first, layer contacts/reports/inventory on top
without a rewrite.

## Runtime / dependency baseline

This repo targets Node.js 24 LTS and Bun 1.4. Prisma is on the current stable v7 line, NestJS 12, Next.js 16, React 19, and Tailwind CSS 4. Keep `bun.lock` as the source of truth for installed versions.
