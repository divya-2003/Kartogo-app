import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/store";
import { toast } from "sonner";
import { Phone, KeyRound, ShieldCheck } from "lucide-react";
import kartigoLogo from "@/assets/kartigo-logo.png.asset.json";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: LoginPage,
  head: () => ({ meta: [{ title: "Login — Kartogo" }] }),
});

function LoginPage() {
  const { sendOtp, verifyOtp, adminLogin } = useAuth();
  const nav = useNavigate();
  const { redirect } = Route.useSearch();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [passcode, setPasscode] = useState("");
  const [stage, setStage] = useState<"phone" | "otp" | "passcode">("phone");
  const [loading, setLoading] = useState(false);
  const [demoCode, setDemoCode] = useState<string | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(phone)) { toast.error("Enter a valid 10-digit mobile"); return; }
    setLoading(true);
    try {
      const { demo, demoCode } = await sendOtp(phone);
      setStage("otp");
      if (demo && demoCode) {
        setDemoCode(demoCode);
        setOtp(demoCode);
        toast.success(`Demo mode: use OTP ${demoCode}`);
      } else {
        setDemoCode(null);
        toast.success(`OTP sent to +91 ${phone}`);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setLoading(false); }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { isAdminPhone, delivery, supplier } = await verifyOtp(phone, otp);
      // Delivery partners are routed straight to their portal.
      if (delivery) {
        try {
          localStorage.setItem("qk_delivery_token", delivery.token);
          localStorage.setItem("qk_delivery_driver", JSON.stringify(delivery.driver));
        } catch { /* noop */ }
        toast.success(`Welcome, ${delivery.driver.name}!`);
        nav({ to: "/delivery" });
        return;
      }
      // Suppliers are routed straight to their scoped inventory + orders portal.
      if (supplier) {
        try {
          localStorage.setItem("qk_supplier_token", JSON.stringify(supplier.token));
          localStorage.setItem("qk_supplier", JSON.stringify(supplier.supplier));
        } catch { /* noop */ }
        toast.success(`Welcome, ${supplier.supplier.name}!`);
        nav({ to: "/supplier" });
        return;
      }
      if (isAdminPhone) {
        // Admin numbers must also clear the secret passcode before any admin
        // token is issued — OTP alone never grants admin access.
        setStage("passcode");
        toast.success("Identity verified. Enter your admin passcode.");
        return;
      }
      toast.success("Welcome to Kartogo!");
      nav({ to: redirect ?? "/" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setLoading(false); }
  };

  const handlePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await adminLogin(passcode);
      toast.success("Welcome back, admin!");
      nav({ to: "/admin" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      {/* Brand */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl bg-[#15205a] shadow-pop">
          <img src={kartigoLogo.url} alt="Kartogo" className="h-full w-full object-cover" />
        </div>
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight">Kartogo</h1>
          <p className="mt-1 text-sm text-muted-foreground">Everything you need, delivered fast</p>
        </div>
      </div>

      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-pop md:p-8">
          <h2 className="font-display text-xl font-bold">Login or sign up</h2>
          <p className="mt-1 text-sm text-muted-foreground">We'll send an OTP to your mobile.</p>

          {stage === "phone" && (
            <form onSubmit={handleSend} className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Mobile number</label>
                <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">+91</span>
                  <input
                    autoFocus inputMode="numeric" maxLength={10}
                    value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ""))}
                    placeholder="10-digit mobile" className="w-full bg-transparent text-base outline-none"
                  />
                </div>
              </div>
              <button disabled={loading} className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                {loading ? "Sending..." : "Send OTP"}
              </button>
            </form>
          )}

          {stage === "otp" && (
            <form onSubmit={handleVerify} className="mt-6 space-y-4">
              {demoCode && (
                <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-foreground">
                  <span className="font-semibold">Demo mode:</span> SMS isn't live yet, so use OTP{" "}
                  <span className="font-bold tracking-[0.2em] text-primary">{demoCode}</span> for any number.
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Enter OTP sent to +91 {phone}</label>
                <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                  <input
                    autoFocus inputMode="numeric" maxLength={6}
                    value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="6-digit OTP" className="w-full bg-transparent text-base tracking-[0.5em] outline-none"
                  />
                </div>
              </div>
              <button disabled={loading} className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                {loading ? "Verifying..." : "Verify & continue"}
              </button>
              <button type="button" onClick={() => { setStage("phone"); setOtp(""); }} className="w-full text-center text-sm text-muted-foreground hover:text-foreground">Change number</button>
            </form>
          )}

          {stage === "passcode" && (
            <form onSubmit={handlePasscode} className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Admin passcode</label>
                <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  <input
                    autoFocus type="password"
                    value={passcode} onChange={e => setPasscode(e.target.value)}
                    placeholder="Enter admin passcode" className="w-full bg-transparent text-base outline-none"
                  />
                </div>
              </div>
              <button disabled={loading} className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                {loading ? "Verifying..." : "Enter admin portal"}
              </button>
              <button type="button" onClick={() => { setStage("otp"); setPasscode(""); }} className="w-full text-center text-sm text-muted-foreground hover:text-foreground">Back</button>
            </form>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          By continuing, you agree to Kartogo's terms.
        </p>
      </div>
    </div>
  );
}
