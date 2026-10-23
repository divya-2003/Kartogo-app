# Architecture rules

- Persist multi-stop deliveries as transactionally claimed trips; stop completion and cancellation cleanup must preserve pickup-before-drop ordering and rider occupancy.
- Resolve pickup stores from inventory reservation allocations, failing closed for ambiguous legacy ownership; validate multi-store road time before batching.
- Reuse the Home location selector at checkout so saved addresses and exact delivery details share one source of truth.

- Use browser-safe home section predicates for discovery and search boundaries so category ownership stays consistent across views.
- Share Food and Rides experiences as presentation components between their home tabs and dedicated routes so existing ordering and booking flows stay identical.
- Load dedicated marketplace discovery with existing category-read functions so global home preview limits cannot hide a section's catalog.
- Keep the home top area in normal document flow with a separate sticky search band; scroll-driven header height changes cause scroll anchoring feedback and blinking.
- Use the router history blocker for customer bottom-section backward traversal, await POP restoration before replacing with Home, and preserve explicit customer-home intent so portal auto-redirects cannot override it; never insert dummy history entries or intercept forward/detail navigation.- Keep every role's session keys mirrored into long-lived cookies and silently re-signed through the session keeper; route guards must never sign anyone out on a network error, so accounts survive storage wipes and expiry.
