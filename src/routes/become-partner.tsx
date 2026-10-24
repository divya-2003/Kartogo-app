import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Users, ShoppingBag, Sparkles, CalendarCheck, ClipboardList, TrendingUp, LocateFixed, CheckCircle2 } from "lucide-react";
import { PageTop } from "@/components/marketplace/Cards";
import { Button } from "@/components/ui/button";
import { PARTNER_TYPES, needsFssai, validatePartnerApplication, type PartnerApplicationInput } from "@/lib/partner-applications";
import { submitPartnerApplicationFn } from "@/lib/partner-applications.functions";

export const Route = createFileRoute("/become-partner")({
  head: () => ({
    meta: [
      { title: "Become a Kartogo partner — Grow your business" },
      { name: "description", content: "Retailers, restaurants, pharmacies, salons and service providers: apply to sell to local customers in Ongole with Kartogo." },
      { property: "og:title", content: "Grow your business with KARTOGO" },
      { property: "og:description", content: "Apply as a partner seller with your business, GSTIN and FSSAI details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PartnerPage,
});

const BENEFITS = [
  [Users, "Reach local customers"], [ShoppingBag, "Sell products"], [Sparkles, "Offer services"],
  [CalendarCheck, "Accept bookings"], [ClipboardList, "Manage orders"], [TrendingUp, "Grow your business"],
] as const;

const EMPTY: PartnerApplicationInput = {
  partnerType: PARTNER_TYPES[0], businessName: "", ownerName: "", phone: "", email: "",
  address: "", city: "Ongole", pincode: "", lat: null, lng: null, gstin: "", fssai: "", pan: "", categories: "", notes: "",
};

function PartnerPage() {
  const [f, setF] = useState<PartnerApplicationInput>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k: keyof PartnerApplicationInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF(prev => ({ ...prev, [k]: e.target.value }));

  const locate = () => {
    if (!navigator.geolocation) return void toast.error("Location isn't available on this device");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setF(p => ({ ...p, lat: pos.coords.latitude, lng: pos.coords.longitude })); setLocating(false); toast.success("Shop location added"); },
      () => { setLocating(false); toast.error("Couldn't get your location. Allow location access and try again."); },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const submit = async () => {
    const e = validatePartnerApplication(f);
    setErrors(e);
    if (Object.keys(e).length) return void toast.error("Please fix the highlighted details");
    setBusy(true);
    try {
      const r = await submitPartnerApplicationFn({ data: f });
      if (!r.ok) { setErrors(r.errors); toast.error("Please fix the highlighted details"); return; }
      setDone(true);
      toast.success(r.duplicate ? "Your application is already with our partner team" : "Application sent!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send your application");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageTop title="Become a Partner" back="/menu" />
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-4">
        <div className="rounded-3xl bg-brand-navy p-6 text-brand-on-navy">
          <h2 className="font-display text-2xl font-extrabold">Grow your business with KARTOGO</h2>
          <p className="mt-1 text-sm opacity-80">Your local. Your choice. Join Ongole's local marketplace.</p>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {BENEFITS.map(([Icon, label]) => (
            <div key={label} className="rounded-2xl border border-border bg-card p-3"><Icon className="h-5 w-5 text-primary" /><div className="mt-2 text-xs font-bold">{label}</div></div>
          ))}
        </div>

        {done ? (
          <section className="rounded-2xl border border-border bg-card p-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <h3 className="mt-2 font-display text-xl font-extrabold">Thanks, {f.ownerName.split(" ")[0]}!</h3>
            <p className="mt-1 text-sm text-muted-foreground">Our partner team will check your details and call you on {f.phone} within 2 working days.</p>
            <Link to="/" className="mt-4 inline-flex h-11 items-center rounded-xl bg-primary px-5 font-bold text-primary-foreground">Back to Home</Link>
          </section>
        ) : <>
          <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <h3 className="font-display text-lg font-extrabold">Basic details</h3>
            <div className="text-sm font-bold">I am a…</div>
            <div className="flex flex-wrap gap-2">{PARTNER_TYPES.map(t => <button key={t} type="button" onClick={() => setF(p => ({ ...p, partnerType: t }))} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${f.partnerType === t ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{t}</button>)}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Business name" error={errors.businessName}><input value={f.businessName} onChange={set("businessName")} className={INPUT} /></Field>
              <Field label="Owner name" error={errors.ownerName}><input value={f.ownerName} onChange={set("ownerName")} autoComplete="name" className={INPUT} /></Field>
              <Field label="Mobile number" error={errors.phone}><input value={f.phone} onChange={set("phone")} inputMode="numeric" maxLength={14} autoComplete="tel" className={INPUT} /></Field>
              <Field label="Email (optional)" error={errors.email}><input value={f.email} onChange={set("email")} type="email" autoComplete="email" className={INPUT} /></Field>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <h3 className="font-display text-lg font-extrabold">Business details</h3>
            <Field label="Shop address" error={errors.address}><textarea value={f.address} onChange={set("address")} rows={2} className={INPUT} /></Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="City" error={errors.city}><input value={f.city} onChange={set("city")} className={INPUT} /></Field>
              <Field label="Pincode" error={errors.pincode}><input value={f.pincode} onChange={set("pincode")} inputMode="numeric" maxLength={6} className={INPUT} /></Field>
              <div className="flex items-end">
                <Button type="button" variant="outline" disabled={locating} onClick={locate} className="h-10 w-full">
                  <LocateFixed /> {f.lat != null ? "Location added" : locating ? "Locating…" : "Use shop location"}
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="GSTIN (optional)" error={errors.gstin}><input value={f.gstin} onChange={e => setF(p => ({ ...p, gstin: e.target.value.toUpperCase() }))} maxLength={15} placeholder="37ABCDE1234F1Z5" className={INPUT} /></Field>
              <Field label={needsFssai(f.partnerType) ? "FSSAI licence no." : "FSSAI (if you sell food)"} error={errors.fssai}><input value={f.fssai} onChange={set("fssai")} inputMode="numeric" maxLength={14} placeholder="14 digits" className={INPUT} /></Field>
              <Field label="PAN (optional)" error={errors.pan}><input value={f.pan} onChange={e => setF(p => ({ ...p, pan: e.target.value.toUpperCase() }))} maxLength={10} placeholder="ABCDE1234F" className={INPUT} /></Field>
            </div>
            <Field label="What do you sell or offer?"><input value={f.categories} onChange={set("categories")} placeholder="e.g. groceries, clothes, medicines, haircuts" className={INPUT} /></Field>
            <Field label="Anything else (optional)"><textarea value={f.notes} onChange={set("notes")} rows={2} className={INPUT} /></Field>
          </section>

          <Button onClick={() => void submit()} disabled={busy} className="h-12 w-full text-base font-bold">{busy ? "Sending…" : "Apply to become a partner"}</Button>
          <p className="text-center text-xs text-muted-foreground">Already a partner? <Link to="/login" className="font-bold text-primary">Log in to your partner portal</Link></p>
        </>}
      </div>
    </div>
  );
}

const INPUT = "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-muted-foreground">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs font-semibold text-destructive">{error}</span>}
    </label>
  );
}
