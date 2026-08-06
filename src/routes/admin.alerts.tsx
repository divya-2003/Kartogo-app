import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { BellRing, Mail, MessageSquare, Trash2, Send, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/store";
import {
  listNotificationSettingsFn, saveNotificationRecipientFn, deleteNotificationRecipientFn,
  sendTestNotificationFn, runInventoryDigestFn,
} from "@/lib/notifications.functions";
import { usePushNotifications } from "@/hooks/use-push-notifications";

export const Route = createFileRoute("/admin/alerts")({
  component: AlertSettingsPage,
  head: () => ({
    meta: [
      { title: "Alert settings — Kartogo admin" },
      { name: "description", content: "Configure push, email and SMS alerts for low stock, critical stock-outs and supplier reminders." },
      { property: "og:title", content: "Alert settings — Kartogo admin" },
      { property: "og:description", content: "Push, email and SMS alerting for Kartogo inventory intelligence." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const KINDS = [
  { id: "low_stock", label: "Low stock" },
  { id: "out_of_stock", label: "Out of stock" },
  { id: "critical", label: "Critical alerts" },
  { id: "supplier_reminder", label: "Supplier reminders" },
  { id: "replenish_request", label: "Replenish requests" },
];

type Data = Awaited<ReturnType<typeof listNotificationSettingsFn>>;

function AlertSettingsPage() {
  const { adminToken } = useAuth();
  const [data, setData] = useState<Data | null>(null);
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [audience, setAudience] = useState<"admin" | "supplier">("admin");
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [kinds, setKinds] = useState<string[]>(KINDS.map((k) => k.id));
  const [busy, setBusy] = useState(false);
  const { permission, requestPermission } = usePushNotifications(adminToken);

  const load = useCallback(async () => {
    if (!adminToken) return;
    try { setData(await listNotificationSettingsFn({ data: { adminToken } })); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not load alert settings"); }
  }, [adminToken]);

  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    if (!adminToken) return;
    setBusy(true);
    try {
      await saveNotificationRecipientFn({ data: { adminToken, audience, channel, address, label, kinds } });
      setAddress(""); setLabel("");
      toast.success("Recipient saved");
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!adminToken) return;
    await deleteNotificationRecipientFn({ data: { adminToken, id } });
    toast.success("Recipient removed");
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Alert settings</h1>
          <p className="text-sm text-muted-foreground">Push, email and SMS alerts for low stock, critical stock-outs and supplier reminders.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button onClick={requestPermission} disabled={permission === "granted" || permission === "unsupported"}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-60">
            <BellRing className="h-4 w-4" /> {permission === "granted" ? "Push on" : "Enable push"}
          </button>
          <button onClick={async () => { if (adminToken) { await sendTestNotificationFn({ data: { adminToken } }); toast.success("Test alert sent"); await load(); } }}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-secondary">
            <Send className="h-4 w-4" /> Send test
          </button>
          <button onClick={async () => { if (adminToken) { const r = await runInventoryDigestFn({ data: { adminToken } }); toast.success(`Digest sent for ${r.sent} products`); await load(); } }}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            <RefreshCw className="h-4 w-4" /> Run digest now
          </button>
        </div>
      </div>

      {data && !data.emailConfigured && (
        <p className="rounded-2xl border border-saffron/40 bg-saffron/10 p-3 text-sm">
          Email delivery isn't connected yet — add a <span className="font-semibold">RESEND_API_KEY</span> to start sending emails.
          SMS and in-app push already work.
        </p>
      )}

      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-display text-lg font-extrabold">Add a recipient</h2>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Audience</span>
            <select value={audience} onChange={(e) => setAudience(e.target.value as "admin" | "supplier")} className="rounded-lg border border-input bg-card px-3 py-2 text-sm">
              <option value="admin">Admin team</option>
              <option value="supplier">Suppliers / stores</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Channel</span>
            <select value={channel} onChange={(e) => setChannel(e.target.value as "email" | "sms")} className="rounded-lg border border-input bg-card px-3 py-2 text-sm">
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
          </label>
          <label className="min-w-[200px] flex-1 text-sm">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">{channel === "email" ? "Email address" : "Mobile number"}</span>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={channel === "email" ? "ops@kartogo.in" : "+919110310034"}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm" />
          </label>
          <label className="min-w-[140px] text-sm">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Label</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ops lead" className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm" />
          </label>
          <button onClick={() => void add()} disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">Add</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {KINDS.map((k) => {
            const on = kinds.includes(k.id);
            return (
              <button key={k.id} onClick={() => setKinds(on ? kinds.filter((x) => x !== k.id) : [...kinds, k.id])}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
                {k.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-display text-lg font-extrabold">Recipients</h2>
        <div className="mt-3 space-y-2">
          {(data?.recipients ?? []).length === 0 && <p className="text-sm text-muted-foreground">No email or SMS recipients yet.</p>}
          {(data?.recipients ?? []).map((r) => (
            <div key={String(r.id)} className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-3">
              {r.channel === "email" ? <Mail className="h-4 w-4 text-primary" /> : <MessageSquare className="h-4 w-4 text-primary" />}
              <span className="font-semibold">{String(r.address)}</span>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">{String(r.audience)}</span>
              {r.label ? <span className="text-xs text-muted-foreground">{String(r.label)}</span> : null}
              <span className="text-xs text-muted-foreground">{((r.kinds as string[]) ?? []).length} alert types</span>
              <button onClick={() => void remove(String(r.id))} aria-label="Remove recipient" className="ml-auto rounded-lg border border-border p-2 text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-display text-lg font-extrabold">Recent deliveries</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground">
              <th className="py-1">When</th><th>Channel</th><th>To</th><th>Title</th><th>Status</th>
            </tr></thead>
            <tbody>
              {(data?.log ?? []).map((l) => (
                <tr key={String(l.id)} className="border-t border-border">
                  <td className="py-1.5">{new Date(String(l.created_at)).toLocaleString("en-IN")}</td>
                  <td>{String(l.channel)}</td>
                  <td className="max-w-[160px] truncate">{String(l.recipient)}</td>
                  <td className="max-w-[200px] truncate">{String(l.title)}</td>
                  <td className={String(l.status) === "sent" ? "text-leaf" : "text-destructive"}>{String(l.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(data?.log ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nothing sent yet.</p>}
        </div>
      </div>
    </div>
  );
}
