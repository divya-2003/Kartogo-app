import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, Fingerprint, Phone, ShieldCheck, KeyRound, Loader2 } from "lucide-react";
import { PhoneNumberInput } from "@/components/PhoneNumberInput";
import { validatePhoneNumber, toE164 } from "@/lib/phone";
import { getStaffProfileFn, requestMobileChangeOtpFn, confirmMobileChangeFn, type StaffProfile } from "@/lib/staff.functions";

export type StaffRole = "admin" | "vendor" | "delivery_partner";

const ROLE_LABEL: Record<StaffRole, string> = {
  admin: "Admin",
  vendor: "Supplier",
  delivery_partner: "Delivery partner",
};

// Each portal stores its session token under its own key. Delivery tokens are
// stored raw; the others are JSON-encoded.
const TOKEN_KEY: Record<StaffRole, { key: string; json: boolean }> = {
  admin: { key: "qk_admin_token", json: true },
  vendor: { key: "qk_supplier_token", json: true },
  delivery_partner: { key: "qk_delivery_token", json: false },
};

function readToken(role: StaffRole): string | null {
  const { key, json } = TOKEN_KEY[role];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return json ? (JSON.parse(raw) as string | null) : raw;
  } catch { return null; }
}

function writeToken(role: StaffRole, token: string) {
  const { key, json } = TOKEN_KEY[role];
  try { localStorage.setItem(key, json ? JSON.stringify(token) : token); } catch { /* noop */ }
}

/**
 * Account identity card for staff portals (admin / supplier / delivery).
 * Shows the permanent account id and role, and runs the OTP-verified
 * "change mobile number" flow. Changing the number never creates a new
 * account — the permanent id and all linked data stay exactly the same.
 */
export function StaffAccountCard({ role }: { role: StaffRole }) {
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<"idle" | "number" | "otp">("idle");
  const [newMobile, setNewMobile] = useState("");
  const [code, setCode] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = readToken(role);
      if (!token) { setLoading(false); return; }
      try {
        const p = await getStaffProfileFn({ data: { role, token } });
        if (!cancelled) setProfile(p);
      } catch { /* keep empty */ } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [role]);

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = readToken(role);
    if (!token) { toast.error("Session expired. Please sign in again."); return; }
    const check = validatePhoneNumber(newMobile);
    if (!check.valid) { toast.error(check.error ?? "Enter a valid mobile number"); return; }
    setBusy(true);
    try {
      const res = await requestMobileChangeOtpFn({ data: { role, token, newMobile: toE164(newMobile) ?? newMobile } });
      setStage("otp");
      if (res.demo && res.demoCode) {
        setDemoCode(res.demoCode);
        setCode(res.demoCode);
        toast.success(`Demo mode: use OTP ${res.demoCode}`);
      } else {
        setDemoCode(null);
        toast.success(`OTP sent to +91 ${newMobile}`);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = readToken(role);
    if (!token) { toast.error("Session expired. Please sign in again."); return; }
    setBusy(true);
    try {
      const res = await confirmMobileChangeFn({ data: { role, token, newMobile: toE164(newMobile) ?? newMobile, code } });
      if (res.token) writeToken(role, res.token);
      setProfile(res.profile);
      setStage("idle");
      setNewMobile(""); setCode(""); setDemoCode(null);
      toast.success("Mobile number updated. All your data is unchanged.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  };

  if (loading) {
    return <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">Loading account…</div>;
  }
  if (!profile) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
        Account details unavailable. Please sign in again.
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 font-display text-base font-bold">
        <BadgeCheck className="h-4 w-4 text-primary" /> Account identity
      </h3>

      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <Field label="Name" value={profile.fullName} />
        <Field label="Role" value={ROLE_LABEL[profile.role]} />
        <Field label="Mobile number" value={`+91 ${profile.mobileNumber}`} icon={Phone} />
        <Field label="Status" value={profile.status === "active" ? "Active" : "Inactive"} icon={ShieldCheck} />
        <div className="sm:col-span-2">
          <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Fingerprint className="h-3.5 w-3.5" /> Permanent account ID
          </dt>
          <dd className="mt-0.5 break-all font-mono text-xs">{profile.userId}</dd>
        </div>
      </dl>

      <div className="mt-4 border-t border-border pt-4">
        {stage === "idle" && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setStage("number")}
              className="rounded-xl border border-primary bg-primary/5 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10"
            >
              Change mobile number
            </button>
            <p className="text-xs text-muted-foreground">
              Verified by OTP. Your account ID, history, earnings and settings stay the same.
            </p>
          </div>
        )}

        {stage === "number" && (
          <form onSubmit={sendOtp} className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="new-mobile">
              New mobile number
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">+91</span>
              <input
                id="new-mobile" inputMode="numeric" maxLength={10} autoFocus
                value={newMobile}
                onChange={e => setNewMobile(e.target.value.replace(/\D/g, ""))}
                placeholder="10-digit mobile"
                className="w-full bg-transparent text-base outline-none"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Send OTP
              </button>
              <button type="button" onClick={() => { setStage("idle"); setNewMobile(""); }} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary">
                Cancel
              </button>
            </div>
          </form>
        )}

        {stage === "otp" && (
          <form onSubmit={confirm} className="space-y-3">
            {demoCode && (
              <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm">
                <span className="font-semibold">Demo mode:</span> use OTP{" "}
                <span className="font-bold tracking-[0.2em] text-primary">{demoCode}</span>
              </div>
            )}
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="change-otp">
              Enter the OTP sent to +91 {newMobile}
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <input
                id="change-otp" inputMode="numeric" maxLength={6} autoFocus
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="6-digit OTP"
                className="w-full bg-transparent text-base tracking-[0.4em] outline-none"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Verify & update
              </button>
              <button type="button" onClick={() => { setStage("number"); setCode(""); setDemoCode(null); }} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary">
                Back
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

function Field({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof Phone }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />} {label}
      </dt>
      <dd className="mt-0.5 font-semibold">{value}</dd>
    </div>
  );
}
