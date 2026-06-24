import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useOrders } from "@/lib/store";
import { formatINR } from "@/lib/data";
import { toast } from "sonner";
import { AlertTriangle, BadgeIndianRupee, CheckCircle2, PackageX, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/admin/cancellations")({
  component: Cancellations,
  head: () => ({ meta: [{ title: "Cancelled orders — Kartigo" }] }),
});

function Cancellations() {
  const { orders, markRefunded } = useOrders();
  const [filter, setFilter] = useState<"all" | "pending" | "refunded">("all");
  const [busy, setBusy] = useState<string | null>(null);

  const cancelled = useMemo(
    () => orders.filter(o => o.status === "cancelled").sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt)),
    [orders],
  );

  const pendingRefunds = cancelled.filter(o => o.paymentMethod === "upi" && !o.refunded);
  const refundedCount = cancelled.filter(o => o.refunded).length;
  const refundAmount = pendingRefunds.reduce((s, o) => s + o.total, 0);

  const shown = useMemo(() => {
    if (filter === "pending") return cancelled.filter(o => o.paymentMethod === "upi" && !o.refunded);
    if (filter === "refunded") return cancelled.filter(o => o.refunded);
    return cancelled;
  }, [cancelled, filter]);

  const toggleRefund = async (id: string, next: boolean) => {
    setBusy(id);
    try {
      await markRefunded(id, next);
      toast.success(next ? "Marked as refunded" : "Refund reverted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update refund");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <PackageX className="h-7 w-7 text-destructive" /> Cancelled orders
        </h1>
        <p className="text-sm text-muted-foreground">Stop packing these immediately and process refunds where needed.</p>
      </div>

      {pendingRefunds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
          <p className="text-sm font-semibold text-destructive">
            {pendingRefunds.length} prepaid cancellation{pendingRefunds.length > 1 ? "s" : ""} awaiting refund · {formatINR(refundAmount)}
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total cancelled" value={String(cancelled.length)} icon={<PackageX className="h-5 w-5" />} />
        <Stat label="Refunds pending" value={String(pendingRefunds.length)} icon={<BadgeIndianRupee className="h-5 w-5" />} warn={pendingRefunds.length > 0} />
        <Stat label="Refunded" value={String(refundedCount)} icon={<CheckCircle2 className="h-5 w-5" />} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip active={filter === "all"} onClick={() => setFilter("all")} label={`All (${cancelled.length})`} />
        <Chip active={filter === "pending"} onClick={() => setFilter("pending")} label={`Refund pending (${pendingRefunds.length})`} />
        <Chip active={filter === "refunded"} onClick={() => setFilter("refunded")} label={`Refunded (${refundedCount})`} />
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">No cancelled orders here.</div>
      ) : (
        <div className="space-y-3">
          {shown.map(o => {
            const needsRefund = o.paymentMethod === "upi" && !o.refunded;
            return (
              <article key={o.id} className={`rounded-2xl border bg-card p-4 md:p-5 ${needsRefund ? "border-destructive/40" : "border-border"}`}>
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 font-display text-base font-bold">
                      {o.id}
                      <span className="rounded-md bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">Cancelled</span>
                      {o.refunded && <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">Refunded</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleString("en-IN")} · {o.customerName} · {o.customerPhone}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{o.address}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-lg font-bold">{formatINR(o.total)}</div>
                    <div className="text-xs uppercase text-muted-foreground">{o.paymentMethod}</div>
                  </div>
                </header>

                {o.cancelReason && (
                  <p className="mt-2 text-sm"><span className="font-semibold">Reason:</span> <span className="text-muted-foreground">{o.cancelReason}</span></p>
                )}

                <ul className="my-3 grid gap-1 text-sm md:grid-cols-2">
                  {o.items.map(i => <li key={i.productId} className="text-muted-foreground">{i.name} × <span className="font-semibold text-foreground">{i.qty}</span></li>)}
                </ul>

                <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
                  {o.paymentMethod === "cash" ? (
                    <span className="text-xs font-semibold text-muted-foreground">Cash on delivery — no refund required.</span>
                  ) : o.refunded ? (
                    <>
                      <span className="text-xs font-semibold text-primary flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Refunded{o.refundedAt ? ` · ${new Date(o.refundedAt).toLocaleString("en-IN")}` : ""}</span>
                      <button
                        onClick={() => toggleRefund(o.id, false)}
                        disabled={busy === o.id}
                        className="ml-auto flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Undo
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => toggleRefund(o.id, true)}
                      disabled={busy === o.id}
                      className="ml-auto flex items-center gap-1 rounded-lg bg-destructive px-3 py-1.5 text-sm font-bold text-destructive-foreground transition hover:opacity-90 disabled:opacity-60"
                    >
                      <BadgeIndianRupee className="h-4 w-4" /> {busy === o.id ? "Saving…" : `Process refund · ${formatINR(o.total)}`}
                    </button>
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

function Stat({ label, value, icon, warn }: { label: string; value: string; icon: React.ReactNode; warn?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${warn ? "border-destructive/40 bg-destructive/10" : "border-border bg-card"}`}>
      <div className={`flex items-center gap-2 text-xs font-semibold ${warn ? "text-destructive" : "text-muted-foreground"}`}>{icon} {label}</div>
      <div className="mt-2 font-display text-2xl font-bold">{value}</div>
    </div>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return <button onClick={onClick} className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-secondary"}`}>{label}</button>;
}
