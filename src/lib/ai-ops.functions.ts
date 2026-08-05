import { createServerFn } from "@tanstack/react-start";

// ============================================================================
// AI Operations Assistant — client-facing server API.
// The AI analyses, predicts, recommends and notifies. It NEVER changes stock
// levels and never creates a purchase order without an explicit admin action.
// ============================================================================

const str = (v: unknown, max = 500) => String(v ?? "").trim().slice(0, max);

type Actor = { kind: "admin" | "supplier"; id: string; categories: string[] | null };

async function authorize(adminToken: string, supplierToken: string): Promise<Actor> {
  const { verifyAdminToken, verifySupplierToken } = await import("./auth-tokens.server");
  if (adminToken && verifyAdminToken(adminToken)) return { kind: "admin", id: "admin", categories: null };
  if (supplierToken) {
    const s = verifySupplierToken(supplierToken);
    if (s) {
      const { findSupplierById } = await import("./suppliers");
      const sup = findSupplierById(s.supplierId);
      return { kind: "supplier", id: s.supplierId, categories: sup?.categories ?? [] };
    }
  }
  throw new Error("Authorization required");
}

// -------------------------------------------------------------- dashboard
export const aiOpsDashboardFn = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken?: string; supplierToken?: string }) => ({
    adminToken: str(d?.adminToken), supplierToken: str(d?.supplierToken),
  }))
  .handler(async ({ data }) => {
    const actor = await authorize(data.adminToken, data.supplierToken);
    const ai = await import("./ai-ops.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const snap = await ai.loadSnapshot(90);
    let forecasts = ai.buildForecasts(snap);
    if (actor.kind === "supplier") {
      const cats = actor.categories ?? [];
      forecasts = forecasts.filter((f) => cats.includes(f.category));
    }

    const anomalies = actor.kind === "admin" ? ai.detectAnomalies(snap, forecasts) : [];
    const health = ai.inventoryHealthScore(forecasts);
    const suppliers = actor.kind === "admin" ? await ai.supplierScores(snap, forecasts) : [];
    const accuracy = await ai.forecastAccuracy();

    let q = supabaseAdmin.from("ai_insights").select("*")
      .eq("status", "open").order("created_at", { ascending: false }).limit(120);
    q = actor.kind === "admin"
      ? q.eq("audience", "admin")
      : q.eq("audience", "supplier").eq("supplier_id", actor.id);
    const { data: insights } = await q;

    const sold = (f: typeof forecasts[number]) => f.soldLast30;
    return {
      role: actor.kind,
      health,
      accuracy,
      suppliers,
      anomalies,
      insights: insights ?? [],
      aboutToStockOut: forecasts.filter((f) => f.severity).slice(0, 10),
      reorderSuggestions: forecasts.filter((f) => f.recommendedQuantity > 0).slice(0, 15),
      fastestSelling: [...forecasts].sort((a, b) => sold(b) - sold(a)).slice(0, 10),
      slowestSelling: [...forecasts].filter((f) => f.currentStock > 0).sort((a, b) => sold(a) - sold(b)).slice(0, 10),
      unusualDemand: [...forecasts].filter((f) => f.trendPercent >= 40 && f.soldLast7 >= 3).slice(0, 10),
      decliningDemand: [...forecasts].filter((f) => f.trendPercent <= -30 && f.soldLast30 >= 5).slice(0, 10),
      mostCancelled: [...forecasts].filter((f) => f.cancelledUnits > 0).sort((a, b) => b.cancelledUnits - a.cancelledUnits).slice(0, 10),
      forecasts: forecasts.slice(0, 60),
      generatedAt: new Date().toISOString(),
    };
  });

// ------------------------------------------------------------- run analysis
export const runAiAnalysisFn = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken?: string }) => ({ adminToken: str(d?.adminToken) }))
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");
    const { runAnalysis } = await import("./ai-ops.server");
    return runAnalysis();
  });

