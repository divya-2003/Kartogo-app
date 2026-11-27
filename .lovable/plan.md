# Kartogo WhatsApp Recommendations

## Outcome and boundaries

Add **Customer Growth → WhatsApp Recommendations**, campaign **Registered but Not Ordered** (`registered_not_ordered`): register → voluntarily opt in → wait 24 hours → verify no submitted order → suggest/select product → open WhatsApp → send manually → explicitly confirm sent → atomic status/audit update → refresh daily count. Include Skip and a strict maximum of 25 confirmed messages per India calendar day.

Reuse existing authentication, customer/product/order/audit tables, recommendation signals, admin design and TanStack Start server functions. No paid WhatsApp API, automated/bulk sending, Edge Functions, new infrastructure, hardcoded production samples or unrelated portal changes.

## Verified existing foundations and conflicts

- `customers` already has all four requested consent/status fields, with correct defaults. All 20 customers are opted out; none sent/skipped. No backfill or duplicate columns. The old plan's missing-field claims are obsolete.
- Use `customers.id` for campaign identity. `user_id` is nullable. Existing signed customer sessions resolve profiles by verified phone. `app_orders` has no customer/user UUID; `wa_customer_has_order` matches current and historical numbers via `mobile_number_changes`/`user_id`.
- Order insertion is `placed` after validation; failures roll back. Lifecycle: placed, packed, out_for_delivery, delivered, cancelled. Every saved matching order excludes the customer, including cancelled/refunded orders. Carts, reservations and unsaved checkouts do not count.
- All eight WhatsApp SQL helpers/guard and queue/sent indexes already exist. Claim/skip already lock and audit atomically. Reuse/strengthen rather than recreate.
- Seven `catalog_items` currently meet active conditions. Existing recommendation catalog fallback includes bundled products and omits expiry: campaign ranking must strictly filter live products.
- Product/category preferences, Buy Again, replenishment and popularity exist. Never-ordered customers usually have no purchase history; do not invent it.
- Active-admin permission helpers and sub-admin editor exist; WhatsApp permission/navigation do not. Profile Settings links to `/notifications`, currently push-only.
- `admin_audit_log` supports needed metadata; campaign writes must remain transactional, not best-effort `recordAudit`. Customers/audit have RLS, campaign mutation RPCs are service-role-only, and a trigger guards WhatsApp fields.
- Reuse `share-link.ts` and the existing phone library; campaign validation must avoid permissive global phone fallbacks.

## Implementation in execution order

### 1. Establish independent campaign helpers

Track work in `roadmap.md`; record server boundaries in `AGENTS.md`.

Create `src/lib/whatsapp-promo.shared.ts` and `src/lib/whatsapp-link.ts` before consumers: types, campaign constant, 24-hour rule, fixed 25 limit, India date boundaries, strict phone checks, message/link generation.

Validate explicit international numbers with the existing phone library; support documented legacy Indian ten-digit storage, never guess foreign countries. Reject missing/invalid/ambiguous numbers. Strip spaces/hyphens/leading `+` only after validation. Generate `https://wa.me/<international_digits>?text=<fully_encoded_message>` using `productShareUrl` and the existing public origin.

Use the supplied personalized welcome/product/URL/sign-off message, editable in WhatsApp.

### 2. Reuse and strengthen database foundations

One idempotent migration in `supabase/migrations/`, applied verbatim with the migration tool. No duplicate columns/tables; existing audit metadata holds campaign details.

Review/update only needed objects:
- `wa_phone_key` / `wa_customer_has_order`: canonical current/historical matching, no empty-number matches, exclusion for every saved order regardless of final status.
- `wa_pending_customers`: consistent consent+timestamp, age ≥24 hours, unsent/unskipped, valid record, no order; stable searchable pagination. Canonical identities already processed must not reappear via another record.
- `wa_promo_sent_today`: count `promo_sent_at` in `[Asia/Kolkata midnight, next midnight)`.
- `claim_whatsapp_promo`: retain transaction advisory lock and customer row lock; recheck eligibility/product/duplicates/count inside transaction. Enforce **25**, never a caller-adjustable limit. Set server timestamp and insert audit together; audit failure rolls everything back. Strict server phone validation precedes RPC.
- `skip_whatsapp_promo`: locked duplicate-safe skip/audit; no sent increment. Permit a safely identified unsuitable/test customer to be skipped without allowing it to be contacted.
- `wa_set_consent`: caller-scoped consent/timestamp and withdrawal, serialized with campaign row mutation. Preserve unchanged opt-in timestamp; record fresh explicit opt-in; withdrawal immediately prevents later eligibility checks.
- `guard_wa_customer_fields`: preserve rejection of client-written campaign status/forged consent and compatibility with existing profile saves.

