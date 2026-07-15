import { createServerFn } from "@tanstack/react-start";

// ---------------- Supplier order/session server functions ----------------
// Every call is gated by a signed supplier token. Order history is filtered
// server-side to only the categories the supplier is responsible for, so a
// supplier can never see orders/items outside their scope.

export type SupplierOrderItem = { productId: string; name: string; qty: number; price: number };
export type SupplierOrder = {
  id: string;
  createdAt: number;
  status: "placed" | "packed" | "out_for_delivery" | "delivered" | "cancelled";
  refunded: boolean;
  customerName: string;
  items: SupplierOrderItem[];
  /** Value of this supplier's items in the order (their share only). */
  supplierTotal: number;
};

// ---------------- Verify supplier token (route gate) ----------------
export const verifySupplierTokenFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token?: string }) => ({ token: data?.token ? String(data.token) : "" }))
  .handler(async ({ data }) => {
    const { verifySupplierToken } = await import("./auth-tokens.server");
    const { findSupplierById } = await import("./suppliers");
    const session = verifySupplierToken(data.token);
    if (!session) return { valid: false as const, supplier: null };
    const supplier = findSupplierById(session.supplierId);
    if (!supplier) return { valid: false as const, supplier: null };
    return {
      valid: true as const,
      supplier: { id: supplier.id, name: supplier.name, categories: supplier.categories },
    };
  });

// ---------------- List supplier orders (scoped by category) ----------------
export const listSupplierOrdersFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token?: string }) => ({ token: data?.token ? String(data.token) : "" }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifySupplierToken } = await import("./auth-tokens.server");
    const { findSupplierById } = await import("./suppliers");
    const { PRODUCT_CATEGORY } = await import("./server-catalog.server");

    const session = verifySupplierToken(data.token);
    if (!session) return { orders: [] as SupplierOrder[] };
    const supplier = findSupplierById(session.supplierId);
    if (!supplier) return { orders: [] as SupplierOrder[] };
    const cats = new Set(supplier.categories);

    const { data: rows, error } = await supabaseAdmin
      .from("app_orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error("Orders could not be loaded. Please try again.");

    const orders: SupplierOrder[] = [];
    for (const r of rows ?? []) {
      const allItems = (r.items ?? []) as SupplierOrderItem[];
      const items = allItems.filter((i) => cats.has(PRODUCT_CATEGORY[i.productId] ?? ""));
      if (items.length === 0) continue; // no items from this supplier — skip order
      const supplierTotal = items.reduce((s, i) => s + Number(i.price) * Number(i.qty), 0);
      orders.push({
        id: r.id,
        createdAt: new Date(r.created_at).getTime(),
        status: r.status as SupplierOrder["status"],
        refunded: Boolean(r.refunded),
        customerName: r.customer_name,
        items,
        supplierTotal,
      });
    }

    return { orders };
  });

// ---------------- Supplier marks an order as packed ----------------
// A supplier is only allowed to advance an order from "placed" → "packed",
// and only when the order actually contains at least one item from one of
// their categories. All authorization is enforced server-side; the DB
// trigger additionally blocks illegal transitions.
export const supplierMarkPackedFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token?: string; id?: string }) => ({
    token: data?.token ? String(data.token) : "",
    id: String(data?.id ?? ""),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifySupplierToken } = await import("./auth-tokens.server");
    const { findSupplierById } = await import("./suppliers");
    const { PRODUCT_CATEGORY } = await import("./server-catalog.server");

    const session = verifySupplierToken(data.token);
    if (!session) throw new Error("Your session has expired. Please log in again.");
    const supplier = findSupplierById(session.supplierId);
    if (!supplier) throw new Error("Supplier not found");
    const cats = new Set(supplier.categories);

    const { data: existing, error: readErr } = await supabaseAdmin
      .from("app_orders")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr || !existing) throw new Error("Order not found");

    const items = (existing.items ?? []) as SupplierOrderItem[];
    const owned = items.some((i) => cats.has(PRODUCT_CATEGORY[i.productId] ?? ""));
    if (!owned) throw new Error("This order doesn't contain any of your items");

    if (existing.status !== "placed") {
      throw new Error("Only newly placed orders can be marked as packed");
    }

    const { data: row, error } = await supabaseAdmin
      .from("app_orders")
      .update({ status: "packed", updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("status", "placed")
      .select("*")
      .maybeSingle();

    if (error || !row) {
      throw new Error("Status could not be updated. Please try again.");
    }
    return { ok: true as const, id: row.id, status: row.status as SupplierOrder["status"] };
  });
