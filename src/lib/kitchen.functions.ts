import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Kitchen portal: staff see their kitchen's food orders, print tickets and mark them ready.
async function session(token?: string) {
  const { verifyKitchenToken } = await import("./auth-tokens.server");
  return verifyKitchenToken(token);
}
async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as { from: (t: string) => any };
}

export const kitchenOrdersFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().max(4000) }).parse(d))
  .handler(async ({ data }) => {
    const s = await session(data.token);
    if (!s) return { ok: false as const, orders: [] };
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: rows } = await (await db()).from("service_orders")
      .select("id,order_code,status,kitchen_status,kitchen_printed_at,created_at,customer_name,details")
      .eq("kind", "FOOD").eq("details->>kitchen_id", s.kitchenId).gte("created_at", since)
      .order("created_at", { ascending: true }).limit(200);
    const orders = ((rows ?? []) as any[]).map((r) => ({
      id: r.id as string, code: r.order_code as string, status: r.status as string, kitchenStatus: r.kitchen_status as string,
      printed: !!r.kitchen_printed_at, createdAt: r.created_at as string, customer: (r.customer_name as string) ?? "Customer",
      items: (r.details?.items ?? []) as { name: string; qty: number; veg: boolean; addons: string[] }[], note: (r.details?.note as string) ?? null,
    }));
    return { ok: true as const, orders };
  });

export const updateKitchenOrderFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().max(4000), id: z.string().uuid(), action: z.enum(["PREPARING", "READY", "PRINTED"]) }).parse(d))
  .handler(async ({ data }) => {
    const s = await session(data.token);
    if (!s) return { ok: false as const, error: "Please sign in again." };
    const patch = data.action === "PRINTED" ? { kitchen_printed_at: new Date().toISOString() }
      : data.action === "READY" ? { kitchen_status: "READY", kitchen_ready_at: new Date().toISOString() } : { kitchen_status: "PREPARING" };
    const { data: row } = await (await db()).from("service_orders").update(patch)
      .eq("id", data.id).eq("kind", "FOOD").eq("details->>kitchen_id", s.kitchenId).neq("status", "CANCELLED")
      .select("id,order_code,customer_phone").maybeSingle();
    if (!row) return { ok: false as const, error: "Order not found or cancelled." };
    if (data.action === "READY") {
      const { safePush } = await import("./push.server");
      await safePush({ phone: row.customer_phone, type: "FOOD_READY", orderId: row.id, path: "/orders", body: `Your food (${row.order_code}) is ready and waiting for the rider.` });
    }
    return { ok: true as const };
  });
