// Admin-managed delivery areas. Pure and browser-safe so both the server
// serviceability check and tests use the same matching rules.
import { isQuickArea, type ServiceabilityResult } from "./serviceability";

export type DeliveryZone = {
  id: string;
  name: string;
  /** Text matched inside a typed/geocoded address (lower-case). */
  keyword: string | null;
  pincode: string | null;
  /** Optional map point; with radius_km it covers a circle around it. */
  lat: number | null;
  lng: number | null;
  radius_km: number;
  quick_enabled: boolean;
  eta_minutes: number;
  is_active: boolean;
};

export type ZonedServiceability = ServiceabilityResult & {
  /** Whether Quick (30-minute) delivery is offered at this location. */
  quick: boolean;
  /** The admin delivery area that decided this, if any. */
  zoneId: string | null;
};

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Picks the admin area for a location. A map-point area containing the GPS
 * position wins (smallest circle first); otherwise the longest matching
 * area name/keyword in the address text.
 */
export function matchZone(
  zones: DeliveryZone[],
  text: string,
  coords?: { lat: number; lng: number } | null,
): DeliveryZone | null {
  const active = zones.filter(z => z.is_active);
  if (coords) {
    const inside = active
      .filter(z => z.lat != null && z.lng != null && distanceKm(coords, { lat: z.lat!, lng: z.lng! }) <= Number(z.radius_km || 0))
      .sort((a, b) => Number(a.radius_km) - Number(b.radius_km));
    if (inside[0]) return inside[0];
  }
  const lower = text.toLowerCase();
  if (!lower.trim()) return null;
  const byText = active
    .map(z => ({ z, key: (z.keyword || z.name || "").trim().toLowerCase() }))
    .filter(({ key }) => key.length >= 3 && lower.includes(key))
    .sort((a, b) => b.key.length - a.key.length);
  return byText[0]?.z ?? null;
}

/** Applies the admin's area settings on top of the built-in serviceability result. */
export function applyDeliveryZones(
  base: ServiceabilityResult,
  zones: DeliveryZone[],
  text: string,
  coords?: { lat: number; lng: number } | null,
): ZonedServiceability {
  const zone = matchZone(zones, text, coords);
  if (zone) {
    const eta = Math.max(1, Math.round(Number(zone.eta_minutes) || 15));
    return {
      ...base,
      serviceable: true,
      area: base.area && base.serviceable ? base.area : zone.name,
      pincode: base.pincode ?? zone.pincode,
      etaMinutes: eta,
      reason: `Great news — we deliver to ${zone.name} in about ${eta} min!`,
      quick: zone.quick_enabled,
      zoneId: zone.id,
    };
  }
  const quick = !!base.serviceable && ((base.etaMinutes ?? 99) <= 13 || isQuickArea(text || base.area));
  return { ...base, quick, zoneId: null };
}
