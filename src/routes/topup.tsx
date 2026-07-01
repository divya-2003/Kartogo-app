import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuth, useWallet } from "@/lib/store";
import { formatINR } from "@/lib/data";
import { toast } from "sonner";
import { ChevronLeft, Wallet, ShieldCheck, Loader2, CheckCircle2, XCircle, Smartphone } from "lucide-react";

// Merchant UPI id money is collected into. In production this comes from the
// payment gateway / PSP; the wallet is only credited after the gateway confirms
// a successful payment.
const MERCHANT_VPA = "kartogo@upi";
const MERCHANT_NAME = "Kartogo";

export const Route = createFileRoute("/topup")({
  component: TopUpPage,
  validateSearch: (search: Record<string, unknown>) => ({
    amount: Math.max(0, Math.round(Number(search.amount) || 0)),
  }),
  head: () => ({ meta: [{ title: "Add money — Kartogo Cash" }] }),
});

type Stage = "enter" | "pay" | "verifying" | "success" | "failed";

function TopUpPage() {
  const { user } = useAuth();
  const { balance, addMoney, recordFailedTopup } = useWallet();
  const nav = useNavigate();
  const { amount: initialAmount } = Route.useSearch();

  const [amount, setAmount] = useState(initialAmount ? String(initialAmount) : "");
  const [stage, setStage] = useState<Stage>(initialAmount > 0 ? "pay" : "enter");

  const amt = Math.round(Number(amount) || 0);

  const upiUri = useMemo(() => {
    const params = new URLSearchParams({
      pa: MERCHANT_VPA,
      pn: MERCHANT_NAME,
      am: String(amt),
      cu: "INR",
      tn: "Kartogo Cash top-up",
    });
    return `upi://pay?${params.toString()}`;
  }, [amt]);

  const qrSrc = useMemo(
    () => `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=${encodeURIComponent(upiUri)}`,
    [upiUri],
  );

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

  const startPayment = () => {
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    setStage("pay");
  };

  // Simulate the return from the UPI app / gateway. Money is credited ONLY when
  // the payment is confirmed successful.
  const confirmPaid = async () => {
    setStage("verifying");
    await new Promise((r) => setTimeout(r, 2200));
    try {
      await addMoney(amt);
      setStage("success");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not credit wallet");
      setStage("failed");
    }
  };

  const cancelPayment = () => {
    setStage("failed");
  };

  return (
    <div className="min-h-screen bg-secondary/40 pb-12">
      <TopBar />
      <div className="mx-auto max-w-md px-4 md:px-6">
        {/* Balance strip */}
        <div className="mt-6 flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-3 text-sm">
          <Wallet className="h-5 w-5 text-primary" />
          <span className="text-muted-foreground">Current balance</span>
          <span className="ml-auto font-bold">{formatINR(balance)}</span>
        </div>

        {stage === "enter" && (
          <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-pop">
            <h1 className="font-display text-xl font-bold">Add money to Kartogo Cash</h1>
            <p className="mt-1 text-sm text-muted-foreground">Choose an amount, then pay securely via UPI.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[100, 200, 500, 1000].map((v) => (
                <button
                  key={v}
                  onClick={() => setAmount(String(v))}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${amount === String(v) ? "border-primary bg-primary/10 text-primary" : "border-input"}`}
                >
                  +{formatINR(v)}
                </button>
              ))}
            </div>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="mt-3 w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={startPayment}
              className="mt-4 w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground hover:bg-primary/90"
            >
              Proceed to pay
            </button>
          </div>
        )}

        {stage === "pay" && (
          <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-pop">
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Paying</div>
              <div className="font-display text-3xl font-bold">{formatINR(amt)}</div>
            </div>

            <div className="mt-5 flex flex-col items-center">
              <div className="rounded-2xl border border-border bg-white p-3">
                <img src={qrSrc} alt="UPI payment QR code" width={220} height={220} className="h-[220px] w-[220px]" />
              </div>
              <p className="mt-3 text-center text-sm text-muted-foreground">
                Scan the QR with any UPI app, or open your UPI app to pay
                <span className="mt-0.5 block font-semibold text-foreground">{MERCHANT_VPA}</span>
              </p>
            </div>

            <a
              href={upiUri}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-primary bg-primary/5 py-3 font-bold text-primary hover:bg-primary/10"
            >
              <Smartphone className="h-5 w-5" /> Open UPI app
            </a>

            <div className="mt-4 flex items-center gap-2 rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
              Your wallet is credited only after the payment succeeds.
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={cancelPayment}
                className="flex-1 rounded-xl border border-border py-3 font-bold hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={confirmPaid}
                className="flex-1 rounded-xl bg-primary py-3 font-bold text-primary-foreground hover:bg-primary/90"
              >
                I've paid
              </button>
            </div>
          </div>
        )}

        {stage === "verifying" && (
          <div className="mt-4 rounded-2xl border border-border bg-card p-8 text-center shadow-pop">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <h1 className="mt-4 font-display text-xl font-bold">Verifying payment…</h1>
            <p className="mt-1 text-sm text-muted-foreground">Please wait while we confirm your UPI payment. Don't close this screen.</p>
          </div>
        )}

        {stage === "success" && (
          <div className="mt-4 rounded-2xl border border-border bg-card p-8 text-center shadow-pop">
            <CheckCircle2 className="mx-auto h-14 w-14 text-leaf" />
            <h1 className="mt-4 font-display text-2xl font-bold">Payment successful</h1>
            <p className="mt-1 text-sm text-muted-foreground">{formatINR(amt)} has been added to your Kartogo Cash.</p>
            <div className="mt-2 text-sm">New balance: <span className="font-bold">{formatINR(balance)}</span></div>
            <div className="mt-6 flex gap-2">
              <Link to="/wallet" className="flex-1 rounded-xl border border-border py-3 font-bold hover:bg-secondary">View wallet</Link>
              <button onClick={() => nav({ to: "/" })} className="flex-1 rounded-xl bg-primary py-3 font-bold text-primary-foreground hover:bg-primary/90">Done</button>
            </div>
          </div>
        )}

        {stage === "failed" && (
          <div className="mt-4 rounded-2xl border border-border bg-card p-8 text-center shadow-pop">
            <XCircle className="mx-auto h-14 w-14 text-destructive" />
            <h1 className="mt-4 font-display text-2xl font-bold">Payment not completed</h1>
            <p className="mt-1 text-sm text-muted-foreground">No money was added to your wallet. You can try the payment again.</p>
            <div className="mt-6 flex gap-2">
              <Link to="/menu" className="flex-1 rounded-xl border border-border py-3 font-bold hover:bg-secondary">Back to profile</Link>
              <button onClick={() => setStage("pay")} className="flex-1 rounded-xl bg-primary py-3 font-bold text-primary-foreground hover:bg-primary/90">Try again</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3 md:px-6">
        <Link to="/menu" aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <span className="font-display text-lg font-bold">Add Kartogo Cash</span>
      </div>
    </div>
  );
}
