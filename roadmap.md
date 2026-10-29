# Roadmap

## Multi-stop trips and customer fixes
- [x] Implement persisted pickup-before-drop trips with safe side-by-side store batching
- [x] Connect automatic dispatch and rider stop actions
- [x] Restore previous-page Back from Events details
- [x] Reuse Home address selection at checkout
- [ ] Verify signed-in checkout and real rider trip end-to-end — needs an app customer/rider session and ready orders with known pickup stores
- [x] Website Firebase settings linked (see Oct 22 batch)

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
- [x] Web push keys linked

## Oct 21 batch
- [x] Merge admin Delivery and Live logistics into one page
- [x] Admin Feedback shows delivery partner feedback
- [x] Product share window with a public link and WhatsApp/Telegram/Message/Facebook/X

## Oct 22 batch
- [x] Remove the Refresh button from admin Push notifications
- [x] Keep customer, seller, rider, printer and admin accounts signed in (year-long sessions, silent renewal, restore after storage wipe)
- [x] Link Firebase with web push settings and fix device registration waiting for the notification worker
- [ ] Confirm a real phone receives a push — needs the user to turn on notifications on the published app or Android app

## Oct 23 batch
- [x] Full-page login only when a guest taps Add to cart or Wishlist
- [x] Add Clothes category to Shop
- [x] Shop section categories as a compact icon row (like the reference)
- [x] Show Combos and Pharmacy in Shop
- [x] Remove the search bar inside the Food section
- [x] Hide the section top bar on sub-pages everywhere
- [x] Logout from Profile returns to the first-open Home page
- [x] Remove the Order tracking…Stock alerts cards from guest Profile
- [x] Seller account asks for basic + business details (location, GSTIN, FSSAI…); drop favourites/addresses mentions
- [x] Sub-admin usage analytics (incl. login/logout) replacing the admin login audit

## Oct 24 batch
- [x] Seller and delivery portals: three-line menu holding the portal pages plus "Shop as a customer"; analysis shown first; Profile links back to the portal
- [x] Unserviceable page fits one screen with "Go to standard delivery" under the request button
- [x] Single scrollable cart (items, savings zone, price details) with a fixed total bar
- [ ] Check the seller/delivery menus with a real partner login — needs a partner session

## Oct 26 batch
- [x] Sellers must add description, photos and expiry date for products; description and photos for services
- [x] Seller details on customer product pages; provider details on service pages
- [x] Photo space on each restaurant page
- [x] Ride start code (customer → driver at pickup) and fare-collection step at destination, shown to both sides
- [x] Guest Profile page: Account Settings, Earn with Kartogo, Feedback & Information
- [ ] Test a real ride end-to-end with a rider and customer account — needs both sessions

## Oct 28 batch
- [x] Partners/sellers/admins always reopen on their own portal
- [x] Shop: no Quick/Standard buttons; one list, each product once, Quick tag in Quick areas
- [x] Mobile section cards are wide horizontal cards
- [x] Shop category bar fits all categories without sideways scrolling
- [x] Admin top bar matches the seller portal
- [ ] Check admin and seller top bars while signed in — needs a real admin/seller session
