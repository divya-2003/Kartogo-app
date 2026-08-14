// Phase 7 — geo indexing.
//
// A dependency-free spatial grid index. Candidates are bucketed into ~1km
// cells around the pickup point, so the nearest-rider search walks rings
// outward instead of sorting the whole fleet. It implements the same
// `GeoIndex` contract a Redis GEO / PostGIS upgrade would, so swapping the
// implementation later is a single `registerLogisticsCapability` call.

import { haversineMeters } from "./geo";
import {
  registerLogisticsCapability,
  logisticsCapabilities,
  type DriverCandidate,
  type GeoIndex,
  type GeoPoint,
} from "./types";

/** Cell size in degrees (~1.1 km of latitude). */
const CELL = 0.01;

function cellKey(p: GeoPoint): string {
  return `${Math.floor(p.lat / CELL)}:${Math.floor(p.lng / CELL)}`;
}

export const gridGeoIndex: GeoIndex = {
  async nearest(origin, candidates, limit) {
    if (candidates.length <= limit) {
      return [...candidates].sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, limit);
    }

    const buckets = new Map<string, DriverCandidate[]>();
    for (const c of candidates) {
      const key = cellKey(c.location);
      const list = buckets.get(key);
      if (list) list.push(c);
      else buckets.set(key, [c]);
    }

    const baseLat = Math.floor(origin.lat / CELL);
    const baseLng = Math.floor(origin.lng / CELL);
    const picked: DriverCandidate[] = [];

    // Walk rings outward until we have enough candidates (or run out of grid).
    for (let ring = 0; ring <= 12 && picked.length < limit * 3; ring++) {
      for (let dLat = -ring; dLat <= ring; dLat++) {
        for (let dLng = -ring; dLng <= ring; dLng++) {
          // Only the outer edge of each ring is new.
          if (ring > 0 && Math.abs(dLat) !== ring && Math.abs(dLng) !== ring) continue;
          const list = buckets.get(`${baseLat + dLat}:${baseLng + dLng}`);
          if (list) picked.push(...list);
        }
      }
    }

    const pool = picked.length ? picked : candidates;
    return pool
      .map((c) => ({ ...c, distanceMeters: haversineMeters(origin, c.location) }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, limit);
  },
};

/** Idempotent — safe to import from several server modules. */
export function ensureGeoIndex() {
  if (!logisticsCapabilities.geoIndex) registerLogisticsCapability("geoIndex", gridGeoIndex);
}
