// Shared promo-code rules. Client-safe (pure data + math) so the checkout UI can
// preview discounts, while the server uses the exact same logic to validate them
// authoritatively at order time.
//
// Codes now live in the database (admin-managed, with validity windows and
// usage limits). The constants below stay as an offline fallback so the cart
// still prices correctly if the promo table cannot be read.

export type PromoRule = {
  code: string;
  description: string;
  discountType: "flat" | "pct";
  discountValue: number;
  minSubtotal: number;
  maxDiscount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  perCustomerLimit: number;
  firstOrderOnly: boolean;
  isActive: boolean;
};

export type Coupon = {
  type: "flat" | "pct";
  value: number;
  minSubtotal: number;
  maxOff?: number;
  desc: string;
};

export const COUPONS: Record<string, Coupon> = {
  SAVE50: { type: "flat", value: 50, minSubtotal: 1000, desc: "₹50 off on orders above ₹1000" },
  SAVE100: { type: "flat", value: 100, minSubtotal: 1800, desc: "₹100 off on orders above ₹1800" },
  SAVE150: { type: "flat", value: 150, minSubtotal: 1999, desc: "₹150 off on orders above ₹1999" },
};

/** Discount a single rule yields on a subtotal (0 when the floor isn't met). */
export function discountForRule(rule: PromoRule, subtotal: number): number {
  if (!rule.isActive || subtotal < rule.minSubtotal) return 0;
  const now = Date.now();
  if (rule.startsAt && new Date(rule.startsAt).getTime() > now) return 0;
  if (rule.endsAt && new Date(rule.endsAt).getTime() < now) return 0;
  const raw =
    rule.discountType === "flat"
      ? rule.discountValue
      : Math.floor((subtotal * rule.discountValue) / 100);
  const capped = rule.maxDiscount ? Math.min(raw, rule.maxDiscount) : raw;
  return Math.max(0, Math.min(Math.round(capped), subtotal));
}

export function computeDiscount(
  code: string | null,
  subtotal: number,
  rules?: PromoRule[],
): number {
  if (!code) return 0;
  const upper = code.toUpperCase();
  const rule = rules?.find((r) => r.code === upper);
  if (rule) return discountForRule(rule, subtotal);

  const c = COUPONS[upper];
  if (!c || subtotal < c.minSubtotal) return 0;
  const raw = c.type === "flat" ? c.value : Math.floor((subtotal * c.value) / 100);
  const capped = c.maxOff ? Math.min(raw, c.maxOff) : raw;
  return Math.min(capped, subtotal);
}

export function deliveryFee(subtotal: number): number {
  if (subtotal === 0) return 0;
  return subtotal >= 199 ? 0 : 25;
}

/** Deterministic, readable referral code from a phone number. */
export function referralCodeFor(phone: string, name = ""): string {
  const initials = (name.trim().split(/\s+/)[0] ?? "KART").replace(/[^a-zA-Z]/g, "").slice(0, 4).toUpperCase();
  const tail = phone.replace(/\D/g, "").slice(-4);
  return `${initials || "KART"}${tail || "0000"}`;
}

/** What a referrer and a referred friend each get, in rupees. */
export const REFERRAL_REWARD = 50;
