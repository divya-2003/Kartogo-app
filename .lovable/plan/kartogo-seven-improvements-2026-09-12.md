# Kartogo — seven improvements

## 1. Android app with working push notifications

Add Capacitor so the existing app can be wrapped as an Android app:

- Capacitor config (app id, name, web build output), Android platform scripts.
- A slot for `google-services.json` (you drop the file from Firebase into `android/app/`).
- `POST_NOTIFICATIONS` permission plus internet/network permissions in the Android manifest template.
- Native push registration path: on Android the device token comes from the native push plugin instead of the browser; the token is saved to the same notification-token table already used by the web app, so order notifications work unchanged.
- Notification taps open the correct screen (order details, live tracking) using the existing links.

Note: the finished `.apk` must be built on your machine in Android Studio — Lovable cannot produce an installable Android file. I will include exact step-by-step build and Firebase Console instructions at the end.

## 2. Remove unused database tables

Leftover tables from an earlier design, all empty and not used by any screen:
`merchants`, `products`, `orders`, `drivers`, `product_recommendations`.

I will first confirm nothing in the app reads them, then remove them in a single approved change. Nothing with real data is touched.

## 3. Saved addresses in the change-address screen

The screen in your first picture will list your saved addresses (Home / Work / etc.) above the map-search box, each tappable to select it directly, with the exact-address editor reachable from each one. No new address needs to be typed if one is already saved.

## 4. Delivery incentive ₹6 → ₹8

Change the per-kilometre rate beyond the free 3.5 km radius from ₹6 to ₹8 everywhere it is used: customer price estimate, checkout total, driver payout and the admin earnings/revenue figures, so all numbers stay consistent.

## 5. Multiple address profiles

- Labels: Home, Work, Friends, plus a custom label.
- Each address keeps door/flat, apartment, landmark notes (existing fields, preserved).
- Saving a labelled address checks it against the serviceable zone and marks it "Quick available" or "Standard only", so picking it at checkout immediately shows the right service.
- Labels and notes are stored on the customer record, so they follow the customer across devices.

## 6. Scheduled deliveries for Standard orders

- Customers choosing Standard get a time-slot picker: Morning 8–11, Afternoon 12–4, Evening 6–9. Past slots for today are disabled; next-day slots offered after cut-off.
- Admin page to edit the slot list (label, start, end, on/off) so you control what customers see.
- The chosen slot is stored with the order and shown on the order card, in the admin orders list and in the delivery partner's order view.

## 7. Logo background on splash and login

The wordmark image carries its own dark-navy block that differs slightly from the page. I will make the wordmark's background transparent so it sits directly on the page colour, on both the opening screen and the login screen. Nothing else moves — same size, same position, same layout.

## Technical notes

- Capacitor + `@capacitor/push-notifications`; web push path (`firebase-push.ts`, `PushBridge`) stays as-is and the native path registers into the same `user_notification_tokens` table.
- `PER_KM_RATE` in `src/lib/logistics/pricing.ts` 6 → 8; audit admin/delivery earnings screens for hardcoded 6.
- Address labels/zone flags stored in the existing `customers.saved_addresses` JSON via `customer.functions.ts` (no schema change); serviceability reuses `src/lib/serviceability.ts`.
- New `delivery_slots` table (label, start/end time, active, sort) + `scheduled_slot` columns on `app_orders`, with grants and RLS.
- Wordmark: regenerate the asset with a transparent background and swap the pointer JSON used by `SplashScreen.tsx` and `login.tsx`.
