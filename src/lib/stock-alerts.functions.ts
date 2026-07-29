import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ---------------- Out-of-stock alerts ----------------
// When a customer taps "Notify me" on a sold-out product we raise a restock
// request for the admin, stamped with the product and the partner markets we
// source that product from.

export type StockAlert = {
  id: string;
  productId: string;
  productName: string;
  category: string;
  customerPhone: string | null;
  customerName: string | null;
  markets: string;
  status: "pending" | "sourcing" | "restocked" | "closed";
  createdAt: string;
};

type Row = {
  id: string; product_id: string; product_name: string; category: string;
  customer_phone: string | null; customer_name: string | null; markets: string;
  status: string; created_at: string;
};

const STATUSES = ["pending", "sourcing", "restocked", "closed"] as const;

const toAlert = (r: Row): StockAlert => ({
  id: r.id,
  productId: r.product_id,
  productName: r.product_name,
  category: r.category,
  customerPhone: r.customer_phone,
  customerName: r.customer_name,
  markets: r.markets ?? "",
  status: (STATUSES as readonly string[]).includes(r.status) ? (r.status as StockAlert["status"]) : "pending",
  createdAt: r.created_at,
});

async function requireAdmin(token: string) {
  const { verifyAdminToken } = await import("./auth-tokens.server");
  if (!verifyAdminToken(token)) throw new Error("Admin authorization required");
}

const createSchema = z.object({
  productId: z.string().min(1).max(80),
  productName: z.string().max(160).default(""),
  category: z.string().max(80).default(""),
  customerPhone: z.string().max(20).optional().nullable(),
  customerName: z.string().max(80).optional().nullable(),
});

/** Customer: "Notify me when back in stock". */
export const createStockAlertFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Attach the markets we currently source from so the admin knows who to call.
    const { data: markets } = await supabaseAdmin
      .from("partner_markets")
      .select("name")
      .eq("is_active", true)
      .limit(20);
    const marketNames = (markets ?? []).map((m: { name: string }) => m.name).join(", ");

    // One open request per customer + product keeps the admin queue clean.
    const { data: existing } = await supabaseAdmin
      .from("stock_alerts")
      .select("id")
      .eq("product_id", data.productId)
      .eq("customer_phone", data.customerPhone ?? "")
      .eq("status", "pending")
      .maybeSingle();
    if (existing) return { ok: true as const, duplicate: true as const };

    const { error } = await supabaseAdmin.from("stock_alerts").insert({
      product_id: data.productId,
      product_name: data.productName,
      category: data.category,
      customer_phone: data.customerPhone || null,
      customer_name: data.customerName || null,
      markets: marketNames,
    });
    if (error) throw new Error("Could not register your alert. Please try again.");
    return { ok: true as const, duplicate: false as const };
  });

export const listStockAlertsFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken: string }) => ({ adminToken: String(data?.adminToken ?? "") }))
  .handler(async ({ data }): Promise<StockAlert[]> => {
    await requireAdmin(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("stock_alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error("Could not load restock requests");
    return (rows as Row[]).map(toAlert);
  });

export const updateStockAlertStatusFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken: string; id: string; status: StockAlert["status"] }) => ({
    adminToken: String(data?.adminToken ?? ""),
    id: z.string().uuid().parse(data?.id),
    status: z.enum(STATUSES).parse(data?.status),
  }))
  .handler(async ({ data }) => {
    await requireAdmin(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("stock_alerts")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error("Could not update this request");
    return { ok: true as const };
  });
