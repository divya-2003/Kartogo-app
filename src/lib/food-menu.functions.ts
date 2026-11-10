import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Food menus: customers read the live menu, kitchen staff manage their own
// kitchen's dishes. Prices are re-checked on the server when an order is placed.

async function kitchenSession(token?: string) {
  const { verifyKitchenToken } = await import("./auth-tokens.server");
  return verifyKitchenToken(token);
}

/** Public: every kitchen and its available dishes. */
export const listFoodMenusFn = createServerFn({ method: "GET" }).handler(async () => {
  const { loadKitchenMenus } = await import("./food-menu.server");
  return { kitchens: await loadKitchenMenus(false) };
});

/** Kitchen staff: their kitchen with every dish, including hidden ones. */
export const kitchenMenuFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().max(4000) }).parse(d))
  .handler(async ({ data }) => {
    const s = await kitchenSession(data.token);
    if (!s) return { ok: false as const, error: "Please sign in again." };
    const { loadKitchenMenus } = await import("./food-menu.server");
    const kitchen = (await loadKitchenMenus(true)).find((k) => k.id === s.kitchenId) ?? null;
    if (!kitchen) return { ok: false as const, error: "Kitchen not found." };
    return { ok: true as const, kitchen };
  });

const addon = z.object({ id: z.string().min(1).max(20), name: z.string().trim().min(1).max(60), price: z.number().min(0).max(5000) });

export const saveKitchenDishFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token: z.string().max(4000),
    dish: z.object({
      id: z.string().max(20).optional(),
      name: z.string().trim().min(2).max(80),
      price: z.number().min(1).max(20000),
      veg: z.boolean(),
      description: z.string().trim().max(300),
      image: z.string().max(1_500_000).nullable().optional(),
      bestseller: z.boolean(),
      available: z.boolean(),
      addons: z.array(addon).max(8),
    }),
  }).parse(d))
  .handler(async ({ data }) => {
    const s = await kitchenSession(data.token);
    if (!s) return { ok: false as const, error: "Please sign in again." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as unknown as { from: (t: string) => any };
    const d = data.dish;
    const image = d.image && /^(https:\/\/|data:image\/(png|jpe?g|webp);base64,)/i.test(d.image) ? d.image : null;
    const row = {
      kitchen_id: s.kitchenId, name: d.name, price: Math.round(d.price), veg: d.veg, description: d.description,
      image, bestseller: d.bestseller, is_available: d.available, addons: d.addons,
    };
    if (d.id) {
      const { data: updated, error } = await sb.from("kitchen_dishes").update(row)
        .eq("id", d.id).eq("kitchen_id", s.kitchenId).select("id").maybeSingle();
      if (error || !updated) return { ok: false as const, error: "Couldn't save this dish." };
      return { ok: true as const, id: updated.id as string };
    }
    // New dishes go to the end of the menu.
    const { data: last } = await sb.from("kitchen_dishes").select("sort").eq("kitchen_id", s.kitchenId)
      .order("sort", { ascending: false }).limit(1).maybeSingle();
    const { data: created, error } = await sb.from("kitchen_dishes")
      .insert({ ...row, sort: Number(last?.sort ?? -1) + 1 }).select("id").single();
    if (error || !created) return { ok: false as const, error: "Couldn't add this dish." };
    return { ok: true as const, id: created.id as string };
  });
