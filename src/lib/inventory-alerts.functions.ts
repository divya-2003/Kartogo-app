import { createServerFn } from "@tanstack/react-start";

// ============================================================================
// AI Inventory Alerts — read-only intelligence for a marketplace model.
// Kartogo does not own stock, so this module never creates purchase orders or
// procurement records. It predicts stock-outs and lets the admin nudge the
// partner supermarket to replenish. Warehouse/procurement modules can be added
// later without touching this file.
// ============================================================================

export type AlertHealth = "green" | "yellow" | "red";

export type InventoryAlertRow = {
  key: string;
  productId: string;
  productName: string;
  marketId: string;
  marketName: string;
  marketPhone: string | null;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  reorderLevel: number;
  dailyDemand: number;
  daysToStockout: number | null;
  stockoutDate: string | null;
  recommendedQuantity: number;
  health: AlertHealth;
  urgency: "critical" | "high" | "watch";
  recommendation: string;
  confidence: number;
  history: { date: string; units: number }[];
  projection: { date: string; units: number }[];
};

const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);

async function requireAdmin(token: string) {
  const { verifyAdminToken } = await import("./auth-tokens.server");
  if (!token || !verifyAdminToken(token)) throw new Error("Admin authorization required");
}

export const inventoryAlertsBoardFn = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken?: string }) => ({ adminToken: str(d?.adminToken, 500) }))
  .handler(async ({ data }) => {
    await requireAdmin(data.adminToken);
    const { loadSnapshot, buildForecasts, inventoryHealthScore } = await import("./ai-ops.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const snap = await loadSnapshot(90);
    const forecasts = buildForecasts(snap);
    const byProduct = new Map(forecasts.map((f) => [f.productId, f]));

    const { data: markets } = await supabaseAdmin
      .from("partner_markets").select("id, name, phone, is_active");
    const marketMap = new Map((markets ?? []).map((m) => [m.id as string, m]));

    // Total available per product, so demand can be split across stores.
    const totalAvailable = new Map<string, number>();
    for (const i of snap.inventory) {
      totalAvailable.set(i.product_id, (totalAvailable.get(i.product_id) ?? 0) + Number(i.available_stock));
    }

    const rows: InventoryAlertRow[] = snap.inventory.map((i) => {
      const f = byProduct.get(i.product_id);
      const available = Number(i.available_stock);
      const total = totalAvailable.get(i.product_id) ?? 0;
      const share = total > 0 ? available / total : 1;
      const dailyDemand = +(((f?.nextDay ?? 0) * share) || 0).toFixed(2);
      const daysToStockout = dailyDemand > 0 ? +(available / dailyDemand).toFixed(1) : null;
      const stockoutDate =
        daysToStockout !== null
          ? new Date(Date.now() + daysToStockout * 86_400_000).toISOString().slice(0, 10)
          : null;
      const weekly = (f?.nextWeek ?? 0) * share;
      const recommendedQuantity = Math.max(
        0,
        Math.ceil(Math.max(weekly * 1.2, Number(i.reorder_level)) - available),
      );

      const health: AlertHealth =
        available <= 0 || (daysToStockout !== null && daysToStockout <= 2)
          ? "red"
          : Number(i.current_stock) <= Number(i.reorder_level) || (daysToStockout !== null && daysToStockout <= 7)
            ? "yellow"
            : "green";
      const urgency = health === "red" ? "critical" : health === "yellow" ? "high" : "watch";

      const market = marketMap.get(i.market_id);
      const marketName = (market?.name as string) ?? "Store";
      const recommendation =
        available <= 0
          ? `Out of stock at ${marketName}. Ask them to restock ${recommendedQuantity || Number(i.reorder_level) || 10} units today — demand is about ${dailyDemand}/day.`
          : health === "yellow"
            ? `Stock covers roughly ${daysToStockout ?? "—"} days at ${marketName}. Recommend ${recommendedQuantity} units before ${stockoutDate ?? "the weekend"}.`
            : `Healthy cover at ${marketName}. No action needed; keep watching weekly demand (${(f?.nextWeek ?? 0).toFixed(1)} units).`;

      return {
        key: `${i.market_id}:${i.product_id}`,
        productId: i.product_id,
        productName: i.product_name,
        marketId: i.market_id,
        marketName,
        marketPhone: (market?.phone as string | null) ?? null,
        currentStock: Number(i.current_stock),
        reservedStock: Number(i.reserved_stock),
        availableStock: available,
        reorderLevel: Number(i.reorder_level),
        dailyDemand,
        daysToStockout,
        stockoutDate,
        recommendedQuantity,
        health,
        urgency,
        recommendation,
        confidence: f?.confidence ?? 0.4,
        history: (f?.history ?? []).slice(-21),
        projection: (f?.projection ?? []).slice(0, 14),
      };
    });

    const order = { critical: 0, high: 1, watch: 2 } as const;
    rows.sort((a, b) => order[a.urgency] - order[b.urgency] || (a.daysToStockout ?? 999) - (b.daysToStockout ?? 999));

    return {
      rows,
      markets: (markets ?? []).map((m) => ({ id: m.id as string, name: m.name as string })),
      summary: {
        healthScore: inventoryHealthScore(forecasts),
        critical: rows.filter((r) => r.urgency === "critical").length,
        high: rows.filter((r) => r.urgency === "high").length,
        watch: rows.filter((r) => r.urgency === "watch").length,
        tracked: rows.length,
      },
      generatedAt: new Date().toISOString(),
    };
  });

/** Notify a partner supermarket (in-app + SMS/email) that a product needs restocking. */
export const notifyMarketReplenishFn = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken?: string; marketId?: string; productId?: string; quantity?: number; note?: string }) => ({
    adminToken: str(d?.adminToken, 500),
    marketId: str(d?.marketId, 60),
    productId: str(d?.productId, 80),
    quantity: Math.max(0, Math.floor(Number(d?.quantity) || 0)),
    note: str(d?.note, 300),
  }))
  .handler(async ({ data }) => {
    await requireAdmin(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: market }, { data: item }] = await Promise.all([
      supabaseAdmin.from("partner_markets").select("id, name, phone").eq("id", data.marketId).maybeSingle(),
      supabaseAdmin.from("inventory_items").select("product_name")
        .eq("market_id", data.marketId).eq("product_id", data.productId).maybeSingle(),
    ]);
    if (!market) throw new Error("Partner supermarket not found");

    const productName = (item?.product_name as string) ?? data.productId;
    const title = `Replenish ${productName}`;
    const body =
      `${market.name}: please restock ${data.quantity} units of ${productName}.` +
      (data.note ? `\nNote: ${data.note}` : "");

    const { dispatchNotification } = await import("./notify.server");
    await dispatchNotification({
      kind: "replenish_request",
      audience: "supplier",
      title,
      body,
      productId: data.productId,
      extraRecipients: market.phone ? [{ channel: "sms", address: String(market.phone) }] : [],
    });

    await supabaseAdmin.from("market_replenish_requests").insert({
      market_id: data.marketId,
      market_name: market.name,
      product_id: data.productId,
      product_name: productName,
      quantity: data.quantity,
      note: data.note,
    });

    return { ok: true };
  });

export const listReplenishRequestsFn = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken?: string }) => ({ adminToken: str(d?.adminToken, 500) }))
  .handler(async ({ data }) => {
    await requireAdmin(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("market_replenish_requests").select("*")
      .order("created_at", { ascending: false }).limit(50);
    return { requests: rows ?? [] };
  });
