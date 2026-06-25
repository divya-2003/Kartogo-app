// Shared promo-code rules. Client-safe (pure data + math) so the checkout UI can
// preview discounts, while the server uses the exact same logic to validate them
// authoritatively at order time.
export type Coupon = {
  type: "flat" | "pct";
  value: number;
  minSubtotal: number;
  maxOff?: number;
  desc: string;
};

export const COUPONS: Record<string, Coupon> = {
  SAVE50: { type: "flat", value: 50, minSubtotal: 299, desc: "₹50 off on orders above ₹299" },
  KART10: { type: "pct", value: 10, minSubtotal: 199, maxOff: 100, desc: "10% off (up to ₹100) above ₹199" },
  BIG100: { type: "flat", value: 100, minSubtotal: 599, desc: "₹100 off on orders above ₹599" },
};

export function computeDiscount(code: string | null, subtotal: number): number {
  if (!code) return 0;
  const c = COUPONS[code.toUpperCase()];
  if (!c || subtotal < c.minSubtotal) return 0;
  const raw = c.type === "flat" ? c.value : Math.floor((subtotal * c.value) / 100);
  const capped = c.maxOff ? Math.min(raw, c.maxOff) : raw;
  return Math.min(capped, subtotal);
}

export function deliveryFee(subtotal: number): number {
  if (subtotal === 0) return 0;
  return subtotal >= 199 ? 0 : 25;
}
