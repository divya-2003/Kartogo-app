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

/** Pickup point = the active partner supermarket (single dark-store phase). */
export async function pickupPointFor(_orderId: string): Promise<GeoPoint | null> {
  const supabaseAdmin = await db();
  const { data } = await supabaseAdmin
    .from("partner_markets")
    .select("lat, lng")
    .eq("is_active", true)
    .not("lat", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const point = data ? { lat: Number(data.lat), lng: Number(data.lng) } : null;
  return isValidPoint(point) ? point : null;
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
  | { ok: true; driverId: string; expiresAt: string; attempt: number }
  | { ok: false; reason: "no_drivers" | "already_offered" | "order_closed" };

/**
 * Offer an order to the nearest available rider.
 * `excludeDriverIds` carries the riders who already rejected / timed out.
 */
export async function offerOrder(
  orderId: string,
  opts: { excludeDriverIds?: string[]; attempt?: number } = {},
): Promise<OfferOutcome> {
  const supabaseAdmin = await db();

  const { data: order } = await supabaseAdmin
    .from("app_orders").select("id, status, delivery_boy_id").eq("id", orderId).maybeSingle();
  if (!order || order.status === "cancelled" || order.status === "delivered") {
    return { ok: false, reason: "order_closed" };
  }
  if (order.delivery_boy_id) return { ok: false, reason: "already_offered" };

  // An offer already in flight? Leave it alone.
  const { data: live } = await supabaseAdmin
    .from("delivery_assignments")
    .select("id, status, expires_at")
    .eq("order_id", orderId)
    .in("status", ["OFFERED", "ACCEPTED"])
    .maybeSingle();
  if (live && (live.status === "ACCEPTED" || new Date(live.expires_at).getTime() > Date.now())) {
    return { ok: false, reason: "already_offered" };
  }

  // Everyone who already said no (or let the clock run out) on this order.
  const { data: past } = await supabaseAdmin
    .from("delivery_assignments")
    .select("driver_id, attempt")
    .eq("order_id", orderId);
  const declined = new Set([
    ...(opts.excludeDriverIds ?? []),
    ...((past ?? []).map((p) => p.driver_id as string)),
  ]);
  const attempt = opts.attempt ?? (past?.length ?? 0) + 1;

  const pickup = await pickupPointFor(orderId);
  const partners = (await listDispatchable()).filter((p) => !declined.has(p.driverId));

  let candidates: DriverCandidate[] = partners.map((p) => ({
    driverId: p.driverId,
    location: p.location ?? pickup ?? { lat: 0, lng: 0 },
    distanceMeters: pickup && p.location ? haversineMeters(p.location, pickup) : Number.MAX_SAFE_INTEGER,
    activeOrders: p.activeOrderId ? 1 : 0,
    rating: p.rating,
  }));

  if (!candidates.length) {
    await logEvent(orderId, "no_driver_available", { attempt });
    return { ok: false, reason: "no_drivers" };
  }

  const strategy = logisticsCapabilities.dispatch;
  candidates = strategy
    ? await strategy.rank({ orderId, pickup: pickup ?? candidates[0]!.location, candidates })
    : candidates.sort((a, b) => a.distanceMeters - b.distanceMeters);

  const chosen = candidates[0]!;
  const drop = await dropPointFor(orderId);
  const expiresAt = new Date(Date.now() + ACCEPT_WINDOW_SECONDS * 1000).toISOString();

  const { error } = await supabaseAdmin.from("delivery_assignments").insert({
    order_id: orderId,
    driver_id: chosen.driverId,
    status: "OFFERED",
    attempt,
    distance_meters: Number.isFinite(chosen.distanceMeters) ? chosen.distanceMeters : null,
    pickup_latitude: pickup?.lat ?? null,
    pickup_longitude: pickup?.lng ?? null,
    drop_latitude: drop?.lat ?? null,
    drop_longitude: drop?.lng ?? null,
    expires_at: expiresAt,
  });
  // Unique partial index — another dispatch cycle got there first.
  if (error) return { ok: false, reason: "already_offered" };

  await logEvent(orderId, "driver_offered", { attempt, distanceMeters: chosen.distanceMeters }, chosen.driverId);
  void notifyDriverSms(chosen.driverId, `Kartogo: new delivery ${orderId}. Open the app to accept within ${ACCEPT_WINDOW_SECONDS}s.`);

  return { ok: true, driverId: chosen.driverId, expiresAt, attempt };
}

/** Phase 4 — rider accepts. Locks the order to them. */
export async function acceptOffer(orderId: string, driverId: string) {
  const supabaseAdmin = await db();
  const { data: offer } = await supabaseAdmin
    .from("delivery_assignments")
    .select("*")
    .eq("order_id", orderId)
    .eq("driver_id", driverId)
    .eq("status", "OFFERED")
    .maybeSingle();
  if (!offer) throw new Error("This delivery is no longer available");
  if (new Date(offer.expires_at as string).getTime() < Date.now()) {
    await expireOffer(orderId, driverId);
    throw new Error("The acceptance window closed. It has gone to another partner.");
  }

  const { data: locked, error } = await supabaseAdmin
    .from("app_orders")
    .update({ delivery_boy_id: driverId, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .is("delivery_boy_id", null)
    .select("id")
    .maybeSingle();
  if (error || !locked) throw new Error("This delivery was already taken");

  await supabaseAdmin
    .from("delivery_assignments")
    .update({ status: "ACCEPTED", responded_at: new Date().toISOString() })
    .eq("id", offer.id as string);

  await ensurePartner(driverId);
  await setStatus(driverId, "PICKING_ORDER", { orderId });
  await logEvent(orderId, "driver_accepted", {}, driverId, `driver:${driverId}`);
  void notifyCustomerSms(orderId, `Kartogo: a delivery partner is picking up your order ${orderId}.`);
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
  return redispatched;
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
