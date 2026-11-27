# Kartogo WhatsApp Recommendations

## Outcome and boundaries

Add **Customer Growth → WhatsApp Recommendations**, campaign **Registered but Not Ordered** (`registered_not_ordered`): register → voluntarily opt in → wait 24 hours → verify no submitted order → suggest/select product → open WhatsApp → send manually → explicitly confirm sent → atomic status/audit update → refresh daily count. Include Skip and a strict maximum of 25 confirmed messages per India calendar day.

Reuse existing authentication, customer/product/order/audit tables, recommendation signals, admin design and TanStack Start server functions. No paid WhatsApp API, automated/bulk sending, Edge Functions, new infrastructure, hardcoded production samples or unrelated portal changes.

## Verified existing functionality and conflicts

- `customers` already contains all four requested fields and defaults: `whatsapp_marketing_opt_in=false`, nullable consent timestamp, nullable `promo_sent_at`, `promo_skipped=false`. All 20 existing customers are opted out; none sent/skipped. The previous plan's missing-field claims are obsolete. Do not recreate fields or backfill consent.
- Campaign identity is UUID `customers.id`. Nullable `user_id` and unique `phone` already exist. Customer server functions validate signed customer tokens and resolve profiles through verified phone.
- `app_orders` contains `customer_phone`, not customer/user UUID. Existing `wa_customer_has_order` also checks historical numbers in `mobile_number_changes` using `customers.user_id`. Preserve this relationship; fail closed on ambiguous identity rather than adding an order foreign key.
- `placeOrderFn` inserts `placed` only after checkout validation/payment/reservation; failed insertion is rolled back. Lifecycle supports placed, packed, out_for_delivery, delivered, cancelled; current rows are delivered/cancelled. **Every persisted matching order excludes its customer**, including later cancellation/refund. Unsaved checkouts, carts and reservations do not count. No duplicate order-count field.
- Existing SQL: `wa_phone_key`, `wa_customer_has_order`, `wa_pending_customers`, `wa_promo_sent_today`, `claim_whatsapp_promo`, `skip_whatsapp_promo`, `wa_set_consent`, `guard_wa_customer_fields`. Queue/sent indexes exist; claim/skip already lock and audit transactionally.
- `catalog_items` has the required fields; seven products currently satisfy active filtering. Shared recommendation catalog loading includes bundled fallbacks and omits expiry checks: campaign suggestions must intersect the strict live database product set.
- Phone-keyed product/category preferences, replenishment, Buy Again and popularity exist. Never-ordered customers ordinarily lack purchase-based signals; missing history is expected, not grounds to invent it.
- `admin-session.server.ts` / `admin-access.shared.ts` already enforce active staff permissions. WhatsApp navigation/permission are not present. Reuse the existing sub-admin editor and admin shell.
- Profile `/menu` links Settings to `/notifications`, which currently manages push preferences. Add separate voluntary WhatsApp consent there; never reuse push `promotional_offers`.
- Existing `admin_audit_log` supports all required metadata. Campaign SQL already writes audit atomically; shared `recordAudit` is best-effort and unsuitable for campaign commits. Customers/audit have RLS; campaign mutation RPCs are service-role-only; customer WhatsApp fields have a guard trigger.
- `share-link.ts` supplies public product links. `phone.ts` uses `libphonenumber-js`, but some helpers accept permissive fallbacks; campaign phone validation must be strict without altering global login behavior.

## Implementation in execution order

### 1. Establish independent campaign helpers

Track work in `roadmap.md`; document the server-only boundary in `AGENTS.md` during implementation.

Create `src/lib/whatsapp-promo.shared.ts` and `src/lib/whatsapp-link.ts` before consumers: types, campaign constant, 24-hour rule, fixed 25 limit, India date boundaries, strict phone checks, message/link generation.

Validate explicit international numbers with the existing phone library; support documented legacy Indian ten-digit storage, never guess foreign countries. Reject missing/invalid/ambiguous numbers. Strip spaces/hyphens/leading `+` only after validation. Generate `https://wa.me/<international_digits>?text=<fully_encoded_message>` using `productShareUrl` and the existing public origin.

