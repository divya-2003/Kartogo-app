# Kartogo WhatsApp Recommendations — complete implementation plan

## Result and scope

Add **Customer Growth → WhatsApp Recommendations** to the existing admin panel for the **Registered but Not Ordered** campaign (`registered_not_ordered`). Customers voluntarily opt in, become eligible 24 hours after registration if they have never submitted an order, and receive a product suggestion. An authorized admin opens a personalized WhatsApp chat, sends manually, then explicitly confirms **Mark as Sent** or **Skip** in Kartogo.

Use only free `https://wa.me/` links, existing TanStack Start server functions, existing authentication, and the existing database. No paid messaging API, automatic sending, bulk tools, Edge Functions, new infrastructure, or duplicate customer/product/order/audit tables. No unrelated portal changes.

## Verified existing functionality and conflicts

| Area | Verified existing state | Implementation consequence |
|---|---|---|
| Customers | `public.customers`: UUID `id`, nullable unique `user_id`, unique `phone`, `name`, `created_at`, saved addresses and other profile fields. Existing customer server functions authenticate signed customer tokens and resolve profiles by verified phone. | Use `customers.id` as the campaign identity. Do not require `user_id`, which is nullable, or rebuild customer authentication. |
| Consent and promotional status | All four requested fields already exist with the requested types/defaults: `whatsapp_marketing_opt_in=false`, nullable `whatsapp_marketing_opt_in_at`, nullable `promo_sent_at`, `promo_skipped=false`. All 20 existing customers are currently opted out; none are sent or skipped. | No new consent/status columns and no consent backfill. Earlier plan statements that these fields are missing are obsolete. |
| Existing database foundations | `wa_phone_key`, `wa_customer_has_order`, `wa_pending_customers`, `wa_promo_sent_today`, `claim_whatsapp_promo`, `skip_whatsapp_promo`, `wa_set_consent`, `guard_wa_customer_fields`; queue/sent indexes already exist. | Reuse and selectively strengthen these objects rather than recreate them. |
| Orders | `app_orders` has `customer_phone`, not a customer UUID or user UUID. `placeOrderFn` validates checkout, charges/reserves as appropriate, and inserts `status='placed'`; failed insertion is rolled back. Current persisted statuses are delivered and cancelled; lifecycle supports placed, packed, out_for_delivery, delivered, cancelled. | Any persisted matching `app_orders` row excludes the customer, regardless of cancellation or refund. Carts, checkout attempts without a saved order, and reservations alone do not count. No order-count column. |
| Order identity | Existing `wa_customer_has_order` matches normalized phone and historical mobile numbers from `mobile_number_changes` through `customers.user_id`. | Preserve that history-aware relationship; use permanent identity where available, verified canonical phone otherwise. Fail closed on ambiguous identities; do not add a customer foreign key to orders for this module. |
| Products | `catalog_items` contains the requested fields; seven products currently meet the requested active conditions. | Always filter real database products by not deleted, positive stock and nonexpired date using India time. Never substitute bundled sample products. |
| Recommendation sources | Product/category preferences and replenishment predictions are phone-keyed; existing Buy Again and popularity helpers live in `recommendations.server.ts`. Its shared catalog helper includes bundled fallback items and does not check expiry. | Reuse existing signals/ranking where suitable, but intersect every suggestion with the campaign's strict live-product set. Do not change unrelated recommendation behavior. |
| Recommendation priority | A genuinely never-ordered customer ordinarily has no purchase-based category, Buy Again or replenishment history. | Use product interest first, most-bought category only when a valid signal exists, then best-selling active product. Missing purchase history is normal, not grounds to invent it. |
| Admin access | `admin-session.server.ts` checks active staff and permissions; `admin-access.shared.ts` supplies feature/path permissions. Current navigation has no WhatsApp entry or Customer Growth group. | Add one permission and one group/entry; reuse the existing shell and sub-admin editor. Server permission checks remain authoritative despite cached navigation access. |
| Consent experience | Customer Profile (`/menu`) links Settings to `/notifications`. That page currently controls push preferences, including `promotional_offers`. | Add a separate WhatsApp consent control there; leave push preferences unchanged. |
| Audit | `admin_audit_log` already provides actor, role, action, entity, metadata and timestamp. Existing `recordAudit` is best-effort; campaign database functions already insert audit rows transactionally. | Keep campaign status and audit atomic, not a separate best-effort write. No audit schema extension is needed. |
| Protection | Customers and audit tables have RLS enabled. Existing campaign mutation RPCs are service-role-only; a customer trigger guards WhatsApp fields. | Preserve isolation and validate all function execution grants and guarded mutation paths. |
| Phone and links | `phone.ts` uses `libphonenumber-js`, but some helpers have permissive fallback validation. `share-link.ts` provides `productShareUrl` and the published app origin. | Reuse the existing library and product generator, adding strict campaign-specific number validation without changing global login behavior. |

## Execution order

### 1. Record scope and establish campaign rules

Track the implementation and tests in `roadmap.md`; document the server-only campaign boundary in `AGENTS.md` during implementation. Keep existing authentication/session persistence, customer shopping, supplier, delivery and other admin modules intact.

Create browser-safe campaign helpers/types in `src/lib/whatsapp-promo.shared.ts` and `src/lib/whatsapp-link.ts` before their consumers. Centralize campaign name, 24-hour threshold, India timezone, fixed daily maximum 25, strict phone validation, message formatting and active-product rules.

