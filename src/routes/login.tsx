import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/store";
import { toast } from "sonner";
import { KeyRound, ShieldCheck } from "lucide-react";
import kartogoLogo from "@/assets/kartogo-logo.png";
import wordmark from "@/assets/kartogo-wordmark-cropped.png";

import { PhoneNumberInput } from "@/components/PhoneNumberInput";
import { Button } from "@/components/ui/button";
import { usePhoneCountryDetection } from "@/hooks/use-phone-country";
import { toE164, validatePhoneNumber, getCountry } from "@/lib/phone";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: LoginPage,
  head: () => ({ meta: [
    { title: "Login or Sign Up — Kartogo" },
    { name: "description", content: "Log in or create your Kartogo account securely with your mobile number." },
    { property: "og:title", content: "Login or Sign Up — Kartogo" },
    { property: "og:description", content: "Access Kartogo securely with your mobile number." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
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
      const { isAdminPhone, delivery, deliveryPending, supplier } = await verifyOtp(e164 ?? phone, otp);
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
    <main className="flex min-h-dvh flex-col items-center justify-start overflow-x-hidden bg-brand-navy px-5 py-8 sm:px-8 sm:py-10 lg:justify-center lg:py-12">
      {/* Brand */}
      <div className="mb-10 flex flex-col items-center sm:mb-11">
        <img src={kartogoLogo} alt="" className="h-22 w-22 rounded-3xl object-cover sm:h-24 sm:w-24" />
        <img src={wordmark} alt="Kartogo" className="mt-5 w-48 max-w-[72vw] object-contain sm:w-52" />
        <p className="mt-1.5 font-sans text-sm font-medium text-brand-white/85 sm:text-base">Everything You Need, Delivered Fast</p>
      </div>

      <div className="w-full max-w-xl">
        <section className="rounded-[2rem] border border-border bg-card px-6 py-7 shadow-pop sm:px-10 sm:py-9" aria-labelledby="login-title">
          <h1 id="login-title" className="font-display text-2xl font-bold text-card-foreground">Login or sign up</h1>
          <p className="mt-1 font-sans text-base text-muted-foreground">We'll send an OTP to your mobile.</p>

          {stage === "phone" && (
            <form onSubmit={handleSend} className="mt-7 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-muted-foreground">Mobile number</label>
                <PhoneNumberInput
                  autoFocus
                  country={country}
                  onCountryChange={setCountry}
                  value={phone}
                  onValueChange={setPhone}
                  className="min-h-14 rounded-2xl bg-cream px-4"
                />
              </div>
              <Button disabled={loading} size="lg" className="h-15 w-full rounded-2xl bg-brand-green font-display text-lg font-bold text-brand-white hover:bg-brand-green/90">
                {loading ? "Sending..." : "Send OTP"}
              </Button>
              <p className="pt-1 text-center text-sm text-muted-foreground">An OTP will be sent to your mobile number.</p>

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
              <Button disabled={loading} className="w-full rounded-xl">
                {loading ? "Verifying..." : "Verify & continue"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => { setStage("phone"); setOtp(""); }} className="w-full text-muted-foreground">Change number</Button>
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
              <Button disabled={loading} className="w-full rounded-xl">
                {loading ? "Verifying..." : "Enter admin portal"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => { setStage("otp"); setPasscode(""); }} className="w-full text-muted-foreground">Back</Button>
            </form>
          )}
        </section>
        <p className="mt-6 text-center text-sm text-brand-white/70">
          By continuing, you agree to Kartogo's terms.
        </p>
      </div>
    </main>
  );
}
