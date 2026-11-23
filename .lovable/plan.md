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
- **Consent:** must be added; customers without consent are never listed. Existing customers start as not consented.
- **Daily limit day boundary:** India time (Asia/Kolkata), midnight reset.
- **Assumption:** each customer receives this promo once (sent or skipped removes them from the queue). Can add a re-eligibility window later.

## Execution order

### 1. Database migration (new)
- `customers`: add `whatsapp_marketing_consent boolean not null default false`, `whatsapp_consent_at timestamptz`, `promo_sent_at timestamptz`, `promo_skipped boolean not null default false`, `promo_skipped_at timestamptz`, `promo_sent_by text`, `promo_product_id text`.
- Partial index on `promo_sent_at` (for the daily count) and on consent + not sent + not skipped (for the queue).
- SQL function `claim_whatsapp_promo(p_customer uuid, p_admin text, p_product text)` (SECURITY DEFINER):
  - `pg_advisory_xact_lock(hashtext('kartogo_whatsapp_promo'))` — serializes simultaneous admins.
  - Lock the customer row `FOR UPDATE`; fail if not consented, already sent, or skipped (duplicate prevention).
  - Count `promo_sent_at` within today (IST); fail with "Daily limit of 25 reached" if ≥ 25.
  - Set `promo_sent_at = now()`, `promo_sent_by`, `promo_product_id`; return remaining count.
- SQL function `skip_whatsapp_promo(p_customer uuid, p_admin text)` — same lock, sets `promo_skipped`; does not count toward the limit.
- `REVOKE EXECUTE ... FROM public, anon, authenticated`; `GRANT` only to `service_role`. No new RLS policies opening `customers`; existing locked-down access unchanged.

### 2. Permission (modify)
- `src/lib/admin-access.shared.ts`: new permission `whatsapp_promos`, path `/admin/whatsapp-recommendations`. Main admin has it automatically; sub-admins only if granted on the Sub-admins page.

### 3. Server functions (new) — `src/lib/whatsapp-promo.functions.ts` + helper `src/lib/whatsapp-promo.server.ts`
- `listPendingPromosFn(adminToken)`: `requireAdminPermission(..., "whatsapp_promos")`; returns consented, not sent, not skipped customers with ≥1 delivered order, their order count, last order date, the recommended active product (name, price, image, URL), and today's sent count / remaining of 25.
- `markPromoSentFn(adminToken, customerId, productId)`: calls `claim_whatsapp_promo`; writes `admin_audit_log`.
- `skipPromoFn(adminToken, customerId)`: calls `skip_whatsapp_promo`; writes audit.
- Phone numbers are returned only to authorised admins (needed for the chat link).

### 4. Message + link helper (new) — `src/lib/whatsapp-link.ts` (browser-safe)
- Normalise phone to E.164 digits without "+" (reuse existing phone normaliser, India default).
- Personalised text: "Hi {first name}, based on your Kartogo orders we think you'll like {product} at ₹{price}. Order here: {product URL}". Name trimmed/sanitised; text URL-encoded.
- Link: `https://wa.me/<digits>?text=<encoded>` — free Click-to-Chat, no WhatsApp Cloud API.

### 5. Admin page (new) — `src/routes/admin.whatsapp-recommendations.tsx`, nav entry in `src/routes/admin.tsx`
- Header: "Sent today: X / 25" counter.
- List cards: customer name, masked phone, order count, recommended product photo/price, editable message preview.
- Buttons side by side: **Open WhatsApp** (opens link in new tab), **Mark as Sent**, **Skip**.
- Mark as Sent disabled at 25; server error message shown if another admin used the last slot; list refreshes after each action.
- Uses existing admin layout, cards, buttons and toast.

### 6. Consent capture (new, minimal)
- One toggle "Get offers on WhatsApp" in the customer's existing notification preferences area on Profile, saved through a server function that checks the customer session and sets consent + timestamp. No other customer page changes.

### 7. Tests (new)
- `whatsapp-link.test.ts`: phone normalisation, encoding, URL format.
- Rule tests: 25th send succeeds, 26th fails; two simultaneous claims for the last slot → exactly one succeeds; same customer marked twice → second fails; skipped customer cannot be sent; non-consented customer excluded; deleted/out-of-stock product never recommended.
- Browser check: sub-admin without permission is refused; full admin opens page, marks one sent and one skipped; test data cleaned.

## Impact on existing features
- Adds columns with safe defaults to `customers`; existing reads/writes unaffected.
- No changes to orders, checkout, push notifications, partner or other admin pages beyond one nav item and one permission.
- Database functions are callable only from the server.
