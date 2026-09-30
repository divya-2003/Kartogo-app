// Which grocery products are eligible for Quick (30-minute) delivery.
// Quick stock is the fast-moving shelf kept in the dark store; the rest is
// packed same day by partner markets and goes out on Standard.
import type { Product } from "@/lib/data";

export const QUICK_CATEGORIES = new Set([
  "snacks",
  "instant-food",
  "beverages",
  "grooming",
  "stationery",
  "pooja",
  "local-snacks",
  "pharmacy",
]);

export function isQuickProduct(p: Pick<Product, "category">): boolean {
  return QUICK_CATEGORIES.has(p.category);
}

export type DeliveryTier = "quick" | "standard";

export function tierOf(p: Pick<Product, "category">): DeliveryTier {
  return isQuickProduct(p) ? "quick" : "standard";
}

/** Customer-facing expected delivery time per tier. */
export function tierEta(tier: DeliveryTier, quickMinutes?: number): string {
  return tier === "quick" ? `${quickMinutes ?? 15}–30 mins` : "Today, by 8 PM";
}

export const TIER_LABEL: Record<DeliveryTier, string> = {
  quick: "Quick delivery",
  standard: "Standard delivery",
};