// ----------------------------------------------------------------- insights
export const markAiInsightsReadFn = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken?: string; supplierToken?: string }) => ({
    adminToken: str(d?.adminToken), supplierToken: str(d?.supplierToken),
  }))
  .handler(async ({ data }) => {
    const actor = await authorize(data.adminToken, data.supplierToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("ai_insights").update({ read: true }).eq("read", false);
    q = actor.kind === "admin" ? q.eq("audience", "admin") : q.eq("audience", "supplier").eq("supplier_id", actor.id);
    await q;
    return { ok: true };
  });

export const dismissAiInsightFn = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken?: string; supplierToken?: string; id?: string }) => ({
    adminToken: str(d?.adminToken), supplierToken: str(d?.supplierToken), id: str(d?.id, 60),
  }))
  .handler(async ({ data }) => {
    const actor = await authorize(data.adminToken, data.supplierToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("ai_insights").update({ status: "dismissed" }).eq("id", data.id);
    q = actor.kind === "admin" ? q.eq("audience", "admin") : q.eq("audience", "supplier").eq("supplier_id", actor.id);
    const { error } = await q;
    if (error) throw new Error("Could not dismiss this insight");
    return { ok: true };
  });

/** Admin-approved action: turn an AI reorder recommendation into a DRAFT purchase
 *  order. The AI never does this on its own. */
export const approveReorderSuggestionFn = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken?: string; insightId?: string; marketId?: string; quantity?: number }) => ({
    adminToken: str(d?.adminToken), insightId: str(d?.insightId, 60), marketId: str(d?.marketId, 60),
    quantity: Math.max(1, Math.floor(Number(d?.quantity) || 1)),
  }))
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: insight } = await supabaseAdmin.from("ai_insights").select("*").eq("id", data.insightId).maybeSingle();
    if (!insight?.product_id) throw new Error("Recommendation not found");

    const { data: market } = data.marketId
      ? await supabaseAdmin.from("partner_markets").select("id, name").eq("id", data.marketId).maybeSingle()
      : await supabaseAdmin.from("partner_markets").select("id, name").eq("is_active", true).limit(1).maybeSingle();

    const { data: cost } = await supabaseAdmin.from("product_costs")
      .select("cost_price").eq("product_id", insight.product_id).maybeSingle();
    const unitCost = Number(cost?.cost_price ?? 0);

    const { data: po, error } = await supabaseAdmin.from("purchase_orders").insert({
      market_id: market?.id ?? null,
      market_name: market?.name ?? "",
      status: "draft",
      expected_cost: unitCost * data.quantity,
      auto_generated: false,
      notes: `Created from an AI recommendation approved by admin — ${insight.title}`,
    }).select("id").single();
    if (error || !po) throw new Error("Could not create the draft purchase order");

    await supabaseAdmin.from("purchase_order_items").insert({
      purchase_order_id: po.id,
      product_id: insight.product_id,
      product_name: insight.product_name ?? insight.product_id,
      quantity: data.quantity,
      unit_cost: unitCost,
    });

    await supabaseAdmin.from("ai_insights").update({ status: "approved" }).eq("id", data.insightId);
    return { purchaseOrderId: po.id };
  });

// ------------------------------------------------------------- chat assistant
export type AiChatMessage = { role: "user" | "assistant"; content: string };

export const aiAssistantFn = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken?: string; supplierToken?: string; question?: string; history?: AiChatMessage[] }) => ({
    adminToken: str(d?.adminToken), supplierToken: str(d?.supplierToken),
    question: str(d?.question, 800),
    history: (Array.isArray(d?.history) ? d.history : []).slice(-8).map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: str(m.content, 2000),
    })),
  }))
  .handler(async ({ data }) => {
    const actor = await authorize(data.adminToken, data.supplierToken);
    if (!data.question) throw new Error("Ask a question first");

    const ai = await import("./ai-ops.server");
    const snap = await ai.loadSnapshot(90);
    let forecasts = ai.buildForecasts(snap);
    if (actor.kind === "supplier") forecasts = forecasts.filter((f) => (actor.categories ?? []).includes(f.category));

    const anomalies = ai.detectAnomalies(snap, forecasts).slice(0, 10);
    const suppliers = actor.kind === "admin" ? await ai.supplierScores(snap, forecasts) : [];
    const health = ai.inventoryHealthScore(forecasts);
    const accuracy = await ai.forecastAccuracy();

    const compact = forecasts.slice(0, 40).map((f) => ({
      product: f.name, category: f.category, available: f.availableStock, reserved: f.reservedStock,
      sold7: f.soldLast7, sold30: f.soldLast30, perDay: f.dailyAverage,
      tomorrow: f.nextDay, week: f.nextWeek, month: f.nextMonth,
      daysToStockout: f.daysToStockout, stockoutDate: f.stockoutDate,
      reorderQty: f.recommendedQuantity, trendPct: f.trendPercent, confidence: f.confidence,
      cancelled: f.cancelledUnits,
    }));

    const context = JSON.stringify({
      today: new Date().toISOString().slice(0, 10),
      role: actor.kind,
      inventoryHealthScore: health,
      forecastAccuracy: accuracy.overall,
      stores: snap.markets.map((m) => ({ name: m.name, active: m.is_active })),
      supplierScores: suppliers,
      anomalies: anomalies.map((a) => ({ title: a.title, detail: a.body, severity: a.severity })),
      products: compact,
    });

    const { createLovableAiGatewayProvider, requireAiKey } = await import("./ai-gateway.server");
    const { streamText } = await import("ai");
    const gateway = createLovableAiGatewayProvider(requireAiKey());

    const system = [
      "You are Kartogo's AI Operations Assistant for an Indian quick-commerce grocery business.",
      "Answer only from the BUSINESS DATA JSON provided. Never invent numbers.",
      "Always explain the reasoning with the actual figures (units sold, days of cover, trend %).",
      "Amounts are in Indian rupees (₹). Be concise: short paragraphs or bullet points.",
      "You may recommend restocking quantities, but state clearly that purchase orders need admin approval.",
      "You must never claim to have changed stock or placed an order — you only analyse and recommend.",
      actor.kind === "supplier" ? "The user is a supplier and can only see their own product categories." : "The user is the admin.",
    ].join(" ");

    try {
      const result = streamText({
        model: gateway("google/gemini-2.5-flash"),
        system,
        messages: [
          ...data.history,
          { role: "user" as const, content: `BUSINESS DATA:\n${context}\n\nQUESTION: ${data.question}` },
        ],
      });
      const answer = await result.text;
      return { answer };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/429|rate limit/i.test(msg)) throw new Error("The assistant is busy right now — please try again in a moment.");
      if (/402|credit/i.test(msg)) throw new Error("AI credits are exhausted. Add credits to keep using the assistant.");
      console.error("AI assistant failed", e);
      throw new Error("The assistant could not answer that. Please try again.");
    }
  });
