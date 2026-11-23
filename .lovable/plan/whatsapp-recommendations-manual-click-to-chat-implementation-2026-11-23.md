# WhatsApp Recommendations (manual Click-to-Chat) — Implementation Plan

## What exists today (verified)

| Area | Existing | Finding |
|---|---|---|
| Customers | `public.customers` (id, user_id, name, phone, saved_addresses, email, address, referral_*) — 20 rows | No order count column. No WhatsApp consent field. |
| Order count | `public.app_orders` (customer_phone, status, created_at) — 36 delivered | Count is derived per phone (delivered orders); no new column needed. |
| Consent | `notification_preferences.promotional_offers` (keyed by user_phone) | This is push-notification consent, not WhatsApp consent. **Missing field.** |
| Products | `public.catalog_items` (id, name, price, mrp, stock, image, category, is_deleted, expiry_date) — 6 live | "Active" = `is_deleted = false AND stock > 0 AND (expiry_date is null OR expiry_date >= today)`. |
| Product URL | `src/lib/share-link.ts` → `https://kartogoapp.lovable.app/product/<id>` | Reuse as is. |
| Recommendations | `customer_product_preferences`, `customer_replenishment_predictions`, Buy Again logic | Reuse to pick the product per customer; fallback: most-bought category, then best seller. |
| Admin auth | Signed admin token + `requireAdminPermission(token, permission)` / `requireActiveAdmin` in `src/lib/admin-session.server.ts`; permission map in `src/lib/admin-access.shared.ts`; sub-admin permissions | Reuse. Admins are not Supabase Auth users, so RLS cannot identify them — all access goes through server functions. |
| Admin nav | `NAV` list in `src/routes/admin.tsx` (e.g. Customers entry) | Add one entry. |
| Audit | `admin_audit_log` | Reuse for sent/skip actions. |
| Promo columns | None named `promo_sent_at` / `promo_skipped` exist anywhere | No conflict. |

## Schema conflicts / deviations to note
- **Edge Functions:** this project's rules forbid new Supabase Edge Functions (TanStack Start). The two "functions" will be server functions (`createServerFn`) — same security, no extra infrastructure.
- **Consent:** added as `whatsapp_marketing_opt_in` / `whatsapp_marketing_opt_in_at`; `notification_preferences.promotional_offers` is NOT reused (push consent). Existing customers stay opted out.
- **Audience:** customers who have never submitted an order. Any `app_orders` row (placed, packed, out_for_delivery, delivered or cancelled) excludes them, matched by normalised phone (`app_orders.customer_phone` = `customers.phone`; app_orders has no customer id column).
- **24-hour eligibility (assumption):** customer account created more than 24 hours ago, so brand-new sign-ups mid-checkout are not messaged.
- **Daily limit day boundary:** India time (Asia/Kolkata), midnight reset.
- **Assumption:** each customer receives this promo once (sent or skipped removes them from the queue). Can add a re-eligibility window later.

## Execution order

### 1. Database migration (new)
- `customers` (idempotent `ADD COLUMN IF NOT EXISTS`): `whatsapp_marketing_opt_in boolean not null default false`, `whatsapp_marketing_opt_in_at timestamptz`, `promo_sent_at timestamptz`, `promo_skipped boolean not null default false`. Selected product, admin and campaign live in `admin_audit_log` (no extra columns).
- Partial index on `promo_sent_at` (for the daily count) and on consent + not sent + not skipped (for the queue).
- SQL function `claim_whatsapp_promo(p_customer uuid, p_admin text, p_product text)` (SECURITY DEFINER):
  - `pg_advisory_xact_lock(hashtext('kartogo_whatsapp_promo'))` — serializes simultaneous admins.
  - Lock the customer row `FOR UPDATE`; fail if not consented, already sent, or skipped (duplicate prevention).
  - Count `promo_sent_at` within today (IST); fail with "Daily limit of 25 reached" if ≥ 25.
  - Re-check no order exists for the phone and product is still active.
  - Set `promo_sent_at = now()`, `promo_sent_by`, `promo_product_id`, and insert the `admin_audit_log` row (customer id, admin id, product id, campaign `registered_not_ordered`, action `sent`, timestamp) in the same transaction; return remaining count.
