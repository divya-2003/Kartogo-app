# Kartogo WhatsApp Recommendations — complete implementation plan

## Result and scope

Add **Customer Growth → WhatsApp Recommendations** to the existing admin panel for the **Registered but Not Ordered** campaign (`registered_not_ordered`). Customers voluntarily opt in, become eligible 24 hours after registration if they have never submitted an order, and receive a product suggestion. An authorized admin opens a personalized WhatsApp chat, sends manually, then explicitly confirms **Mark as Sent** or **Skip** in Kartogo.

Use only free `https://wa.me/` links, existing TanStack Start server functions, existing authentication, and the existing database. No paid messaging API, automatic sending, bulk tools, Edge Functions, new infrastructure, or duplicate customer/product/order/audit tables. No unrelated portal changes.

## Existing foundations verified in this inspection

- `customers` already has all four required consent/status fields with the requested types and defaults. All 20 current customers are opted out, with no sent/skipped records. No extra columns, consent backfill or duplicate tables are needed; the previous plan's missing-field claims are obsolete.
- Customer campaign identity is `customers.id`. `user_id` is nullable; current customer authentication resolves signed customer tokens by verified phone. `app_orders` has no customer/user UUID, only `customer_phone`. Existing `wa_customer_has_order` also checks historical mobile numbers through `mobile_number_changes` and `customers.user_id`.
- `placeOrderFn` saves validated orders as `placed`; failed insertion is rolled back. Lifecycle: placed, packed, out_for_delivery, delivered, cancelled. Current rows are delivered/cancelled. Every persisted matching order excludes its customer, including cancelled/refunded orders. Unsaved checkout attempts, carts and reservations do not count. No order-count field is required.
- Existing SQL: `wa_phone_key`, `wa_customer_has_order`, `wa_pending_customers`, `wa_promo_sent_today`, `claim_whatsapp_promo`, `skip_whatsapp_promo`, `wa_set_consent`, `guard_wa_customer_fields`; queue/sent indexes exist. Claim/skip already lock and write audit transactionally. Reuse and strengthen, not recreate.
- `catalog_items` has the requested product fields; seven products currently meet the active conditions. Shared `recommendations.server.ts` catalog loading includes bundled fallback items and omits expiry checks: this campaign must strictly intersect recommendations with live active database products.
- Product/category preferences, replenishment, Buy Again and popularity already exist. Never-ordered customers normally lack purchase-based category/replenishment history; use available interest, then valid most-bought category, then active best seller without inventing history.
- Admin authentication/active-account permission checks exist in `admin-session.server.ts` and `admin-access.shared.ts`. Existing navigation has no WhatsApp entry or Customer Growth group. Reuse the existing shell and permission editor.
- Profile (`/menu`) links Settings to `/notifications`; existing promotional preferences are push-only. Add separate WhatsApp consent there without changing push behavior.
- `admin_audit_log` already supports all requested metadata. `recordAudit` is best-effort, so campaign audit must remain inside the status transaction. Customers/audit have RLS; campaign mutation RPCs are service-role-only and a trigger guards customer WhatsApp fields.
- `share-link.ts` already generates public `/product/<id>` links. `phone.ts` already uses `libphonenumber-js`, but some helpers accept permissive fallbacks: add strict campaign validation without changing global login behavior.

## Execution order

### 1. Record scope and establish campaign rules

Track work/tests in `roadmap.md` and record the server-only boundary in `AGENTS.md`. Preserve all unrelated flows.

Create browser-safe campaign helpers/types in `src/lib/whatsapp-promo.shared.ts` and `src/lib/whatsapp-link.ts` before their consumers. Centralize campaign name, 24-hour threshold, India timezone, fixed daily maximum 25, strict phone validation, message formatting and active-product rules.

Strictly validate international country-code numbers with the existing library; support documented legacy Indian 10-digit storage, but never guess foreign countries. Reject invalid/ambiguous numbers, then strip formatting/`+` and encode the full message. Reuse `productShareUrl` and the public origin.

### 2. Apply only necessary database corrections

Create one idempotent migration in `supabase/migrations/`; apply exact SQL through the migration tool. No duplicate fields, extra metadata columns or new tables.

