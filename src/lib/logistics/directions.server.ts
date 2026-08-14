import { fetchWithRetry } from "@/lib/retry";
// Phase 6 — routing / ETA.
//
// Uses the Google Directions API when GOOGLE_MAPS_API_KEY is configured and
// degrades to a straight-line estimate otherwise, so the product never breaks
// because of a missing key or a provider outage.

import { haversineMeters, estimateDurationSeconds } from "./geo";
import type { GeoPoint, RouteEstimate } from "./types";

function fallback(origin: GeoPoint, dest: GeoPoint): RouteEstimate {
  // City roads are rarely straight — 1.35x is a reasonable detour factor.
  const distanceMeters = Math.round(haversineMeters(origin, dest) * 1.35);
  return {
    distanceMeters,
    durationSeconds: estimateDurationSeconds(distanceMeters),
    polyline: null,
    source: "estimate",
  };
}

export async function getRoute(
  origin: GeoPoint,
  dest: GeoPoint,
  waypoint?: GeoPoint | null,
): Promise<RouteEstimate> {
  const key = process.env["GOOGLE_MAPS_API_KEY"];
  if (!key) return fallback(origin, dest);

  try {
    const params = new URLSearchParams({
      origin: `${origin.lat},${origin.lng}`,
      destination: `${dest.lat},${dest.lng}`,
      mode: "driving",
      departure_time: "now",
      key,
    });
    if (waypoint) params.set("waypoints", `${waypoint.lat},${waypoint.lng}`);

    const res = await fetchWithRetry(`https://maps.googleapis.com/maps/api/directions/json?${params}`, undefined, { label: "google-directions" });
    if (!res.ok) return fallback(origin, dest);
    const json = (await res.json()) as {
      status?: string;
      routes?: {
        overview_polyline?: { points?: string };
        legs?: { distance?: { value?: number }; duration_in_traffic?: { value?: number }; duration?: { value?: number } }[];
      }[];
    };
    const route = json.status === "OK" ? json.routes?.[0] : null;
    if (!route?.legs?.length) return fallback(origin, dest);

    let distanceMeters = 0;
    let durationSeconds = 0;
    for (const leg of route.legs) {
      distanceMeters += leg.distance?.value ?? 0;
      durationSeconds += leg.duration_in_traffic?.value ?? leg.duration?.value ?? 0;
    }
    if (!distanceMeters) return fallback(origin, dest);
    return {
      distanceMeters,
      durationSeconds,
      polyline: route.overview_polyline?.points ?? null,
      source: "google_directions",
    };
  } catch (e) {
    console.error("Directions API failed", e);
    return fallback(origin, dest);
  }
}

/** Best-effort geocode of a free-text delivery address. Returns null quietly. */
export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  const key = process.env["GOOGLE_MAPS_API_KEY"];
  if (!key || !address.trim()) return null;
  try {
    const params = new URLSearchParams({ address, region: "in", key });
    const res = await fetchWithRetry(`https://maps.googleapis.com/maps/api/geocode/json?${params}`, undefined, { label: "google-geocode" });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      status?: string;
      results?: { geometry?: { location?: { lat: number; lng: number } } }[];
    };
    const loc = json.status === "OK" ? json.results?.[0]?.geometry?.location : null;
    return loc ? { lat: loc.lat, lng: loc.lng } : null;
  } catch {
    return null;
  }
}
