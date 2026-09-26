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
- API hardening (rate limiting, `helmet`, a stricter CORS policy than
  `origin: true`) hasn't been done.
