// Phases 3, 4, 7, 9 — the dispatch engine (server only).
//
// One order, one active offer. When a supplier accepts an order we rank the
// available riders by distance to the pickup store and offer the order to the
// nearest one for 20 seconds. Accept locks it; reject or timeout rolls the
// offer to the next nearest rider. The customer never sees the churn — the
// order simply stays "Preparing" until someone accepts.
//
// Ranking goes through `logisticsCapabilities.dispatch` when a smarter
// strategy (AI dispatch, batching) is registered later; the default is pure
// distance, which is the right call for a startup launch.

import {
  ACCEPT_WINDOW_SECONDS,
  logisticsCapabilities,
  type DeliveryEventType,
  type DriverCandidate,
  type GeoPoint,
} from "./types";
import { ensureGeoIndex } from "./geo-index";
import { haversineMeters, isValidPoint } from "./geo";
import { quoteDriverPayout, type PayoutQuote } from "./pricing";
import { buildBatches, MAX_BATCH_SIZE, type BatchCandidate } from "./batching";
import { ensurePartner, listDispatchable, setStatus, getPartner } from "./partners.server";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Never let telemetry break a delivery — event writes are best effort. */
export async function logEvent(
  orderId: string,
  type: DeliveryEventType,
  payload: Record<string, unknown> = {},
  driverId?: string | null,
  actor = "system",
) {
  try {
    const supabaseAdmin = await db();
    await supabaseAdmin.from("delivery_events").insert({
      order_id: orderId,
      driver_id: driverId ?? null,
      event_type: type,
      payload: payload as never,
      actor,
    });
  } catch (e) {
    console.error("delivery_events write failed", e);
  }
}

/** Phase 7 — one place to fan a logistics notification out. Never throws. */
export async function notifyDriverSms(driverId: string, body: string) {
  try {
    const partner = await getPartner(driverId);
    if (!partner?.mobileNumber) return;
    const { sendSms } = await import("../sms.server");
    await sendSms(partner.mobileNumber, body);
  } catch (e) {
    console.error("driver notification failed", e);
  }
}

export async function notifyCustomerSms(orderId: string, body: string) {
  try {
    const supabaseAdmin = await db();
    const { data } = await supabaseAdmin
      .from("app_orders").select("customer_phone").eq("id", orderId).maybeSingle();
    if (!data?.customer_phone) return;
    const { sendSms } = await import("../sms.server");
    await sendSms(data.customer_phone, body);
  } catch (e) {
    console.error("customer notification failed", e);
  }
}

/** Resolve the actual reserved pickup store, never the first market. */
export async function pickupPointFor(orderId: string): Promise<GeoPoint | null> {
  const { orderPickups } = await import("./trips.server");
  return (await orderPickups(orderId))[0]?.point ?? null;
}

async function dropPointFor(orderId: string): Promise<GeoPoint | null> {
  const supabaseAdmin = await db();
  const { data: order } = await supabaseAdmin
    .from("app_orders").select("address").eq("id", orderId).maybeSingle();
  if (!order?.address) return null;
  const { geocodeAddress } = await import("./directions.server");
  return geocodeAddress(order.address);
}

type OfferOutcome =
  | { ok: true; driverId: string; expiresAt: string; attempt: number; payout?: number }
  | { ok: false; reason: "no_drivers" | "already_offered" | "order_closed" };

/**
 * Offer an order to the nearest available rider.
 * `excludeDriverIds` carries the riders who already rejected / timed out.
 */
export async function offerOrder(
  orderId: string,
  opts: { excludeDriverIds?: string[]; attempt?: number } = {},
): Promise<OfferOutcome> {
  const { dispatchReadyTrip } = await import("./trips.server");
  return dispatchReadyTrip(orderId);
}

// ---------------------------------------------------------------------------
// Dynamic payouts — how stretched the fleet is right now feeds the surge.
// ---------------------------------------------------------------------------

async function fleetPressure(): Promise<{ waitingOrders: number; freeDrivers: number }> {
  try {
    const supabaseAdmin = await db();
    const [{ data: orders }, free] = await Promise.all([
      supabaseAdmin
        .from("app_orders")
        .select("id, status, delivery_boy_id")
        .in("status", ["placed", "packed"])
        .is("delivery_boy_id", null),
      listDispatchable(),
    ]);
    return { waitingOrders: (orders ?? []).length, freeDrivers: free.length };
  } catch {
    return { waitingOrders: 0, freeDrivers: 1 };
  }
}

