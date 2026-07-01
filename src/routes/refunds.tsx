import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ChevronLeft, IndianRupee, CheckCircle2, Clock } from "lucide-react";
import { useAuth, useOrders } from "@/lib/store";
import { formatINR } from "@/lib/data";

export const Route = createFileRoute("/refunds")({
  component: RefundsPage,
  head: () => ({ meta: [{ title: "Your refunds — Kartogo" }] }),
});

function RefundsPage() {
  const { user } = useAuth();
  const { orders } = useOrders();

  const refunds = useMemo(
    () =>
      orders
        .filter((o) => o.refunded)
        .sort((a, b) => (b.refundedAt ?? b.createdAt) - (a.refundedAt ?? a.createdAt)),
    [orders],
  );

  const totalRefunded = refunds.reduce((s, o) => s + o.total, 0);

  if (!user) {
    return (
      <div className="min-h-screen bg-secondary/40">
        <TopBar />
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="font-display text-2xl font-bold">Please login</h1>
          <Link to="/login" className="mt-5 inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground">Login with OTP</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/40 pb-12">
      <TopBar />
      <div className="mx-auto max-w-2xl px-4 md:px-6">
        {refunds.length > 0 && (
          <div className="mt-6 flex items-center justify-between rounded-2xl bg-primary/10 p-4">
            <div className="flex items-center gap-3">
              <IndianRupee className="h-6 w-6 text-primary" />
              <span className="font-display text-lg font-bold">Total refunded</span>
            </div>
            <span className="font-display text-xl font-bold text-primary">{formatINR(totalRefunded)}</span>
          </div>
        )}

        {refunds.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-8 text-center shadow-pop">
            <IndianRupee className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-3 font-display text-lg font-bold">No refunds yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Refunds for cancelled or returned orders will show up here.
            </p>
            <Link to="/orders" className="mt-5 inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground">
              View your orders
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {refunds.map((o) => (
              <Link
                key={o.id}
                to="/orders"
                search={{ open: o.id }}
                className="block rounded-2xl border border-border bg-card p-4 shadow-pop hover:bg-secondary"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display font-bold">Order {o.id}</div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {o.items.map((i) => `${i.name} × ${i.qty}`).join(", ")}
                    </div>
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Refund processed
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-display text-lg font-bold text-primary">{formatINR(o.total)}</div>
                    {o.refundedAt && (
                      <div className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(o.refundedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <div className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 md:px-6">
        <Link to="/menu" aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-secondary">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-xl font-bold">Your Refunds</h1>
      </div>
    </div>
  );
}
