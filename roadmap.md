# Roadmap

## Multi-stop trips and customer fixes
- [x] Implement persisted pickup-before-drop trips with safe side-by-side store batching
- [x] Connect automatic dispatch and rider stop actions
- [x] Restore previous-page Back from Events details
- [x] Reuse Home address selection at checkout
- [ ] Verify signed-in checkout and real rider trip end-to-end — needs an app customer/rider session and ready orders with known pickup stores
- [ ] Complete push delivery verification — website Firebase settings are absent, no devices are registered, and connection update was declined

## Customer navigation fixes
- [x] Show full top-section labels and remove shortcut category rows
- [x] Stop home-header blinking during slow scrolling
- [x] Verify Clear all removes recent searches
- [x] Ensure bottom-section back navigation returns Home
- [x] Verify the requested flows on screen

## Dedicated home sections
- [x] Restrict Shop discovery and recommendations to Shop products
- [x] Show the food ordering and ride booking interfaces under their own tabs
- [x] Design separate Beauty, Home Services and Events discovery views
- [x] Test section boundaries and verify each home tab

- [x] Apply Kartogo opening/login branding and guest-first account flow
- [x] Add low-stock badges and enforce stock quantity limits
- [x] Send and record back-in-stock notifications with product deep links
- [x] Verify guest, stock, and notification flows across mobile and desktop

## Marketplace upgrade (products + services + bookings + events)
- [x] Marketplace data model (categories, partners, listings, staff, bookings, history, favorites, home sections) + seed + RLS
- [x] Shared types + server functions (listing, availability, booking w/ double-booking guard, quote, favorites, search)
- [x] Splash tagline, bottom nav (Home / Categories / Orders & Bookings / Account)
- [x] Home: "What are you looking for?" + configurable sections, new search placeholder
- [x] Categories page grouped + category listing pages (type-adaptive, search/filter/sort)
- [x] Partner profile, service detail + salon/home booking, furniture detail, event package + request/quote
- [x] Booking confirmation, booking detail + timeline + home service tracking
- [x] Orders & Bookings tabs, favorites, account menu, help & support, become a partner
- [x] Search includes services/stores/providers
- [x] Verify
- [x] Partner self-service portal for listings/staff/availability (admin manages bookings for now)
- [x] 30-min / same-day / next-day choice inside the grocery checkout (existing Quick/Standard + slots kept)

## Oct 5 batch
- [x] Partner bookings page (to confirm / ongoing / today / cancelled)
- [x] Rider portal: food & ride requests, accept, status updates, live location
- [x] Ride-to-store after showroom visit
- [x] Order placed / Service booked / Visit booked labels
- [x] Top section bar (Shop, Food, Rides, Beauty & Wellness, Home Services, Events)
- [x] Admin Food & rides view
- [x] Seller AI insights for services
- [x] Admin search across all pages + side menu
- [x] Automatic "Allow notifications" prompt after login
- [ ] Web push keys — waiting on user to update Firebase connection with "Include web push"
