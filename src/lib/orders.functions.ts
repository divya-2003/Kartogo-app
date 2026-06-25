import { createServerFn } from "@tanstack/react-start";

const STATUSES = ["placed", "packed", "out_for_delivery", "delivered", "cancelled"] as const;
type OrderStatus = (typeof STATUSES)[number];
const PAYMENTS = ["cash", "upi", "wallet"] as const;
type PaymentMethod = (typeof PAYMENTS)[number];

type PlaceInput = {
  token: string;
  items: { productId: string; qty: number }[];
  name: string;
  address: string;
  paymentMethod: PaymentMethod;
  promoCode?: string;
};

// ---------------- List orders ----------------
// Admin token => all orders. Customer token => only that phone's orders.
export const listOrdersFn = createServerFn({ method: "POST" })
  .inputValidator((data: { customerToken?: string; adminToken?: string }) => ({
    customerToken: data?.customerToken ? String(data.customerToken) : undefined,
    adminToken: data?.adminToken ? String(data.adminToken) : undefined,
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyAdminToken, verifyCustomerToken } = await import("./auth-tokens.server");

    if (verifyAdminToken(data.adminToken)) {
      const { data: rows, error } = await supabaseAdmin
        .from("app_orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error("Orders could not be refreshed. Please try again.");
      return rows ?? [];
    }

    const session = verifyCustomerToken(data.customerToken);
    if (session) {
      const { data: rows, error } = await supabaseAdmin
        .from("app_orders")
        .select("*")
        .eq("customer_phone", session.phone)
        .order("created_at", { ascending: false });
      if (error) throw new Error("Orders could not be refreshed. Please try again.");
      return rows ?? [];
    }

    return [];
  });

// ---------------- Place order ----------------
// Prices, fees, discounts, and total are ALL recomputed on the server from the
// authoritative catalog. Client-supplied amounts are ignored entirely.
export const placeOrderFn = createServerFn({ method: "POST" })
  .inputValidator((data: PlaceInput) => {
    if (!data?.token) throw new Error("Please log in to place an order");
    if (!Array.isArray(data.items) || data.items.length === 0) throw new Error("Your cart is empty");
    const name = String(data.name ?? "").trim();
    const address = String(data.address ?? "").trim();
    if (!name) throw new Error("A delivery name is required");
    if (!address) throw new Error("A delivery address is required");
    if (!PAYMENTS.includes(data.paymentMethod)) throw new Error("Invalid payment method");
    const items = data.items.map((i) => ({
      productId: String(i.productId),
      qty: Math.max(1, Math.min(50, Math.floor(Number(i.qty) || 0))),
    }));
    return {
      token: String(data.token),
      items,
      name: name.slice(0, 120),
      address: address.slice(0, 400),
      paymentMethod: data.paymentMethod,
      promoCode: data.promoCode ? String(data.promoCode).slice(0, 24) : undefined,
    };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyCustomerToken } = await import("./auth-tokens.server");
    const { CATALOG } = await import("./server-catalog.server");
    const { COUPONS, computeDiscount, deliveryFee } = await import("./promo");

    const session = verifyCustomerToken(data.token);
    if (!session) throw new Error("Your session has expired. Please log in again.");

    const items = data.items.map((i) => {
      const p = CATALOG[i.productId];
      if (!p) throw new Error("One of the items is no longer available");
      return { productId: i.productId, name: p.name, qty: i.qty, price: p.price };
    });

    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const fee = deliveryFee(subtotal);

    let promoCode: string | null = null;
    let discount = 0;
    if (data.promoCode) {
      const code = data.promoCode.toUpperCase();
      const c = COUPONS[code];
      if (c && subtotal >= c.minSubtotal) {
        promoCode = code;
        discount = computeDiscount(code, subtotal);
      }
    }

    const total = Math.max(0, subtotal + fee - discount);
    const id = `OK${Date.now().toString().slice(-6)}`;

    const { data: row, error } = await supabaseAdmin
      .from("app_orders")
      .insert({
        id,
        customer_phone: session.phone,
        customer_name: data.name,
        address: data.address,
        items,
        subtotal,
        delivery_fee: fee,
        discount,
        promo_code: promoCode,
        total,
        payment_method: data.paymentMethod,
        status: "placed",
      })
      .select("*")
      .single();

    if (error) {
      console.error("Failed to save order", error);
      throw new Error("Order could not be saved. Please try again.");
    }
    return row;
  });

