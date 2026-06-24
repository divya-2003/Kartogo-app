import type { OrderStatus } from "./store";

// Typical minutes spent moving FROM each status to the next. Used to estimate
// arrival time from the moment the order entered its current status.
const STAGE_MINUTES: Record<Exclude<OrderStatus, "cancelled" | "delivered">, number> = {
  placed: 3,
  packed: 4,
  out_for_delivery: 10,
};

const ORDER: OrderStatus[] = ["placed", "packed", "out_for_delivery", "delivered"];

// Minutes still expected from the current status until delivery.
export function remainingMinutes(status: OrderStatus): number {
  if (status === "delivered" || status === "cancelled") return 0;
  const idx = ORDER.indexOf(status);
  let total = 0;
  for (let i = idx; i < ORDER.length - 1; i++) {
    const s = ORDER[i] as keyof typeof STAGE_MINUTES;
    total += STAGE_MINUTES[s] ?? 0;
  }
  return total;
}

/**
 * Estimate arrival text from the time the order entered its current status.
 * `statusSince` is the changed_at timestamp from the order status log.
 */
export function etaText(status: OrderStatus, statusSince: number | undefined, now: number = Date.now()): string | null {
  if (status === "delivered" || status === "cancelled") return null;
  const since = statusSince ?? now;
  const etaAt = since + remainingMinutes(status) * 60_000;
  const minsLeft = Math.round((etaAt - now) / 60_000);
  if (minsLeft <= 0) return "Arriving any moment";
  if (minsLeft === 1) return "Arriving in 1 min";
  return `Arriving in ${minsLeft} mins`;
}

/**
 * Human-friendly total delivery duration between two timestamps (ms).
 * e.g. "12 mins", "1 hr 5 mins", "45 secs".
 */
export function formatDeliveryDuration(fromMs: number, toMs: number): string {
  const totalSecs = Math.max(0, Math.round((toMs - fromMs) / 1000));
  if (totalSecs < 60) return `${totalSecs} sec${totalSecs === 1 ? "" : "s"}`;
  const totalMins = Math.round(totalSecs / 60);
  if (totalMins < 60) return `${totalMins} min${totalMins === 1 ? "" : "s"}`;
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const hrPart = `${hrs} hr${hrs === 1 ? "" : "s"}`;
  return mins === 0 ? hrPart : `${hrPart} ${mins} min${mins === 1 ? "" : "s"}`;
}
