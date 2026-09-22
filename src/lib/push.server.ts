// ============================================================================
// Kartogo push notifications (server only)
//
// Flow:  Kartogo server fn -> this module -> Lovable connector gateway
//        -> Firebase Cloud Messaging HTTP v1 -> customer device.
//
// Firebase service-account credentials NEVER reach the browser: the gateway
// exchanges them for a Google access token on our behalf. The only things this
// module needs are LOVABLE_API_KEY and FIREBASE_MESSAGING_API_KEY, both of
// which are server-side secrets.
// ============================================================================

const GATEWAY = "https://connector-gateway.lovable.dev/firebase_messaging";

export const NOTIFICATION_TYPES = [
  "ORDER_CONFIRMED",
  "SUPERMARKET_ACCEPTED",
  "DRIVER_ASSIGNED",
  "ORDER_PICKED_UP",
  "DRIVER_NEARBY",
  "ORDER_DELIVERED",
  "ORDER_CANCELLED",
  "TEST",
  "PROMOTION",
  "BACK_IN_STOCK",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Professional Kartogo copy for every transactional push. */
export const MESSAGES: Record<NotificationType, { title: string; body: string }> = {
  ORDER_CONFIRMED: { title: "Order Confirmed 🛒", body: "Your Kartogo order has been confirmed." },
  SUPERMARKET_ACCEPTED: { title: "Order Being Prepared 🏪", body: "Your order is being prepared." },
  DRIVER_ASSIGNED: { title: "Delivery Partner Assigned 🛵", body: "Your Kartogo order has been assigned to a delivery partner." },
  ORDER_PICKED_UP: { title: "Order Picked Up 📦", body: "Your order is on the way." },
  DRIVER_NEARBY: { title: "Your Delivery Partner Is Nearby 📍", body: "Your delivery partner is nearby." },
  ORDER_DELIVERED: { title: "Order Delivered ✅", body: "Your Kartogo order has been delivered." },
  ORDER_CANCELLED: { title: "Order Cancelled", body: "Your Kartogo order has been cancelled." },
  TEST: { title: "Kartogo test notification 🔔", body: "Push notifications are working on this device." },
  PROMOTION: { title: "Kartogo offer", body: "A new offer is waiting for you." },
  BACK_IN_STOCK: { title: "Back in stock", body: "An item you wanted is available again." },
};

/** Which preference switch gates each notification type. */
const PREF_OF: Record<NotificationType, "order_updates" | "delivery_updates" | "important_updates" | "promotional_offers"> = {
  ORDER_CONFIRMED: "order_updates",
  SUPERMARKET_ACCEPTED: "order_updates",
  ORDER_CANCELLED: "order_updates",
  DRIVER_ASSIGNED: "delivery_updates",
  ORDER_PICKED_UP: "delivery_updates",
  DRIVER_NEARBY: "delivery_updates",
  ORDER_DELIVERED: "delivery_updates",
  TEST: "important_updates",
  PROMOTION: "promotional_offers",
  BACK_IN_STOCK: "important_updates",
};

/** Deep link target for a notification tap. */
export function deepLinkFor(type: NotificationType, orderId?: string | null, productId?: string | null): string {
  if (type === "BACK_IN_STOCK" && productId) return `/product/${encodeURIComponent(productId)}`;
  if (!orderId) return "/orders";
  switch (type) {
    case "DRIVER_ASSIGNED":
    case "ORDER_PICKED_UP":
    case "DRIVER_NEARBY":
      return `/track/${orderId}`;
    case "ORDER_DELIVERED":
      return `/rate-order/${orderId}`;
    default:
      return "/orders";
  }
}

type SendResult = { ok: boolean; status: number; body: string };

/** One FCM send through the gateway. Never throws. */
async function sendToToken(
  token: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<SendResult> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["FIREBASE_MESSAGING_API_KEY"];
  if (!lovableKey || !connectionKey) {
    return { ok: false, status: 0, body: "Firebase Cloud Messaging is not connected" };
  }
  try {
    const res = await fetch(`${GATEWAY}/v1/projects/_/messages:send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connectionKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data,
          android: { priority: "HIGH", notification: { sound: "default", click_action: "OPEN_KARTOGO" } },
          webpush: { fcm_options: { link: data.path } },
        },
      }),
    });
    const text = await res.text();
    if (!res.ok) console.error(`[push] FCM send failed [${res.status}]: ${text}`);
    return { ok: res.ok, status: res.status, body: text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    console.error("[push] FCM request threw", msg);
    return { ok: false, status: 0, body: msg };
  }
}

function isStaleToken(r: SendResult): boolean {
  if (r.status !== 404 && r.status !== 400) return false;
  return /UNREGISTERED|INVALID_ARGUMENT|not a valid FCM registration token/i.test(r.body);
}

export type PushInput = {
  phone: string;
  type: NotificationType;
  orderId?: string | null;
  productId?: string | null;
  stockAlertId?: string | null;
  title?: string;
  body?: string;
  /** Skip the per-customer preference check (test pushes from admin). */
  force?: boolean;
};

export type PushOutcome = { sent: number; failed: number; skipped?: string };

/**
 * Sends one notification to every active device of a customer, honouring their
 * preferences, de-duplicating per (customer, order, type) and recording the
 * result in `notifications`. Never throws — a push must not break an order flow.
 */
export async function sendPushToCustomer(input: PushInput): Promise<PushOutcome> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const phone = String(input.phone ?? "").trim();
    if (!phone) return { sent: 0, failed: 0, skipped: "no customer" };

    const preset = MESSAGES[input.type] ?? MESSAGES.PROMOTION;
    const title = (input.title ?? preset.title).slice(0, 120);
    const body = (input.body ?? preset.body).slice(0, 300);

    // 1) preference gate
    if (!input.force) {
      const { data: prefs } = await supabaseAdmin
        .from("notification_preferences")
        .select("*")
        .eq("user_phone", phone)
        .maybeSingle();
      const key = PREF_OF[input.type];
      const enabled = prefs ? (prefs as Record<string, unknown>)[key] !== false : key !== "promotional_offers";
      if (!enabled) return { sent: 0, failed: 0, skipped: "muted by preference" };
    }

    // 2) history row — the partial unique index makes this the duplicate guard
    const { data: row, error: insertError } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_phone: phone,
        order_id: input.orderId ?? null,
        product_id: input.productId ?? null,
        stock_alert_id: input.stockAlertId ?? null,
        notification_type: input.type,
        title,
        body,
        status: "pending",
      } as never)
      .select("id")
      .maybeSingle();

    if (insertError) {
      if (insertError.code === "23505") return { sent: 0, failed: 0, skipped: "duplicate" };
      console.error("[push] could not record notification", insertError.message);
    }
    const notificationId = row?.id as string | undefined;

    // 3) devices
    const { data: tokens } = await supabaseAdmin
      .from("user_notification_tokens")
      .select("id, fcm_token")
      .eq("user_phone", phone)
      .eq("notification_enabled", true);

    const list = tokens ?? [];
    if (list.length === 0) {
      if (notificationId) {
        await supabaseAdmin
          .from("notifications")
          .update({ status: "failed", error_message: "No registered device for this customer" })
          .eq("id", notificationId);
      }
      return { sent: 0, failed: 0, skipped: "no device" };
    }

    const data = {
      type: input.type,
      orderId: String(input.orderId ?? ""),
      path: deepLinkFor(input.type, input.orderId, input.productId),
      productId: String(input.productId ?? ""),
      notificationId: String(notificationId ?? ""),
    };

    let sent = 0;
    let failed = 0;
    let lastError = "";
    let usedToken = "";

    for (const t of list) {
      const result = await sendToToken(String(t.fcm_token), title, body, data);
      if (result.ok) {
        sent += 1;
        usedToken = String(t.fcm_token);
      } else {
        failed += 1;
        lastError = `[${result.status}] ${result.body}`.slice(0, 500);
        if (isStaleToken(result)) {
          await supabaseAdmin.from("user_notification_tokens").delete().eq("id", t.id);
        }
      }
    }

    if (notificationId) {
      await supabaseAdmin
        .from("notifications")
        .update({
          status: sent > 0 ? "sent" : "failed",
          sent_at: sent > 0 ? new Date().toISOString() : null,
          fcm_token: usedToken || null,
          error_message: sent > 0 ? null : lastError || "Delivery failed",
        })
        .eq("id", notificationId);
    }

    return { sent, failed };
  } catch (e) {
    console.error("[push] sendPushToCustomer failed", e);
    return { sent: 0, failed: 1 };
  }
}

/** Maps an order status change to the right Kartogo push. */
export async function pushOrderStatus(orderId: string, status: string): Promise<void> {
  const map: Record<string, NotificationType> = {
    placed: "ORDER_CONFIRMED",
    packed: "SUPERMARKET_ACCEPTED",
    out_for_delivery: "ORDER_PICKED_UP",
    delivered: "ORDER_DELIVERED",
    cancelled: "ORDER_CANCELLED",
  };
  const type = map[status];
  if (!type) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("app_orders")
      .select("customer_phone")
      .eq("id", orderId)
      .maybeSingle();
    if (!order?.customer_phone) return;
    await sendPushToCustomer({ phone: String(order.customer_phone), type, orderId });
  } catch (e) {
    console.error("[push] pushOrderStatus failed", e);
  }
}
