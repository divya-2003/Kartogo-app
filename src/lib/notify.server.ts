// ============================================================================
// Notification dispatcher (server only)
//
// One entry point — `dispatchNotification` — fans a single alert out to every
// configured channel:
//   • in-app   → `inventory_notifications` (admin / supplier bell + browser push)
//   • email    → Resend, when RESEND_API_KEY is configured
//   • sms      → the existing Twilio connector
// Every attempt is written to `notification_log` so nothing is silently lost.
//
// Modular by design: add a channel by adding one `case` in `deliver()`.
// ============================================================================

export type NotifyKind =
  | "low_stock"
  | "out_of_stock"
  | "critical"
  | "supplier_reminder"
  | "replenish_request"
  | "test";

export type NotifyInput = {
  kind: NotifyKind;
  audience: "admin" | "supplier";
  title: string;
  body: string;
  supplierId?: string | null;
  productId?: string | null;
  /** Extra one-off recipients (partner supermarket phone / email). */
  extraRecipients?: { channel: "email" | "sms"; address: string }[];
  /** Skip writing the in-app bell entry (used when the caller already wrote one). */
  skipInApp?: boolean;
};

type Recipient = { channel: string; address: string };

async function log(
  kind: string,
  channel: string,
  recipient: string,
  title: string,
  body: string,
  status: string,
  error?: string,
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("notification_log").insert({
      kind, channel, recipient, title, body: body.slice(0, 1000), status, error: error ?? null,
    });
  } catch (e) {
    console.error("notification_log write failed", e);
  }
}

async function sendEmail(to: string, subject: string, body: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Email sending is not configured yet");
  const from = process.env.NOTIFICATION_FROM_EMAIL || "Kartogo Alerts <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html: `<div style="font-family:system-ui,sans-serif;line-height:1.5">
        <h2 style="margin:0 0 8px">${escapeHtml(subject)}</h2>
        <p style="white-space:pre-wrap;margin:0 0 16px">${escapeHtml(body)}</p>
        <p style="color:#666;font-size:12px">Sent automatically by Kartogo inventory intelligence.</p>
      </div>`,
    }),
  });
  if (!res.ok) throw new Error(`Email provider rejected the message (${res.status})`);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

async function deliver(kind: string, r: Recipient, title: string, body: string) {
  try {
    if (r.channel === "email") await sendEmail(r.address, title, body);
    else if (r.channel === "sms") {
      const { sendSms } = await import("./sms.server");
      await sendSms(r.address, `${title}\n${body}`.slice(0, 300));
    } else return;
    await log(kind, r.channel, r.address, title, body, "sent");
  } catch (e) {
    await log(kind, r.channel, r.address, title, body, "failed", e instanceof Error ? e.message : "unknown error");
  }
}

/** Sends one alert everywhere it belongs. Never throws — alerts must not break flows. */
export async function dispatchNotification(input: NotifyInput): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) in-app (also what the browser push listener reacts to)
    if (!input.skipInApp) {
      await supabaseAdmin.from("inventory_notifications").insert({
        audience: input.audience,
        supplier_id: input.supplierId ?? null,
        product_id: input.productId ?? null,
        title: input.title,
        body: input.body,
        kind: input.kind,
      });
      await log(input.kind, "in_app", input.audience, input.title, input.body, "sent");
    }

    // 2) configured email / sms recipients for this audience + kind
    const { data: rows } = await supabaseAdmin
      .from("notification_recipients")
      .select("channel, address, kinds, audience, active")
      .eq("active", true);

    const targets: Recipient[] = [
      ...(rows ?? [])
        .filter((r) => r.audience === input.audience && (r.kinds ?? []).includes(input.kind))
        .map((r) => ({ channel: r.channel as string, address: r.address as string })),
      ...(input.extraRecipients ?? []),
    ];

    for (const t of targets) await deliver(input.kind, t, input.title, input.body);
  } catch (e) {
    console.error("dispatchNotification failed", e);
  }
}

/** Daily digest: low stock, out of stock and critical AI alerts. Called by the cron job. */
export async function dispatchInventoryDigest(): Promise<{ sent: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: items }, { data: markets }] = await Promise.all([
    supabaseAdmin.from("inventory_items").select("product_name, market_id, current_stock, available_stock, reorder_level"),
    supabaseAdmin.from("partner_markets").select("id, name"),
  ]);
  const name = new Map((markets ?? []).map((m) => [m.id as string, m.name as string]));

  const out = (items ?? []).filter((i) => Number(i.available_stock) <= 0);
  const low = (items ?? []).filter(
    (i) => Number(i.available_stock) > 0 && Number(i.current_stock) <= Number(i.reorder_level),
  );
  if (out.length === 0 && low.length === 0) return { sent: 0 };

  const line = (i: { product_name: unknown; market_id: unknown; current_stock: unknown }) =>
    `• ${String(i.product_name)} — ${name.get(String(i.market_id)) ?? "store"} (${Number(i.current_stock)} left)`;

  const body = [
    out.length ? `Out of stock (${out.length}):\n${out.slice(0, 15).map(line).join("\n")}` : "",
    low.length ? `Low stock (${low.length}):\n${low.slice(0, 15).map(line).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");

  await dispatchNotification({
    kind: out.length ? "critical" : "low_stock",
    audience: "admin",
    title: `Stock alert — ${out.length} out of stock, ${low.length} low`,
    body,
  });
  await dispatchNotification({
    kind: "supplier_reminder",
    audience: "supplier",
    title: "Replenishment reminder",
    body,
  });
  return { sent: out.length + low.length };
}
