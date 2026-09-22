import { createServerFn } from "@tanstack/react-start";

// Client-callable push endpoints. Identity always comes from the signed
// customer/admin tokens the app already uses — never from client-claimed ids.

const str = (v: unknown, max = 400) => String(v ?? "").trim().slice(0, max);

async function requireCustomer(token: string) {
  const { verifyCustomerToken } = await import("./auth-tokens.server");
  const session = verifyCustomerToken(token);
  if (!session) throw new Error("Please log in again");
  return session;
}

async function requireAdmin(token: string) {
  const { verifyAdminToken } = await import("./auth-tokens.server");
  if (!token || !verifyAdminToken(token)) throw new Error("Admin authorization required");
}

// ---------------- Device tokens ----------------

export const registerPushTokenFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token?: string; fcmToken?: string; platform?: string; deviceName?: string }) => ({
    token: str(d?.token, 600),
    fcmToken: str(d?.fcmToken, 600),
    platform: ["android", "ios", "web"].includes(String(d?.platform)) ? String(d?.platform) : "web",
    deviceName: str(d?.deviceName, 120),
  }))
  .handler(async ({ data }) => {
    const session = await requireCustomer(data.token);
    if (!data.fcmToken) throw new Error("Missing device token");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_notification_tokens")
      .upsert(
        {
          user_phone: session.phone,
          fcm_token: data.fcmToken,
          platform: data.platform,
          device_name: data.deviceName,
          notification_enabled: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "fcm_token" },
      );
    if (error) {
      console.error("[push] token upsert failed", error.message);
      throw new Error("Could not register this device for notifications");
    }
    return { ok: true };
  });

export const disablePushTokenFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token?: string; fcmToken?: string }) => ({
    token: str(d?.token, 600),
    fcmToken: str(d?.fcmToken, 600),
  }))
  .handler(async ({ data }) => {
    const session = await requireCustomer(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("user_notification_tokens")
      .update({ notification_enabled: false })
      .eq("user_phone", session.phone)
      .eq("fcm_token", data.fcmToken);
    return { ok: true };
  });

// ---------------- Preferences ----------------

const PREF_KEYS = ["order_updates", "delivery_updates", "important_updates", "promotional_offers"] as const;
export type NotificationPrefs = Record<(typeof PREF_KEYS)[number], boolean>;

const DEFAULT_PREFS: NotificationPrefs = {
  order_updates: true,
  delivery_updates: true,
  important_updates: true,
  promotional_offers: false,
};

export const getNotificationPrefsFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token?: string }) => ({ token: str(d?.token, 600) }))
  .handler(async ({ data }): Promise<{ prefs: NotificationPrefs; devices: number }> => {
    const session = await requireCustomer(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: row }, { count }] = await Promise.all([
      supabaseAdmin.from("notification_preferences").select("*").eq("user_phone", session.phone).maybeSingle(),
      supabaseAdmin
        .from("user_notification_tokens")
        .select("id", { count: "exact", head: true })
        .eq("user_phone", session.phone)
        .eq("notification_enabled", true),
    ]);
    const prefs = { ...DEFAULT_PREFS };
    if (row) for (const k of PREF_KEYS) prefs[k] = (row as Record<string, unknown>)[k] !== false;
    return { prefs, devices: count ?? 0 };
  });

