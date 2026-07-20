import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useOrders } from "@/lib/store";
import { formatINR } from "@/lib/data";
import { toast } from "sonner";
import { BadgeIndianRupee, CheckCircle2, RotateCcw, Undo2, XCircle } from "lucide-react";

export const Route = createFileRoute("/admin/refund-requests")({
  component: RefundRequests,
  head: () => ({ meta: [{ title: "Refund requests — Kartogo" }] }),
});

function RefundRequests() {
  const { orders, resolveRefundRequest } = useOrders();
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [busy, setBusy] = useState<string | null>(null);

  const requests = useMemo(
    () => orders
      .filter(o => !!o.refundRequestedAt)
      .sort((a, b) => (b.refundRequestedAt ?? 0) - (a.refundRequestedAt ?? 0)),
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
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <BadgeIndianRupee className="h-7 w-7 text-primary" /> Refund requests
        </h1>
        <p className="text-sm text-muted-foreground">Requests raised by customers from their delivered orders (including cash on delivery).</p>
      </div>

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
