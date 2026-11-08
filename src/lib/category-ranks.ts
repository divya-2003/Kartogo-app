// Browser-safe helpers for admin-chosen 1st / 2nd / 3rd products per Shop category.
// A product reference is a catalog product id, or "mp:<listingId>" for a
// local-store (marketplace) listing.

export type CategoryRank = { category_slug: string; rank: number; product_ref: string };

export const MAX_RANK = 3;
export const listingRef = (listingId: string) => `mp:${listingId}`;

/** product_ref -> rank (1 = top) for the given categories; the best rank wins. */
export function rankLookup(ranks: readonly CategoryRank[], categorySlugs: readonly string[]): Map<string, number> {
  const want = new Set(categorySlugs);
  const out = new Map<string, number>();
  for (const r of ranks) {
    if (!want.has(r.category_slug) || r.rank < 1 || r.rank > MAX_RANK) continue;
    const prev = out.get(r.product_ref);
    if (prev === undefined || r.rank < prev) out.set(r.product_ref, r.rank);
  }
  return out;
}

/** Ranked items first (1, 2, 3), everything else keeps its original order. */
export function sortByRank<T>(items: readonly T[], refOf: (item: T) => string, ranks: Map<string, number>): T[] {
  return items
    .map((item, index) => ({ item, index, rank: ranks.get(refOf(item)) ?? Infinity }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(x => x.item);
}

/** Cleans an admin's three picks: blanks dropped, duplicates removed, order kept. */
export function normalizePicks(picks: readonly (string | null | undefined)[]): { rank: number; product_ref: string }[] {
  const seen = new Set<string>();
  const out: { rank: number; product_ref: string }[] = [];
  picks.slice(0, MAX_RANK).forEach((p, i) => {
    const ref = (p ?? "").trim();
    if (!ref || seen.has(ref)) return;
    seen.add(ref);
    out.push({ rank: i + 1, product_ref: ref });
  });
  return out;
}

export const rankLabel = (rank: number) => (rank === 1 ? "1st" : rank === 2 ? "2nd" : rank === 3 ? "3rd" : `${rank}th`);
