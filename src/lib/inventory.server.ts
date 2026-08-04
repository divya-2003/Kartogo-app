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
  } catch (e) {
    console.error("Inventory commit failed", e);
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
