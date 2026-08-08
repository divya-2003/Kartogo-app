// Geo helpers — pure functions, safe on client and server.
import type { GeoPoint } from "./types";

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Average city riding speed used when the Directions API is unavailable. */
export const FALLBACK_SPEED_KMPH = 22;

export function estimateDurationSeconds(distanceMeters: number): number {
  return Math.round((distanceMeters / 1000 / FALLBACK_SPEED_KMPH) * 3600);
}

export function formatDistance(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters)) return "—";
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

export function formatEta(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return "—";
  if (minutes < 1) return "Arriving now";
  return `${Math.round(minutes)} min`;
}

export function isValidPoint(p: Partial<GeoPoint> | null | undefined): p is GeoPoint {
  return (
    !!p &&
    typeof p.lat === "number" &&
    typeof p.lng === "number" &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180 &&
    !(p.lat === 0 && p.lng === 0)
  );
}

/** Google Maps deep link for turn-by-turn navigation. */
export function directionsUrl(dest: GeoPoint | string): string {
  const q = typeof dest === "string" ? encodeURIComponent(dest) : `${dest.lat},${dest.lng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`;
}

/** Static preview map for a point (no API key required for the embed link). */
export function mapLink(point: GeoPoint): string {
  return `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`;
}