/**
 * What a rider earns for one order right now: base + distance, lifted by peak
 * hour, traffic, weather and live demand, plus a bonus per batched order.
 */
export async function quoteOrderPayout(
  orderId: string,
  pickupDistanceMeters: number,
  drop?: GeoPoint | null,
): Promise<PayoutQuote> {
  const pickup = await pickupPointFor(orderId);
  const rideMeters =
    pickup && isValidPoint(drop ?? null) ? haversineMeters(pickup, drop as GeoPoint) : 0;
  const approach = Number.isFinite(pickupDistanceMeters) ? pickupDistanceMeters : 0;
  const { waitingOrders, freeDrivers } = await fleetPressure();
  const batchedWith = Math.max(0, (await batchMatesFor(orderId)).length);

  return quoteDriverPayout({
    distanceMeters: rideMeters + approach,
    waitingOrders,
    freeDrivers,
    batchedWith,
  });
}

// ---------------------------------------------------------------------------
// Batching — pool orders leaving the same store along the same corridor.
// ---------------------------------------------------------------------------

/** Unassigned orders that would ride the same corridor as `orderId`. */
export async function batchMatesFor(orderId: string): Promise<string[]> {
  try {
    const supabaseAdmin = await db();
    const pickup = await pickupPointFor(orderId);
    if (!pickup) return [];

    const { data: rows } = await supabaseAdmin
      .from("app_orders")
      .select("id, address, created_at, status, delivery_boy_id")
      .in("status", ["placed", "packed"])
      .is("delivery_boy_id", null)
      .order("created_at", { ascending: true })
      .limit(25);

    const pool = (rows ?? []).filter((r) => r.id === orderId || r.id !== orderId);
    if (!pool.some((r) => r.id === orderId)) return [];

    const { geocodeAddress } = await import("./directions.server");
    const candidates: BatchCandidate[] = [];
    for (const r of pool) {
      const point = await geocodeAddress(String(r.address ?? ""));
      if (!isValidPoint(point)) continue;
      candidates.push({
        orderId: r.id as string,
        marketId: null, // single dark-store phase: every order leaves the same market
        drop: point,
        createdAt: String(r.created_at ?? ""),
      });
    }

    const batch = buildBatches(pickup, candidates).find((b) => b.orderIds.includes(orderId));
    return (batch?.orderIds ?? []).filter((id) => id !== orderId).slice(0, MAX_BATCH_SIZE - 1);
  } catch (e) {
    console.error("batching failed", e);
    return [];
  }
}

/**
 * After a rider accepts, hand them the corridor-mates of that order so one run
 * covers several drops instead of dispatching a second rider down the same road.
 */
async function attachBatchMates(orderId: string, driverId: string) {
  const mates = await batchMatesFor(orderId);
  if (!mates.length) return;
  const supabaseAdmin = await db();
  const pickup = await pickupPointFor(orderId);

  for (const mateId of mates) {
    const { data: locked } = await supabaseAdmin
      .from("app_orders")
      .update({ delivery_boy_id: driverId, updated_at: new Date().toISOString() })
      .eq("id", mateId)
      .is("delivery_boy_id", null)
      .in("status", ["placed", "packed"])
      .select("id")
      .maybeSingle();
    if (!locked) continue;

    await supabaseAdmin.from("delivery_assignments").insert({
      order_id: mateId,
      driver_id: driverId,
      status: "ACCEPTED",
      attempt: 1,
      pickup_latitude: pickup?.lat ?? null,
      pickup_longitude: pickup?.lng ?? null,
      expires_at: new Date(Date.now() + ACCEPT_WINDOW_SECONDS * 1000).toISOString(),
      responded_at: new Date().toISOString(),
      reason: `batched_with:${orderId}`,
    });
    await logEvent(mateId, "driver_accepted", { batchedWith: orderId }, driverId, `driver:${driverId}`);
    void notifyCustomerSms(mateId, `Kartogo: a delivery partner is picking up your order ${mateId}.`);
  }
}

