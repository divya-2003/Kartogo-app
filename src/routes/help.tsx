import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, MessageCircle, Phone, ChevronDown } from "lucide-react";
import { PageTop } from "@/components/marketplace/Cards";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help & Support — Kartogo" },
      { name: "description", content: "Answers about orders, bookings, payments, refunds, delivery, services and your Kartogo account." },
      { property: "og:title", content: "Help & Support — Kartogo" },
      { property: "og:description", content: "Search help or chat with Kartogo support." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HelpPage,
});

const FAQ: Record<string, { q: string; a: string }[]> = {
  Orders: [{ q: "How do I track my order?", a: "Open Orders & Bookings and tap Track Order to see live status and your delivery partner." }, { q: "Can I change items after ordering?", a: "Contact support quickly — we can help before the store starts preparing." }],
  Bookings: [{ q: "How do I cancel a booking?", a: "Open the booking and tap Cancel booking. You can cancel until the service starts." }, { q: "Can I choose a professional?", a: "Yes — after picking a time, choose Any available or a specific professional who is free then." }],
  Payments: [{ q: "Which payment methods are supported?", a: "UPI, Kartogo Cash and cash on delivery (for eligible orders). Services are paid after the service." }],
  Refunds: [{ q: "Where do refunds go?", a: "Eligible refunds are credited to your Kartogo Cash or original payment method. See Your Refunds in Account." }],
  Delivery: [{ q: "What delivery options are there?", a: "Quick delivery in minutes where available, standard same-day slots, and scheduled delivery for furniture and electronics." }],
  Services: [{ q: "Do professionals bring their own kit?", a: "Yes, home professionals carry the tools and products listed under What's included." }, { q: "How do quotes work?", a: "Send your requirements; the provider replies with a quote you can accept from the booking page." }],
  Account: [{ q: "How do I change my address?", a: "Use the location selector on Home or manage addresses in your Profile." }],
};

function HelpPage() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [cat, setCat] = useState<string>("Orders");
  const term = q.trim().toLowerCase();
  const items = term ? Object.entries(FAQ).flatMap(([c, list]) => list.filter(f => `${f.q} ${f.a}`.toLowerCase().includes(term)).map(f => ({ ...f, c }))) : FAQ[cat].map(f => ({ ...f, c: cat }));
  return (
    <div className="min-h-screen bg-background pb-24">
      <PageTop title="Help & Support" back="/menu" />
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        <label className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search help" className="w-full bg-transparent text-sm outline-none" />
        </label>
        {!term && <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">{Object.keys(FAQ).map(c => <button key={c} onClick={() => setCat(c)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${cat === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>{c}</button>)}</div>}
        <div className="divide-y divide-border rounded-2xl border border-border bg-card">
          {items.length === 0 && <div className="p-4 text-sm text-muted-foreground">No answers found. Chat with us below.</div>}
          {items.map(f => (
            <button key={f.q} onClick={() => setOpen(open === f.q ? null : f.q)} className="block w-full p-4 text-left">
              <div className="flex items-center justify-between gap-2 text-sm font-bold">{f.q}<ChevronDown className={`h-4 w-4 shrink-0 transition ${open === f.q ? "rotate-180" : ""}`} /></div>
              {open === f.q && <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Link to="/support" className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"><MessageCircle className="h-4 w-4" />Chat with KARTOGO Support</Link>
          <a href="tel:+919110310034" className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-bold"><Phone className="h-4 w-4" />Call Support</a>
        </div>
      </div>
    </div>
  );
}