Reuse/modify as needed:
- `wa_phone_key` / `wa_customer_has_order`: retain canonical current/historical phone matching and exclusion for **every persisted order**, including cancelled/refunded rows; avoid empty-number matches.
- `wa_pending_customers`: align queue filtering, search, stable pagination and identity deduplication with mutation eligibility. Require explicit consent and timestamp, age at least 24 hours, unsent/unskipped state, valid record and no submitted order. A canonical phone already sent/skipped must not reappear through another record.
- `wa_promo_sent_today`: use `[India midnight, next India midnight)` against `promo_sent_at`, not browser timezone.
- `claim_whatsapp_promo`: retain advisory transaction lock plus customer row lock; recheck eligibility, selected active product, duplicates and count; enforce a fixed 25 regardless of any caller-supplied limit; set server timestamp and insert audit atomically. Server-side strict phone validation is also mandatory before calling it.
- `skip_whatsapp_promo`: retain locking, duplicate rejection and atomic skip/audit; use a safely identified customer even when the number is unsuitable, without incrementing sent count.
- `wa_set_consent`: resolve the caller's customer through the existing verified customer session, set timestamp on explicit opt-in, preserve it for unchanged consent, and withdraw immediately. Serialize with campaign mutation row locking so withdrawal and confirmation cannot overwrite each other.
- `guard_wa_customer_fields`: preserve prevention of client-written campaign status or forged consent; review for insert/update compatibility with existing profile writes.

Retain existing indexes; add only justified missing indexes. Restrict campaign RPCs to `service_role`, revoke public/customer execution, preserve RLS and derive audit actor from verified admin identity.

### 3. Add the dedicated permission

Add `whatsapp_promos` and `/admin/whatsapp-recommendations` mapping in `src/lib/admin-access.shared.ts`. Existing super-admin logic grants founder access; sub-admins require explicit permission. Every operation uses `requireAdminPermission(token, 'whatsapp_promos')`, which checks active status through the same mechanism as `requireActiveAdmin`. No new authentication or signature-only checks.

### 4. Implement server functions and recommendation selection

New files:
- `src/lib/whatsapp-promo.server.ts`: server-only eligibility, batched recommendation reads, summaries and RPC orchestration.
- `src/lib/whatsapp-promo.functions.ts`: validated `createServerFn` wrappers, safe to import from the UI.

Operations:
1. **Fetch Pending Recommendations**: authorized paginated/searchable customer queue, exact pending/skipped totals, sent-today counter, and active product choices. Return only customer ID/name/phone/signup date and suggested product ID/name/public URL; product choices expose only needed ID/name/price/category/URL fields. Apply strict phone screening before presentation and pagination totals; scan in bounded batches rather than silently truncating to an arbitrary first 500 customers. Searchable product pagination must make every active product selectable as the catalog grows.
2. **Prepare WhatsApp chat**: revalidate current consent/eligibility and product before opening, return the personalized link, and never write sent/skipped state. Reject stale selections or invalid numbers. Limit-reached state blocks further chat preparation and confirmation.
3. **Update Promotional Status**: validated `{ token, userId, action, productId }`, where `userId` is explicitly the existing `customers.id`, not `auth.users.id`. Actions are only `sent` or `skip`; product required and validated for sent, optional for skip. Execute the transactional RPC and return confirmed counts/results. Duplicate or failed requests must not produce false success.
4. **Read/Update WhatsApp Consent**: customer-only session authorization, no arbitrary customer ID/phone accepted from the browser; persist through existing consent fields/RPC and return confirmed consent state.

Rank interest → valid most-bought category → existing best sellers; reuse replenishment/Buy Again only when applicable without relaxing eligibility. Break ties deterministically. No sales: real active-product fallback; no active products: disable sending. Batch reads without per-customer rebuilds.

Load privileged clients only in authorized server code; expose no credentials, tokens in URLs, extra customer data or raw database errors. Use `useServerFn`, never protected public SSR loaders.

### 5. Add separate voluntary customer consent

