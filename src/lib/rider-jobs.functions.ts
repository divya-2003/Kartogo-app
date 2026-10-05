import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Food deliveries and rides handled by real delivery partners.
// FOOD: PLACED -> ACCEPTED -> PICKED_UP -> DELIVERED
// RIDE: SEARCHING -> ACCEPTED -> ARRIVED -> IN_TRIP -> COMPLETED

export const NEXT_STATUS: Record<string, Record<string, string>> = {
  FOOD: { ACCEPTED: "PICKED_UP", PICKED_UP: "DELIVERED" },
  RIDE: { ACCEPTED: "ARRIVED", ARRIVED: "IN_TRIP", IN_TRIP: "COMPLETED" },
};

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as { from: (t: string) => any };
}
async function driverSession(token: string) {
  const { verifyDeliveryToken } = await import("./auth-tokens.server");
  const s = verifyDeliveryToken(token);
  if (!s) throw new Error("Your session has expired. Please log in again.");
  const { assertDriverActive } = await import("./driver-access.server");
  await assertDriverActive(s.driverId);
  return s;
}
const OPEN = ["PLACED", "SEARCHING"];
const ACTIVE = ["ACCEPTED", "PICKED_UP", "ARRIVED", "IN_TRIP"];

function maskPhone(p?: string | null) { return p ? `••••••${String(p).slice(-4)}` : null; }

async function notify(phone: string, title: string, body: string) {
  try {
    const { sendPushToCustomer } = await import("./push.server");
    await sendPushToCustomer({ phone, type: "DRIVER_ASSIGNED", title, body } as any);
  } catch (e) { console.error("rider push failed", e); }
}

export const listRiderJobsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(async ({ data }) => {
    const s = await driverSession(data.token);
    const d = await db();
    const [{ data: open }, { data: mine }] = await Promise.all([
      d.from("service_orders").select("*").in("status", OPEN).is("driver_id", null).order("created_at", { ascending: false }).limit(30),
      d.from("service_orders").select("*").eq("driver_id", s.driverId).order("created_at", { ascending: false }).limit(40),
    ]);
    const clean = (r: any) => ({ ...r, customer_phone: maskPhone(r.customer_phone) });
    return { open: (open ?? []).map(clean), mine: (mine ?? []).map(clean) } as { open: any[]; mine: any[] };
  });

export const acceptRiderJobFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(10), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const s = await driverSession(data.token);
    const d = await db();
    const { data: busy } = await d.from("service_orders").select("id").eq("driver_id", s.driverId).in("status", ACTIVE).limit(1);
    if (busy?.length) return { ok: false as const, error: "Finish your current job first." };
    const { data: dp } = await d.from("delivery_partners").select("name,mobile_number").eq("driver_id", s.driverId).maybeSingle();
    const now = new Date().toISOString();
    const { data: row } = await d.from("service_orders").update({
      driver_id: s.driverId, driver_name: dp?.name ?? "Kartogo partner", driver_phone: dp?.mobile_number ?? null,
      status: "ACCEPTED", accepted_at: now, status_history: [{ status: "ACCEPTED", at: now }],
    }).eq("id", data.id).is("driver_id", null).in("status", OPEN).select("*").maybeSingle();
    if (!row) return { ok: false as const, error: "Another partner already took this job." };
    await notify(row.customer_phone, row.kind === "RIDE" ? "Driver on the way 🛺" : "Rider assigned 🛵",
      `${row.driver_name} accepted your ${row.kind === "RIDE" ? "ride" : "food order"} #${row.order_code}.`);
    return { ok: true as const };
  });

export const advanceRiderJobFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(10), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const s = await driverSession(data.token);
    const d = await db();
    const { data: cur } = await d.from("service_orders").select("*").eq("id", data.id).eq("driver_id", s.driverId).maybeSingle();
    if (!cur) return { ok: false as const, error: "Job not found." };
    const next = NEXT_STATUS[cur.kind]?.[cur.status];
    if (!next) return { ok: false as const, error: "Nothing more to update." };
    const hist = Array.isArray(cur.status_history) ? cur.status_history : [];
    await d.from("service_orders").update({ status: next, status_history: [...hist, { status: next, at: new Date().toISOString() }] })
      .eq("id", data.id).eq("status", cur.status);
    const msg: Record<string, string> = {
      PICKED_UP: "Your food is picked up and on the way.", DELIVERED: "Your food order was delivered. Enjoy!",
      ARRIVED: "Your driver has arrived at the pickup point.", IN_TRIP: "Your ride has started.", COMPLETED: "Ride completed. Thanks for riding with Kartogo!",
    };
    await notify(cur.customer_phone, `#${cur.order_code} update`, msg[next] ?? next);
    return { ok: true as const, status: next };
  });

export const updateRiderLocationFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(10), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).parse(d))
  .handler(async ({ data }) => {
    const s = await driverSession(data.token);
    const d = await db();
    const now = new Date().toISOString();
    await d.from("service_orders").update({ driver_lat: data.lat, driver_lng: data.lng, driver_location_at: now })
      .eq("driver_id", s.driverId).in("status", ACTIVE);
    await d.from("delivery_partners").update({ current_latitude: data.lat, current_longitude: data.lng, last_location_at: now }).eq("driver_id", s.driverId);
    return { ok: true };
  });

// Admin: live food orders and rides.
export const adminServiceOrdersFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.token)) return [];
    const d = await db();
    const { data: rows } = await d.from("service_orders").select("*").order("created_at", { ascending: false }).limit(200);
    return (rows ?? []) as any[];
  });

export const adminCancelServiceOrderFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.token)) return { ok: false };
    const d = await db();
    await d.from("service_orders").update({ status: "CANCELLED" }).eq("id", data.id).not("status", "in", "(DELIVERED,COMPLETED)");
    return { ok: true };
  });
