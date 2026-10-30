# Architecture rules

- Persist multi-stop deliveries as transactionally claimed trips; stop completion and cancellation cleanup must preserve pickup-before-drop ordering and rider occupancy.
- Resolve pickup stores from inventory reservation allocations, failing closed for ambiguous legacy ownership; validate multi-store road time before batching.
- Reuse the Home location selector at checkout so saved addresses and exact delivery details share one source of truth.

- Use browser-safe home section predicates for discovery and search boundaries so category ownership stays consistent across views.
- Share Food and Rides experiences as presentation components between their home tabs and dedicated routes so existing ordering and booking flows stay identical.
- Load dedicated marketplace discovery with existing category-read functions so global home preview limits cannot hide a section's catalog.
- Keep the home top area in normal document flow with a separate sticky search band; scroll-driven header height changes cause scroll anchoring feedback and blinking.
- Use the router history blocker for customer bottom-section backward traversal, await POP restoration before replacing with Home, and preserve explicit customer-home intent so portal auto-redirects cannot override it; never insert dummy history entries or intercept forward/detail navigation.
- Keep every role's session keys mirrored into long-lived cookies and silently re-signed through the session keeper; route guards must never sign anyone out on a network error, so accounts survive storage wipes and expiry.
- Record admin login, logout and page-view events in the admin audit trail under the admin_session entity keyed by staff id, so usage analytics come from server-verified tokens only.
- Store empty session slots by removing the storage key, never as the text "null", so portal auto-redirects cannot mistake an empty slot for a saved session.
- Open Home-tab sub-pages (e.g. a restaurant) on their own route so the Home section cards never render above a sub-page.
- Partner and admin portals share the PartnerMenu three-line top bar; "shop as a customer" intent lives only in memory for the current app run (src/lib/portal-mode.ts), so reopening, reloading or idling the app always returns a saved portal session to its portal.
- Rider self-claim ("I'm taking this order") puts the rider on duty and falls back to a direct single-order assignment when the order cannot join a trip, so claiming never depends on packing or store data.
- Ask notification permission directly after the first-open location prompt (no in-app card); PushBridge listens for the grant event to register the device.
- The customer Orders "All" tab is one list of product orders, bookings, food and rides sorted newest-first by creation time.
- Shared server helpers called from several server functions live in *.server.ts files, never as plain exports of *.functions.ts files, because those exports (and their server-only imports) are kept in the browser bundle and break the build.
- Ride start codes are generated and checked only on the server; driver job lists strip the code so riders must get it from the customer, and the fare is collected in a separate at-destination step before completion.
- Decide whether a delivery location gets Quick only through the shared location-Quick helper in the delivery-tier module, so Home, product cards and saved-address badges never disagree.
- Use the modular @firebase/app and @firebase/messaging packages for push, not the umbrella firebase package, because it bundles Firestore and its vulnerable gRPC dependency that the app never uses.
