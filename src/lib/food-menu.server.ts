// Live food menu: dishes are stored per kitchen in the database (kitchen staff
// manage them from the kitchen portal). Kitchen details (name, photo, ETA)
// still come from the static list in food.ts. The static dishes are only a
// fallback for dishes that were never copied into the database.
import { KITCHENS, findDish, type Dish, type Kitchen } from "./food";

export type MenuDish = Dish & { available: boolean; sort: number };
export type MenuKitchen = Omit<Kitchen, "dishes"> & { dishes: MenuDish[] };

type Row = {
  id: string; kitchen_id: string; name: string; price: number | string; veg: boolean; description: string;
  image: string | null; bestseller: boolean; addons: unknown; is_available: boolean; sort: number;
};

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as { from: (t: string) => any };
}

function cleanAddons(raw: unknown): { id: string; name: string; price: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a: any) => ({ id: String(a?.id ?? ""), name: String(a?.name ?? ""), price: Number(a?.price ?? 0) }))
    .filter((a) => a.id && a.name && Number.isFinite(a.price) && a.price >= 0);
}

export function rowToDish(r: Row): MenuDish {
  return {
    id: r.id, name: r.name, price: Number(r.price), veg: !!r.veg, desc: r.description ?? "",
    image: r.image ?? null, bestseller: !!r.bestseller, addons: cleanAddons(r.addons),
    available: !!r.is_available, sort: Number(r.sort ?? 0),
  };
}

/** Every kitchen with its dishes. Customers get only available dishes. */
export async function loadKitchenMenus(includeHidden = false): Promise<MenuKitchen[]> {
  const { data, error } = await (await db()).from("kitchen_dishes")
    .select("id,kitchen_id,name,price,veg,description,image,bestseller,addons,is_available,sort")
    .order("sort", { ascending: true }).order("created_at", { ascending: true }).limit(2000);
  const rows = (error ? [] : (data ?? [])) as Row[];
  return KITCHENS.map(({ dishes, ...k }) => {
    const own = rows.filter((r) => r.kitchen_id === k.id).map(rowToDish);
    // Kitchens never copied into the database keep their original menu.
    const list: MenuDish[] = own.length > 0 ? own : dishes.map((d, i) => ({ ...d, available: true, sort: i }));
    return { ...k, dishes: includeHidden ? list : list.filter((d) => d.available) };
  });
}

/** Server-side price lookup for an order line. Hidden dishes cannot be ordered. */
export async function findLiveDish(dishId: string): Promise<{ kitchen: Kitchen; dish: Dish } | null> {
  const { data } = await (await db()).from("kitchen_dishes")
    .select("id,kitchen_id,name,price,veg,description,image,bestseller,addons,is_available,sort")
    .eq("id", dishId).maybeSingle();
  if (data) {
    const row = data as Row;
    if (!row.is_available) return null;
    const kitchen = KITCHENS.find((k) => k.id === row.kitchen_id);
    return kitchen ? { kitchen, dish: rowToDish(row) } : null;
  }
  return findDish(dishId) ?? null;
}
