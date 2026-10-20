import { compatibleTrip, sequenceStops, type TripOrder, type TripStop, type RiderTrip } from "./trips";
import { getRoute, geocodeAddress } from "./directions.server";
import { haversineMeters, isValidPoint } from "./geo";
import { listDispatchable } from "./partners.server";

async function db() { const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); return supabaseAdmin; }

/** Reservation allocations are authoritative; only use unique warehouse ownership for legacy lines. */
export async function orderPickups(orderId: string): Promise<TripStop[]> {
  const d = await db();
  const { data: order } = await d.from("app_orders").select("items").eq("id", orderId).maybeSingle();
  if (!order) return [];
  const lines = order.items as { productId: string }[];
  const [{ data: holds }, { data: stock }, { data: markets }] = await Promise.all([
    d.from("inventory_reservations").select("market_id,product_id,status").eq("order_id", orderId),
    d.from("inventory_items").select("market_id,product_id").in("product_id", lines.map(i => i.productId)),
    d.from("partner_markets").select("id,name,address,lat,lng,is_active,prep_minutes").eq("is_active", true),
  ]);
  const ids = new Set<string>();
  for (const line of lines) {
    const allocated = [...new Set((holds ?? []).filter(h => h.product_id === line.productId && h.status !== "released").map(h => h.market_id))];
    const owners = allocated.length ? allocated : [...new Set((stock ?? []).filter(s => s.product_id === line.productId).map(s => s.market_id))];
    if (!owners.length || (!allocated.length && owners.length !== 1)) return []; // Split reservations are authoritative; legacy ownership must be unique.
    for (const id of owners) ids.add(id);
  }
  const stops: TripStop[] = [];
  for (const id of ids) {
    const market = markets?.find(m => m.id === id);
    if (!market) return [];
    const point = market.lat != null && market.lng != null ? { lat: Number(market.lat), lng: Number(market.lng) } : null;
    stops.push({ kind: "pickup", orderId, marketId: id, label: market.name, address: market.address, point: isValidPoint(point) ? point : await geocodeAddress(market.address), done: false });
  }
  return stops;
}

export async function activeTrip(driverId: string): Promise<RiderTrip | null> {
  const d = await db();
  const { data, error } = await d.from("delivery_trips").select("id,order_ids,stops").eq("driver_id", driverId).eq("status", "active").maybeSingle();
  if (error) throw new Error("Could not load your delivery trip");
  return data ? { id: data.id, orderIds: data.order_ids, stops: data.stops as unknown as TripStop[] } : null;
}

async function pickupDelay(orders: TripOrder[]): Promise<number | null> {
  const stores = [...new Map(orders.flatMap(o => o.pickups).map(p => [p.marketId, p])).values()];
  if (stores.length === 1) return 0;
  if (stores.length !== 2 || !stores[0]?.point || !stores[1]?.point) return null;
  if (haversineMeters(stores[0].point, stores[1].point) > 200) return null;
  const route = await getRoute(stores[0].point, stores[1].point);
  // A packed-order handoff allowance of 2 minutes plus actual road travel.
  return route.source === "estimate" ? null : route.durationSeconds + 120;
}

export async function dispatchReadyTrip(orderId: string, driverId?: string) {
  const d = await db();
  const { data: anchor } = await d.from("app_orders").select("*").eq("id", orderId).maybeSingle();
  if (!anchor || anchor.status !== "packed" || anchor.delivery_boy_id) return { ok: false as const, reason: "order_closed" as const };
  const { data: rows } = await d.from("app_orders").select("*").eq("status", "packed").is("delivery_boy_id", null).order("created_at").limit(20);
  const now = Date.now();
  const due = (r: typeof anchor) => !r.scheduled_date || new Date(`${r.scheduled_date}T${r.scheduled_start ?? "00:00:00"}+05:30`).getTime() <= now + 30 * 60000;
  if (!due(anchor)) return { ok: false as const, reason: "order_closed" as const };
  const make = async (r: typeof anchor): Promise<TripOrder> => ({ id: r.id, ready: r.status === "packed", quick: r.delivery_speed === "30min", pickups: await orderPickups(r.id), drop: { kind: "drop", orderId: r.id, marketId: "", label: r.customer_name, address: r.address, point: await geocodeAddress(r.address), done: false } });
  const first = await make(anchor);
  const orders = [first];
  if (!compatibleTrip(orders, await pickupDelay(orders))) return { ok: false as const, reason: "order_closed" as const };
  for (const row of rows ?? []) {
    if (row.id === orderId || !due(row) || orders.length >= 3) continue;
    // Never mix scheduled and Quick delivery promises.
    if (row.delivery_speed !== anchor.delivery_speed || row.scheduled_date !== anchor.scheduled_date || row.scheduled_start !== anchor.scheduled_start) continue;
    const proposed = [...orders, await make(row)];
    if (compatibleTrip(proposed, await pickupDelay(proposed))) orders.push(proposed[proposed.length - 1] as TripOrder);
  }
  const pickup = first.pickups[0]?.point;
  const riders = (await listDispatchable()).filter(p => !driverId || p.driverId === driverId).sort((a, b) => (a.location && pickup ? haversineMeters(a.location, pickup) : Infinity) - (b.location && pickup ? haversineMeters(b.location, pickup) : Infinity));
  for (const rider of riders) {
    const stops = sequenceStops(rider.location, orders);
    const { data: tripId, error } = await d.rpc("claim_delivery_trip", { p_driver: rider.driverId, p_orders: orders.map(o => o.id), p_stops: stops as never });
    if (error) continue; // Transaction rechecks occupancy and every order atomically.
    const { sendPushToCustomer } = await import("../push.server");
    for (const o of orders) {
      const customer = o.id === anchor.id ? anchor : rows?.find(r => r.id === o.id);
      if (customer) await sendPushToCustomer({ phone: customer.customer_phone, type: "DRIVER_ASSIGNED", orderId: o.id });
    }
    return { ok: true as const, driverId: rider.driverId, tripId, expiresAt: new Date().toISOString(), attempt: 1 };
  }
  return { ok: false as const, reason: "no_drivers" as const };
}

export async function dispatchWaitingTrips() {
  const d = await db();
  const { data: rows } = await d.from("app_orders").select("id").eq("status", "packed").is("delivery_boy_id", null).order("created_at").limit(10);
  let assigned = 0;
  for (const row of rows ?? []) {
    if (!(await listDispatchable()).length) break;
    if ((await dispatchReadyTrip(row.id)).ok) assigned++;
  }
  return assigned;
}

export async function finishStop(driverId: string, tripId: string, index: number) {
  const d = await db();
  const { data, error } = await d.rpc("finish_delivery_stop", { p_driver: driverId, p_trip: tripId, p_index: index });
  if (error) throw new Error(error.message);
  const result = data as { changed: boolean; kind?: string; orderId?: string };
  if (result.changed && result.orderId) {
    const { pushOrderStatus } = await import("../push.server");
    if (result.kind === "drop") { const { syncInventoryForStatus } = await import("../inventory.server"); await syncInventoryForStatus(result.orderId, "delivered", `driver:${driverId}`); }
    await pushOrderStatus(result.orderId, result.kind === "drop" ? "delivered" : "out_for_delivery");
    await dispatchWaitingTrips();
  }
  return { ok: true };
}