# Kartogo — production architecture notes

Concise reference for how the production-critical flows work. Complements
`README.md` (setup) and `ANDROID.md` (mobile build).

## Stack

- TanStack Start v1 (React 19, Vite 7), deployed to a Cloudflare Worker runtime.
- Lovable Cloud (Supabase Postgres) as the only datastore.
- App-internal backend logic lives in `src/lib/*.functions.ts` (`createServerFn`).
  Server-only helpers are `*.server.ts` and never reach the browser bundle.
- External/scheduled callers use file routes under `src/routes/api/public/*`
  and authenticate with `CRON_SECRET` (`src/lib/cron-auth.server.ts`).

## Identity and authorization

There is no Supabase Auth session for operational roles. Each portal gets an
HMAC-signed, role-scoped token minted server-side in
`src/lib/auth-tokens.server.ts`:

| Role     | Issuer                     | Secret                      |
| -------- | -------------------------- | --------------------------- |
| Customer | `issueCustomerToken`       | `CUSTOMER_SESSION_SECRET`   |
| Admin    | `issueAdminToken`          | `ADMIN_SESSION_SECRET`      |
| Driver   | `issueDeliveryToken`       | `DELIVERY_SESSION_SECRET`   |
| Supplier | `issueSupplierToken`       | `SUPPLIER_SESSION_SECRET`   |
| Printer  | `issuePrinterToken`        | `SUPPLIER_SESSION_SECRET` (distinct `role` claim) |

Rules enforced everywhere:

- Roles and identity come **only** from the verified token payload, never from
  request data. Every server function re-verifies before doing work.
- Tokens are role-separated: a supplier token can never pass as a printer or
  driver token (covered by `src/lib/auth-tokens.test.ts`).
- Sub-admin feature permissions live in `admin_access` and are checked in
  `src/lib/admin-access.functions.ts`; the admin shell also filters its menu.
- Every table in `public` is deny-by-default (RLS on, no anon/authenticated
  policies) except the intentionally public read surfaces: `catalog_items`
  (non-deleted rows), `combos`, `product_offers`, `promo_codes`,
  `delivery_slots`. All privileged access flows through the service-role client
  inside server-only code.

## Order lifecycle

Canonical statuses: `placed → packed → out_for_delivery → delivered`, with
`cancelled` reachable from any live state.

Three layers enforce the same rules:

1. `src/lib/order-status.ts` — pure, unit-tested transition table used by the
   app before a write.
2. `setOrderStatusFn` — re-reads the current status and rejects illegal moves.
3. Postgres trigger `validate_order_status_transition` — final authority;
   backwards moves and changes out of a terminal state raise an exception.

Every change is appended to `order_status_log` by the
`log_order_status_change` trigger, and to `admin_audit_log` by the server
function (`src/lib/audit.server.ts`).

## Inventory correctness

Stock never moves outside these three database functions, all of which take
row locks so concurrent checkouts cannot oversell:

| Moment    | Function            | Effect                                   |
| --------- | ------------------- | ---------------------------------------- |
| Placed    | `reserve_inventory` | `reserved +`, available `-`, current same |
| Delivered | `commit_inventory`  | `current -`, `reserved -`                 |
| Cancelled | `release_inventory` | `reserved -`, current same                |

`src/lib/inventory.server.ts` wraps them and additionally decrements the
shelf count `catalog_items.stock` on delivery. Reservations are recorded per
order in `inventory_reservations`, so a release is always exact — stock is
never fabricated or guessed. Products not yet tracked in any store's
inventory are skipped rather than blocking the order.

## Checkout safety

- All money is recomputed server-side from `server-catalog.server.ts`:
  prices, delivery fee, surge snapshot, promo discount and total. Client
  amounts are ignored entirely.
- Wallet payments debit through `adjust_wallet` (balance checked in SQL)
  **before** the order row is written.
- Stock is reserved before the insert; if either the reservation or the insert
  fails, the wallet charge and the reservation are rolled back.
- **Idempotency**: the client sends a `clientRequestId` per checkout attempt.
  `app_orders.client_request_id` has a unique index; a repeat request returns
  the original order, and a lost insert race resolves to the winner's order.

## Observability

- `admin_audit_log` — who changed what, when (service-role only).
- `order_status_log`, `driver_status_history`, `inventory_transactions`,
  `delivery_events`, `refund_audit_log`, `notification_log` — per-domain trails
  that already existed and are preserved.
- Best-effort side effects (push, dispatch, audit) are wrapped so they can
  never fail the user-facing operation; failures go to the server console.

## Performance

Hot-path indexes: `app_orders (status, created_at)`,
`app_orders (customer_phone, created_at)`, `order_status_log (order_id,
changed_at)`, `inventory_reservations (order_id, status)`.
The admin shell caches token verification for 10 minutes per tab so navigation
inside `/admin` does not wait on a round-trip.

## Tests

`bun run test` (vitest):

- `src/lib/order-status.test.ts` — lifecycle transitions and inventory effects.
- `src/lib/auth-tokens.test.ts` — signing, tampering, expiry, role separation.
- `src/lib/refund-credit.test.ts` — refund/GST credit maths.

## Deferred / candidates for later review

Documented only — **nothing here has been changed or deleted**:

- Legacy cleanup candidates: none of the currently populated tables are unused;
  earlier orphan tables were already removed. `driver_access_events` largely
  duplicates `driver_availability` and could be folded in after verifying no
  poller depends on it.
- `inventory_reservations` rows are never pruned; a scheduled archive job for
  `committed`/`released` rows older than ~90 days would keep the table small.
- Substitution preferences: the existing `order_substitutions` schema supports
  per-order suggestions but has no per-customer default preference column;
  adding one is an additive migration, not yet applied.
- Concurrency tests for `reserve_inventory` need a live Postgres connection and
  are not part of the unit suite.
