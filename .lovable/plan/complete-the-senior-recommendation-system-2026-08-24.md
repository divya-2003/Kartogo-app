# Complete the Senior Recommendation System

## Confirmed current state
The stopped run did save substantial work: the recommendation database migration and generated types exist, the scoring/replenishment/association engine is present, customer-event tracking is wired into shopping flows, recommendation rows appear on home/cart/product pages, and an admin analytics/settings page exists.

The remaining task is to finish and validate the implementation rather than rebuild it.

## Plan

### 1. Harden the recommendation server boundary
- Refactor `recommendations.functions.ts` into a transform-safe thin server-function wrapper by moving runtime constants, validation helpers, and shared input logic to an imported module.
- Preserve signed customer-token isolation and admin authorization for all recommendation operations.
- Make database failures explicit where they affect correctness while keeping nonessential tracking from interrupting shopping.

### 2. Complete behavior and conversion tracking
- Verify product views, searches, wishlist actions, cart changes, checkout starts, orders, cancellations, recommendation impressions, clicks, and recommendation add-to-cart events reach the engine.
- Ensure completed orders are ingested once and recommendation-origin purchases can be attributed without double counting.
- Correct any missing or disconnected event paths found during verification.

### 3. Validate recommendation quality and fallbacks
- Test recency-weighted personalization, buy-again ranking, replenishment timing, frequently-bought-together associations, similar-item fallback, out-of-stock filtering, cancellation/refund handling, and new-customer popularity fallback.
- Confirm products are deduplicated across sections according to the configured priority.
- Add focused automated tests for deterministic scoring and edge cases where practical.

### 4. Verify customer and admin experiences
- Check the home, cart, and product recommendation sections with both new and returning customer states.
- Verify “Add all,” individual add-to-cart, impression/click tracking, empty states, and responsive layouts.
- Verify admin analytics, scoring controls, save, refresh, and rebuild actions against real backend data.

### 5. Final validation
- Run targeted tests and the project’s normal validation checks.
- Exercise the recommendation server calls and key browser flows end to end.
- Report what was already present, what required completion, and the verified final behavior.

## Success criteria
- Recommendations are generated from real customer/order behavior and never expose another customer’s data.
- All intended events are recorded without duplicates that distort ranking or analytics.
- Only available products appear, with reliable fallbacks for sparse history.
- Customer recommendation surfaces and admin controls work on desktop and mobile.
- Validation completes without recommendation-related errors.
