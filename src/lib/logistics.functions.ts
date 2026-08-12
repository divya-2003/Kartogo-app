import { createServerFn } from "@tanstack/react-start";
import type {
  DeliveryAssignment,
  DeliveryPartner,
  DriverStatus,
  LogisticsDashboard,
  TrackingSnapshot,
  VehicleType,
} from "./logistics/types";
import { DRIVER_STATUSES, VEHICLE_TYPES } from "./logistics/types";

// ============================================================================
// Logistics RPC surface.
//
// Three audiences, three token types — never trust a role the client claims:
//   • driver   — signed delivery token
//   • admin    — signed admin token
//   • customer — order id + the customer's own phone-bound token
// ============================================================================

async function requireDriver(token: string) {
  const { verifyDeliveryToken } = await import("./auth-tokens.server");
  const session = verifyDeliveryToken(token);
  if (!session) throw new Error("Your session has expired. Please log in again.");
  const { assertDriverActive } = await import("./driver-access.server");
  await assertDriverActive(session.driverId);
  const { ensurePartner } = await import("./logistics/partners.server");
  await ensurePartner(session.driverId);
  return session;
}

async function requireAdmin(token: string) {
  const { verifyAdminToken } = await import("./auth-tokens.server");
  if (!verifyAdminToken(token)) throw new Error("Admin authorization required");
}

const str = (v: unknown) => String(v ?? "");

// ---------------------------------------------------------------- driver ---

/** Phase 1 — rider goes online / offline / on break. */
export const setDriverStatusFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; status: DriverStatus; vehicleType?: VehicleType }) => {
    if (!DRIVER_STATUSES.includes(data?.status)) throw new Error("Invalid status");
    const vehicleType = VEHICLE_TYPES.includes(data?.vehicleType as VehicleType)
      ? (data.vehicleType as VehicleType)
      : undefined;
    return { token: str(data?.token), status: data.status, vehicleType };
  })
  .handler(async ({ data }): Promise<DeliveryPartner | null> => {
    const session = await requireDriver(data.token);
    const { setStatus } = await import("./logistics/partners.server");

    if (data.vehicleType) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("delivery_partners")
        .update({ vehicle_type: data.vehicleType })
        .eq("driver_id", session.driverId);
    }

    // Going offline mid-delivery must not strand the order (Phase 9).
    if (data.status === "OFFLINE" || data.status === "BREAK") {
      const { getPartner } = await import("./logistics/partners.server");
      const partner = await getPartner(session.driverId);
      if (partner?.activeOrderId) {
        const { releaseDriver } = await import("./logistics/dispatch.server");
        await releaseDriver(partner.activeOrderId, `driver_${data.status.toLowerCase()}`);
      }
    }
    return setStatus(session.driverId, data.status, {
      orderId: data.status === "OFFLINE" || data.status === "BREAK" ? null : undefined,
      actor: `driver:${session.driverId}`,
    });
  });

/** Phase 2 — 10-second GPS heartbeat. Sub-10 m movement is discarded. */
export const pingDriverLocationFn = createServerFn({ method: "POST" })
  .inputValidator((data: {
    token: string; lat: number; lng: number;
    accuracy?: number; speed?: number; heading?: number;
  }) => ({
    token: str(data?.token),
    lat: Number(data?.lat),
    lng: Number(data?.lng),
    accuracy: Number.isFinite(data?.accuracy) ? Number(data?.accuracy) : null,
    speed: Number.isFinite(data?.speed) ? Number(data?.speed) : null,
    heading: Number.isFinite(data?.heading) ? Number(data?.heading) : null,
  }))
  .handler(async ({ data }) => {
    const session = await requireDriver(data.token);
    const { recordLocation } = await import("./logistics/partners.server");
    return recordLocation(
      session.driverId,
      { lat: data.lat, lng: data.lng },
      { accuracy: data.accuracy, speed: data.speed, heading: data.heading },
    );
  });

