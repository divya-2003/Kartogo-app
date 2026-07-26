import { createServerFn } from "@tanstack/react-start";

// Strip the customer's raw phone number before returning an order to a
// delivery partner — drivers communicate through in-app chat / masked calls.
function maskOrderForDriver<T extends Record<string, unknown>>(row: T): T {
  return { ...row, customer_phone: null } as T;
}
function maskOrdersForDriver<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map(maskOrderForDriver);
}

// Statuses a delivery partner is allowed to set on their own orders.
const DELIVERY_STATUSES = ["packed", "out_for_delivery", "delivered"] as const;
type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

// Verify the signed delivery token AND that the admin hasn't blocked this rider.
// Blocking only removes portal access — the rider's history stays untouched.
async function requireActiveDriver(token: string) {
  const { verifyDeliveryToken } = await import("./auth-tokens.server");
  const session = verifyDeliveryToken(token);
  if (!session) throw new Error("Your session has expired. Please log in again.");
  const { assertDriverActive } = await import("./driver-access.server");
  await assertDriverActive(session.driverId);
  return session;
}



// ---------------- Delivery partner login ----------------
// The driver enters their registered phone + the SMS OTP (request it first with
// the shared requestOtpFn). We verify the OTP exactly like a customer login,
// confirm the phone belongs to a registered driver, then issue a signed
// delivery token. Identity/role are derived only from server-signed values.
export const deliveryLoginFn = createServerFn({ method: "POST" })
  .inputValidator((data: { phone: string; code: string }) => {
    const phone = String(data?.phone ?? "");
    const code = String(data?.code ?? "");
    if (!/^\d{10}$/.test(phone)) throw new Error("Enter a valid 10-digit mobile number");
    if (!/^\d{4,8}$/.test(code)) throw new Error("Enter the code you received");
    return { phone, code };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createHash } = await import("node:crypto");
    const { issueDeliveryToken, findDriverByPhone } = await import("./auth-tokens.server");

    const driver = findDriverByPhone(data.phone);
    if (!driver) throw new Error("This number isn't registered as a delivery partner");
    const { assertDriverActive } = await import("./driver-access.server");
    await assertDriverActive(driver.id);

    const { data: rows } = await supabaseAdmin
      .from("otp_codes")
      .select("*")
      .eq("phone", data.phone)
      .eq("consumed", false)
      .order("created_at", { ascending: false })
      .limit(1);

    const row = rows?.[0];
    if (!row) throw new Error("Please request a new OTP");
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await supabaseAdmin.from("otp_codes").update({ consumed: true }).eq("id", row.id);
      throw new Error("Your code has expired. Request a new one.");
    }
    if (row.attempts >= 5) {
      await supabaseAdmin.from("otp_codes").update({ consumed: true }).eq("id", row.id);
      throw new Error("Too many incorrect attempts. Request a new OTP.");
    }

    const hash = createHash("sha256").update(`${data.phone}:${data.code}`).digest("hex");
    if (hash !== row.code_hash) {
      await supabaseAdmin.from("otp_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      throw new Error("Incorrect OTP");
    }

    await supabaseAdmin.from("otp_codes").update({ consumed: true }).eq("id", row.id);
    return {
      ok: true as const,
      token: issueDeliveryToken(driver.id, driver.phone),
      driver: { id: driver.id, name: driver.name, phone: driver.phone },
    };
  });

// ---------------- List my assigned orders ----------------
// Returns only the orders assigned to the token's driver.
export const listDeliveryOrdersFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => ({ token: String(data?.token ?? "") }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const session = await requireActiveDriver(data.token);

    const { data: rows, error } = await supabaseAdmin
      .from("app_orders")
      .select("*")
      .eq("delivery_boy_id", session.driverId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Orders could not be loaded. Please try again.");
    return maskOrdersForDriver(rows ?? []);

  });

