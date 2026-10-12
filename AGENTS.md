# Architecture rules

- Use browser-safe home section predicates for discovery and search boundaries so category ownership stays consistent across views.
- Share Food and Rides experiences as presentation components between their home tabs and dedicated routes so existing ordering and booking flows stay identical.
- Load dedicated marketplace discovery with existing category-read functions so global home preview limits cannot hide a section's catalog.
- Keep the home top area in normal document flow with a separate sticky search band; scroll-driven header height changes cause scroll anchoring feedback and blinking.
- Enforce bottom-section back destinations through the router history blocker, not dummy browser history entries, so normal detail navigation and forward links remain intact.