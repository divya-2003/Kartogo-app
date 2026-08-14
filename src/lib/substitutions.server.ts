// Block 5 — out-of-stock substitutions.
//
// A store can offer a replacement for an item it cannot pack. The customer
// approves or declines; approval rewrites the order line and adjusts the
// totals, decline removes the line and refunds its value to Kartogo Cash.

export type SubstitutionRow = {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  original_price: number;
  replacement_product_id: string | null;
  replacement_name: string | null;
  replacement_price: number;
  note: string | null;
  status: string;
  created_at: string;
};

export type OrderSubstitution = {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  originalPrice: number;
  replacementProductId: string | null;
  replacementName: string | null;
  replacementPrice: number;
  note: string | null;
  status: "pending" | "approved" | "declined" | "cancelled";
  createdAt: string;
};

export const toSubstitution = (r: SubstitutionRow): OrderSubstitution => ({
  id: r.id,
  orderId: r.order_id,
  productId: r.product_id,
  productName: r.product_name,
  quantity: Number(r.quantity ?? 1),
  originalPrice: Number(r.original_price ?? 0),
  replacementProductId: r.replacement_product_id,
  replacementName: r.replacement_name,
  replacementPrice: Number(r.replacement_price ?? 0),
  note: r.note,
  status: (r.status as OrderSubstitution["status"]) ?? "pending",
  createdAt: r.created_at,
});

type OrderItem = { productId?: string; id?: string; name: string; qty: number; price: number };

/**
 * Apply a customer's decision to the stored order: swap the line (approve) or
 * drop it and credit the difference back (decline).
 */
export async function applySubstitutionDecision(sub: SubstitutionRow, approve: boolean) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: order } = await supabaseAdmin
    .from("app_orders")
    .select("id, items, subtotal, total, customer_phone, status")
    .eq("id", sub.order_id)
    .maybeSingle();
  if (!order) throw new Error("Order not found");
  if (order.status === "delivered" || order.status === "cancelled") {
    throw new Error("This order can no longer be changed");
  }

  const items = (Array.isArray(order.items) ? order.items : []) as OrderItem[];
  const idOf = (it: OrderItem) => it.productId ?? it.id ?? "";
  const line = items.find((it) => idOf(it) === sub.product_id);
  if (!line) throw new Error("Item is no longer part of this order");

  const qty = Number(sub.quantity ?? line.qty ?? 1);
  const oldValue = Number(line.price) * qty;
  let newValue = 0;
  let nextItems: OrderItem[];

  if (approve) {
    newValue = Number(sub.replacement_price ?? 0) * qty;
    nextItems = items.map((it) =>
      idOf(it) === sub.product_id
        ? {
            ...it,
            productId: sub.replacement_product_id ?? idOf(it),
            id: sub.replacement_product_id ?? idOf(it),
            name: sub.replacement_name ?? it.name,
            price: Number(sub.replacement_price ?? it.price),
          }
        : it,
    );
  } else {
    nextItems = items.filter((it) => idOf(it) !== sub.product_id);
  }

  const delta = newValue - oldValue;
  const subtotal = Math.max(0, Number(order.subtotal ?? 0) + delta);
  const total = Math.max(0, Number(order.total ?? 0) + delta);

  await supabaseAdmin
    .from("app_orders")
    .update({ items: nextItems as unknown as never, subtotal, total })
    .eq("id", sub.order_id);

  // A cheaper basket means the customer already paid too much — return the
  // difference as Kartogo Cash rather than silently keeping it.
  if (delta < 0 && order.customer_phone) {
    await supabaseAdmin.rpc("adjust_wallet", {
      p_phone: order.customer_phone,
      p_amount: Math.abs(delta),
      p_type: "credit",
      p_note: `Adjustment for order ${sub.order_id}`,
    });
  }

  return { subtotal, total, delta };
}
