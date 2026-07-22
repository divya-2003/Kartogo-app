import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth, useOrders } from "@/lib/store";
import { formatINR } from "@/lib/data";
import { toast } from "sonner";
import {
  BadgeIndianRupee, CheckCircle2, RotateCcw, Settings2, ScrollText, ListTodo,
  Undo2, XCircle, Save,
} from "lucide-react";
import {
  getRefundConfigFn, setRefundConfigFn, listRefundAuditLogFn,
  type RefundAuditRow,
} from "@/lib/refund.functions";

export const Route = createFileRoute("/admin/refund-requests")({
  component: RefundRequests,
  head: () => ({ meta: [{ title: "Refund requests — Kartogo" }] }),
});

type Tab = "requests" | "settings" | "audit";

function RefundRequests() {
  const [tab, setTab] = useState<Tab>("requests");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <BadgeIndianRupee className="h-7 w-7 text-primary" /> Refund requests
        </h1>
        <p className="text-sm text-muted-foreground">Approve or reject refund requests, tune the credit rules, and review the audit log.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <TabChip active={tab === "requests"} onClick={() => setTab("requests")} icon={<ListTodo className="h-3.5 w-3.5" />} label="Requests" />
        <TabChip active={tab === "settings"} onClick={() => setTab("settings")} icon={<Settings2 className="h-3.5 w-3.5" />} label="Settings" />
        <TabChip active={tab === "audit"} onClick={() => setTab("audit")} icon={<ScrollText className="h-3.5 w-3.5" />} label="Audit log" />
      </div>

      {tab === "requests" && <RequestsPanel />}
      {tab === "settings" && <SettingsPanel />}
      {tab === "audit" && <AuditPanel />}
    </div>
  );
}

/* ----------------------------- Requests panel ---------------------------- */

