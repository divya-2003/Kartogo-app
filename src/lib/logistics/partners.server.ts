// Phase 1 + 2 — the delivery-partner repository (server only).
//
// `delivery_partners` is the live operational record for a rider: status,
// last known position, active order. It is seeded lazily from the existing
// roster (`driver_availability` + founding riders), so the admin's partner
// management screens stay the single place riders are created.

import type { DeliveryPartner, DriverStatus, GeoPoint, VehicleType } from "./types";
import { GPS_MIN_MOVE_METERS, DRIVER_STALE_MS, GEOFENCE_RADIUS_METERS } from "./types";
import { haversineMeters, isValidPoint } from "./geo";

type Row = {
  id: string;
  driver_id: string;
  name: string;
  mobile_number: string;
  vehicle_type: string;
  current_latitude: number | null;
  current_longitude: number | null;
  status: string;
  online: boolean;
  rating: number;
  rating_count: number;
  completed_orders: number;
  active_order_id: string | null;
  last_location_at: string | null;
};

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export function toPartner(r: Row): DeliveryPartner {
  const point =
    r.current_latitude != null && r.current_longitude != null
      ? { lat: r.current_latitude, lng: r.current_longitude }
      : null;
  return {
    id: r.id,
    driverId: r.driver_id,
    name: r.name,
    mobileNumber: r.mobile_number,
    vehicleType: (r.vehicle_type || "bike") as VehicleType,
    location: isValidPoint(point) ? point : null,
    status: r.status as DriverStatus,
    online: !!r.online,
    rating: Number(r.rating ?? 5),
    ratingCount: Number(r.rating_count ?? 0),
    completedOrders: Number(r.completed_orders ?? 0),
    activeOrderId: r.active_order_id,
    lastLocationAt: r.last_location_at,
  };
}

/** True when the rider's last GPS ping is recent enough to trust. */
export function hasFreshLocation(p: DeliveryPartner): boolean {
  if (!p.lastLocationAt) return false;
  return Date.now() - new Date(p.lastLocationAt).getTime() < DRIVER_STALE_MS;
}

/**
 * Guarantees an operational row exists for a rider on the roster.
 * Idempotent — safe to call on every driver request.
 */
export async function ensurePartner(driverId: string): Promise<DeliveryPartner | null> {
  const supabaseAdmin = await db();
  const { data: existing } = await supabaseAdmin
    .from("delivery_partners")
    .select("*")
    .eq("driver_id", driverId)
    .maybeSingle();
  if (existing) return toPartner(existing as Row);

  const { findRosterDriverById } = await import("../driver-roster.server");
  const roster = await findRosterDriverById(driverId);
  if (!roster) return null;

  const { data, error } = await supabaseAdmin
    .from("delivery_partners")
    .insert({ driver_id: roster.id, name: roster.name, mobile_number: roster.phone })
    .select("*")
    .maybeSingle();
  if (error) {
    // Another concurrent request won the insert — read it back.
    const { data: again } = await supabaseAdmin
      .from("delivery_partners").select("*").eq("driver_id", driverId).maybeSingle();
    return again ? toPartner(again as Row) : null;
  }
  return data ? toPartner(data as Row) : null;
}

export async function getPartner(driverId: string): Promise<DeliveryPartner | null> {
  const supabaseAdmin = await db();
  const { data } = await supabaseAdmin
    .from("delivery_partners").select("*").eq("driver_id", driverId).maybeSingle();
  return data ? toPartner(data as Row) : null;
}

export async function listPartners(): Promise<DeliveryPartner[]> {
  const supabaseAdmin = await db();
  const { data } = await supabaseAdmin
    .from("delivery_partners").select("*").order("name", { ascending: true });
  return ((data ?? []) as Row[]).map(toPartner);
}

/** Riders eligible for a new offer: online, free, and recently seen. */
export async function listDispatchable(): Promise<DeliveryPartner[]> {
  const supabaseAdmin = await db();
  const { data } = await supabaseAdmin
    .from("delivery_partners")
    .select("*")
    .in("status", ["ONLINE", "AVAILABLE"])
    .eq("online", true)
    .is("active_order_id", null);
  return ((data ?? []) as Row[]).map(toPartner);
}

export async function setStatus(
  driverId: string,
  status: DriverStatus,
  opts: { orderId?: string | null; actor?: string } = {},
): Promise<DeliveryPartner | null> {
  const supabaseAdmin = await db();
  const patch = {
    status,
    online: status !== "OFFLINE",
    updated_at: new Date().toISOString(),
    ...(opts.orderId !== undefined ? { active_order_id: opts.orderId } : {}),
  };

  const { data } = await supabaseAdmin
    .from("delivery_partners").update(patch).eq("driver_id", driverId).select("*").maybeSingle();
  return data ? toPartner(data as Row) : null;
}

