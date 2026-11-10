import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Each signed-in customer's cart is saved against their phone number, so
// logging out empties this device and logging back in brings it back (merged
// with anything added while browsing as a guest).

const listing = z.object({
  name: z.string().max(200),
  price: z.number().min(0).max(10_000_000),
  mrp: z.number().min(0).max(10_000_000).optional(),
  image: z.string().max(2000).optional(),
  icon: z.string().max(20).optional(),
  partner: z.string().max(200).optional(),
});
const line = z.object({
  productId: z.string().min(1).max(120),
  qty: z.number().int().min(1).max(99),
  unselected: z.boolean().optional(),
  listing: listing.optional(),
});
export type SavedCartLine = z.infer<typeof line>;

async function phoneOf(token?: string) {
  const { verifyCustomerToken } = await import("./auth-tokens.server");
  return verifyCustomerToken(token)?.phone ?? null;
}
async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as { from: (t: string) => any };
}

function sanitize(raw: unknown): SavedCartLine[] {
  const parsed = z.array(line).max(100).safeParse(raw);
  return parsed.success ? parsed.data : [];
}

export const getSavedCartFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().max(4000) }).parse(d))
  .handler(async ({ data }) => {
    const phone = await phoneOf(data.token);
    if (!phone) return { ok: false as const, items: [] as SavedCartLine[] };
    const { data: row } = await (await db()).from("customer_carts").select("items").eq("phone", phone).maybeSingle();
    return { ok: true as const, items: sanitize(row?.items) };
  });

export const saveCartFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().max(4000), items: z.array(line).max(100) }).parse(d))
  .handler(async ({ data }) => {
    const phone = await phoneOf(data.token);
    if (!phone) return { ok: false as const };
    const { error } = await (await db()).from("customer_carts")
      .upsert({ phone, items: data.items, updated_at: new Date().toISOString() }, { onConflict: "phone" });
    if (error) console.error("[cart] save failed", error.message);
    return { ok: !error };
  });