Retain indexes; add only justified missing ones. Service-role-only campaign RPCs, revoked public/customer execution, preserved RLS; verified admin supplies audit actor.

### 3. Add the dedicated admin permission

Modify `src/lib/admin-access.shared.ts`: `whatsapp_promos` and `/admin/whatsapp-recommendations` mapping. Founder access uses existing super-admin logic; sub-admins need explicit grants.

Every admin operation uses `requireAdminPermission(token, 'whatsapp_promos')`, including active status through the `requireActiveAdmin` resolver. Never trust cached UI permissions or signatures alone.

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

Authorized server-only privileged clients; no credential/token/customer-data leaks or raw errors. Use `useServerFn`, not protected public SSR loaders.

### 5. Add explicit customer consent

Modify only the relevant settings area in `src/routes/notifications.tsx`, using a focused `src/components/WhatsAppConsent.tsx`:
- Unchecked **Get product recommendations and offers on WhatsApp** option, distinct from push preferences.
- Voluntary wording, timestamp capture and withdrawal.
- Saved-state loading, progress/errors; reflect persistence only after confirmation.
- Existing signed-out experience and customer-only identity protection.
- Preserve existing push/device controls and unrelated account functionality.

### 6. Build the admin page

Create `src/routes/admin.whatsapp-recommendations.tsx`; add **Customer Growth → WhatsApp Recommendations** in `src/routes/admin.tsx`. Reuse design/layout/controls; unique Kartogo metadata.

Summary: **Messages Sent Today: X / 25**, Daily Limit 25, Pending Recommendations, Skipped Customers. Refresh after successful changes, on focus and across India midnight.

Table: name, phone, signup date, product dropdown, actions. Search/pagination/loading/empty/error/retry states; preserve selections. Responsive presentation; actions side by side.

- **Open in WhatsApp**: open freshly validated link in new tab/app, handle blocked popups; never remove customer, mark sent or count an opening.
- **Mark as Sent**: confirmation after manual sending, secure revalidation and atomic write. Only successful database confirmation removes row, refreshes counter and shows success. Failure keeps row and shows error.
- **Skip**: confirmation and atomic skip/audit; remove only on success, increment skipped total, never sent count.

At 25 block opening/sent confirmation; keep Skip available. Include requested short manual-send instructions and invalid-number/missing-product/limit warnings. No redesign of existing dashboard.

## Required testing and acceptance

Add/run focused tests and relevant regressions for every requested scenario:
- No consent/default false; explicit consent timestamp; under 24 hours excluded, eligible at/after 24 hours.
- Delivered/cancelled/refunded orders excluded, including historical numbers; carts/reservations/unsaved checkouts excluded from order history.
- Missing/invalid phones rejected; valid Indian/international links and full message encoding; active/nonexpired products only; selected override audited.
- WhatsApp opening never marks sent; withdrawal/stale product blocks actions. Confirmation timestamps/audit commit atomically; failures keep UI rows.
- Skip increments no sent count; processed/equivalent identities never reappear.
- India midnight/reset; 25th succeeds, 26th fails; concurrent final-slot requests cannot exceed 25; duplicate request creates one status/audit result.
- Wrong/missing permission, disabled admins, impersonation and direct unauthorized RPC access refused.
- Own-customer consent persists/withdraws without changing push preferences; existing login/cart/settings/recommendations/admin navigation regressions.

Verify signed-in opt-in → eligibility → product override → WhatsApp destination/message → explicit sent → database/audit/UI read-back, plus Skip/withdrawal. Use isolated fixtures, clean only test records, and test concurrency without consuming real campaign slots. Check mobile/tablet/laptop including 870px, popup handling and runtime errors.

Click-to-Chat cannot verify delivery/read status. Inspect destination/message without unwanted sends; sending remains manual. Limit applies to 25 confirmed records, not independent WhatsApp activity.

## Completion

Deliver the independent module with test results and accurately stated real-device limitations. No paid channel or new credentials needed. Save implementation after verification; publishing is separate. Until plan approval, no application/database changes are made.
