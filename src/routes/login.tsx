import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/store";
import { toast } from "sonner";
import { KeyRound, ShieldCheck } from "lucide-react";
import kartogoLogo from "@/assets/kartogo-logo.png";
import kartogoWordmark from "@/assets/kartogo-wordmark.png.asset.json";
import { PhoneNumberInput } from "@/components/PhoneNumberInput";
import { usePhoneCountryDetection } from "@/hooks/use-phone-country";
import { toE164, validatePhoneNumber, getCountry } from "@/lib/phone";

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
  const { country, setCountry } = usePhoneCountryDetection();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [passcode, setPasscode] = useState("");
  const [stage, setStage] = useState<"phone" | "otp" | "passcode">("phone");
  const [loading, setLoading] = useState(false);
  const [demoCode, setDemoCode] = useState<string | null>(null);

  // The E.164 number is what the OTP backend receives; the UI keeps showing
  // whatever the customer typed.
  const e164 = toE164(phone, country);
  const displayNumber = e164 ?? `${getCountry(country).dialCode} ${phone}`;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePhoneNumber(phone, country) || !e164) {
      toast.error("Please enter a valid mobile number.");
      return;
    }
    setLoading(true);
    try {
      const { demo, demoCode } = await sendOtp(e164);
      setStage("otp");
      if (demo && demoCode) {
        setDemoCode(demoCode);
        setOtp(demoCode);
        toast.success(`Demo mode: use OTP ${demoCode}`);
      } else {
        setDemoCode(null);
        toast.success(`OTP sent to ${displayNumber}`);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setLoading(false); }
  };


  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { isAdminPhone, delivery, deliveryPending, supplier, printer } = await verifyOtp(e164 ?? phone, otp);
      // Clear tokens belonging to OTHER roles so a device that previously
      // hosted a supplier/delivery/admin session doesn't bounce a new customer
      // (or a different role) back to the wrong portal via roleRedirectTarget.
      const clearKeys = (keys: string[]) => {
        try { for (const k of keys) localStorage.removeItem(k); } catch { /* noop */ }
      };
      // Delivery partners are routed straight to their portal.
      if (delivery) {
        clearKeys(["qk_admin_token", "qk_supplier_token", "qk_supplier", "qk_delivery_pending_token"]);
        try {
          localStorage.setItem("qk_delivery_token", delivery.token);
          localStorage.setItem("qk_delivery_driver", JSON.stringify(delivery.driver));
        } catch { /* noop */ }
        toast.success(`Welcome, ${delivery.driver.name}!`);
        // replace: login screens must never sit in history — Back from the
        // portal/home should leave the app, not bounce back to the login page.
        nav({ to: "/delivery", replace: true });
        return;
      }
      // Registered partner whose portal access is paused by the admin.
      if (deliveryPending) {
        clearKeys(["qk_admin_token", "qk_supplier_token", "qk_supplier", "qk_delivery_token", "qk_delivery_driver"]);
        // Park a short-lived pending token so the waiting screen can promote
        // itself to a full delivery session the second the admin approves.
        try { localStorage.setItem("qk_delivery_pending_token", deliveryPending.pendingToken); } catch { /* noop */ }
        nav({ to: "/delivery-request", search: { phone: deliveryPending.phone }, replace: true });
        return;
      }
      // Suppliers are routed straight to their scoped inventory + orders portal.
      if (supplier) {
        clearKeys(["qk_admin_token", "qk_delivery_token", "qk_delivery_driver"]);
        try {
          localStorage.setItem("qk_supplier_token", JSON.stringify(supplier.token));
          localStorage.setItem("qk_supplier", JSON.stringify(supplier.supplier));
        } catch { /* noop */ }
        toast.success(`Welcome, ${supplier.supplier.name}!`);
        nav({ to: "/supplier", replace: true });
        return;
      }
      // Printer service portal — same shape as the supplier portal.
      if (printer) {
        clearKeys(["qk_admin_token", "qk_delivery_token", "qk_delivery_driver", "qk_supplier_token", "qk_supplier"]);
        try {
          localStorage.setItem("qk_printer_token", JSON.stringify(printer.token));
          localStorage.setItem("qk_printer", JSON.stringify(printer.service));
        } catch { /* noop */ }
        toast.success(`Welcome, ${printer.service.name}!`);
        nav({ to: "/printer", replace: true });
        return;
      }
      if (isAdminPhone) {
        // Admin numbers must also clear the secret passcode before any admin
        // token is issued — OTP alone never grants admin access.
        setStage("passcode");
        toast.success("Identity verified. Enter your admin passcode.");
        return;
      }
      // Regular customer — purge any stale role tokens from prior sessions
      // on this device so the home page doesn't auto-redirect them.
      clearKeys([
        "qk_admin_token",
        "qk_delivery_token",
        "qk_delivery_driver",
        "qk_supplier_token",
        "qk_supplier",
      ]);
      toast.success("Welcome to Kartogo!");
      // replace: Back from the home page closes the app instead of reopening login.
      nav({ to: redirect ?? "/", replace: true });
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setLoading(false); }
  };


  const handlePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await adminLogin(passcode, e164 ?? phone);
      toast.success("Welcome back, admin!");
      nav({ to: "/admin", replace: true });
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#010d30] px-4">
      {/* Brand */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl bg-[#010d30] shadow-pop">
          <img src={kartogoLogo} alt="Kartogo" className="h-full w-full scale-110 object-cover" />
        </div>
        <div className="text-center">
          <h1>
            <img src={kartogoWordmark.url} alt="Kartogo" className="mx-auto h-10 w-auto object-contain" />
          </h1>
          <p className="mt-1 text-sm text-white/70">Everything You Need, Delivered Fast</p>
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
                <PhoneNumberInput
                  autoFocus
                  country={country}
                  onCountryChange={setCountry}
                  value={phone}
                  onValueChange={setPhone}
                />
              </div>
              <button disabled={loading} className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                {loading ? "Sending..." : "Send OTP"}
              </button>
              <p className="text-center text-xs text-muted-foreground">An OTP will be sent to your mobile number.</p>

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
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Enter OTP sent to {displayNumber}</label>
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
        <p className="mt-4 text-center text-xs text-white/60">
          By continuing, you agree to Kartogo's terms.
        </p>
      </div>
    </div>
  );
}
