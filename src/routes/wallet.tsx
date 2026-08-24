import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth, useWallet } from "@/lib/store";
import { formatINR } from "@/lib/data";
import { ChevronLeft, Wallet, ArrowDownLeft, ArrowUpRight, CheckCircle2, XCircle, Clock } from "lucide-react";

export const Route = createFileRoute("/wallet")({
  component: WalletPage,
  head: () => ({ meta: [{ title: "Kartogo Cash — Wallet history" }] }),
});

function formatWhen(at: number) {
  return new Date(at).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function WalletPage() {
  const { user } = useAuth();
  const { balance, txns, topups } = useWallet();
  const nav = useNavigate();



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
        {/* Balance card */}
        <div className="mt-6 rounded-2xl bg-primary p-5 text-primary-foreground shadow-pop">
          <div className="flex items-center gap-2 text-sm opacity-90">
            <Wallet className="h-5 w-5" /> Kartogo Cash balance
          </div>
          <div className="mt-2 font-display text-4xl font-bold">{formatINR(balance)}</div>
          <button
            onClick={() => nav({ to: "/topup", search: { amount: 0 } })}
            className="mt-4 rounded-lg bg-primary-foreground/15 px-4 py-2 text-sm font-bold backdrop-blur hover:bg-primary-foreground/25"
          >
            Add money
          </button>
        </div>

        {/* History */}
        <div className="mb-3 mt-8 flex flex-wrap items-center gap-3">
          <h2 className="font-display text-xl font-bold">Transaction history</h2>
        </div>
        {txns.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground shadow-pop">
            No wallet transactions yet. Top-ups and order payments made with Kartogo Cash will show up here.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-pop">
            {txns.map((t, i) => {
              const credit = t.type === "credit";
              const expiryNote = t.expiresAt && !t.expiredAt
                ? `Valid until ${new Date(t.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                : t.expiredAt
                ? "Expired"
                : null;
              return (
                <div
                  key={t.id}
                  className={`flex items-center gap-3 p-4 ${i < txns.length - 1 ? "border-b border-border" : ""}`}
                >
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${credit ? "bg-leaf/15 text-leaf" : "bg-destructive/10 text-destructive"}`}>
                    {credit ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{t.note}</div>
                    <div className="text-xs text-muted-foreground">{formatWhen(t.at)}</div>
                    {expiryNote && (
                      <div className={`mt-0.5 text-xs font-semibold ${t.expiredAt ? "text-destructive" : "text-primary"}`}>{expiryNote}</div>
                    )}
                  </div>
                  <div className={`shrink-0 font-display text-base font-bold ${credit ? "text-leaf" : "text-destructive"}`}>
                    {credit ? "+" : "−"}{formatINR(t.amount)}
                  </div>
                </div>
              );
            })}

          </div>
        )}

        {/* Top-up history (successful + failed) */}
        <h2 className="mb-3 mt-8 font-display text-xl font-bold">Top-up history</h2>
        {topups.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground shadow-pop">
            No top-ups yet. Your successful and failed add-money attempts will appear here.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-pop">
            {topups.map((t, i) => {
              const ok = t.status === "success";
              const pending = t.status === "pending";
              const tone = ok ? "bg-leaf/15 text-leaf" : pending ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive";
              const label = ok ? "Top-up successful" : pending ? "Awaiting payment verification" : "Top-up failed";
              return (
                <div
                  key={t.id}
                  className={`flex items-center gap-3 p-4 ${i < topups.length - 1 ? "border-b border-border" : ""}`}
                >
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${tone}`}>
                    {ok ? <CheckCircle2 className="h-5 w-5" /> : pending ? <Clock className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{label}</div>
                    <div className="text-xs text-muted-foreground">{formatWhen(t.at)}</div>
                  </div>
                  <div className={`shrink-0 font-display text-base font-bold ${ok ? "text-leaf" : pending ? "" : "text-muted-foreground line-through"}`}>
                    {formatINR(t.amount)}
                  </div>
                </div>
              );
            })}

          </div>
        )}
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 md:px-6">
        <Link to="/menu" aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <span className="font-display text-lg font-bold">Kartogo Cash</span>
      </div>
    </div>
  );
}
