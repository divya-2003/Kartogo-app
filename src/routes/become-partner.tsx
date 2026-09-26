import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Users, ShoppingBag, Sparkles, CalendarCheck, ClipboardList, TrendingUp } from "lucide-react";
import { PageTop } from "@/components/marketplace/Cards";

export const Route = createFileRoute("/become-partner")({
  head: () => ({
    meta: [
      { title: "Become a Kartogo partner — Grow your business" },
      { name: "description", content: "Retailers, salons, service providers, furniture sellers, event and home-service providers: reach local customers in Ongole with Kartogo." },
      { property: "og:title", content: "Grow your business with KARTOGO" },
      { property: "og:description", content: "Sell products, offer services and accept bookings from local customers." },
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
const TYPES = ["Retailer", "Salon", "Service Provider", "Furniture Seller", "Event Provider", "Home-Service Provider"];

function PartnerPage() {
  const [type, setType] = useState(TYPES[0]);
  const [name, setName] = useState("");
  const apply = () => {
    const msg = encodeURIComponent(`Hi Kartogo, I'd like to become a partner.\nBusiness: ${name || "-"}\nType: ${type}`);
    window.open(`https://wa.me/919110310034?text=${msg}`, "_blank", "noopener");
    toast.success("Thanks! Our partner team will contact you.");
  };
  return (
    <div className="min-h-screen bg-background pb-24">
      <PageTop title="Become a Partner" back="/menu" />
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-4">
        <div className="rounded-3xl bg-brand-navy p-6 text-brand-on-navy">
          <h2 className="font-display text-2xl font-extrabold">Grow your business with KARTOGO</h2>
          <p className="mt-1 text-sm opacity-80">Your local. Your choice. Join Ongole's local marketplace.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {BENEFITS.map(([Icon, label]) => (
            <div key={label} className="rounded-2xl border border-border bg-card p-4"><Icon className="h-6 w-6 text-primary" /><div className="mt-2 text-sm font-bold">{label}</div></div>
          ))}
        </div>
        <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div className="text-sm font-bold">I am a…</div>
          <div className="flex flex-wrap gap-2">{TYPES.map(t => <button key={t} onClick={() => setType(t)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${type === t ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{t}</button>)}</div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Business name" className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none" />
          <button onClick={apply} className="h-12 w-full rounded-xl bg-primary font-bold text-primary-foreground">Become a Partner</button>
          <p className="text-center text-xs text-muted-foreground">Already a partner? <Link to="/login" className="font-bold text-primary">Log in to your partner portal</Link></p>
        </section>
      </div>
    </div>
  );
}
