import type { GeoPoint } from "./types";
import { haversineMeters } from "./geo";
import { bearingDegrees, bearingDelta, MAX_BATCH_SIZE, MAX_DETOUR_METERS, CORRIDOR_BEARING_DEGREES } from "./batching";

export const SIDE_BY_SIDE_METERS = 200;
export const EXTRA_PICKUP_SECONDS = 240;
export type TripStop = { kind: "pickup" | "drop"; orderId: string; marketId: string; label: string; address: string; point: GeoPoint | null; done: boolean };
export type TripOrder = { id: string; ready: boolean; quick: boolean; pickups: TripStop[]; drop: TripStop };
export type RiderTrip = { id: string; orderIds: string[]; stops: TripStop[] };

/** Conservative shared-store/side-by-side eligibility. Unknown coordinates never batch. */
export function compatibleTrip(orders: TripOrder[], extraPickupSeconds: number | null): boolean {
  if (!orders.length || orders.length > MAX_BATCH_SIZE || orders.some(o => !o.ready)) return false;
  const stores = new Map(orders.flatMap(o => o.pickups).map(s => [s.marketId, s]));
  if (stores.size > 2 || stores.size === 0) return false;
  const points = [...stores.values()].map(s => s.point);
  if (points.some(p => !p)) return orders.length === 1 && stores.size === 1;
  if (stores.size === 2) {
    const [a, b] = points;
    if (!a || !b || haversineMeters(a, b) > SIDE_BY_SIDE_METERS || extraPickupSeconds === null || extraPickupSeconds > EXTRA_PICKUP_SECONDS) return false;
  }
  const origin = points[0];
  const anchor = orders[0]?.drop.point;
  if (!origin || !anchor) return orders.length === 1 && stores.size === 1;
  return orders.every(o => o.drop.point && haversineMeters(anchor, o.drop.point) <= MAX_DETOUR_METERS && bearingDelta(bearingDegrees(origin, anchor), bearingDegrees(origin, o.drop.point)) <= CORRIDOR_BEARING_DEGREES);
}

function permutations<T>(items: T[]): T[][] {
  if (!items.length) return [[]];
  return items.flatMap((item, i) => permutations(items.filter((_, j) => j !== i)).map(tail => [item, ...tail]));
}

/** Exhaustive distance minimization for at most two stores and three drops. */
export function sequenceStops(origin: GeoPoint | null, orders: TripOrder[]): TripStop[] {
  const groups = [...new Set(orders.flatMap(o => o.pickups.map(p => p.marketId)))].map(id => orders.flatMap(o => o.pickups).filter(p => p.marketId === id));
  const drops = orders.map(o => o.drop);
  let best = [...groups.flat(), ...drops];
  let bestDistance = Infinity;
  for (const pickups of permutations(groups)) for (const deliveries of permutations(drops)) {
    const route = [...pickups.flat(), ...deliveries];
    let last = origin ?? route[0]?.point;
    let distance = 0;
    for (const stop of route) {
      if (last && stop.point) distance += haversineMeters(last, stop.point);
      last = stop.point ?? last;
    }
    if (distance < bestDistance) { best = route; bestDistance = distance; }
  }
  return best;
}