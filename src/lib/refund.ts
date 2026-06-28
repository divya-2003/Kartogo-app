import type { Order } from "./store";
import type { Product } from "./data";

// Refund/return windows per the Refund & Returns Policy, expressed in hours
// from the moment the order is delivered.
//   - Fresh / perishable products: 2 hours
//   - Packaged grocery & FMCG:     24 hours
//   - Household & non-food:        3 days (72 hours)
export const REFUND_WINDOW_HOURS = {
  fresh: 2,
  packaged: 24,
  household: 72,
} as const;

type WindowKind = keyof typeof REFUND_WINDOW_HOURS;

// Map each catalog category to the policy bucket it belongs to. Anything not
// listed falls back to the packaged-grocery window (24 hours).
const CATEGORY_WINDOW: Record<string, WindowKind> = {
  "tiffin-batter": "fresh",
  "local-snacks": "fresh",
  snacks: "packaged",
  "instant-food": "packaged",
  "spice-powders": "packaged",
  pickles: "packaged",
  beverages: "packaged",
  grooming: "packaged",
  stationery: "household",
  pooja: "household",
};

export function categoryWindowKind(category: string): WindowKind {
  return CATEGORY_WINDOW[category] ?? "packaged";
}

export type RefundEligibility = {
  // The order is eligible for a refund request right now.
  eligible: boolean;
  // Order has been delivered (refunds only apply after delivery).
  delivered: boolean;
  // The longest applicable window across the order's items, in hours.
  windowHours: number;
  // Human label for the window (e.g. "24 hours").
  windowLabel: string;
  // When the refund window closes (epoch ms), or null if not delivered.
  deadline: number | null;
  // Whole hours/minutes remaining before the window closes (0 if expired).
  hoursLeft: number;
  minutesLeft: number;
};

function labelForHours(hours: number): string {
  if (hours >= 24) {
    const days = Math.round(hours / 24);
    return days === 1 ? "24 hours" : `${days} days`;
  }
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

// Computes whether an order can still be refunded based on policy time. We use
// the LONGEST applicable window across the order's items so a customer keeps
// eligibility while at least one item is still within its policy window.
export function refundEligibility(
  order: Order,
  products: Product[],
  deliveredAt: number | undefined,
  now: number,
): RefundEligibility {
  const delivered = order.status === "delivered";

  const windowHours = order.items.reduce<number>((max, item) => {
    const product = products.find((p) => p.id === item.productId);
    const kind = categoryWindowKind(product?.category ?? "");
    return Math.max(max, REFUND_WINDOW_HOURS[kind]);
  }, REFUND_WINDOW_HOURS.fresh);

  const windowLabel = labelForHours(windowHours);

  if (!delivered || !deliveredAt) {
    return {
      eligible: false,
      delivered,
      windowHours,
      windowLabel,
      deadline: null,
      hoursLeft: 0,
      minutesLeft: 0,
    };
  }

  const deadline = deliveredAt + windowHours * 60 * 60 * 1000;
  const msLeft = deadline - now;
  const eligible = msLeft > 0;
  const totalMinutes = Math.max(0, Math.floor(msLeft / 60000));

  return {
    eligible,
    delivered,
    windowHours,
    windowLabel,
    deadline,
    hoursLeft: Math.floor(totalMinutes / 60),
    minutesLeft: totalMinutes % 60,
  };
}
