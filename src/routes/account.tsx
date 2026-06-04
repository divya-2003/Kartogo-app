import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { useAuth, useLocation } from "@/lib/store";
import { toast } from "sonner";
import { User2, Phone, Mail, MapPin, KeyRound, Check, Trash2 } from "lucide-react";

export const Route = createFileRoute("/account")({
  component: AccountPage,
  head: () => ({ meta: [{ title: "My account — QuickKart" }] }),
});

function AccountPage() {
  const { user, updateProfile } = useAuth();
  

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? "");
    setEmail(user.email ?? "");
    setAddress(user.address ?? "");
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="font-display text-2xl font-bold">Please login</h1>
          <Link to="/login" className="mt-5 inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground">Login with OTP</Link>
        </div>
      </div>
    );
  }

  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({ name, email, address });
    toast.success("Profile updated");
  };

  const savePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 4) { toast.error("Password must be at least 4 characters"); return; }
    if (password !== confirm) { toast.error("Passwords don't match"); return; }
    updateProfile({ password });
    setPassword(""); setConfirm("");
    toast.success(user.password ? "Password updated" : "Password created");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-2xl px-4 py-8 md:px-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            <User2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Account details</h1>
            <p className="text-sm text-muted-foreground">Manage your personal details and password</p>
          </div>
        </div>


        <form onSubmit={saveProfile} className="rounded-2xl border border-border bg-card p-5 shadow-pop">
          <h2 className="mb-4 font-display text-lg font-bold">Account details</h2>

          <div className="space-y-4">
            <Field icon={<Phone className="h-4 w-4 text-muted-foreground" />} label="Phone number">
              <input value={`+91 ${user.phone}`} readOnly className="w-full bg-transparent text-base outline-none text-muted-foreground" />
            </Field>

            <Field icon={<User2 className="h-4 w-4 text-muted-foreground" />} label="Full name">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="w-full bg-transparent text-base outline-none" />
            </Field>

            <Field icon={<Mail className="h-4 w-4 text-muted-foreground" />} label="Email">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="w-full bg-transparent text-base outline-none" />
            </Field>

            <Field icon={<MapPin className="h-4 w-4 text-muted-foreground" />} label="Default address">
              <textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="House no, street, city, pincode" rows={2} className="w-full resize-none bg-transparent text-base outline-none" />
            </Field>
          </div>

          <button className="mt-5 w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground hover:bg-primary/90">Save details</button>
        </form>

        <form onSubmit={savePassword} className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-pop">
          <h2 className="mb-1 font-display text-lg font-bold">{user.password ? "Change password" : "Create password"}</h2>
          <p className="mb-4 text-xs text-muted-foreground">Optional — you can still login using OTP.</p>

          <div className="space-y-4">
            <Field icon={<KeyRound className="h-4 w-4 text-muted-foreground" />} label="New password">
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 4 characters" className="w-full bg-transparent text-base outline-none" />
            </Field>
            <Field icon={<KeyRound className="h-4 w-4 text-muted-foreground" />} label="Confirm password">
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Re-enter password" className="w-full bg-transparent text-base outline-none" />
            </Field>
          </div>

          <button className="mt-5 w-full rounded-xl bg-secondary py-3 font-bold text-secondary-foreground hover:bg-secondary/80">
            {user.password ? "Update password" : "Create password"}
          </button>
        </form>

      </div>
    </div>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
        {icon}
        {children}
      </div>
    </div>
  );
}