- SQL function `skip_whatsapp_promo(p_customer uuid, p_admin text)` — same lock, sets `promo_skipped = true` and writes the `skipped` audit row in the same transaction; does not count toward the limit.
- `REVOKE EXECUTE ... FROM public, anon, authenticated`; `GRANT` only to `service_role`. No new RLS policies opening `customers`; existing locked-down access unchanged.

### 2. Permission (modify)
- `src/lib/admin-access.shared.ts`: new permission `whatsapp_promos`, path `/admin/whatsapp-recommendations`. Main admin has it automatically; sub-admins only if granted on the Sub-admins page.

### 3. Server functions (new) — `src/lib/whatsapp-promo.functions.ts` + helper `src/lib/whatsapp-promo.server.ts`
- All functions call `requireActiveAdmin` + `requireAdminPermission(..., "whatsapp_promos")`; no public route exposes customer data.
- `listPendingPromosFn(adminToken)`: opted-in, not sent, not skipped, account older than 24h, zero orders, valid WhatsApp number; returns the suggested product plus a short list of alternative active products, and today's sent count / remaining of 25.
- Suggestion order: `customer_product_preferences` / `customer_replenishment_predictions` / Buy Again logic (reads customer_events where no orders exist) → most-bought category → best-selling active product.
- `updatePromoStatusFn({ adminToken, userId, action: 'sent' | 'skip', productId })` (zod-validated): `sent` → `claim_whatsapp_promo`, `skip` → `skip_whatsapp_promo`. Returns the new sent-today count.
- List is paginated (25 per page) with name/phone search; returns only id, name, phone, signup date, suggested product id/name/URL, plus summary counts (sent today, pending, skipped).
- Phone numbers are returned only to authorised admins (needed for the chat link).

### 4. Message + link helper (new) — `src/lib/whatsapp-link.ts` (browser-safe)
- Normalise phone to E.164 digits with country code, no "+" (reuse existing phone normaliser, India default). Invalid or missing numbers return null: no link is built and the customer is listed as "invalid number" with only Skip available.
- Personalised text: "Hi {name}! 👋 / Welcome to Kartogo! / We thought you might like our {product}. / Explore the product here: {product URL} / Happy shopping! 🛍️ / Team Kartogo (line breaks)". Name trimmed/sanitised; text URL-encoded.
- Link: `https://wa.me/<digits>?text=<encoded>` — free Click-to-Chat, no WhatsApp Cloud API.

### 5. Admin page (new) — `src/routes/admin.whatsapp-recommendations.tsx`, nav entry "WhatsApp Recommendations" in a Customer Growth group in `src/routes/admin.tsx`
- Summary cards: "Messages Sent Today: X / 25", Daily limit 25, Pending, Skipped; short how-to-send instructions.
- Table on laptop (Name, Phone, Signup date, Recommended product dropdown, Actions); stacked cards on phone.
- List cards: customer name, masked phone, product picker (suggested product preselected, admin can change it), message preview that updates with the chosen product.
- Buttons side by side: **Open WhatsApp** (opens link in new tab; never marks as sent), **Mark as Sent**, **Skip** — both with a confirmation dialog; row removed only after the server confirms. Warnings for invalid phone, no product selected, limit reached; loading, empty and error states.
- Mark as Sent disabled at 25; server error message shown if another admin used the last slot; list refreshes after each action.
- Uses existing admin layout, cards, buttons and toast.

### 6. Consent capture (new, minimal)
- Unticked-by-default checkbox "Send me product offers on WhatsApp" (customers can turn it off any time) in the customer's existing notification preferences area on Profile, saved through a server function that checks the customer session and sets consent + timestamp. No other customer page changes.

### 7. Tests (new)
- `whatsapp-link.test.ts`: phone normalisation, encoding, URL format.
- Rule tests: non-opted-in excluded; account under 24h excluded; customer with any order (including cancelled) excluded; invalid number gets no link; deleted/out-of-stock product never suggested and rejected on send; admin-changed product saved and audited; opening WhatsApp leaves status unchanged; sent/skip write audit rows; 25th send succeeds, 26th fails (IST day); 5 parallel claims for the last 2 slots → exactly 2 succeed; same customer marked twice → second fails.
- Browser check: sub-admin without permission is refused; full admin opens page, marks one sent and one skipped; test data cleaned.

## Impact on existing features
- Adds columns with safe defaults to `customers`; existing reads/writes unaffected.
- No changes to orders, checkout, push notifications, partner or other admin pages beyond one nav item and one permission.
- Database functions are callable only from the server.
