// Corridor batching — pure geometry, safe on client and server.
//
// Two orders belong in the same rider run when they leave the same store and
// their drop points sit along the same corridor: similar compass bearing from
// the store and a short detour between the drops. That keeps multi-order runs
// fast instead of zig-zagging a rider across town.

import type { GeoPoint } from "./types";
import { haversineMeters } from "./geo";

/** Max orders one rider carries in a single run. */
export const MAX_BATCH_SIZE = 3;
/** Drops more than this far apart never batch, however similar the bearing. */
export const MAX_DETOUR_METERS = 1_200;
/** Half-width of the corridor, in degrees of bearing from the pickup point. */
export const CORRIDOR_BEARING_DEGREES = 30;

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Initial compass bearing from `a` to `b`, 0–360°. */
export function bearingDegrees(a: GeoPoint, b: GeoPoint): number {
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Smallest angle between two bearings, 0–180°. */
export function bearingDelta(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export interface BatchCandidate {
  orderId: string;
  /** Store the order is picked from — orders never batch across stores. */
  marketId: string | null;
  drop: GeoPoint;
  /** Older orders anchor a batch so nothing waits while newer orders pile on. */
  createdAt: string;
}

export interface OrderBatch {
  orderIds: string[];
  marketId: string | null;
  /** Total drop-to-drop distance the rider rides after the pickup. */
  legMeters: number;
}

/**
 * Group candidates into corridor runs. Oldest order anchors each batch; the
 * remaining orders join when they share the store, the bearing corridor and a
 * short detour from the anchor's drop.
 */
export function buildBatches(pickup: GeoPoint, candidates: BatchCandidate[]): OrderBatch[] {
  const pool = [...candidates].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const batches: OrderBatch[] = [];

  while (pool.length > 0) {
    const anchor = pool.shift()!;
    const anchorBearing = bearingDegrees(pickup, anchor.drop);
    const group = [anchor];
    let legMeters = 0;
    let last = anchor.drop;

    for (let i = 0; i < pool.length && group.length < MAX_BATCH_SIZE; ) {
      const c = pool[i]!;
      const sameStore = (c.marketId ?? null) === (anchor.marketId ?? null);
      const alongCorridor =
        bearingDelta(anchorBearing, bearingDegrees(pickup, c.drop)) <= CORRIDOR_BEARING_DEGREES;
      const detour = haversineMeters(last, c.drop);

      if (sameStore && alongCorridor && detour <= MAX_DETOUR_METERS) {
        group.push(c);
        legMeters += detour;
        last = c.drop;
        pool.splice(i, 1);
      } else {
        i += 1;
      }
    }

    batches.push({
      orderIds: group.map((g) => g.orderId),
      marketId: anchor.marketId,
      legMeters: Math.round(legMeters),
    });
  }

  return batches;
}
