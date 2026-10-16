import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { KITCHENS } from "./food";
import { KITCHEN_NEXT } from "./route-plan";

// Kitchen side of food orders. Kitchen progress lives in details.kitchen_status:
// NEW -> ACCEPTED -> PREPARING -> READY. Riders can only pick up READY orders.
// Opened from the admin portal for now; kitchen-owner logins come with real partners.

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as { from: (t: string) => any };
}
async function admin(token: string) {
  const { verifyAdminToken } = await import("./auth-tokens.server");
  if (!verifyAdminToken(token)) throw new Error("Please log in as admin.");
}
const kitchenId = z.string().refine(id => KITCHENS.some(k => k.id === id), "Unknown kitchen");

export const kitchenBoardFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string(), kitchenId }).parse(d))
  .handler(async ({ data }) => {
    await admin(data.token);
    const d = await db();
    const [{ data: rows }, { data: avail }] = await Promise.all([
      d.from("service_orders").select("*").eq("kind", "FOOD").filter("details->>kitchen_id", "eq", data.kitchenId)
        .order("created_at", { ascending: false }).limit(60),
      d.from("kitchen_availability").select("is_open").eq("kitchen_id", data.kitchenId).maybeSingle(),
    ]);
    const orders = (rows ?? []).map((r: any) => ({ ...r, customer_phone: r.customer_phone ? `••••••${String(r.customer_phone).slice(-4)}` : null }));
    return { orders: orders as any[], isOpen: avail?.is_open ?? true };
  });

export const kitchenAdvanceFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await admin(data.token);
    const d = await db();
    const { data: cur } = await d.from("service_orders").select("*").eq("id", data.id).eq("kind", "FOOD").maybeSingle();
    if (!cur || cur.status === "CANCELLED") return { ok: false as const, error: "Order not found or cancelled." };
    const ks = cur.details?.kitchen_status ?? "NEW";
    const next = KITCHEN_NEXT[ks];
    if (!next) return { ok: false as const, error: "Already ready." };
    await d.from("service_orders").update({ details: { ...cur.details, kitchen_status: next } }).eq("id", data.id);
    const msg: Record<string, string> = { ACCEPTED: "The kitchen accepted your order.", PREPARING: "Your food is being prepared.", READY: "Your food is packed and waiting for the rider." };
    try {
      const { sendPushToCustomer } = await import("./push.server");
      await sendPushToCustomer({ phone: cur.customer_phone, type: "SUPERMARKET_ACCEPTED", title: `#${cur.order_code} update`, body: msg[next] } as any);
    } catch (e) { console.error("kitchen push failed", e); }
    return { ok: true as const, status: next };
  });

export const setKitchenOpenFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string(), kitchenId, isOpen: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    await admin(data.token);
    const d = await db();
    await d.from("kitchen_availability").upsert({ kitchen_id: data.kitchenId, is_open: data.isOpen, updated_at: new Date().toISOString() });
    return { ok: true };
  });

/** Public: which kitchens are currently closed. */
export const closedKitchensFn = createServerFn({ method: "GET" }).handler(async () => {
  const d = await db();
  const { data } = await d.from("kitchen_availability").select("kitchen_id").eq("is_open", false);
  return ((data ?? []) as { kitchen_id: string }[]).map(r => r.kitchen_id);
});
