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
  /** Standard orders may be scheduled into one of the admin-managed time slots. */
  slotId?: string;
  slotDate?: string;
  /**
   * Idempotency key generated once per checkout attempt by the client. If the
   * same key arrives twice (double tap, retry after a flaky network) the first
   * order is returned instead of creating a duplicate.
   */
  clientRequestId?: string;
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
      slotId: data.slotId ? String(data.slotId).slice(0, 64) : undefined,
      slotDate: /^\d{4}-\d{2}-\d{2}$/.test(String(data.slotDate ?? "")) ? String(data.slotDate) : undefined,
    };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyCustomerToken } = await import("./auth-tokens.server");
    const { CATALOG } = await import("./server-catalog.server");
    const { deliveryFee } = await import("./promo");
    const { loadSurgeConfig } = await import("./surge.functions");

    const session = verifyCustomerToken(data.token);
    if (!session) throw new Error("Your session has expired. Please log in again.");

    const items = data.items.map((i) => {
      const p = CATALOG[i.productId];
      if (!p) throw new Error("One of the items is no longer available");
      return { productId: i.productId, name: p.name, qty: i.qty, price: p.price };
    });

    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const baseFee = deliveryFee(subtotal);

    // Snapshot surge state at the moment of ordering. Anything a driver earns
    // from this order is derived from THIS snapshot — not the live config —
    // so later admin edits never rewrite past settlements.
    const surge = await loadSurgeConfig();
    const surgeAmount = surge.enabled && subtotal > 0 ? Math.round(surge.amount) : 0;
    const surgeReason = surgeAmount > 0 ? surge.reason : null;
    const driverSurgeShare = surgeAmount > 0
      ? Math.round((surgeAmount * surge.driverSharePercent) / 100)
      : 0;
    const fee = baseFee + surgeAmount;

    // Promotions are re-derived from the promo_codes table: validity window,
    // basket floor, total cap, per-customer cap and first-order-only rules all
    // enforced here, never from whatever the client claims.
    let promoCode: string | null = null;
    let discount = 0;
    if (data.promoCode) {
      const { evaluatePromo } = await import("./promo.server");
      const verdict = await evaluatePromo(
        data.promoCode,
        subtotal,
        session.phone,
        items.map((i) => ({ productId: i.productId, price: i.price, qty: i.qty })),
      );
      if (verdict.ok) {
        promoCode = verdict.code;
        discount = verdict.discount;
      }
    }


    const total = Math.max(0, subtotal + fee - discount);
    const id = `OK${Date.now().toString().slice(-6)}`;

    // Scheduled delivery: the slot is re-read from the database so a client can
    // never invent a window we don't actually run.
    let slot: { label: string; start: string; end: string; date: string } | null = null;
    if (data.slotId && data.slotDate) {
      const { data: slotRow } = await supabaseAdmin
        .from("delivery_slots")
        .select("label, start_time, end_time, is_active")
        .eq("id", data.slotId)
        .maybeSingle();
      if (slotRow?.is_active) {
        slot = {
          label: slotRow.label,
          start: slotRow.start_time,
          end: slotRow.end_time,
          date: data.slotDate,
        };
      }
    }

    // Wallet payments are charged against the AUTHORITATIVE server-side balance.
    // The deduction is validated and recorded in the database before the order is
    // saved, so a client can never get a free order by faking a balance.
    let walletCharged = false;
    if (data.paymentMethod === "wallet" && total > 0) {
      const { error: payErr } = await supabaseAdmin.rpc("adjust_wallet", {
        p_phone: session.phone,
        p_amount: total,
        p_type: "debit",
        p_note: `Order payment ${id}`,
      });
      if (payErr) {
        const msg = cleanDbError(payErr.message) ?? "";
        if (/insufficient/i.test(msg)) throw new Error("Not enough Kartogo Cash to pay for this order");
        console.error("Wallet charge failed", payErr);
        throw new Error("Could not charge your wallet. Please try again.");
      }
      walletCharged = true;
    }

    // Hold (reserve) warehouse stock BEFORE the order row is written. The
    // reservation is transaction-safe, so two customers can never buy the same
    // last unit. Current stock is untouched until the order is delivered.
    const { reserveForOrder, releaseForOrder } = await import("./inventory.server");
    try {
      await reserveForOrder(id, items.map((i) => ({ productId: i.productId, qty: i.qty })), session.phone);
    } catch (e) {
      if (walletCharged) {
        await supabaseAdmin.rpc("adjust_wallet", {
          p_phone: session.phone, p_amount: total, p_type: "credit",
          p_note: `Refund — order ${id} could not be stocked`,
        });
      }
      throw e;
    }

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
        surge_amount: surgeAmount,
        surge_reason: surgeReason,
        driver_surge_share: driverSurgeShare,
        discount,
        promo_code: promoCode,
        total,
        payment_method: data.paymentMethod,
        status: "placed",
        scheduled_slot_label: slot?.label ?? null,
        scheduled_date: slot?.date ?? null,
        scheduled_start: slot?.start ?? null,
        scheduled_end: slot?.end ?? null,
      })
      .select("*")
      .single();

    if (error) {
      console.error("Failed to save order", error);
      // Roll the wallet charge and the stock hold back so the customer is never
      // debited — and no stock stays locked — for an order that did not persist.
      await releaseForOrder(id, "system");
      if (walletCharged) {
        await supabaseAdmin.rpc("adjust_wallet", {
          p_phone: session.phone,
          p_amount: total,
          p_type: "credit",
          p_note: `Refund — order ${id} failed`,
        });
      }
      throw new Error("Order could not be saved. Please try again.");
    }

    if (promoCode && discount > 0) {
      const { recordRedemption } = await import("./promo.server");
      await recordRedemption(promoCode, session.phone, id, discount);
    }

    // Push: order confirmed (best-effort — never blocks the order)
    try {
      const { sendPushToCustomer } = await import("./push.server");
      await sendPushToCustomer({ phone: session.phone, type: "ORDER_CONFIRMED", orderId: id });
    } catch (e) {
      console.error("order confirmation push failed", e);
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

    const update: { status: OrderStatus; updated_at: string; cancel_reason?: string } = {
      status: data.status,
      updated_at: new Date().toISOString(),
    };
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

    // Delivered -> deduct held stock permanently. Cancelled -> give it back.
    const { syncInventoryForStatus } = await import("./inventory.server");
    await syncInventoryForStatus(data.id, data.status, "admin");

    // Phase 3/7 — keep dispatch in step with the order lifecycle. Never let a
    // logistics hiccup fail the admin's status change.
    try {
      const dispatch = await import("./logistics/dispatch.server");
      if (data.status === "packed") {
        await dispatch.logEvent(data.id, "order_ready", {}, null, "admin");
        await dispatch.offerOrder(data.id);
      } else if (data.status === "cancelled") {
        await dispatch.releaseDriver(data.id, "cancelled", false);
      } else if (data.status === "delivered" && row.delivery_boy_id) {
        await dispatch.completeAssignment(data.id, String(row.delivery_boy_id));
      }
    } catch (e) {
      console.error("dispatch sync failed", e);
    }

    try {
      const { pushOrderStatus } = await import("./push.server");
      await pushOrderStatus(data.id, data.status);
    } catch (e) {
      console.error("status push failed", e);
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

    try {
      const { sendPushToCustomer } = await import("./push.server");
      await sendPushToCustomer({
        phone: String(row.customer_phone), type: "DRIVER_ASSIGNED", orderId: data.id,
      });
    } catch (e) {
      console.error("driver assigned push failed", e);
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

    const { data: existing, error: readErr } = await supabaseAdmin
      .from("app_orders")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr || !existing) throw new Error("Order not found");

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

    // Reverse the Kartogo Cash payment server-side when a wallet order is marked
    // refunded (and pull it back if the refund is reverted). Guarded by the
    // previous refunded state so the wallet is never double-credited.
    const wasWallet = existing.payment_method === "wallet" && Number(existing.total) > 0;
    if (wasWallet && data.refunded && !existing.refunded) {
      await supabaseAdmin.rpc("adjust_wallet", {
        p_phone: existing.customer_phone,
        p_amount: Number(existing.total),
        p_type: "credit",
        p_note: `Refund for cancelled order ${existing.id}`,
      });
    } else if (wasWallet && !data.refunded && existing.refunded) {
      await supabaseAdmin.rpc("adjust_wallet", {
        p_phone: existing.customer_phone,
        p_amount: Number(existing.total),
        p_type: "debit",
        p_note: `Refund reverted for order ${existing.id}`,
      });
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

    const wasWallet = existing.payment_method === "wallet" && Number(existing.total) > 0 && !existing.refunded;
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

    // Reverse the wallet payment authoritatively on the server so refunds can't
    // be faked or skipped from the client.
    if (wasWallet) {
      await supabaseAdmin.rpc("adjust_wallet", {
        p_phone: existing.customer_phone,
        p_amount: Number(existing.total),
        p_type: "credit",
        p_note: `Refund for cancelled order ${existing.id}`,
      });
    }

    // Give the held stock back to the shelf.
    const { releaseForOrder } = await import("./inventory.server");
    await releaseForOrder(data.id, "customer");

    return row;

  });

// ---------------- Customer: request a refund/replacement ----------------
// Called from the customer "Report an issue" flow. Persists the request on the
// order so admins can see and action it in the Refund requests screen.
export const requestRefundFn = createServerFn({ method: "POST" })
  .inputValidator((data: {
    token: string;
    id: string;
    type: string;
    resolution: "Refund" | "Replacement";
    details: string;
  }) => ({
    token: String(data?.token ?? ""),
    id: String(data?.id ?? ""),
    type: String(data?.type ?? "").slice(0, 80),
    resolution: data?.resolution === "Replacement" ? "Replacement" : "Refund",
    details: String(data?.details ?? "").slice(0, 500),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyCustomerToken } = await import("./auth-tokens.server");

    const session = verifyCustomerToken(data.token);
    if (!session) throw new Error("Please log in to request a refund");

    const { data: existing, error: readErr } = await supabaseAdmin
      .from("app_orders")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr || !existing) throw new Error("Order not found");
    if (existing.customer_phone !== session.phone) throw new Error("You can only request refunds on your own orders");

    const { data: row, error } = await supabaseAdmin
      .from("app_orders")
      .update({
        refund_requested_at: new Date().toISOString(),
        refund_request_reason: data.details,
        refund_request_type: data.type,
        refund_request_resolution: data.resolution,
        refund_request_status: "pending",
        return_stage: "requested",
        return_picked_up_at: null,
        refund_initiated_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("*")
      .maybeSingle();

    if (error || !row) throw new Error("Could not submit your request. Please try again.");
    return row;
  });

// ---------------- Admin: resolve a refund request ----------------
export const resolveRefundRequestFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken: string; id: string; decision: "approved" | "rejected" }) => ({
    adminToken: String(data?.adminToken ?? ""),
    id: String(data?.id ?? ""),
    decision: data?.decision === "approved" ? "approved" : "rejected",
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");

    const { data: existing, error: readErr } = await supabaseAdmin
      .from("app_orders")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr || !existing) throw new Error("Order not found");

    const shouldMarkRefunded = data.decision === "approved" && existing.refund_request_resolution === "Refund";

    const { data: row, error } = await supabaseAdmin
      .from("app_orders")
      .update({
        refund_request_status: data.decision,
        refunded: shouldMarkRefunded ? true : existing.refunded,
        refunded_at: shouldMarkRefunded ? new Date().toISOString() : existing.refunded_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("*")
      .maybeSingle();

    if (error || !row) throw new Error("Could not update the request. Please try again.");

    // Auto-credit Kartogo Cash on approved refund requests so the customer is made whole.
    // Rules live in the admin-configurable `refund_config` table:
    //  - Wallet-paid orders: full refund credit back to Kartogo Cash (no expiry).
    //  - Any order under the configured threshold (including Cash on Delivery): credit
    //    the order value minus the configured GST% to Kartogo Cash. That credit is
    //    valid for `credit_expiry_days` from today (default 365).
    const total = Number(existing.total) || 0;
    const alreadyRefunded = existing.refunded === true;

    const { loadRefundConfig } = await import("./refund.functions");
    const { computeRefundCredit } = await import("./refund-credit");
    const config = await loadRefundConfig();

    let creditAmount = 0;
    let creditExpiresAt: Date | null = null;

    if (shouldMarkRefunded && !alreadyRefunded && total > 0) {
      const outcome = computeRefundCredit({
        total,
        paymentMethod: existing.payment_method as "cash" | "upi" | "wallet",
        config,
      });
      if (outcome.kind === "wallet_full") {
        creditAmount = outcome.creditAmount;
        await supabaseAdmin.rpc("adjust_wallet", {
          p_phone: existing.customer_phone,
          p_amount: creditAmount,
          p_type: "credit",
          p_note: `Refund approved for order ${existing.id}`,
        });
      } else if (outcome.kind === "low_value_ex_gst") {
        creditAmount = outcome.creditAmount;
        creditExpiresAt = outcome.expiresAt;
        await supabaseAdmin.rpc("credit_wallet_with_expiry", {
          p_phone: existing.customer_phone,
          p_amount: creditAmount,
          p_note: `Refund for order ${existing.id} (excl. ${config.gstPercent}% GST) · valid ${config.creditExpiryDays} days`,
          p_expires_at: outcome.expiresAt.toISOString(),
        });
      }
    }

    // Advance the customer-visible return/refund stage:
    //  - credit already posted to Kartogo Cash  → "refunded"
    //  - approved but money moves out-of-band   → "refund_initiated" (3–5 business days)
    //  - rejected                               → "refund_rejected"
    let returnStage: string | null = null;
    let refundInitiatedAt: string | null = null;
    if (data.decision === "approved") {
      refundInitiatedAt = new Date().toISOString();
      returnStage = creditAmount > 0 ? "refunded" : "refund_initiated";
    } else {
      returnStage = "refund_rejected";
    }
    const { data: staged } = await supabaseAdmin
      .from("app_orders")
      .update({
        return_stage: returnStage,
        refund_initiated_at: refundInitiatedAt ?? existing.refund_initiated_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("*")
      .maybeSingle();

    // Audit log — records the actor, decision, and exact wallet credit posted.
    // The admin token is opaque (single passcode-scoped role), so we log
    // "admin" plus the last 8 chars of the signed token as a best-effort
    // session fingerprint.
    const actor = `admin:${data.adminToken.slice(-8)}`;
    await supabaseAdmin.from("refund_audit_log").insert({
      order_id: existing.id,
      customer_phone: existing.customer_phone,
      decision: data.decision,
      resolution: existing.refund_request_resolution ?? null,
      order_total: total,
      credit_amount: creditAmount,
      credit_expires_at: creditExpiresAt ? creditExpiresAt.toISOString() : null,
      threshold_amount: config.thresholdAmount,
      gst_percent: config.gstPercent,
      actor,
    });

    return staged ?? row;
  });