export const saveNotificationPrefsFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token?: string; prefs?: Partial<NotificationPrefs> }) => ({
    token: str(d?.token, 600),
    prefs: Object.fromEntries(PREF_KEYS.map((k) => [k, d?.prefs?.[k] === true])) as NotificationPrefs,
  }))
  .handler(async ({ data }) => {
    const session = await requireCustomer(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("notification_preferences")
      .upsert({ user_phone: session.phone, ...data.prefs, updated_at: new Date().toISOString() }, { onConflict: "user_phone" });
    if (error) throw new Error("Could not save your notification settings");
    return { ok: true };
  });

// ---------------- Customer history ----------------

export const listMyNotificationsFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token?: string }) => ({ token: str(d?.token, 600) }))
  .handler(async ({ data }) => {
    const session = await requireCustomer(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("notifications")
      .select("id, title, body, notification_type, order_id, product_id, status, read_at, created_at")
      .eq("user_phone", session.phone)
      .order("created_at", { ascending: false })
      .limit(30);
    return { notifications: rows ?? [] };
  });

export const markNotificationReadFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token?: string; id?: string }) => ({ token: str(d?.token, 600), id: str(d?.id, 60) }))
  .handler(async ({ data }) => {
    const session = await requireCustomer(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("notifications")
      .update({ read_at: new Date().toISOString(), delivered_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_phone", session.phone);
    return { ok: true };
  });

/** Customer-triggered test push to their own devices. */
export const sendMyTestPushFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token?: string }) => ({ token: str(d?.token, 600) }))
  .handler(async ({ data }) => {
    const session = await requireCustomer(data.token);
    const { sendPushToCustomer } = await import("./push.server");
    return await sendPushToCustomer({ phone: session.phone, type: "TEST", force: true });
  });

// ---------------- Admin monitoring ----------------

export const notificationOverviewFn = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken?: string }) => ({ adminToken: str(d?.adminToken, 600) }))
  .handler(async ({ data }) => {
    await requireAdmin(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: recent }, { count: devices }] = await Promise.all([
      supabaseAdmin
        .from("notifications")
        .select("id, user_phone, order_id, notification_type, title, body, status, error_message, sent_at, delivered_at, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin.from("user_notification_tokens").select("id", { count: "exact", head: true }).eq("notification_enabled", true),
    ]);
    const rows = recent ?? [];
    return {
      devices: devices ?? 0,
      total: rows.length,
      sent: rows.filter((r) => r.status === "sent").length,
      delivered: rows.filter((r) => r.delivered_at).length,
      failed: rows.filter((r) => r.status === "failed").length,
      recent: rows,
    };
  });

export const retryNotificationFn = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken?: string; id?: string }) => ({ adminToken: str(d?.adminToken, 600), id: str(d?.id, 60) }))
  .handler(async ({ data }) => {
    await requireAdmin(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("notifications").select("*").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("That notification no longer exists");
    if (row.status === "sent") throw new Error("That notification was already delivered");
    const extendedRow = row as typeof row & { product_id?: string | null; stock_alert_id?: string | null };
    // Remove the old record so the duplicate guard allows the resend.
    await supabaseAdmin.from("notifications").delete().eq("id", data.id);
    const { sendPushToCustomer } = await import("./push.server");
    const result = await sendPushToCustomer({
      phone: String(row.user_phone),
      type: String(row.notification_type) as never,
      orderId: row.order_id ? String(row.order_id) : null,
      productId: extendedRow.product_id ? String(extendedRow.product_id) : null,
      stockAlertId: extendedRow.stock_alert_id ? String(extendedRow.stock_alert_id) : null,
      title: String(row.title),
      body: String(row.body ?? ""),
      force: true,
    });
    if (result.sent === 0) throw new Error(`Retry failed${result.skipped ? ` — ${result.skipped}` : ""}`);
    return { ok: true };
  });

/** Admin test push to any registered customer number (your own test device). */
export const adminTestPushFn = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken?: string; phone?: string }) => ({
    adminToken: str(d?.adminToken, 600),
    phone: str(d?.phone, 20),
  }))
  .handler(async ({ data }) => {
    await requireAdmin(data.adminToken);
    if (!data.phone) throw new Error("Enter the customer's mobile number");
    const { sendPushToCustomer } = await import("./push.server");
    const result = await sendPushToCustomer({ phone: data.phone, type: "TEST", force: true });
    if (result.sent === 0) {
      throw new Error(
        result.skipped === "no device"
          ? "That number has no device registered for push yet"
          : "The test push could not be delivered — check the failures list",
      );
    }
    return result;
  });