Message follows the supplied example: customer greeting, Kartogo welcome, selected product name, public product URL, shopping/sign-off text. Admin edits it in WhatsApp before sending.

### 2. Reuse and strengthen database foundations

Create one idempotent migration in `supabase/migrations/` and apply its exact SQL with the migration tool. **No new tables, duplicated columns or unnecessary promo metadata fields.** Audit metadata holds product/admin/campaign details.

Review/update only needed objects:
- `wa_phone_key` / `wa_customer_has_order`: canonical current/historical matching, no empty-number matches, exclusion for every saved order regardless of final status.
- `wa_pending_customers`: consistent consent+timestamp, age ≥24 hours, unsent/unskipped, valid record, no order; stable searchable pagination. Canonical identities already processed must not reappear via another record.
- `wa_promo_sent_today`: count `promo_sent_at` in `[Asia/Kolkata midnight, next midnight)`.
- `claim_whatsapp_promo`: retain transaction advisory lock and customer row lock; recheck eligibility/product/duplicates/count inside transaction. Enforce **25**, never a caller-adjustable limit. Set server timestamp and insert audit together; audit failure rolls everything back. Strict server phone validation precedes RPC.
- `skip_whatsapp_promo`: locked duplicate-safe skip/audit; no sent increment. Permit a safely identified unsuitable/test customer to be skipped without allowing it to be contacted.
- `wa_set_consent`: caller-scoped consent/timestamp and withdrawal, serialized with campaign row mutation. Preserve unchanged opt-in timestamp; record fresh explicit opt-in; withdrawal immediately prevents later eligibility checks.
- `guard_wa_customer_fields`: preserve rejection of client-written campaign status/forged consent and compatibility with existing profile saves.

Retain useful indexes; add only justified missing ones. Restrict campaign RPC execution to `service_role`, revoke public/customer execution as appropriate, preserve RLS/data isolation. Derive audit actor from verified admin, not frontend input.

### 3. Add the dedicated admin permission

Modify `src/lib/admin-access.shared.ts`: `whatsapp_promos` and `/admin/whatsapp-recommendations` mapping. Existing super-admin logic grants founder access; sub-admins need an explicit grant through the existing feature list.

Every admin operation uses `requireAdminPermission(token, 'whatsapp_promos')`, which checks active status through the same resolver as `requireActiveAdmin`. No signature-only authorization, new login system or reliance on cached navigation permissions.

### 4. Add secure server functions and recommendation orchestration

Create:
- `src/lib/whatsapp-promo.server.ts`: server-only querying, ranking, summaries and transactional RPC calls.
- `src/lib/whatsapp-promo.functions.ts`: validated `createServerFn` wrappers.

Operations:
1. **Fetch Pending Recommendations**: authenticate/authorize; apply all eligibility rules server-side; return customer ID/name/phone/signup date and suggested product ID/name/public URL only. Include exact pending/skipped totals, sent count and active product choices with only needed fields. Search/pagination must apply strict phone validation before final page/count; scan in bounded batches rather than truncate at 500. Searchable product pagination makes the entire active catalog selectable.
2. **Prepare WhatsApp chat**: freshly revalidate consent, eligibility, number, product and remaining limit; return personalized link. Never mutate sent/skipped or counters. Handle stale selections and withdrawn consent.
3. **Update Promotional Status**: validate `{ token, userId, action, productId }`; document `userId` as `customers.id`, not `auth.users.id`. Only `sent`/`skip`; active selected product required for sent, optional for skip. Invoke atomic RPC and return confirmed results/counts; reject duplicates and unauthorized inputs.
4. **Read/Update WhatsApp Consent**: verify existing customer token, resolve own record only; never accept another customer ID/phone from browser. Return confirmed saved consent state.

Ranking: customer product interest → valid most-bought category → existing best-selling active products. Reuse replenishment/Buy Again only when applicable; never weaken no-order eligibility. Strict active condition: `is_deleted=false AND stock>0 AND (expiry_date IS NULL OR expiry_date>=India_today)`. Deterministic ties; if no sales, choose a real active fallback; if no products, disable sending. Batch existing signals; avoid per-customer rebuilds or sample fallback.