/** Phase 4 — rider accepts. Locks the order to them. */
export async function acceptOffer(orderId: string, driverId: string) {
  const { dispatchReadyTrip } = await import("./trips.server");
  const result = await dispatchReadyTrip(orderId, driverId);
  if (!result.ok) throw new Error("This delivery is no longer available");
  return { ok: true as const };
}

/** Phase 4 — rider rejects; roll straight to the next nearest. */
export async function rejectOffer(orderId: string, driverId: string, reason = "declined") {
  const supabaseAdmin = await db();
  await supabaseAdmin
    .from("delivery_assignments")
    .update({ status: "REJECTED", responded_at: new Date().toISOString(), reason })
    .eq("order_id", orderId)
    .eq("driver_id", driverId)
    .eq("status", "OFFERED");
  await logEvent(orderId, "driver_rejected", { reason }, driverId, `driver:${driverId}`);
  await setStatus(driverId, "AVAILABLE", { orderId: null });
  return offerOrder(orderId);
}

async function expireOffer(orderId: string, driverId: string) {
  const supabaseAdmin = await db();
  await supabaseAdmin
    .from("delivery_assignments")
    .update({ status: "EXPIRED", responded_at: new Date().toISOString(), reason: "timeout" })
    .eq("order_id", orderId)
    .eq("driver_id", driverId)
    .eq("status", "OFFERED");
  await logEvent(orderId, "offer_expired", {}, driverId);
}

/**
 * Phase 4/9 — sweep timed-out offers and re-dispatch. Called opportunistically
 * from the driver and admin polls, so no external scheduler is needed at
 * launch (a cron can call it later without any code change).
 */
export async function sweepExpiredOffers(): Promise<number> {
  const supabaseAdmin = await db();
  const { data: stale } = await supabaseAdmin
    .from("delivery_assignments")
    .select("order_id, driver_id")
    .eq("status", "OFFERED")
    .lt("expires_at", new Date().toISOString())
    .limit(20);

  let redispatched = 0;
  for (const row of stale ?? []) {
    await expireOffer(row.order_id as string, row.driver_id as string);
    await setStatus(row.driver_id as string, "AVAILABLE", { orderId: null });
    const next = await offerOrder(row.order_id as string);
    if (next.ok) redispatched += 1;
  }
  const { dispatchWaitingTrips } = await import("./trips.server");
  return redispatched + await dispatchWaitingTrips();
}

/** Phase 9 — free a rider and put the order back in the pool. */
export async function releaseDriver(orderId: string, reason: string, redispatch = true) {
  const supabaseAdmin = await db();
  const { data: rows } = await supabaseAdmin
    .from("delivery_assignments")
    .select("driver_id")
    .eq("order_id", orderId)
    .in("status", ["OFFERED", "ACCEPTED"]);

  await supabaseAdmin
    .from("delivery_assignments")
    .update({ status: "CANCELLED", responded_at: new Date().toISOString(), reason })
    .eq("order_id", orderId)
    .in("status", ["OFFERED", "ACCEPTED"]);

  for (const r of rows ?? []) {
    await setStatus(r.driver_id as string, "AVAILABLE", { orderId: null });
    await logEvent(orderId, "driver_released", { reason }, r.driver_id as string);
  }

  await supabaseAdmin
    .from("app_orders")
    .update({ delivery_boy_id: null, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .neq("status", "delivered");

  if (redispatch) return offerOrder(orderId);
  return { ok: false as const, reason: "order_closed" as const };
}

/** Rider finished — bump their counters and free them up. */
export async function completeAssignment(orderId: string, driverId: string) {
  const supabaseAdmin = await db();
  await supabaseAdmin
    .from("delivery_assignments")
    .update({ status: "COMPLETED", responded_at: new Date().toISOString() })
    .eq("order_id", orderId)
    .eq("driver_id", driverId)
    .eq("status", "ACCEPTED");

  const partner = await getPartner(driverId);
  await supabaseAdmin
    .from("delivery_partners")
    .update({
      completed_orders: (partner?.completedOrders ?? 0) + 1,
      status: "AVAILABLE",
      active_order_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("driver_id", driverId);

  await logEvent(orderId, "delivered", {}, driverId, `driver:${driverId}`);
}
