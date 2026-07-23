import { createServerFn } from "@tanstack/react-start";

export type SalesRow = {
  orderId: string;
  createdAt: string;
  status: string;
  paymentMethod: string;
  customerName: string | null;
  customerPhone: string | null;
  address: string | null;
  numberOfItems: number;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  surgeAmount: number;
  total: number;
  cancelled: boolean;
  returned: boolean;
  cancelReason: string | null;
  refundStatus: string | null;
  itemQtyByProductId: Record<string, number>;
};

export type SalesDataset = {
  rows: SalesRow[];
  productIds: string[]; // canonical product id list used as variable columns
  productNamesById: Record<string, string>;
};

type OrderRow = {
  id: string; created_at: string; status: string; payment_method: string;
  customer_name: string | null; customer_phone: string | null; address: string | null;
  items: unknown;
  subtotal: number | string; delivery_fee: number | string; discount: number | string;
  surge_amount: number | string; total: number | string;
  cancel_reason: string | null; refunded: boolean; refund_request_status: string | null;
};

export const getSalesDatasetFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken: string }) => ({ adminToken: String(data?.adminToken ?? "") }))
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: orders, error } = await supabaseAdmin
      .from("app_orders")
      .select("id, created_at, status, payment_method, customer_name, customer_phone, address, items, subtotal, delivery_fee, discount, surge_amount, total, cancel_reason, refunded, refund_request_status")
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load sales data");

    // Union of all product ids that appear in orders + catalog for column stability.
    const productIds = new Set<string>();
    const productNamesById: Record<string, string> = {};

    const { CATALOG } = await import("./server-catalog.server");
    for (const p of CATALOG) {
      productIds.add(p.id);
      productNamesById[p.id] = p.name;
    }

    const rows: SalesRow[] = ((orders ?? []) as OrderRow[]).map((o) => {
      const items = Array.isArray(o.items) ? (o.items as Array<{ productId?: string; id?: string; name?: string; qty?: number }>) : [];
      const map: Record<string, number> = {};
      let count = 0;
      for (const it of items) {
        const pid = String(it.productId ?? it.id ?? "").trim();
        const qty = Math.max(0, Math.floor(Number(it.qty) || 0));
        if (!pid || qty <= 0) continue;
        map[pid] = (map[pid] ?? 0) + qty;
        count += qty;
        productIds.add(pid);
        if (it.name && !productNamesById[pid]) productNamesById[pid] = String(it.name);
      }
      const cancelled = o.status === "cancelled";
      const returned = !!o.refunded || o.refund_request_status === "approved";
      return {
        orderId: o.id,
        createdAt: o.created_at,
        status: o.status,
        paymentMethod: o.payment_method,
        customerName: o.customer_name,
        customerPhone: o.customer_phone,
        address: o.address,
        numberOfItems: count,
        subtotal: Number(o.subtotal) || 0,
        deliveryFee: Number(o.delivery_fee) || 0,
        discount: Number(o.discount) || 0,
        surgeAmount: Number(o.surge_amount) || 0,
        total: Number(o.total) || 0,
        cancelled,
        returned,
        cancelReason: o.cancel_reason,
        refundStatus: o.refund_request_status,
        itemQtyByProductId: map,
      };
    });

    return {
      rows,
      productIds: Array.from(productIds).sort(),
      productNamesById,
    } as SalesDataset;
  });
