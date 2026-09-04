// Server-only helpers that keep warehouse stock in sync with the order
// lifecycle. Reservation is transaction-safe (Postgres row locks inside the
// `reserve_inventory` function), so simultaneous customers can never oversell.
//
//   place order   -> reserve   (reserved +, available -, current unchanged)
//   delivered     -> commit    (current -, reserved -)
//   cancelled     -> release   (reserved -, current unchanged)

export type OrderLineInput = { productId: string; qty: number };

export async function reserveForOrder(orderId: string, items: OrderLineInput[], actor = "customer") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const payload = items
    .filter((i) => i.productId && i.qty > 0)
    .map((i) => ({ product_id: i.productId, quantity: Math.floor(i.qty) }));
  if (payload.length === 0) return;

  const { error } = await supabaseAdmin.rpc("reserve_inventory", {
    p_order_id: orderId,
    p_items: payload,
    p_actor: actor,
  });
  if (error) {
    const msg = String(error.message ?? "");
    if (/out of stock/i.test(msg)) {
      throw new Error(msg.replace(/^.*?(?:ERROR:|error:)\s*/i, "").trim());
    }
    console.error("Inventory reservation failed", error);
    throw new Error("Could not reserve stock for this order. Please try again.");
  }
}

export async function commitForOrder(orderId: string, actor = "system") {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("commit_inventory", { p_order_id: orderId, p_actor: actor });
    if (error) console.error("Inventory commit failed", error);
    await deductCatalogStock(orderId);
  } catch (e) {
    console.error("Inventory commit failed", e);
  }
}

/**
 * The admin catalogue and the supplier pages read `catalog_items.stock`, which
 * is separate from the warehouse ledger. Once an order is delivered the sold
 * units must disappear from that shelf count too.
 */
async function deductCatalogStock(orderId: string) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("app_orders")
      .select("items")
      .eq("id", orderId)
      .maybeSingle();
    const items = (order?.items ?? []) as { productId?: string; qty?: number }[];
    const wanted = new Map<string, number>();
    for (const i of items) {
      const id = String(i?.productId ?? "");
      const qty = Math.floor(Number(i?.qty ?? 0));
      if (!id || qty <= 0) continue;
      wanted.set(id, (wanted.get(id) ?? 0) + qty);
    }
    if (wanted.size === 0) return;

    const { data: rows } = await supabaseAdmin
      .from("catalog_items")
      .select("id, stock")
      .in("id", [...wanted.keys()]);
    for (const row of (rows ?? []) as { id: string; stock: number | null }[]) {
      const next = Math.max(0, Number(row.stock ?? 0) - (wanted.get(row.id) ?? 0));
      if (next === Number(row.stock ?? 0)) continue;
      await supabaseAdmin
        .from("catalog_items")
        .update({ stock: next, updated_at: new Date().toISOString() })
        .eq("id", row.id);
    }
  } catch (e) {
    console.error("Catalog stock deduction failed", e);
  }
}

export async function releaseForOrder(orderId: string, actor = "system") {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("release_inventory", { p_order_id: orderId, p_actor: actor });
    if (error) console.error("Inventory release failed", error);
  } catch (e) {
    console.error("Inventory release failed", e);
  }
}

/** Fire-and-forget sync driven purely by the new order status. */
export async function syncInventoryForStatus(orderId: string, status: string, actor = "system") {
  if (status === "delivered") await commitForOrder(orderId, actor);
  else if (status === "cancelled") await releaseForOrder(orderId, actor);
}
