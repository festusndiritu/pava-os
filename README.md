# Pava OS

An ERP/POS system for a hardware and steel yard — quotes, invoices, receipts,
delivery notes, inventory (with FIFO costing), a customer credit ledger,
POS with returns, a sales pipeline, HR/payroll, expenses, and reporting.

Prices and every stored amount are whole Kenyan shillings (no cents), and
every quantity sold or received is a whole unit — the yard doesn't sell or
stock half a kilo or half a length. Phone numbers are stored and validated
as 10-digit Kenyan mobile numbers (`07xxxxxxxx` / `01xxxxxxxx`).

## Layout

```
apps/
  api/   NestJS + Prisma (Postgres), REST API, JWT auth, PIN-based POS login
  web/   Next.js (App Router), the staff-facing UI
```

Each app has its own `package.json`; the root `package.json` only wires up
convenience scripts that run in both.

## Prerequisites

- [Bun](https://bun.sh) — used to run and build both apps
- PostgreSQL (a `DATABASE_URL` you can create/migrate against)

## Setup

1. **API environment** — copy `apps/api/.env.example` to `apps/api/.env`
   and fill in `DATABASE_URL` and `JWT_SECRET` at minimum.
2. **Web environment** — create `apps/web/.env.local` with:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:4000
   ```
3. **Install dependencies** in each app:
   ```
   cd apps/api && bun install
   cd apps/web && bun install
   ```
   The web app uses `@tanstack/react-query` for server data on the POS; `bun install`
   in `apps/web` picks it up.
4. **Migrate and seed the database** (from the repo root):
   ```
   bun run prisma:migrate
   bun run prisma:seed
   ```
   The seed creates an admin user and a few PIN-login staff accounts —
   see `apps/api/prisma/seed.ts` for the credentials it prints.
5. **Run both apps** (in separate terminals, from the repo root):
   ```
   bun run dev:api
   bun run dev:web
   ```
   The API listens on `:4000` (Swagger docs at `/docs`); the web app on
   `:3000`.

## Useful scripts

Run from the repo root unless noted:

- `bun run prisma:migrate` / `prisma:generate` / `prisma:seed` — database
  setup, proxied into `apps/api`.

## What the till and back office do (worth knowing before changing them)

**POS (desktop).** Products are a narrow list of compact rows (staff search
far more than they browse) and the cart takes the rest of the screen:
customer picker on top, the lines, then Fulfilment, the total and
*Complete sale*. A bar under the product list holds the rest:

- **M-Pesa** selects that payment type straight away.
- **Cash** and **Split** open a dialog: how much was received and, when it
  is more than the total, whether to give the change back (only out of cash)
  or keep it on the customer's account as credit.
- **Pay later**, **Transport**, **Hold cart**, **Recent sales** (the last 15
  sales, opening the usual document view for reprinting).
- **Make quote** saves the cart as a quote — no stock taken, nothing paid.
  Shown only to people with the Quotes or Invoices permission.

On a phone the cart is still one full-screen sheet.

**Backorders on invoice edits.** Approving an edit request that adds units
beyond what is on the shelf no longer just refuses. The admin sees what is
short and chooses, per line, how much comes from the shop; the rest is
marked as sourced elsewhere (optionally naming the source). A line can't be
set below what it had already taken from the shelf, and asking for more than
the shelf holds is refused again. What was sourced elsewhere is kept in the
audit log.

**Adding stock without a cost.** In *Adjust stock*, the unit cost is
optional. Left blank it uses the product's last cost, or is stored as
"no cost recorded" (those units are flagged on the product and inventory
pages, and profit on them looks higher than it really is because their cost
counts as zero). Receiving stock from a supplier still requires a cost.

**Customer credit held by the shop.** Money a customer leaves with the shop
(an overpayment, or change they didn't take) is a negative balance on their
account, recorded with how it arrived (e.g. "Excess left with the shop
(M-Pesa 120)"). An admin can *Release credit* from the customer screen,
either **given to the customer** (cash or M-Pesa) or **cleared and kept by the
owner**, always with a note. It is a ledger entry (`CREDIT_RELEASED`) plus an
audit-log record; it is never a sale or shop income. The dashboard's
*Held for customers* card shows the total held, how many customers, and how
long the oldest has been held.

## Performance notes

- POS product browsing, search and categories use TanStack Query
  (`QueryClientProvider` in `app/providers.tsx`). Anything that changes stock
  invalidates the `['pos-products']` queries so the till refreshes. Other
  lists use the existing `useServerTable` hook.
- The PDF renderer is loaded on demand (`await import('lib/pdf/document-pdf')`)
  rather than bundled into every screen.
- Calls that only need the newest few rows pass a `limit` (POS product
  lists, the returns dialog's sale search) instead of downloading everything
  and trimming it in the browser.
- Migration `performance_indexes` adds indexes for document lists
  (type/status/date), customer, paid date, source document, and items by
  product.

## Conventions worth knowing before you touch the code

- **Money and quantities are whole numbers.** Every money and quantity
  column in the Prisma schema is `Int`, not `Float`/`Decimal` — there's
  no cents or fractional-unit precision to lose. DTO-level validation
  rejects decimals at the API boundary (`common/validation/money.validator.ts#IsMoney`
  for money fields, plain `@IsInt()` on quantity fields), and
  `common/money.ts#roundMoney` cleans up any float drift introduced by
  arithmetic (FIFO costing, transport allocation, payroll) before a
  figure is persisted.
- **Phone numbers** go through `common/validation/phone.validator.ts`,
  which normalizes `+254`/`254`-prefixed or spaced/punctuated input to
  `07xx…`/`01xx…` before validating the result is a real 10-digit number.
- **Soft delete is the default deletion.** `Customer`, `Product`, `Lead`
  and `Contact` all carry an `active` boolean; the ordinary `DELETE`
  route archives (`active: false`) rather than removing a row, and a
  `POST :id/restore` route reverses it. `Employee` uses its existing
  `employmentStatus: TERMINATED` as the equivalent "archived" state
  rather than a redundant second flag.
- **Hard delete is separate, deliberate, and narrow.** `DELETE
  :id/permanent` exists for Product, Customer, Lead, Contact and
  Employee. It is admin-only, only ever operates on a record that's
  already archived/terminated, and the service checks for real
  dependent history (sales, ledger entries, price history, stock
  movements, payroll/advances) before allowing it — a record with any
  of that history is refused with a clear reason rather than silently
  cascading. This exists for cleaning up records created by mistake,
  not for erasing business history.
- **No product photography.** The POS deliberately renders products as
  category icons (`components/pos/ProductIcon.tsx`), not photos —
  there's no image upload feature, and none should be re-added without
  a real product-photography workflow behind it.

## Known gaps

- No automated tests yet.
- A stock batch's unit cost can't be corrected after the stock is received or
  adjusted in, so units added without a cost stay uncosted.
- Dashboard and analytics sums over long date ranges load every sale in the
  range into memory; fine at current volume, worth moving into SQL if it grows.
- API hardening (rate limiting, `helmet`, a stricter CORS policy than
  `origin: true`) hasn't been done.
