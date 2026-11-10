import type { CartItem } from "./store";

/**
 * Combines the cart saved on the account with what was added on this device
 * before logging in. Every product from both lists is kept; when the same
 * product is in both, the larger quantity wins (so re-merging the same cart
 * on reload never doubles it).
 */
export function mergeCartLines(saved: CartItem[], local: CartItem[]): CartItem[] {
  const out: CartItem[] = saved.map((l) => ({ ...l }));
  for (const l of local) {
    const i = out.findIndex((x) => x.productId === l.productId);
    if (i < 0) out.push({ ...l });
    else out[i] = { ...out[i], qty: Math.max(out[i].qty, l.qty), listing: l.listing ?? out[i].listing, unselected: out[i].unselected && l.unselected ? true : undefined };
  }
  return out;
}
