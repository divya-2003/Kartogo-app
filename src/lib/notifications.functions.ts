import { createServerFn } from "@tanstack/react-start";

// Admin-managed alert recipients (SMS) + the delivery log.
// Email delivery was removed from Kartogo — SMS and in-app push only.
const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);

const KINDS = ["low_stock", "out_of_stock", "critical", "supplier_reminder", "replenish_request"] as const;

/** Returns a strict E.164 number, or null when the input cannot be one. */
export function toE164(raw: string): string | null {
  const cleaned = raw.replace(/[\s()\-.]/g, "");
  const digits = cleaned.replace(/^\+/, "");
  if (!/^\d+$/.test(digits)) return null;
  const withCc = cleaned.startsWith("+") ? `+${digits}` : digits.length === 10 ? `+91${digits}` : `+${digits}`;
  return /^\+[1-9]\d{7,14}$/.test(withCc) ? withCc : null;
}

async function requireAdmin(token: string) {
  const { verifyAdminToken } = await import("./auth-tokens.server");
  if (!token || !verifyAdminToken(token)) throw new Error("Admin authorization required");
}

export const listNotificationSettingsFn = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken?: string }) => ({ adminToken: str(d?.adminToken, 500) }))
  .handler(async ({ data }) => {
    await requireAdmin(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: recipients }, { data: log }] = await Promise.all([
      supabaseAdmin.from("notification_recipients").select("*").order("created_at"),
      supabaseAdmin.from("notification_log").select("*").order("created_at", { ascending: false }).limit(40),
    ]);
    return {
      recipients: recipients ?? [],
      log: log ?? [],
    };
  });

export const saveNotificationRecipientFn = createServerFn({ method: "POST" })
  .inputValidator((d: {
    adminToken?: string; id?: string; audience?: string; channel?: string;
    address?: string; label?: string; kinds?: string[]; active?: boolean;
  }) => ({
    adminToken: str(d?.adminToken, 500),
    id: str(d?.id, 60),
    audience: d?.audience === "supplier" ? "supplier" : "admin",
    channel: "sms" as const,
    address: str(d?.address, 160),
    label: str(d?.label, 80),
    kinds: (Array.isArray(d?.kinds) ? d!.kinds : []).filter((k) => (KINDS as readonly string[]).includes(k)),
    active: d?.active !== false,
  }))
  .handler(async ({ data }) => {
    await requireAdmin(data.adminToken);
    if (!data.address) throw new Error("Enter a mobile number");
    // Normalise to E.164 (Indian numbers default to +91) and validate strictly.
    const normalised = toE164(data.address);
    if (!normalised) {
      throw new Error("Enter the mobile number in international format, e.g. +919110310034");
    }
    data.address = normalised;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      audience: data.audience,
      channel: data.channel,
      address: data.address,
      label: data.label,
      kinds: data.kinds.length ? data.kinds : [...KINDS],
      active: data.active,
    };
    const { error } = data.id
      ? await supabaseAdmin.from("notification_recipients").update(payload).eq("id", data.id)
      : await supabaseAdmin.from("notification_recipients").insert(payload);
    if (error) throw new Error("Could not save this recipient. Please try again.");
    return { ok: true };
  });

export const deleteNotificationRecipientFn = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken?: string; id?: string }) => ({
    adminToken: str(d?.adminToken, 500), id: str(d?.id, 60),
  }))
  .handler(async ({ data }) => {
    await requireAdmin(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("notification_recipients").delete().eq("id", data.id);
    return { ok: true };
  });

export const sendTestNotificationFn = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken?: string }) => ({ adminToken: str(d?.adminToken, 500) }))
  .handler(async ({ data }) => {
    await requireAdmin(data.adminToken);
    const { dispatchNotification } = await import("./notify.server");
    await dispatchNotification({
      kind: "test",
      audience: "admin",
      title: "Kartogo test alert",
      body: "This is a test of push and SMS alerting. If you see it, alerts are wired up.",
    });
    return { ok: true };
  });

/** Runs the low-stock / critical / supplier-reminder digest immediately. */
export const runInventoryDigestFn = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken?: string }) => ({ adminToken: str(d?.adminToken, 500) }))
  .handler(async ({ data }) => {
    await requireAdmin(data.adminToken);
    const { dispatchInventoryDigest } = await import("./notify.server");
    return await dispatchInventoryDigest();
  });

/** Recent alert feed used by the admin push/toast poller. */
export const recentAlertNotificationsFn = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken?: string }) => ({ adminToken: str(d?.adminToken, 500) }))
  .handler(async ({ data }) => {
    await requireAdmin(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("inventory_notifications")
      .select("id, title, body, kind, created_at")
      .eq("audience", "admin")
      .order("created_at", { ascending: false })
      .limit(15);
    return {
      notifications: (rows ?? []).map((r) => ({
        id: String(r.id), title: String(r.title), body: String(r.body ?? ""),
        kind: String(r.kind ?? ""), createdAt: String(r.created_at),
      })),
    };
  });

/** Re-sends a failed SMS from the delivery log. */
export const retryNotificationFn = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken?: string; id?: string }) => ({
    adminToken: str(d?.adminToken, 500), id: str(d?.id, 60),
  }))
  .handler(async ({ data }) => {
    await requireAdmin(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("notification_log").select("*").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("That delivery record no longer exists");
    if (String(row.channel) === "in_app") throw new Error("In-app alerts cannot be re-sent");

    const { deliver } = await import("./notify.server");
    const ok = await deliver(
      String(row.kind), { channel: String(row.channel), address: String(row.recipient) },
      String(row.title), String(row.body ?? ""),
    );
    if (!ok) throw new Error("The retry failed again — check the number and SMS setup");
    return { ok: true };
  });
