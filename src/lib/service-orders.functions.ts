import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { findDish, dishUnitPrice, FOOD_DELIVERY_FEE } from "./food";
import { distanceKm, quote, VEHICLES } from "./rides";

// Food delivery orders and ride bookings. Prices are always recomputed here.

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as { from: (t: string) => any };
}
async function customer(token?: string) {
  const { verifyCustomerToken } = await import("./auth-tokens.server");
  return verifyCustomerToken(token);
}
const code = (p: string) => p + Math.random().toString(36).slice(2, 8).toUpperCase();

async function insertOrder(phone: string, row: Record<string, unknown>) {
  const s = await db();
  const { data: cust } = await s.from("customers").select("name").eq("phone", phone).maybeSingle();
  const { data, error } = await s.from("service_orders")
    .insert({ ...row, customer_phone: phone, customer_name: cust?.name ?? null })
    .select("id,order_code").single();
  if (error) { console.error("service_orders insert", error); return null; }
  return data as { id: string; order_code: string };
}

export const createFoodOrderFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token: z.string().min(10),
    items: z.array(z.object({ dishId: z.string().max(20), qty: z.number().int().min(1).max(10), addons: z.array(z.string().max(20)).max(5) })).min(1).max(20),
    address: z.object({ line: z.string().min(3).max(300), landmark: z.string().max(200).optional() }),
    note: z.string().max(200).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const session = await customer(data.token);
    if (!session) return { ok: false as const, error: "Please login to order." };
    let kitchenId: string | null = null, subtotal = 0;
    const lines = [];
    for (const it of data.items) {
      const f = findDish(it.dishId);
      if (!f) return { ok: false as const, error: "An item is no longer available." };
      if (kitchenId && kitchenId !== f.kitchen.id) return { ok: false as const, error: "Order from one kitchen at a time." };
      kitchenId = f.kitchen.id;
      const unit = dishUnitPrice(f.dish, it.addons);
      subtotal += unit * it.qty;
      lines.push({ name: f.dish.name, qty: it.qty, unit, veg: f.dish.veg, addons: (f.dish.addons ?? []).filter(a => it.addons.includes(a.id)).map(a => a.name) });
    }
    const kitchen = findDish(data.items[0].dishId)!.kitchen;
    const ins = await insertOrder(session.phone, {
      order_code: code("KF"), kind: "FOOD", title: kitchen.name, amount: subtotal + FOOD_DELIVERY_FEE,
      details: { kitchen_id: kitchen.id, eta_min: kitchen.eta, items: lines, subtotal, delivery_fee: FOOD_DELIVERY_FEE, address: data.address, note: data.note ?? null, payment: "COD" },
    });
    if (!ins) return { ok: false as const, error: "Couldn't place the order. Please try again." };
    return { ok: true as const, id: ins.id, code: ins.order_code };
  });

const pt = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), label: z.string().min(1).max(200) });

export const createRideFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(10), pickup: pt, drop: pt, vehicle: z.enum(["bike", "auto", "car"]) }).parse(d))
  .handler(async ({ data }) => {
    const session = await customer(data.token);
    if (!session) return { ok: false as const, error: "Please login to book a ride." };
    const km = distanceKm(data.pickup, data.drop);
    if (km > 60) return { ok: false as const, error: "Rides are available within 60 km." };
    const q = quote(data.vehicle, km);
    const v = VEHICLES.find(x => x.id === data.vehicle)!;
    const ins = await insertOrder(session.phone, {
      order_code: code("KR"), kind: "RIDE", title: `${v.label} ride`, amount: q.fare, status: "SEARCHING",
      details: { vehicle: data.vehicle, pickup: data.pickup, drop: data.drop, km: Math.round(km * 10) / 10, minutes: q.minutes, payment: "Cash/UPI" },
    });
    if (!ins) return { ok: false as const, error: "Couldn't book the ride. Please try again." };
    return { ok: true as const, id: ins.id, code: ins.order_code, fare: q.fare, minutes: q.minutes };
  });

export const myServiceOrdersFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().optional() }).parse(d))
  .handler(async ({ data }) => {
    const session = await customer(data.token);
    if (!session) return [];
    const s = await db();
    const { data: rows } = await s.from("service_orders").select("*").eq("customer_phone", session.phone).order("created_at", { ascending: false }).limit(50);
    return (rows ?? []) as Array<{ id: string; order_code: string; kind: "FOOD" | "RIDE"; title: string; amount: number; status: string; created_at: string; details: Record<string, any> }>;
  });

export const cancelServiceOrderFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(10), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const session = await customer(data.token);
    if (!session) return { ok: false as const, error: "Please login." };
    const s = await db();
    const { data: row } = await s.from("service_orders").update({ status: "CANCELLED" })
      .eq("id", data.id).eq("customer_phone", session.phone).in("status", ["PLACED", "SEARCHING"]).select("id").maybeSingle();
    return row ? { ok: true as const } : { ok: false as const, error: "This can no longer be cancelled." };
  });
