import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Zap, Truck, ShieldCheck } from "lucide-react";
import { Header } from "@/components/Header";

import { ProductCard } from "@/components/ProductCard";
import { CATEGORIES } from "@/lib/data";
import { useCatalog, useAuth, useLocation } from "@/lib/store";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "QuickKart — Ongole's 15-min neighbourhood store" },
      { name: "description", content: "Snacks, pickles, instant food, spices, pooja items, tiffin batter — delivered to your door in 15 minutes across Ongole." },
    ],
  }),
});

function Index() {
  const { user, ready } = useAuth();
  const { location, ready: locReady } = useLocation();
  const nav = useNavigate();
  const { products } = useCatalog();

  useEffect(() => {
    if (ready && !user) {
      nav({ to: "/login" });
    }
  }, [ready, user, nav]);

  if (!ready || !locReady) return null;
  if (!user) return null;
  const bestsellerIds = new Set(products.slice(0, 10).map(p => p.id));
  const local = products.filter(p => ["pickles", "local-snacks", "tiffin-batter", "spice-powders"].includes(p.category)).slice(0, 8);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-cream bg-grain">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 md:grid-cols-2 md:px-6 md:py-16">
          <div className="flex flex-col justify-center">
            <span className="mb-3 inline-flex w-fit items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Zap className="h-3 w-3" /> Delivering in 15 minutes
            </span>
            <h1 className="font-display text-4xl font-bold tracking-tight md:text-6xl">
              Ongole's pantry, <span className="text-primary">at your door.</span>
            </h1>
            <p className="mt-4 max-w-lg text-base text-muted-foreground md:text-lg">
              Avakaya, Guntur chilli, fresh tiffin batter, instant noodles, pooja essentials — the everyday stuff your neighbourhood store carries, now in your phone.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/category/$slug" params={{ slug: "pickles" }} className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90">
                Shop pickles & spices
              </Link>
              <Link to="/category/$slug" params={{ slug: "tiffin-batter" }} className="rounded-xl border border-border bg-card px-5 py-3 text-sm font-bold hover:bg-secondary">
                Fresh tiffin batter
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /> Free delivery over ₹199</div>
              <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Cash & UPI on delivery</div>
            </div>
          </div>
          <div className="relative grid grid-cols-3 gap-3">
            {["🥭", "🌶️", "🪔", "🍜", "🥞", "🧴", "📒", "🥨", "🍿"].map((e, i) => (
              <div key={i} className="grid aspect-square place-items-center rounded-2xl border border-border bg-card text-4xl shadow-pop">{e}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="bg-[#0f6b7a]">
        <div className="mx-auto max-w-7xl px-4 py-3 md:px-6">
          <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CATEGORIES.map(c => (
              <Link key={c.slug} to="/category/$slug" params={{ slug: c.slug }} className="group flex w-16 shrink-0 snap-start flex-col items-center gap-1 md:w-20">
                <div className="text-3xl md:text-4xl transition group-hover:-translate-y-1">{c.emoji}</div>
                <div className="text-center text-[11px] font-bold leading-tight text-white">{c.name}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Local picks */}
      <section className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold md:text-3xl">From Ongole homes</h2>
            <p className="text-sm text-muted-foreground">Pickles, podis and tiffin batter from local makers.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-4">
          {local.map(p => <ProductCard key={p.id} p={p} bestseller={bestsellerIds.has(p.id)} />)}
        </div>
      </section>


      <footer className="mt-12 border-t border-border bg-cream">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground md:px-6">
          <div className="font-display font-bold text-foreground">QuickKart · Ongole, Andhra Pradesh</div>
          <div>© {new Date().getFullYear()} QuickKart. Delivering happiness in 15 minutes.</div>
        </div>
      </footer>
    </div>
  );
}