// Postgres RAISE EXCEPTION messages come back prefixed; strip the noise.
function cleanDbError(message?: string | null): string | undefined {
  if (!message) return undefined;
  return message.replace(/^.*?(?:ERROR:|error:)\s*/i, "").trim() || undefined;
}

// ---------------- Admin: update status ----------------
export const setOrderStatusFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken: string; id: string; status: OrderStatus; cancelReason?: string }) => {
    if (!STATUSES.includes(data?.status)) throw new Error("Invalid status");
    return {
      adminToken: String(data?.adminToken ?? ""),
      id: String(data?.id ?? ""),
      status: data.status,
      cancelReason: data.cancelReason ? String(data.cancelReason).slice(0, 280) : undefined,
    };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");

    const update: Record<string, unknown> = { status: data.status, updated_at: new Date().toISOString() };
    if (data.status === "cancelled" && data.cancelReason) update.cancel_reason = data.cancelReason;

    const { data: row, error } = await supabaseAdmin
      .from("app_orders")
      .update(update)
      .eq("id", data.id)
      .select("*")
      .maybeSingle();

    if (error || !row) {
      console.error("Failed to update order status", error);
      throw new Error(cleanDbError(error?.message) ?? "Order status could not be updated. Please try again.");
    }
    return row;
  });

// ---------------- Admin: assign delivery partner ----------------
export const assignOrderFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken: string; id: string; deliveryBoyId: string }) => ({
    adminToken: String(data?.adminToken ?? ""),
    id: String(data?.id ?? ""),
    deliveryBoyId: String(data?.deliveryBoyId ?? ""),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");

    const { data: row, error } = await supabaseAdmin
      .from("app_orders")
      .update({ delivery_boy_id: data.deliveryBoyId || null, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .select("*")
      .maybeSingle();

    if (error || !row) {
      console.error("Failed to assign delivery partner", error);
      throw new Error("Delivery partner could not be assigned. Please try again.");
    }
    return row;
  });

// ---------------- Admin: mark refunded ----------------
export const markRefundedFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken: string; id: string; refunded: boolean }) => ({
    adminToken: String(data?.adminToken ?? ""),
    id: String(data?.id ?? ""),
    refunded: !!data?.refunded,
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");

    const { data: row, error } = await supabaseAdmin
      .from("app_orders")
      .update({
        refunded: data.refunded,
        refunded_at: data.refunded ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("*")
      .maybeSingle();

    if (error || !row) {
      console.error("Failed to update refund status", error);
      throw new Error("Refund status could not be updated. Please try again.");
    }
    return row;
  });

// ---------------- Customer: cancel own order ----------------
// Verifies the order belongs to the token's phone and is still cancellable.
export const cancelOrderFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; id: string; reason: string }) => ({
    token: String(data?.token ?? ""),
    id: String(data?.id ?? ""),
    reason: String(data?.reason ?? "").slice(0, 280),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyCustomerToken } = await import("./auth-tokens.server");

    const session = verifyCustomerToken(data.token);
    if (!session) throw new Error("Please log in to cancel an order");

    const { data: existing, error: readErr } = await supabaseAdmin
      .from("app_orders")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr || !existing) throw new Error("Order not found");
    if (existing.customer_phone !== session.phone) throw new Error("You can only cancel your own orders");
    if (existing.status !== "placed") throw new Error("This order can no longer be cancelled");

    const wasWallet = existing.payment_method === "wallet";
    const { data: row, error } = await supabaseAdmin
      .from("app_orders")
      .update({
        status: "cancelled",
        cancel_reason: data.reason || "Cancelled by customer",
        refunded: wasWallet ? true : existing.refunded,
        refunded_at: wasWallet ? new Date().toISOString() : existing.refunded_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("status", "placed")
      .select("*")
      .maybeSingle();

    if (error || !row) {
      console.error("Failed to cancel order", error);
      throw new Error(cleanDbError(error?.message) ?? "Order could not be cancelled. Please try again.");
    }
    return row;
  });