/** Phases 3+4 — the rider's live offer (if any) plus their own record. */
export const getDriverDispatchFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => ({ token: str(data?.token) }))
  .handler(async ({ data }): Promise<{
    partner: DeliveryPartner | null;
    offer:
      | (DeliveryAssignment & {
          orderTotal: number;
          itemCount: number;
          area: string;
          payout: number;
          payoutReasons: string[];
          batchedOrders: number;
        })
      | null;
  }> => {
    const session = await requireDriver(data.token);
    const { sweepExpiredOffers } = await import("./logistics/dispatch.server");
    // Opportunistic timeout sweep — no external scheduler needed at launch.
    await sweepExpiredOffers();

    const { getPartner } = await import("./logistics/partners.server");
    const partner = await getPartner(session.driverId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("delivery_assignments")
      .select("*")
      .eq("driver_id", session.driverId)
      .eq("status", "OFFERED")
      .gt("expires_at", new Date().toISOString())
      .order("offered_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!row) return { partner, offer: null };

    const { data: order } = await supabaseAdmin
      .from("app_orders").select("total, items, address").eq("id", row.order_id as string).maybeSingle();
    const items = (order?.items ?? []) as unknown[];

    const drop = row.drop_latitude != null
      ? { lat: row.drop_latitude as number, lng: row.drop_longitude as number } : null;
    const { quoteOrderPayout, batchMatesFor } = await import("./logistics/dispatch.server");
    const [payout, mates] = await Promise.all([
      quoteOrderPayout(row.order_id as string, Number(row.distance_meters ?? 0), drop),
      batchMatesFor(row.order_id as string),
    ]);

    return {
      partner,
      offer: {
        id: row.id as string,
        orderId: row.order_id as string,
        driverId: row.driver_id as string,
        status: "OFFERED",
        attempt: row.attempt as number,
        distanceMeters: row.distance_meters as number | null,
        pickup: row.pickup_latitude != null
          ? { lat: row.pickup_latitude as number, lng: row.pickup_longitude as number } : null,
        drop,
        offeredAt: row.offered_at as string,
        expiresAt: row.expires_at as string,
        respondedAt: null,
        reason: null,
        orderTotal: Number(order?.total ?? 0),
        itemCount: items.length,
        /** Dynamic payout for this run (distance + peak/traffic/demand + batch bonus). */
        payout: payout.amount,
        payoutReasons: payout.reasons,
        batchedOrders: mates.length,
        // Coarse area only — the full address unlocks after acceptance.
        area: String(order?.address ?? "").split(",").slice(-2).join(",").trim(),
      },
    };
  });

export const respondToOfferFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; orderId: string; accept: boolean }) => ({
    token: str(data?.token),
    orderId: str(data?.orderId),
    accept: !!data?.accept,
  }))
  .handler(async ({ data }) => {
    const session = await requireDriver(data.token);
    const { acceptOffer, rejectOffer } = await import("./logistics/dispatch.server");
    if (data.accept) return acceptOffer(data.orderId, session.driverId);
    await rejectOffer(data.orderId, session.driverId);
    return { ok: true as const };
  });

// ----------------------------------------------------------------- admin ---

/** Phase 8 — control tower. */
export const getLogisticsDashboardFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken: string }) => ({ adminToken: str(data?.adminToken) }))
  .handler(async ({ data }): Promise<LogisticsDashboard> => {
    await requireAdmin(data.adminToken);
    const { sweepExpiredOffers } = await import("./logistics/dispatch.server");
    await sweepExpiredOffers();

    const { listPartners } = await import("./logistics/partners.server");
    const { BUSY_STATUSES } = await import("./logistics/types");
    const partners = await listPartners();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data: orders } = await supabaseAdmin
      .from("app_orders")
      .select("id, status, delivery_boy_id, created_at, updated_at")
      .gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString());
    const rows = orders ?? [];

    const deliveredToday = rows.filter(
      (o) => o.status === "delivered" && new Date(o.updated_at as string) >= startOfDay,
    );
    const durations = deliveredToday
      .map((o) => new Date(o.updated_at as string).getTime() - new Date(o.created_at as string).getTime())
      .filter((ms) => ms > 0 && ms < 6 * 3600_000);

    return {
      onlineDrivers: partners.filter((p) => p.online && !BUSY_STATUSES.includes(p.status)).length,
      busyDrivers: partners.filter((p) => BUSY_STATUSES.includes(p.status)).length,
      offlineDrivers: partners.filter((p) => !p.online).length,
      ordersWaitingForDriver: rows.filter(
        (o) => !o.delivery_boy_id && (o.status === "placed" || o.status === "packed"),
      ).length,
      ordersInDelivery: rows.filter(
        (o) => !!o.delivery_boy_id && o.status !== "delivered" && o.status !== "cancelled",
      ).length,
      deliveredToday: deliveredToday.length,
      averageDeliveryMinutes: durations.length
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 60_000)
        : null,
      partners,
    };
  });