function RequestsPanel() {
  const { orders, resolveRefundRequest } = useOrders();
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [busy, setBusy] = useState<string | null>(null);

  const requests = useMemo(
    () => orders.filter(o => !!o.refundRequestedAt).sort((a, b) => (b.refundRequestedAt ?? 0) - (a.refundRequestedAt ?? 0)),
    [orders],
  );
  const pending = requests.filter(o => (o.refundRequestStatus ?? "pending") === "pending");
  const approved = requests.filter(o => o.refundRequestStatus === "approved");
  const rejected = requests.filter(o => o.refundRequestStatus === "rejected");

  const shown = useMemo(() => {
    if (filter === "pending") return pending;
    if (filter === "approved") return approved;
    if (filter === "rejected") return rejected;
    return requests;
  }, [filter, requests, pending, approved, rejected]);

  const decide = async (id: string, decision: "approved" | "rejected") => {
    setBusy(id);
    try {
      await resolveRefundRequest(id, decision);
      toast.success(decision === "approved" ? "Refund approved" : "Request rejected");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update request");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Chip active={filter === "pending"} onClick={() => setFilter("pending")} label={`Pending (${pending.length})`} />
        <Chip active={filter === "approved"} onClick={() => setFilter("approved")} label={`Approved (${approved.length})`} />
        <Chip active={filter === "rejected"} onClick={() => setFilter("rejected")} label={`Rejected (${rejected.length})`} />
        <Chip active={filter === "all"} onClick={() => setFilter("all")} label={`All (${requests.length})`} />
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">No refund requests here.</div>
      ) : (
        <div className="space-y-3">
          {shown.map(o => {
            const status = o.refundRequestStatus ?? "pending";
            return (
              <article key={o.id} className="rounded-2xl border border-border bg-card p-4 md:p-5">
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 font-display text-base font-bold">
                      {o.id}
                      <StatusBadge status={status} />
                      <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground uppercase">{o.paymentMethod}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Requested {o.refundRequestedAt ? new Date(o.refundRequestedAt).toLocaleString("en-IN") : "—"} · {o.customerName} · {o.customerPhone}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{o.address}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-lg font-bold">{formatINR(o.total)}</div>
                    <div className="text-xs font-semibold text-primary">{o.refundRequestResolution ?? "Refund"}</div>
                  </div>
                </header>

                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground">Issue</div>
                    <div>{o.refundRequestType ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground">Details</div>
                    <div className="text-muted-foreground">{o.refundRequestReason?.trim() || "—"}</div>
                  </div>
                </div>

                <ul className="my-3 grid gap-1 text-sm md:grid-cols-2">
                  {o.items.map(i => <li key={i.productId} className="text-muted-foreground">{i.name} × <span className="font-semibold text-foreground">{i.qty}</span></li>)}
                </ul>

                <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
                  {status === "pending" ? (
                    <>
                      <button
                        onClick={() => decide(o.id, "rejected")}
                        disabled={busy === o.id}
                        className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </button>
                      <button
                        onClick={() => decide(o.id, "approved")}
                        disabled={busy === o.id}
                        className="ml-auto flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-4 w-4" /> {busy === o.id ? "Saving…" : `Approve ${o.refundRequestResolution ?? "Refund"}`}
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {status === "approved" ? "Approved" : "Rejected"}{o.refundedAt ? ` · refunded ${new Date(o.refundedAt).toLocaleDateString("en-IN")}` : ""}
                      </span>
                      <button
                        onClick={() => decide(o.id, status === "approved" ? "rejected" : "approved")}
                        disabled={busy === o.id}
                        className="ml-auto flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
                      >
                        {status === "approved" ? <><Undo2 className="h-3.5 w-3.5" /> Reject instead</> : <><RotateCcw className="h-3.5 w-3.5" /> Approve instead</>}
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Settings panel ---------------------------- */

function SettingsPanel() {
  const { adminToken } = useAuth();
  const [threshold, setThreshold] = useState<number>(500);
  const [gst, setGst] = useState<number>(5);
  const [days, setDays] = useState<number>(365);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!adminToken) return;
    (async () => {
      try {
        const c = await getRefundConfigFn({ data: { adminToken } });
        setThreshold(Number(c.thresholdAmount));
        setGst(Number(c.gstPercent));
        setDays(Number(c.creditExpiryDays));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load settings");
      } finally {
        setLoading(false);
      }
    })();
  }, [adminToken]);

  const save = async () => {
    if (!adminToken) return;
    setSaving(true);
    try {
      await setRefundConfigFn({ data: { adminToken, thresholdAmount: threshold, gstPercent: gst, creditExpiryDays: days } });
      toast.success("Refund settings updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const preview = useMemo(() => {
    // Show what a ₹210 low-value refund would credit under the current form.
    const sample = 210;
    const ex = Math.max(1, Math.round(sample / (1 + Math.max(0, gst) / 100)));
    return { sample, ex };
  }, [gst]);

  if (loading) return <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
      <h2 className="font-display text-lg font-bold">Refund credit rules</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Any refund on an order strictly below the threshold is credited to Kartogo Cash as the ex-GST amount, valid for the configured number of days. Wallet-paid refunds always credit the full amount.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Field label="Low-value threshold (₹)">
          <input type="number" min={0} value={threshold} onChange={e => setThreshold(Number(e.target.value))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </Field>
        <Field label="GST deduction (%)">
          <input type="number" min={0} max={100} step={0.01} value={gst} onChange={e => setGst(Number(e.target.value))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </Field>
        <Field label="Credit validity (days)">
          <input type="number" min={1} max={3650} value={days} onChange={e => setDays(Number(e.target.value))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </Field>
      </div>

      <div className="mt-4 rounded-lg bg-secondary/60 p-3 text-xs text-muted-foreground">
        Preview: a ₹{preview.sample} order under the threshold would credit <span className="font-bold text-foreground">₹{preview.ex}</span> (ex-GST), expiring in {days} days.
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-60">
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/* ------------------------------ Audit panel ------------------------------ */

function AuditPanel() {
  const { adminToken } = useAuth();
  const [rows, setRows] = useState<RefundAuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!adminToken) return;
    setLoading(true);
    try {
      const data = await listRefundAuditLogFn({ data: { adminToken, limit: 200 } });
      setRows(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load audit log");
    } finally {
      setLoading(false);
    }
  }, [adminToken]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading…</div>;
  if (rows.length === 0) {
    return <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">No refund decisions recorded yet.</div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-secondary/40 px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
        <span>Order / Decision</span>
        <span>Credit posted</span>
      </div>
      <ul className="divide-y divide-border">
        {rows.map(r => (
          <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3 text-sm">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display font-bold">{r.order_id}</span>
                <StatusBadge status={r.decision} />
                {r.resolution && <span className="text-xs text-muted-foreground">{r.resolution}</span>}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleString("en-IN")} · {r.actor}
                {r.customer_phone ? ` · ${r.customer_phone}` : ""}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Order total {r.order_total !== null ? formatINR(Number(r.order_total)) : "—"}
                {" · "}
                Rule: &lt; ₹{r.threshold_amount ?? "—"} · GST {r.gst_percent ?? "—"}%
              </div>
            </div>
            <div className="text-right">
              <div className={`font-display text-base font-bold ${Number(r.credit_amount) > 0 ? "text-primary" : "text-muted-foreground"}`}>
                {Number(r.credit_amount) > 0 ? `+${formatINR(Number(r.credit_amount))}` : "—"}
              </div>
              {r.credit_expires_at && (
                <div className="text-[10px] font-semibold text-muted-foreground">
                  valid until {new Date(r.credit_expires_at).toLocaleDateString("en-IN")}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------- Shared bits ----------------------------- */

function StatusBadge({ status }: { status: "pending" | "approved" | "rejected" }) {
  const cls = status === "approved"
    ? "bg-primary/15 text-primary"
    : status === "rejected"
    ? "bg-destructive/15 text-destructive"
    : "bg-amber-500/15 text-amber-600";
  const label = status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Pending";
  return <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return <button onClick={onClick} className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-secondary"}`}>{label}</button>;
}

function TabChip({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-secondary"}`}>
      {icon} {label}
    </button>
  );
}
