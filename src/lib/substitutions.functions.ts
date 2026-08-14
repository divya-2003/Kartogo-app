import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { OrderSubstitution } from "./substitutions.server";

export type { OrderSubstitution };

// ---------------- Store proposes a replacement (supplier token) ----------------
export const suggestSubstitutionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        token: z.string().min(1),
        orderId: z.string().min(1),
        productId: z.string().min(1),
        productName: z.string().min(1).max(160),
        quantity: z.number().int().min(1).max(50).default(1),
        originalPrice: z.number().min(0).max(1_000_000),
        replacementProductId: z.string().max(120).nullable().optional(),
        replacementName: z.string().min(1).max(160),
        replacementPrice: z.number().min(0).max(1_000_000),
        note: z.string().max(300).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { verifySupplierToken } = await import("./auth-tokens.server");
    const session = verifySupplierToken(data.token);
    if (!session) throw new Error("Supplier authorization required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { toSubstitution, type SubstitutionRow } = await import("./substitutions.server");

    const { data: existing } = await supabaseAdmin
      .from("order_substitutions")
      .select("id")
      .eq("order_id", data.orderId)
      .eq("product_id", data.productId)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) throw new Error("A replacement is already awaiting the customer");

    const { data: row, error } = await supabaseAdmin
      .from("order_substitutions")
      .insert({
        order_id: data.orderId,
        product_id: data.productId,
        product_name: data.productName,
        quantity: data.quantity,
        original_price: data.originalPrice,
        replacement_product_id: data.replacementProductId ?? null,
        replacement_name: data.replacementName,
        replacement_price: data.replacementPrice,
        note: data.note ?? null,
        suggested_by: session.supplierId,
      })
      .select("*")
      .single();
    if (error) throw new Error("Could not send the replacement request");

    return { substitution: toSubstitution(row as SubstitutionRow) };
  });

// ---------------- Customer sees pending replacements ----------------
export const listMySubstitutionsFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token?: string }) => ({ token: data?.token ? String(data.token) : "" }))
  .handler(async ({ data }) => {
    const { verifyCustomerToken } = await import("./auth-tokens.server");
    const session = verifyCustomerToken(data.token);
    if (!session) return { substitutions: [] as OrderSubstitution[] };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { toSubstitution, type SubstitutionRow } = await import("./substitutions.server");

    const { data: orders } = await supabaseAdmin
      .from("app_orders")
      .select("id")
      .eq("customer_phone", session.phone)
      .order("created_at", { ascending: false })
      .limit(30);
    const ids = (orders ?? []).map((o) => o.id as string);
    if (!ids.length) return { substitutions: [] as OrderSubstitution[] };

    const { data: rows } = await supabaseAdmin
      .from("order_substitutions")
      .select("*")
      .in("order_id", ids)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    return { substitutions: ((rows ?? []) as SubstitutionRow[]).map(toSubstitution) };
  });

// ---------------- Customer approves / declines ----------------
export const respondSubstitutionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ token: z.string().min(1), id: z.string().uuid(), approve: z.boolean() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { verifyCustomerToken } = await import("./auth-tokens.server");
    const session = verifyCustomerToken(data.token);
    if (!session) throw new Error("Please log in");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { applySubstitutionDecision, type SubstitutionRow } = await import("./substitutions.server");

    const { data: row } = await supabaseAdmin
      .from("order_substitutions")
      .select("*")
      .eq("id", data.id)
      .eq("status", "pending")
      .maybeSingle();
    if (!row) throw new Error("This replacement is no longer available");

    // Ownership: the substitution must belong to an order of this customer.
    const { data: order } = await supabaseAdmin
      .from("app_orders")
      .select("id, customer_phone")
      .eq("id", (row as SubstitutionRow).order_id)
      .maybeSingle();
    if (!order || order.customer_phone !== session.phone) throw new Error("Not allowed");

    const result = await applySubstitutionDecision(row as SubstitutionRow, data.approve);

    await supabaseAdmin
      .from("order_substitutions")
      .update({ status: data.approve ? "approved" : "declined", responded_at: new Date().toISOString() })
      .eq("id", data.id);

    return { ok: true as const, ...result };
  });