/** Admin override — force-dispatch or re-dispatch an order. */
export const dispatchOrderFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken: string; orderId: string; release?: boolean }) => ({
    adminToken: str(data?.adminToken),
    orderId: str(data?.orderId),
    release: !!data?.release,
  }))
  .handler(async ({ data }) => {
    await requireAdmin(data.adminToken);
    const { offerOrder, releaseDriver } = await import("./logistics/dispatch.server");
    return data.release
      ? releaseDriver(data.orderId, "admin_reassign")
      : offerOrder(data.orderId);
  });

/** Admin: the full event trail for one order. */
export const listDeliveryEventsFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken: string; orderId: string }) => ({
    adminToken: str(data?.adminToken),
    orderId: str(data?.orderId),
  }))
  .handler(async ({ data }) => {
    await requireAdmin(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("delivery_events")
      .select("id, event_type, driver_id, payload, created_at")
      .eq("order_id", data.orderId)
      .order("created_at", { ascending: false })
      .limit(50);
    return (rows ?? []).map((r) => ({
      id: r.id as string,
      type: r.event_type as string,
      driverId: r.driver_id as string | null,
      createdAt: r.created_at as string,
    }));
  });

// -------------------------------------------------------------- customer ---

/** Phase 5 + 6 — live tracking for the order's own customer. */
export const trackOrderFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; orderId: string }) => ({
    token: str(data?.token),
    orderId: str(data?.orderId),
  }))
  .handler(async ({ data }): Promise<TrackingSnapshot | null> => {
    const { verifyCustomerToken } = await import("./auth-tokens.server");
    const session = verifyCustomerToken(data.token);
    if (!session) throw new Error("Please log in to track this order");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("app_orders")
      .select("id, status, customer_phone, delivery_boy_id, updated_at")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order || order.customer_phone !== session.phone) return null;

    const status = order.status as string;
    const driverId = order.delivery_boy_id as string | null;

    const stage: TrackingSnapshot["stage"] =
      status === "delivered" ? "delivered"
      : status === "out_for_delivery" ? "on_the_way"
      : driverId && status === "packed" ? "picked_up"
      : driverId ? "driver_assigned"
      : "preparing";

    const { getPartner, hasFreshLocation } = await import("./logistics/partners.server");
    const partner = driverId ? await getPartner(driverId) : null;

    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { data: assignment } = await sb
      .from("delivery_assignments")
      .select("pickup_latitude, pickup_longitude, drop_latitude, drop_longitude")
      .eq("order_id", data.orderId)
      .in("status", ["ACCEPTED", "COMPLETED"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const pickup = assignment?.pickup_latitude != null
      ? { lat: assignment.pickup_latitude as number, lng: assignment.pickup_longitude as number } : null;
    const drop = assignment?.drop_latitude != null
      ? { lat: assignment.drop_latitude as number, lng: assignment.drop_longitude as number } : null;

    // Live position is only exposed once the rider actually has the order.
    const showLive = stage === "picked_up" || stage === "on_the_way";
    const driverPoint = partner && showLive ? partner.location : null;

    let route: TrackingSnapshot["route"] = null;
    if (driverPoint && drop) {
      const { getRoute } = await import("./logistics/directions.server");
      route = await getRoute(driverPoint, drop);
    }

    return {
      orderId: data.orderId,
      stage,
      driver: partner
        ? {
            name: partner.name,
            vehicleType: partner.vehicleType,
            rating: partner.rating,
            location: driverPoint,
            lastLocationAt: hasFreshLocation(partner) ? partner.lastLocationAt : partner.lastLocationAt,
          }
        : null,
      pickup,
      drop,
      route,
      etaMinutes: route ? Math.max(1, Math.round(route.durationSeconds / 60)) : null,
      updatedAt: order.updated_at as string,
    };
  });
