// Dynamic driver payout engine — pure functions, safe on client and server.
//
// A rider's take for one delivery is not a flat fee: it scales with the road
// distance they ride, the time of day, how stretched the fleet is right now,
// and the weather. Everything here is deterministic and unit-testable so the
// driver portal can preview the exact number the server will pay out.

export const BASE_PAYOUT = 25; // ₹ — the guaranteed minimum per delivery
export const PER_KM_RATE = 6; // ₹ per km beyond the free radius
export const FREE_RADIUS_KM = 3.5;
export const MAX_PAYOUT = 220; // safety cap so a bad geocode can't drain payouts
export const BATCH_BONUS = 12; // ₹ per extra order carried in the same run

/** Meal-time and late-night windows where riders are hardest to find. */
export function peakMultiplier(at: Date): { factor: number; label: string | null } {
  const h = at.getHours();
  if (h >= 19 && h <= 22) return { factor: 1.35, label: "Dinner peak" };
  if (h >= 11 && h <= 14) return { factor: 1.2, label: "Lunch peak" };
  if (h >= 23 || h < 6) return { factor: 1.4, label: "Late night" };
  return { factor: 1, label: null };
}

/** Rough traffic drag by hour — office rush costs the rider time, not distance. */
export function trafficMultiplier(at: Date): { factor: number; label: string | null } {
  const h = at.getHours();
  if ((h >= 9 && h <= 11) || (h >= 17 && h <= 20)) return { factor: 1.15, label: "Heavy traffic" };
  return { factor: 1, label: null };
}

export type Weather = "clear" | "rain" | "heavy_rain" | "heat";

export function weatherMultiplier(w: Weather): { factor: number; label: string | null } {
  switch (w) {
    case "heavy_rain":
      return { factor: 1.4, label: "Heavy rain" };
    case "rain":
      return { factor: 1.2, label: "Rain" };
    case "heat":
      return { factor: 1.1, label: "Extreme heat" };
    default:
      return { factor: 1, label: null };
  }
}

/**
 * Demand pressure = orders waiting for a rider / riders free to take them.
 * 1 order per free rider is healthy; 3+ means we must pay up to pull riders on.
 */
export function demandMultiplier(waitingOrders: number, freeDrivers: number) {
  const ratio = waitingOrders / Math.max(1, freeDrivers);
  if (ratio >= 3) return { factor: 1.5, label: "Very high demand" };
  if (ratio >= 2) return { factor: 1.3, label: "High demand" };
  if (ratio >= 1.25) return { factor: 1.15, label: "Busy" };
  return { factor: 1, label: null };
}

export interface PayoutInput {
  distanceMeters: number;
  at?: Date;
  waitingOrders?: number;
  freeDrivers?: number;
  weather?: Weather;
  /** Extra orders carried alongside this one in a batched run. */
  batchedWith?: number;
}

export interface PayoutQuote {
  amount: number;
  base: number;
  distanceComponent: number;
  batchBonus: number;
  multiplier: number;
  /** Human-readable drivers of the surge, e.g. ["Dinner peak", "Rain"]. */
  reasons: string[];
}

export function quoteDriverPayout(input: PayoutInput): PayoutQuote {
  const at = input.at ?? new Date();
  const km = Math.max(0, (Number(input.distanceMeters) || 0) / 1000);
  const distanceComponent = Math.round(Math.max(0, km - FREE_RADIUS_KM) * PER_KM_RATE);
  const batchBonus = Math.max(0, input.batchedWith ?? 0) * BATCH_BONUS;

  const parts = [
    peakMultiplier(at),
    trafficMultiplier(at),
    weatherMultiplier(input.weather ?? "clear"),
    demandMultiplier(input.waitingOrders ?? 0, input.freeDrivers ?? 1),
  ];
  const multiplier = parts.reduce((m, p) => m * p.factor, 1);
  const reasons = parts.map((p) => p.label).filter((l): l is string => !!l);

  const amount = Math.min(
    MAX_PAYOUT,
    Math.round((BASE_PAYOUT + distanceComponent) * multiplier) + batchBonus,
  );

  return {
    amount,
    base: BASE_PAYOUT,
    distanceComponent,
    batchBonus,
    multiplier: Math.round(multiplier * 100) / 100,
    reasons,
  };
}