Modify only the relevant settings area in `src/routes/notifications.tsx`, preferably with a focused `src/components/WhatsAppConsent.tsx`:
- Unchecked **Get product recommendations and offers on WhatsApp** control, separate from push options.
- Explicit voluntary wording and withdrawal option; registration alone is not consent.
- Load saved state, show save progress/errors, and reflect changes only after confirmed persistence.
- Signed-out customers see the existing sign-in experience; customers can affect only their own record.
- Preserve all current push/device controls and settings.

### 6. Build the admin page and navigation

Create `src/routes/admin.whatsapp-recommendations.tsx`; modify `src/routes/admin.tsx` only for **Customer Growth → WhatsApp Recommendations** navigation. Reuse existing layout, tokens, buttons, selectors, dialogs, table and notifications. Add unique Kartogo page metadata.

Dashboard: **Messages Sent Today: X / 25**, Daily Limit 25, Pending Recommendations, Skipped Customers. Refresh on successful mutations and when the page regains focus; handle India midnight while the page stays open.

Pending table: Customer Name, Phone Number, Signup Date, Recommended Product dropdown, Actions. Include search, stable pagination, loading, retry/error and empty states; preserve selected products while interacting.

Keep actions side by side wherever they fit:
- **Open in WhatsApp**: freshly validated `wa.me` link in a new tab/app, personalized welcome/product/URL/sign-off text editable in WhatsApp. Handle blocked popups. Opening never removes a row, changes status or increments the counter.
- **Mark as Sent**: confirmation dialog after manual sending; revalidate server-side, await database confirmation, then remove row/update counters/show success. Failed writes keep the row and show an error.
- **Skip**: confirmation dialog; await atomic database success, remove row, refresh skipped total; never increment sent count.

At 25, block chat opening and sent confirmation while keeping Skip available. Include the requested short manual-send instructions and invalid-number/missing-product/daily-limit warnings. Use responsive table/card presentation without clipping or overlapping controls.

## Validation and acceptance

Add focused tests beside existing tests and run them, plus relevant regression tests. Cover all requested scenarios:
1. No consent never eligible; existing default false remains false.
2. Under 24 hours excluded; opted-in/no-order customer eligible exactly at and after 24 hours.
3. Delivered, cancelled-after-submission and refunded orders excluded, including historical-phone matching.
4. Carts, reservations and failed unsaved checkouts do not count as orders.
5. Missing/invalid phones rejected; legacy Indian and international valid numbers produce correct `wa.me` digits and fully encoded personalized text/public product URL.
6. Deleted, sold-out and expired products neither recommended nor accepted; expiry-today uses India date. Product override is persisted in audit.
7. Chat preparation/opening has no sent/skip/counter side effects; revoked consent or stale product prevents preparation/confirmation.
8. Confirmation writes server timestamp and audit together; audit failure rolls back status; failed writes keep UI rows.
9. Skip increments only skipped count; sent/skipped customers and equivalent phone identities do not reappear.
10. India midnight boundary/reset, successful 25th confirmation and rejected 26th.
11. Concurrent admins competing for the last slots cannot exceed 25; duplicate customer requests produce one status/audit result.
12. Missing/wrong permission, disabled admin, customer impersonation and direct unauthorized RPC attempts fail.
13. Customer consent can be granted/withdrawn only for the verified caller, persists across refresh and never changes push consent.
14. Existing cart/login, customer settings, recommendation and admin navigation behavior remains intact.

Verify signed-in opt-in → eligible queue → change product → inspect WhatsApp destination → confirm sent → database/audit/UI read-back, plus Skip/withdrawal. Use isolated fixtures; clean only test records and avoid consuming real slots in concurrency tests. Check phone/tablet/laptop, current 870px viewport and runtime errors.

Free Click-to-Chat cannot verify delivery/read status. Inspect destination/message without unwanted sends; sending remains manual. The enforced limit is 25 confirmed sent records, not independent WhatsApp activity.

## Completion

Deliver the independent module with verified test results and any real-device limitation stated accurately. No paid channel setup or additional credentials are needed. Save the implemented changes after checks; publishing remains separate. Until this plan is approved, no application or database changes will be made.
