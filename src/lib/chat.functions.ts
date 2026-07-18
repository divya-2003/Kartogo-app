// Chat + masked-call server functions.
// Customer and delivery partner communicate through the app; neither sees
// the other's raw phone number. Admins retain full access via admin views.
import { createServerFn } from "@tanstack/react-start";

type Role = "customer" | "driver" | "admin";

async function authorizeOrderParty(
  token: string,
  orderId: string,
): Promise<{ role: Role; id: string; order: Record<string, unknown> }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { verifyCustomerToken, verifyDeliveryToken, verifyAdminToken } = await import("./auth-tokens.server");

  const { data: order, error } = await supabaseAdmin
    .from("app_orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (error || !order) throw new Error("Order not found");

  if (verifyAdminToken(token)) return { role: "admin", id: "admin", order };
  const driver = verifyDeliveryToken(token);
  if (driver) {
    if ((order as { delivery_boy_id?: string | null }).delivery_boy_id !== driver.driverId) {
      throw new Error("This order isn't assigned to you");
    }
    return { role: "driver", id: driver.driverId, order };
  }
  const customer = verifyCustomerToken(token);
  if (customer) {
    if ((order as { customer_phone?: string | null }).customer_phone !== customer.phone) {
      throw new Error("This order doesn't belong to you");
    }
    return { role: "customer", id: customer.phone, order };
  }
  throw new Error("Your session has expired. Please log in again.");
}

// -------- Send a chat message --------
export const sendMessageFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; orderId: string; body: string }) => {
    const body = String(data?.body ?? "").trim();
    if (!body) throw new Error("Message cannot be empty");
    if (body.length > 2000) throw new Error("Message is too long");
    return { token: String(data?.token ?? ""), orderId: String(data?.orderId ?? ""), body };
  })
  .handler(async ({ data }) => {
    const auth = await authorizeOrderParty(data.token, data.orderId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("order_messages")
      .insert({
        order_id: data.orderId,
        sender_role: auth.role,
        sender_id: auth.id,
        body: data.body,
      })
      .select("*")
      .maybeSingle();
    if (error || !row) throw new Error("Could not send message. Please try again.");
    return row;
  });

// -------- List chat messages for an order --------
export const listMessagesFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; orderId: string }) => ({
    token: String(data?.token ?? ""),
    orderId: String(data?.orderId ?? ""),
  }))
  .handler(async ({ data }) => {
    await authorizeOrderParty(data.token, data.orderId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("order_messages")
      .select("*")
      .eq("order_id", data.orderId)
      .order("created_at", { ascending: true });
    if (error) throw new Error("Could not load messages");
    return rows ?? [];
  });

// -------- Initiate a masked call --------
// We do NOT expose the other party's real phone number. This server function
// logs the call attempt for audit + support; a real masked-call integration
// (Twilio Proxy / Voice) can be wired to the same log entry later.
export const initiateMaskedCallFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; orderId: string }) => ({
    token: String(data?.token ?? ""),
    orderId: String(data?.orderId ?? ""),
  }))
  .handler(async ({ data }) => {
    const auth = await authorizeOrderParty(data.token, data.orderId);
    const order = auth.order as { customer_phone?: string; delivery_boy_id?: string | null };
    // Determine callee based on caller role.
    let calleeRole: Role;
    let calleeId: string;
    if (auth.role === "driver" || auth.role === "admin") {
      calleeRole = "customer";
      calleeId = order.customer_phone ?? "";
    } else {
      calleeRole = "driver";
      calleeId = order.delivery_boy_id ?? "";
      if (!calleeId) throw new Error("No delivery partner has been assigned yet");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("order_call_logs")
      .insert({
        order_id: data.orderId,
        caller_role: auth.role,
        caller_id: auth.id,
        callee_role: calleeRole,
        callee_id: calleeId,
        status: "initiated",
      })
      .select("*")
      .maybeSingle();
    if (error || !row) throw new Error("Could not place the call. Please try again.");
    return {
      ok: true as const,
      logId: (row as { id: string }).id,
      message:
        auth.role === "customer"
          ? "Connecting you to your delivery partner via a masked line…"
          : "Connecting you to the customer via a masked line…",
    };
  });
