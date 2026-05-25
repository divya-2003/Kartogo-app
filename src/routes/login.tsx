import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/Header";
import { useAuth } from "@/lib/store";
import { toast } from "sonner";
import { Phone, KeyRound } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Login — QuickKart" }] }),
});

function LoginPage() {
  const { sendOtp, verifyOtp } = useAuth();
  const nav = useNavigate();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"phone" | "otp">("phone");
  const [sentOtp, setSentOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(phone)) { toast.error("Enter a valid 10-digit mobile"); return; }
    setLoading(true);
    try {
      const code = await sendOtp(phone);
      setSentOtp(code);
      setStage("otp");
      toast.success(`OTP sent to +91 ${phone}`);
    } finally { setLoading(false); }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await verifyOtp(phone, otp);
      toast.success("Welcome to QuickKart!");
      nav({ to: u.role === "admin" ? "/admin" : "/" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-md px-4 py-12 md:px-6">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-pop md:p-8">
          <h1 className="font-display text-2xl font-bold">Login or sign up</h1>
          <p className="mt-1 text-sm text-muted-foreground">We'll send an OTP to your mobile.</p>

          {stage === "phone" ? (
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
              <p className="text-center text-xs text-muted-foreground">
                Tip: use <span className="font-mono font-semibold">9999999999</span> to login as admin.
              </p>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="mt-6 space-y-4">
              <div className="rounded-lg bg-saffron/15 px-3 py-2 text-sm">
                Demo OTP: <span className="font-mono font-bold">{sentOtp}</span>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Enter OTP sent to +91 {phone}</label>
                <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                  <input
                    autoFocus inputMode="numeric" maxLength={4}
                    value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="4-digit OTP" className="w-full bg-transparent text-base tracking-[0.5em] outline-none"
                  />
                </div>
              </div>
              <button disabled={loading} className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                {loading ? "Verifying..." : "Verify & continue"}
              </button>
              <button type="button" onClick={() => { setStage("phone"); setOtp(""); }} className="w-full text-center text-sm text-muted-foreground hover:text-foreground">Change number</button>
            </form>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          By continuing, you agree to QuickKart's terms. <Link to="/" className="text-primary">Back to home</Link>
        </p>
      </div>
    </div>
  );
}
