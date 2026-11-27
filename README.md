# Pava OS

ERP and point-of-sale system for a hardware and steel yard in Kenya: quotes,
invoices, receipts, delivery notes, inventory with FIFO costing, a customer
credit ledger, a POS with returns, a sales pipeline, HR and payroll, expenses,
and reporting.

This document is for developers working on the codebase. It covers how to run
it, how it is put together, the rules the code relies on, and how it is
deployed.

## Contents

- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Domain rules](#domain-rules)
- [Product behaviour worth knowing](#product-behaviour-worth-knowing)
- [Deployment and database cost](#deployment-and-database-cost)
- [Offline use](#offline-use)
- [Receipt printing](#receipt-printing)
- [Performance notes](#performance-notes)
- [Known gaps](#known-gaps)

## Tech stack

| Area | Technology |
| --- | --- |
| API | NestJS, Prisma 7 (`@prisma/adapter-pg`), PostgreSQL |
| Web | Next.js (App Router), React, Tailwind CSS, TanStack Query, Recharts |
| PDFs | `@react-pdf/renderer`, loaded on demand |
| Notifications | Web Push (VAPID) through a service worker |
| Runtime | Bun for scripts and builds, Node `>=24.20 <25` (see `.nvmrc`) |
| Hosting | API on Render, database on Neon, web app deployed separately |

## Repository layout

```
apps/
  api/             NestJS REST API
    prisma/        schema.prisma, migrations/, seed.ts
    src/           one folder per feature module (see Architecture)
  web/             Next.js staff-facing UI
    src/app/       routes; authenticated screens live under (app)/
    src/components UI, grouped by feature
    src/lib        API clients (*-api.ts), hooks, formatting, printing
    public/sw.js   service worker (push notifications only)
tools/
  print-helper/    Windows helper for raw ESC/POS receipt printing
```

Each app has its own `package.json`. The root `package.json` only defines
workspaces and convenience scripts that proxy into `apps/api`.

## Getting started

### Prerequisites

- [Bun](https://bun.sh)
- Node 24.20 or later (`nvm use` reads `.nvmrc`)
- PostgreSQL you can create and migrate a database in

### Setup

1. **API environment.** Copy `apps/api/.env.example` to `apps/api/.env`. At
   minimum set `DATABASE_URL` and `JWT_SECRET`.
2. **Web environment.** Copy `apps/web/env.example` to `apps/web/.env.local`
   (it sets `NEXT_PUBLIC_API_URL=http://localhost:4000`).
3. **Install dependencies** in each app:
   ```
   cd apps/api && bun install
   cd apps/web && bun install
   ```
4. **Migrate and seed** from the repo root:
   ```
   bun run prisma:migrate
   bun run prisma:seed
   ```
   The seed creates an admin user and a few PIN-login staff accounts. It
   prints the admin credentials when it finishes; see `apps/api/prisma/seed.ts`.
5. **Run both apps**, in separate terminals, from the repo root:
   ```
   bun run dev:api
   bun run dev:web
   ```
   The API listens on `:4000` (Swagger UI at `/docs`), the web app on `:3000`.

### Root scripts

| Script | What it does |
| --- | --- |
| `bun run dev:api` | Start the API in watch mode |
| `bun run dev:web` | Start the Next.js dev server |
| `bun run prisma:migrate` | `prisma migrate dev` (creates and applies migrations locally) |
| `bun run prisma:generate` | Regenerate the Prisma client into `apps/api/generated/` |
| `bun run prisma:seed` | Seed an admin and staff accounts |

The generated Prisma client is not committed. Run `prisma:generate` after
cloning and after every schema change.

## Configuration

### API (`apps/api/.env`)

| Variable | Purpose | Default |
| --- | --- | --- |
| `DATABASE_URL` | Runtime connection string. On Neon, use the pooled (`-pooler`) URL. | required |
| `DIRECT_URL` | Direct, non-pooled URL used only by `prisma migrate`. Falls back to `DATABASE_URL`. | unset |
| `DB_POOL_MAX` | Maximum pooled connections held by the API. | `5` |
| `JWT_SECRET` | Signs access tokens. Use a long random value. | required |
| `JWT_ACCESS_TOKEN_TTL` | Access token lifetime. | `15m` |
| `ADMIN_INACTIVITY_MINUTES` / `STAFF_INACTIVITY_MINUTES` | Idle time before a session expires, per role. | `30` / `60` |
| `SESSION_MAX_HOURS` | Absolute session lifetime regardless of activity. | `12` |
| `PORT` | HTTP port. | `4000` |
| `WEB_ORIGIN` | Comma-separated web origins allowed to call the API (CORS and origin check). | `http://localhost:3000` |
| `COOKIE_SAMESITE` | `lax`, `strict` or `none`. Set `none` only if web and API are on different sites. | `lax` |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web Push keys. Generate with `bun run vapid:generate` in `apps/api`. Push is disabled when the keys are missing. | unset |
| `REMINDER_HOUR` | Local hour (0-23) for the daily lead follow-up summary and reorder summary. | `8` |
| `REMINDER_TIMEZONE` | Time zone for those schedules and reorder day boundaries. | `Africa/Nairobi` |
| `BUSINESS_TIMEZONE` | Time zone for dashboard day boundaries. | `Africa/Nairobi` |

Never commit `.env` files. They are git-ignored; if one ever leaves your
machine, rotate `JWT_SECRET` and the VAPID keys.

### Web (`apps/web/.env.local`)

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Base URL of the API. |

## Architecture

### API

`apps/api/src` has one NestJS module per feature, registered in
`app.module.ts`: `auth`, `users`, `products`, `brands`, `categories`, `units`,
`inventory`, `documents` (quotes, invoices, receipts, delivery notes,
returns), `customers`, `contacts`, `leads`, `hr`, `payroll`, `expenses`,
`dashboard`, `analytics`, `settings`, `audit` and `notifications`.
Shared helpers are in `common/` (money rounding, validators, paging, local
time helpers, the Prisma exception filter).

`main.ts` sets up, in order: CORS and a cross-origin write check driven by
`WEB_ORIGIN`, the Prisma exception filter, a global `ValidationPipe`
(`whitelist` and `transform` on), `GET /health` (no database access) and the
Swagger UI at `/docs`.

### Authentication and authorization

- Admins sign in with email and password; cashiers and staff can sign in with
  a PIN (`POST /auth/login/pin`).
- Sessions are `httpOnly` cookies: a short-lived access token (`pava_at`) and a
  refresh token (`pava_rt`, only sent to `/auth`). Page scripts never see
  either. Session cookies are set in `auth/session-cookies.ts`.
- Idle and absolute session limits come from the inactivity and
  `SESSION_MAX_HOURS` settings. The web app also signs the user out on
  inactivity.
- Roles are `ADMIN` and `STAFF`. Access to areas is controlled by per-user
  permissions on the `Module` enum in `schema.prisma` (`POS`, `PRODUCTS`,
  `INVENTORY`, `LEADS`, and so on). Routes are protected with the guards and
  decorators in `apps/api/src/auth/`.
- Sensitive actions write to the audit log (`audit/audit.service.ts`). Do not
  remove or skip audit calls when refactoring.

### Web

- Routes under `src/app/(app)/` are the authenticated screens; `login/` is
  public. `/` is only a doorway that forwards to the last page visited (or the
  dashboard, or sign-in). The shell (sidebar, top bar) is in `components/shell/`.
- Each backend area has a typed client in `src/lib/*-api.ts`, built on
  `lib/api.ts`. Auth state is in `lib/auth-context.tsx`.
- POS data uses TanStack Query (`QueryClientProvider` in
  `app/providers.tsx`). Other lists use the `useServerTable` hook.
- Per-user client state (the cart, till) is persisted with
  `lib/use-persisted-state.ts`.

### Background work in the API

There is no job queue. The API runs a few in-process timers, so they only run
while the process is up. They are written so that an idle shop causes **no**
database traffic (see [Deployment and database cost](#deployment-and-database-cost)).

| Job | Where | When it runs |
| --- | --- | --- |
| Lead follow-up summary (push) | `notifications/follow-up-reminder.service.ts` | Once a day at `REMINDER_HOUR`; once ~30 s after boot if the hour has passed; a few retries after a temporary push failure; a debounced check when a lead is saved with a follow-up due today. Each user is sent at most one summary a day (`FollowUpDigest`). |
| Reorder alerts | `inventory/reorder-alert.service.ts` | About 2 minutes after any stock change (debounced), once a day at `REMINDER_HOUR`, and once ~60 s after boot. Alerts are de-duplicated in `ReorderAlert`; the morning summary in `ReorderDigest`. |

Do not reintroduce fixed-interval polling (`setInterval`) that touches the
database. Schedule to a specific time or react to an event instead.

### Reorder planning

`inventory/reorder.service.ts` replays the last 90 days of inventory movements
backwards from current stock to estimate demand per item, then
`reorder.calc.ts` turns that into a reorder point and suggested quantity.
Movements are summed per product, local day and type in SQL. The result is
cached for 3 minutes in memory. Anything that changes stock or planning inputs
must call `ReorderService.invalidate()`: `InventoryService` already does this
through `ReorderAlertService.stockChanged()` for receipts, sales, adjustments,
returns and opening balances, and `ProductsService` does it for product and
family edits. If you add a new code path that writes `stockQuantity`, route it
through `InventoryService` or call `stockChanged()`.

## Domain rules

These are conventions the code depends on. Please follow them.

- **Money and quantities are whole numbers.** Prices and every stored amount
  are whole Kenyan shillings (no cents), and quantities are whole units. All
  such Prisma columns are `Int`. DTOs reject decimals at the API boundary
  (`common/validation/money.validator.ts#IsMoney` for money, `@IsInt()` for
  quantities), and `common/money.ts#roundMoney` cleans up float drift from
  arithmetic (FIFO costing, transport allocation, payroll) before anything is
  persisted.
- **Phone numbers** are stored as 10-digit Kenyan mobile numbers (`07xxxxxxxx`
  or `01xxxxxxxx`). `common/validation/phone.validator.ts` normalises
  `+254`/`254` prefixed and spaced input before validating.
- **FIFO costing.** Stock is held in cost batches. Sales draw down batches
  oldest first through `InventoryService.consumeFifo`, so batches and
  `Product.stockQuantity` never drift apart. Do not edit `stockQuantity`
  directly.
- **Delivery notes are not stored.** They are built on screen from their order
  (`buildDeliveryNoteViewModel`) and carry the order's number under the delivery
  note prefix from Settings (`INV-2026-000012` prints and shares as
  `DN-2026-000012`); the order's own number appears as the order reference. The
  API still has `POST /documents/:id/delivery-note` that stores one with its own
  sequence, but the web app does not use it.
- **Soft delete is the default.** `Customer`, `Product`, `Lead` and `Contact`
  have an `active` flag. The normal `DELETE` route archives; `POST :id/restore`
  reverses it. `Employee` uses `employmentStatus: TERMINATED` instead.
- **Hard delete is separate and narrow.** `DELETE :id/permanent` exists for
  Product, Customer, Lead, Contact and Employee. It is admin-only, works only
  on already-archived records, and is refused if the record has real history
  (sales, ledger entries, price history, stock movements, payroll). It exists
  to clean up mistakes, not to erase business history.
- **No product photography.** The POS renders products as category icons
  (`components/pos/ProductIcon.tsx`). There is no image upload and none should
  be added without a real product-photography workflow.
- **Migrations are additive.** Do not make destructive schema changes without
  a plan for existing production data.

## Product behaviour worth knowing

Read this before changing the till or back office.

**POS (desktop).** Products are a narrow list of compact rows, and the cart
takes the rest of the screen: customer picker, lines, fulfilment, total and
*Complete sale*. A bar under the product list holds the rest:

- **M-Pesa** selects that payment type straight away.
- **Cash** and **Split** open a dialog: amount received and, when it exceeds
  the total, whether to give change back (only out of cash) or keep it on the
  customer's account as credit.
- **Pay later**, **Transport**, **Hold**, and **Recent sales** (the last 15,
  opening the usual document view for reprinting).
- **Make quote** saves the cart as a quote: no stock taken, nothing paid. Shown
  only to users with the Quotes or Invoices permission.

On a phone the cart is a single full-screen sheet.

**Fulfilment and transport** are always the cashier's choice, in the cart,
quote form (transport), quote-to-invoice (fulfilment) and invoice-edit
requests. Fulfilment starts from the shop's stock as a suggestion, with
*All from shop* and *All from elsewhere* shortcuts. The cart is kept in the
browser per signed-in user so a refresh or idle sign-out doesn't lose it, and
removing a line offers Undo.

**Backorders on invoice edits.** Approving an edit request that adds units
beyond what is on the shelf does not simply refuse. The admin sees what is
short and chooses, per line, how much comes from the shop; the rest is marked
as sourced elsewhere (optionally naming the source). A line cannot go below
what it already took from the shelf, and asking for more than the shelf holds
is refused. What was sourced elsewhere is kept in the audit log.

**Adding stock without a cost.** In *Adjust stock* the unit cost is optional.
Left blank, it uses the product's last cost or is stored as "no cost recorded".
Those units are flagged on the product and inventory pages, and profit on them
looks higher than it really is because their cost counts as zero. Receiving
stock from a supplier always requires a cost.

**Customer credit held by the shop.** Money a customer leaves with the shop
(overpayment, or change they didn't take) is a negative balance on their
account, recorded with how it arrived. An admin can *Release credit* from the
customer screen, either **given to the customer** (cash or M-Pesa) or
**cleared and kept by the owner**, always with a note. It is a ledger entry
(`CREDIT_RELEASED`) plus an audit record, never a sale or shop income. The
dashboard's *Held for customers* card shows the total, the number of customers
and how long the oldest has been held.

## Deployment and database cost

Production runs the API on Render, PostgreSQL on Neon, and the web app
separately. Notes that matter when touching deployment or background work:

- **Neon suspends compute after 5 idle minutes**, and compute hours are metered
  against the plan allowance. Anything that queries the database at an interval
  shorter than that keeps it awake all day. This was the cause of the earlier
  compute overrun. See [Background work](#background-work-in-the-api).
- **Use the pooled URL at runtime and a direct URL for migrations:** set
  `DATABASE_URL` to the `-pooler` endpoint and `DIRECT_URL` to the direct one.
  `prisma.config.ts` uses `DIRECT_URL` when set.
- **The API does not connect to the database at boot.** The first query
  connects, so a restart or deploy doesn't wake Neon by itself (the follow-up
  and reorder checks make one query shortly after boot).
- **`GET /health` never touches the database.** It is safe for an uptime
  pinger. A pinger keeps the Render process alive, which is also what keeps the
  in-process timers running.
- Keep the Render and Neon regions the same to minimise query latency.
- The first request after Neon resumes from suspension waits for the compute to
  start. This is expected.

### Verifying that idle really is idle

Run the API against a local Postgres with `log_statement=all`, leave it with
no requests for 15 minutes after boot, and confirm no queries appear apart from
the boot checks. In production, watch the Neon console's Monitoring tab for
suspended periods overnight.

## Offline use

The till keeps working when the internet drops. This is deliberately narrow: only
**ringing up a plain walk-in sale** and **looking up prices** work offline.
Everything else (customers' accounts, pay-later, transport, holds, quotes,
returns, edits, stock changes, reports) needs a connection and says so.

How it works:

- **App shell.** `apps/web/public/sw.js` caches the hashed `/_next/static/*`
  files and, as a fallback only, the last page loads. Page loads always try the
  network first (cached copy used if there is no answer within 4 s). API calls
  are never cached by the service worker. It is registered on every production
  load (`app/providers.tsx`).
- **Catalogue on the device.** `lib/offline.ts` keeps all active products,
  categories and the business settings in IndexedDB (never cost prices),
  refreshed at most every 5 minutes while online. When the server can't be
  reached, product lists and search fall back to that copy (`listProducts`,
  `listCategories`). Offline sales reduce the device's stock counts so the next
  offline sale sees them.
- **Sale outbox.** `lib/outbox.ts`. Checkout sends the sale with a client
  generated `clientId` and a 15 s timeout. If the server can't be reached the
  sale is written to the outbox first, a receipt with a temporary number
  (`OFF-XXX-0001`) is printed, and the sale is sent when the connection returns
  (on `online`, when the app is opened or shown, and every minute while waiting),
  oldest first, only by the person who rang it up. Printing works offline because
  the print helper runs on localhost.
- **Idempotency (server).** `Document.clientId` is unique. `POST
  /documents/pos-sale` returns the existing sale if it sees the same `clientId`
  again, so retries, double taps and requests that timed out after succeeding can
  never record a sale twice.
- **Replay rules (server).** A sale sent with `offline: true` is recorded even if
  the shelf count has since dropped (the goods already left) and the shortfall is
  flagged through the usual `document.stock_override_used` audit entry. The sale is
  stamped with the time it happened (rejected if more than 30 days old), the audit
  entry has `source: offline`, the temporary number and whether the server's total
  differs from the receipt printed. A sale the server refuses (for example a
  discount over the limit) stays in the outbox marked "needs attention" with the
  reason; nothing is ever dropped silently.
- **Sign-in.** The last signed-in person is remembered on the device (an explicit
  *Sign out* forgets them; the idle timer and an expired session don't). If the
  server can't be reached when the app opens, it opens in **offline till mode** as
  that person, limited to `/pos` (prices and walk-in sales). Back online, the session
  is re-checked and a stale one goes to sign-in. Idle sign-out is also paused while
  offline or while sales are waiting. Signing in itself needs the server.

Things to keep in mind when changing the till:

- Anything added to the checkout payload must be safe to send later, or must block
  offline mode in `offlineBlocker()` (`app/(app)/pos/page.tsx`).
- The offline receipt is built from the cart's own totals (`buildOfflineReceipt`);
  keep it in step with how the server prices a plain sale.

## Receipt printing

Receipts can print straight to a USB thermal printer from the browser using the
Windows helper in `tools/print-helper/`, which sends ESC/POS bytes to the print
spooler as a raw job (no print dialog, automatic cut, logo). Setup, the
allowed-origins setting and a no-printer dry-run mode are in
[`tools/print-helper/README.md`](tools/print-helper/README.md). The browser
side is in `apps/web/src/lib/escpos*.ts` and `print-thermal.ts`.

## Performance notes

- POS product browsing, search and categories use TanStack Query. Anything that
  changes stock invalidates the `['pos-products']` queries so the till
  refreshes.
- The PDF renderer is loaded on demand (`await import('lib/pdf/document-pdf')`)
  rather than bundled into every screen.
- Calls that only need the newest rows pass a `limit` (POS product lists, the
  returns dialog's sale search) instead of downloading everything.
- The unread-notification count refreshes on tab focus, on in-app events and on
  push messages, with a slow 4-minute fallback poll that pauses while the tab is
  hidden.
- Indexes for document lists (type, status, date), customer, paid date, source
  document and items by product come from the `performance_indexes` migration.

## Known gaps

- No automated tests yet.
- A stock batch's unit cost can't be corrected after the stock is received or
  adjusted in, so units added without a cost stay uncosted.
- Dashboard and analytics sums over long date ranges load every sale in the
  range into memory. Fine at current volume; move them into SQL `GROUP BY` if
  it grows.
- API hardening (rate limiting, `helmet`) hasn't been done.
- Audit writes are awaited inside requests (one extra round trip each). They
  are deliberately not deferred, so no entry can be lost.
