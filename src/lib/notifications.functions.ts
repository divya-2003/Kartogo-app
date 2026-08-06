import { createServerFn } from "@tanstack/react-start";

// Admin-managed alert recipients (email / SMS) + the delivery log.
const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);

const KINDS = ["low_stock", "out_of_stock", "critical", "supplier_reminder", "replenish_request"] as const;

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
      emailConfigured: Boolean(process.env.RESEND_API_KEY),
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
    channel: d?.channel === "sms" ? "sms" : "email",
    address: str(d?.address, 160),
    label: str(d?.label, 80),
    kinds: (Array.isArray(d?.kinds) ? d!.kinds : []).filter((k) => (KINDS as readonly string[]).includes(k)),
    active: d?.active !== false,
  }))
  .handler(async ({ data }) => {
    await requireAdmin(data.adminToken);
    if (!data.address) throw new Error("Enter an email address or mobile number");
    if (data.channel === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.address)) {
      throw new Error("Enter a valid email address");
    }
    if (data.channel === "sms" && !/^\+?\d{10,15}$/.test(data.address)) {
      throw new Error("Enter a valid mobile number");
    }
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
      body: "This is a test of push, email and SMS alerting. If you see it, alerts are wired up.",
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