For international numbers, validate explicit country-code numbers with the existing phone library; support legacy Indian 10-digit storage only because that is the documented existing storage convention. Reject malformed or ambiguous numbers rather than guessing a foreign country. Strip formatting and `+` only after validation; encode the entire personalized message. Call `productShareUrl` with the existing public origin; do not create another product-link generator.

### 2. Apply only necessary database corrections

Create one idempotent migration under `supabase/migrations/` and apply its exact SQL through the migration tool. Do not add fields that already exist, extra promo metadata columns, or new tables.

Reuse/modify as needed:
- `wa_phone_key` / `wa_customer_has_order`: retain canonical current/historical phone matching and exclusion for **every persisted order**, including cancelled/refunded rows; avoid empty-number matches.
- `wa_pending_customers`: align queue filtering, search, stable pagination and identity deduplication with mutation eligibility. Require explicit consent and timestamp, age at least 24 hours, unsent/unskipped state, valid record and no submitted order. A canonical phone already sent/skipped must not reappear through another record.
- `wa_promo_sent_today`: use `[India midnight, next India midnight)` against `promo_sent_at`, not browser timezone.
- `claim_whatsapp_promo`: retain advisory transaction lock plus customer row lock; recheck eligibility, selected active product, duplicates and count; enforce a fixed 25 regardless of any caller-supplied limit; set server timestamp and insert audit atomically. Server-side strict phone validation is also mandatory before calling it.
- `skip_whatsapp_promo`: retain locking, duplicate rejection and atomic skip/audit; use a safely identified customer even when the number is unsuitable, without incrementing sent count.
- `wa_set_consent`: resolve the caller's customer through the existing verified customer session, set timestamp on explicit opt-in, preserve it for unchanged consent, and withdraw immediately. Serialize with campaign mutation row locking so withdrawal and confirmation cannot overwrite each other.
- `guard_wa_customer_fields`: preserve prevention of client-written campaign status or forged consent; review for insert/update compatibility with existing profile writes.

Retain useful existing indexes; add only missing narrowly targeted indexes justified by the final queries. Keep callable campaign SQL operations restricted to `service_role`, revoke default/public/customer execution where applicable, and preserve existing RLS policies. The server authenticates the real admin and supplies its actor identity; the browser cannot choose the audit actor.

### 3. Add the dedicated permission

Modify `src/lib/admin-access.shared.ts` with `whatsapp_promos` and `/admin/whatsapp-recommendations` mapping. Main/super admins receive access through existing super-admin logic; sub-admins require an explicit grant through the existing permission list. Test revoked/disabled accounts on every operation. Use `requireAdminPermission(token, 'whatsapp_promos')`, which already resolves active admin status through the same mechanism as `requireActiveAdmin`; do not replace this with signature-only checks or a new login system.

### 4. Implement server functions and recommendation selection

New files:
- `src/lib/whatsapp-promo.server.ts`: server-only eligibility, batched recommendation reads, summaries and RPC orchestration.
- `src/lib/whatsapp-promo.functions.ts`: validated `createServerFn` wrappers, safe to import from the UI.

Operations:
1. **Fetch Pending Recommendations**: authorized paginated/searchable customer queue, exact pending/skipped totals, sent-today counter, and active product choices. Return only customer ID/name/phone/signup date and suggested product ID/name/public URL; product choices expose only needed ID/name/price/category/URL fields. Apply strict phone screening before presentation and pagination totals; scan in bounded batches rather than silently truncating to an arbitrary first 500 customers. Searchable product pagination must make every active product selectable as the catalog grows.
2. **Prepare WhatsApp chat**: revalidate current consent/eligibility and product before opening, return the personalized link, and never write sent/skipped state. Reject stale selections or invalid numbers. Limit-reached state blocks further chat preparation and confirmation.
3. **Update Promotional Status**: validated `{ token, userId, action, productId }`, where `userId` is explicitly the existing `customers.id`, not `auth.users.id`. Actions are only `sent` or `skip`; product required and validated for sent, optional for skip. Execute the transactional RPC and return confirmed counts/results. Duplicate or failed requests must not produce false success.
4. **Read/Update WhatsApp Consent**: customer-only session authorization, no arbitrary customer ID/phone accepted from the browser; persist through existing consent fields/RPC and return confirmed consent state.

Rank active products by customer product interest, then valid most-bought-category signal, then existing best-selling signals. Read existing replenishment/Buy Again signals only where applicable; never relax no-order eligibility to use them. Use deterministic ties; if no active products have sales, choose a real active product deterministically, and if none exist, disable sending with a clear empty state. Batch reads to avoid one expensive rebuild per customer.

Load privileged clients only within authorized server handlers/helpers. Never expose credentials, private tokens in URLs, unnecessary customer data or raw database errors. Call functions through `useServerFn`; do not run protected calls in a public SSR loader.

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

Exercise the real signed-in customer opt-in → eligible queue → product change → WhatsApp destination inspection → explicit Mark as Sent → database/audit/UI read-back, plus Skip and withdrawal. Use isolated clearly identified test fixtures, clean only those fixtures, and test concurrency transactionally without consuming real campaign slots. Check phone/tablet/laptop layouts including the current 870px viewport and browser/runtime errors.

WhatsApp cannot report actual manual delivery/read status to a free Click-to-Chat workflow. Verify the correct destination and prefilled message without sending unwanted promotions; final sending remains the admin's manual action. The enforceable limit is 25 database-confirmed sent actions, as requested, not independent activity inside WhatsApp.

## Completion

Deliver the independent module with verified test results and any real-device limitation stated accurately. No paid channel setup or additional credentials are needed. Save the implemented changes after checks; publishing remains separate. Until this plan is approved, no application or database changes will be made.
