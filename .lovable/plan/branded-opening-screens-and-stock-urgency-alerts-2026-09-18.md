# Branded opening screens and stock urgency alerts

## What will change

1. **Opening and login branding**
   - Use the navy sampled from the second reference image as the shared opening/login background.
   - Replace the current wordmark with the first reference’s Kartogo artwork, prepared with a transparent background so no mismatched rectangle appears.
   - Keep the existing layout, form, tagline, and login behavior unchanged.

2. **Low-stock urgency for customers**
   - Show a clear “Only X left” badge on product cards and product details when available stock is low.
   - Keep exact stock counts hidden for normal-stock items.
   - Prevent quantity controls from exceeding the available stock.

3. **Back-in-stock notifications**
   - Keep the existing “Notify me” action for sold-out products.
   - When an admin or supplier changes an item from sold out to available, automatically notify every customer waiting for that product through the existing notification system.
   - The alert opens the restored product directly, records notification history, and marks the matching requests as restocked only after processing.

4. **Stability and verification**
   - Fix the current admin navigation crash caused by a missing permissions list.
   - Verify the login/opening screens at the current mobile size, the low-stock/out-of-stock states, and the back-in-stock server flow.

## Technical details

- Low stock uses a customer-facing threshold of 5 remaining units.
- Extend the existing push types with `BACK_IN_STOCK` and a product deep link.
- Reuse the existing customer tokens, preferences, notification history, Firebase delivery, and stock-alert records; no new database table is needed.
- Existing inventory alert rules for admins and suppliers remain unchanged.
