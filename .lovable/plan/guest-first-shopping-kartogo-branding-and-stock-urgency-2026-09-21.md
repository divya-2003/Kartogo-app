# Guest-first shopping, Kartogo branding, and stock urgency

## What will change

1. **Opening and login branding**
   - Keep the opening screen and login page on the exact dark navy sampled from the second reference (`#010d30`).
   - Use the prepared transparent Kartogo wordmark based on the first reference, so the white/orange company name blends cleanly into the navy background.
   - Preserve the current opening animation, tagline, OTP flow, and role-based redirects.
   - Refine the login page into a polished mobile-first sign-in sheet inspired by the references, without copying their brand or layout exactly.

2. **Guest-first customer journey**
   - After the opening screen, first-time and signed-out customers land on the home page instead of being asked to log in.
   - Guests can browse products, categories, markets, search, and product details normally.
   - Tapping Add or Wishlist preserves the selected item locally, then opens login with a return path so the customer comes back to the intended shopping screen after OTP verification.
   - Checkout remains protected and sends signed-out customers to login without losing their cart.
   - Replace the current guest profile placeholder with a designed account page containing a prominent **Login / Register** action and useful public help/account links.
   - Show a clear Login / Register affordance in the home account area for signed-out customers.

3. **Low-stock urgency**
   - Treat 1–5 available units as low stock.
   - Show **Only X left** badges on product cards and product details; normal-stock products will not expose exact quantities.
   - Prevent every quantity control from increasing beyond available stock as well as the configured per-order limit.
   - Keep sold-out products disabled with the existing Notify Me action.

4. **Back-in-stock notifications**
   - When catalog stock changes from sold out to available, load only pending/sourcing requests for that product, notify each registered customer through the existing Firebase push system, and deep-link directly to that product.
   - Add `BACK_IN_STOCK` as an important notification type and record delivery history in the existing notifications table.
   - Mark a request restocked only after that customer has been processed; failed/no-device deliveries remain recorded for operational visibility without blocking the stock update.
   - Keep notifications idempotent so repeated stock edits do not send duplicates.

5. **Verification**
   - Test guest opening → home, cart and wishlist login handoff, OTP return navigation, guest account CTA, low/out-of-stock states, quantity limits, and back-in-stock notification dispatch.
   - Check the opening, login, account, product-card, and product-detail layouts at mobile and desktop sizes.
   - Run the focused tests and project validation, fixing regressions caused by these changes.

## Technical details

- Reuse the existing local guest cart/wishlist caches and merge-on-login behavior; no guest identity table is needed.
- Reuse `stock_alerts`, Firebase device tokens, notification preferences/history, and the existing server-side push sender.
- Add only the minimal notification-history fields/index needed for product-level deep links and de-duplication; no broad security-policy changes.
- Keep all customer stock reads based on the existing catalog stock value and use one shared low-stock threshold of 5.