// ---------------- Update status of my order ----------------
// The driver can only advance their OWN assigned orders through the delivery
// lifecycle (packed → out for delivery → delivered). Ownership and role are
// enforced server-side; the DB trigger also blocks illegal transitions.
export const deliverySetStatusFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; id: string; status: DeliveryStatus }) => {
    if (!DELIVERY_STATUSES.includes(data?.status)) throw new Error("Invalid status");
    return { token: String(data?.token ?? ""), id: String(data?.id ?? ""), status: data.status };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const session = await requireActiveDriver(data.token);

    const { data: existing, error: readErr } = await supabaseAdmin
      .from("app_orders")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr || !existing) throw new Error("Order not found");
    if (existing.delivery_boy_id !== session.driverId) {
      throw new Error("This order isn't assigned to you");
    }
    if (existing.status === "cancelled" || existing.status === "delivered") {
      throw new Error("This order is already closed");
    }

    const { data: row, error } = await supabaseAdmin
      .from("app_orders")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("delivery_boy_id", session.driverId)
      .select("*")
      .maybeSingle();

    if (error || !row) {
      console.error("Delivery status update failed", error);
      throw new Error("Status could not be updated. Please try again.");
    }
    return maskOrderForDriver(row);

  });

// ---------------- List unassigned (available) orders ----------------
// Any logged-in driver can see freshly placed orders that no one has claimed
// yet, so they can pick one up themselves.
export const listAvailableOrdersFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => ({ token: String(data?.token ?? "") }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const session = await requireActiveDriver(data.token);

    // Include both freshly placed and already-packed (by supplier) orders
    // so a driver can still claim orders after the supplier packs them.
    const { data: rows, error } = await supabaseAdmin
      .from("app_orders")
      .select("*")
      .is("delivery_boy_id", null)
      .in("status", ["placed", "packed"])
      .order("created_at", { ascending: false });
    if (error) throw new Error("Orders could not be loaded. Please try again.");
    return maskOrdersForDriver(rows ?? []);
  });

// ---------------- Claim an order ("I'm taking this order") ----------------
// A driver self-assigns an unassigned, placed order to themselves. The update
// is conditional on the order still being unclaimed so two drivers can't grab
// the same order — whoever commits first wins.
export const claimOrderFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; id: string }) => ({
    token: String(data?.token ?? ""),
    id: String(data?.id ?? ""),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const session = await requireActiveDriver(data.token);

    const { data: existing, error: readErr } = await supabaseAdmin
      .from("app_orders")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr || !existing) throw new Error("Order not found");
    if (existing.delivery_boy_id) throw new Error("This order was already taken by another partner");
    if (existing.status !== "placed" && existing.status !== "packed") throw new Error("This order is no longer available");

    const { data: row, error } = await supabaseAdmin
      .from("app_orders")
      .update({ delivery_boy_id: session.driverId, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .is("delivery_boy_id", null)
      .select("*")
      .maybeSingle();

    if (error || !row) {
      throw new Error("This order was already taken by another partner");
    }
    return maskOrderForDriver(row);
  });


// ---------------- Return pickups (refund requests) ----------------
// The driver who delivered an order is the one who collects the returned items,
// so refund requests surface in that same driver's portal.
export const listReturnPickupsFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => ({ token: String(data?.token ?? "") }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const session = await requireActiveDriver(data.token);

    const { data: rows, error } = await supabaseAdmin
      .from("app_orders")
      .select("*")
      .eq("delivery_boy_id", session.driverId)
      .not("refund_requested_at", "is", null)
      .order("refund_requested_at", { ascending: false });
    if (error) throw new Error("Return pickups could not be loaded. Please try again.");
    return maskOrdersForDriver(rows ?? []);
  });

// Driver confirms the returned items were collected from the customer.
export const markReturnPickedUpFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; id: string }) => ({
    token: String(data?.token ?? ""),
    id: String(data?.id ?? ""),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const session = await requireActiveDriver(data.token);

    const { data: existing } = await supabaseAdmin
      .from("app_orders")
      .select("id, delivery_boy_id, refund_requested_at, return_stage")
      .eq("id", data.id)
      .maybeSingle();
    if (!existing) throw new Error("Order not found");
    if (existing.delivery_boy_id !== session.driverId) throw new Error("This return isn't assigned to you");
    if (!existing.refund_requested_at) throw new Error("No return was requested for this order");
    if (existing.return_stage && existing.return_stage !== "requested") {
      throw new Error("This return is already picked up");
    }

    const { data: row, error } = await supabaseAdmin
      .from("app_orders")
      .update({
        return_stage: "picked_up",
        return_picked_up_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("delivery_boy_id", session.driverId)
      .select("*")
      .maybeSingle();
    if (error || !row) throw new Error("Could not update this return. Please try again.");
    return maskOrderForDriver(row);
  });