Load privileged clients only in authorized server code; expose no credentials, tokens in URLs, unnecessary customer details or raw errors. Use `useServerFn`; no protected public-SSR loaders or new Edge Functions.

### 5. Add explicit customer consent

Modify only the relevant settings area in `src/routes/notifications.tsx`, using a focused `src/components/WhatsAppConsent.tsx`:
- Unchecked **Get product recommendations and offers on WhatsApp** option, distinct from push preferences.
- Voluntary wording, timestamp capture and withdrawal.
- Saved-state loading, progress/errors; reflect persistence only after confirmation.
- Existing signed-out experience and customer-only identity protection.
- Preserve existing push/device controls and unrelated account functionality.

### 6. Build the admin page

Create `src/routes/admin.whatsapp-recommendations.tsx`; modify `src/routes/admin.tsx` only for **Customer Growth → WhatsApp Recommendations**. Reuse design tokens, buttons, selectors, dialogs, notifications and layout; add unique Kartogo page metadata.

Summary: **Messages Sent Today: X / 25**, Daily Limit 25, Pending Recommendations, Skipped Customers. Refresh after successful changes, on focus and across India midnight.

Table: Customer Name, Phone Number, Signup Date, Recommended Product dropdown, Actions. Search, stable pagination, loading, empty/error/retry states; preserve product selections. Responsive table/card presentation without clipping; actions side by side wherever they fit.

- **Open in WhatsApp**: open freshly validated link in new tab/app, handle blocked popups; never remove customer, mark sent or count an opening.
- **Mark as Sent**: confirmation after manual sending, secure revalidation and atomic write. Only successful database confirmation removes row, refreshes counter and shows success. Failure keeps row and shows error.
- **Skip**: confirmation and atomic skip/audit; remove only on success, increment skipped total, never sent count.

At 25 block opening/sent confirmation; keep Skip available. Include requested short manual-send instructions and invalid-number/missing-product/limit warnings. No redesign of existing dashboard.

## Required testing and acceptance

Add focused tests beside existing tests and run them with relevant regression tests:
1. No-consent exclusion; existing defaults remain false; explicit timestamp required.
2. Under-24-hour exclusion and eligibility exactly at/after 24 hours.
3. Delivered, cancelled-after-submission and refunded-order exclusion, including historical-phone matching.
4. Abandoned carts, reservations and failed unsaved checkouts do not count.
5. Missing/invalid phones rejected; valid Indian/international digits, complete URL encoding and personalized public product links.
6. Deleted/sold-out/expired products excluded; expiry-today uses India date; admin product override reaches audit.
7. Chat opening/preparation has zero status/counter effects; withdrawn consent/stale products block preparation and confirmation.
8. Sent uses server timestamp; status/audit commit together; database/audit failures roll back and keep UI row.
9. Skip affects skipped count only; sent/skipped customers and equivalent identities do not reappear.
10. India midnight boundaries/reset; 25th succeeds, 26th fails.
11. Parallel admins competing for last slots cannot exceed 25; duplicate requests produce one status/audit result.
12. Missing permission, disabled/revoked admins, customer impersonation and unauthorized direct RPC access fail.
13. Own-customer consent grant/withdrawal persists across refresh and never changes push consent.
14. Existing cart/login, customer settings, recommendations and admin navigation remain functional.

Verify signed-in customer opt-in → eligible queue → product override → WhatsApp destination/message inspection → explicit sent → database/audit/UI read-back, plus Skip and withdrawal. Use isolated fixtures, clean only test records, and avoid consuming real campaign slots in concurrency tests. Check phone/tablet/laptop including current 870px viewport, popup handling and browser/runtime errors.

Free Click-to-Chat cannot verify actual delivery/read status. Inspect correct destination/message without unwanted promotional sends; final sending stays manual. The enforceable limit is **25 confirmed sent records**, not independent activity inside WhatsApp.

## Completion

Deliver the independent module with test results and accurately stated real-device limitations. No paid channel or new credentials needed. Save implementation after verification; publishing is separate. Until plan approval, no application/database changes are made.