export type LocationPingResult = {
  accepted: boolean;
  reason?: "no_movement" | "invalid" | "unknown_driver";
  movedMeters?: number;
  /** Set when this ping crossed a 50 m arrival geofence. */
  geofence?: "ARRIVED_AT_STORE" | "ARRIVED_AT_CUSTOMER";
};

/**
 * Phase 2 — record a GPS ping. Pings that moved less than 10 m are dropped so
 * a stationary rider doesn't fill the trail table (still refreshes the
 * heartbeat so they don't look stale).
 */
export async function recordLocation(
  driverId: string,
  point: GeoPoint,
  meta: { accuracy?: number | null; speed?: number | null; heading?: number | null; orderId?: string | null } = {},
): Promise<LocationPingResult> {
  if (!isValidPoint(point)) return { accepted: false, reason: "invalid" };
  const supabaseAdmin = await db();
  const partner = await getPartner(driverId);
  if (!partner) return { accepted: false, reason: "unknown_driver" };

  const moved = partner.location ? haversineMeters(partner.location, point) : Infinity;
  const now = new Date().toISOString();

  if (moved < GPS_MIN_MOVE_METERS) {
    await supabaseAdmin
      .from("delivery_partners")
      .update({ last_location_at: now })
      .eq("driver_id", driverId);
    return { accepted: false, reason: "no_movement", movedMeters: moved };
  }

  await supabaseAdmin
    .from("delivery_partners")
    .update({
      current_latitude: point.lat,
      current_longitude: point.lng,
      last_location_at: now,
      updated_at: now,
    })
    .eq("driver_id", driverId);

  await supabaseAdmin.from("driver_locations").insert({
    driver_id: driverId,
    latitude: point.lat,
    longitude: point.lng,
    accuracy: meta.accuracy ?? null,
    speed: meta.speed ?? null,
    heading: meta.heading ?? null,
    order_id: meta.orderId ?? partner.activeOrderId,
  });

  const geofence = await applyGeofence(partner.driverId, partner.status, partner.activeOrderId, point);

  return { accepted: true, movedMeters: Number.isFinite(moved) ? moved : 0, ...(geofence ? { geofence } : {}) };
}

/**
 * Geofenced arrivals — the rider never taps "I reached the store".
 *
 * Whenever an accepted assignment has a pickup/drop pin, crossing inside the
 * 50 m radius flips the status automatically and writes an audit event. It is
 * idempotent: once the status has already advanced, nothing happens.
 */
async function applyGeofence(
  driverId: string,
  status: DriverStatus,
  orderId: string | null,
  point: GeoPoint,
): Promise<"ARRIVED_AT_STORE" | "ARRIVED_AT_CUSTOMER" | null> {
  if (!orderId) return null;
  const supabaseAdmin = await db();
  const { data: assignment } = await supabaseAdmin
    .from("delivery_assignments")
    .select("pickup_latitude, pickup_longitude, drop_latitude, drop_longitude")
    .eq("order_id", orderId)
    .eq("driver_id", driverId)
    .eq("status", "ACCEPTED")
    .maybeSingle();
  if (!assignment) return null;

  const pickup = { lat: assignment.pickup_latitude as number, lng: assignment.pickup_longitude as number };
  const drop = { lat: assignment.drop_latitude as number, lng: assignment.drop_longitude as number };

  const near = (target: GeoPoint) =>
    isValidPoint(target) && haversineMeters(point, target) <= GEOFENCE_RADIUS_METERS;

  let next: "ARRIVED_AT_STORE" | "ARRIVED_AT_CUSTOMER" | null = null;
  if ((status === "ASSIGNED" || status === "PICKING_ORDER") && near(pickup)) next = "ARRIVED_AT_STORE";
  else if (status === "EN_ROUTE" && near(drop)) next = "ARRIVED_AT_CUSTOMER";
  if (!next) return null;

  await setStatus(driverId, next, { orderId, actor: "geofence" });
  const { logEvent } = await import("./dispatch.server");
  await logEvent(orderId, next === "ARRIVED_AT_STORE" ? "arrived_at_store" : "arrived_at_customer", {
    driverId,
    actor: "geofence",
    payload: { lat: point.lat, lng: point.lng, radiusMeters: GEOFENCE_RADIUS_METERS },
  });
  return next;
}

/** Phase 9 — last known location is what we fall back to when GPS drops out. */
export async function lastKnownLocation(driverId: string): Promise<GeoPoint | null> {
  const partner = await getPartner(driverId);
  if (partner?.location) return partner.location;
  const supabaseAdmin = await db();
  const { data } = await supabaseAdmin
    .from("driver_locations")
    .select("latitude, longitude")
    .eq("driver_id", driverId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { lat: data.latitude as number, lng: data.longitude as number } : null;
}
