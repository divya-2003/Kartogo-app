import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Home, LayoutGrid, TrendingUp, Printer, Search, Store, Clock, X } from "lucide-react";
import { CATEGORIES } from "@/lib/data";
import { useCatalog } from "@/lib/store";
import { listPublicMarketsFn, type PublicMarket } from "@/lib/partners.functions";

export const Route = createFileRoute("/categories")({
  component: CategoriesPage,
  head: () => ({
    meta: [
      { title: "Markets & Categories — Kartogo Ongole" },
      { name: "description", content: "Shop from Kartogo's partnered supermarkets in Ongole or browse categories — snacks, pickles, instant food, spices, pooja items, pharmacy and more." },
      { property: "og:title", content: "Markets & Categories — Kartogo Ongole" },
      { property: "og:description", content: "Pick a partnered market near you or browse Kartogo categories, delivered fast across Ongole." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function CategoriesPage() {
  const { products } = useCatalog();
  const [markets, setMarkets] = useState<PublicMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    listPublicMarketsFn()
      .then(rows => { if (alive) setMarkets(rows); })
      .catch(() => { if (alive) setMarkets([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const term = q.trim().toLowerCase();

  const shownMarkets = useMemo(
    () => (term ? markets.filter(m => `${m.name} ${m.address}`.toLowerCase().includes(term)) : markets),
    [markets, term],
  );
  const shownCategories = useMemo(
    () => (term ? CATEGORIES.filter(c => c.name.toLowerCase().includes(term)) : CATEGORIES),
    [term],
  );

  const countFor = (slug: string) => products.filter(p => p.category === slug).length;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Top bar */}
      <div className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="mx-auto max-w-2xl px-4 py-3 lg:max-w-7xl lg:px-8">
          <div className="flex items-center gap-3">
            <Link to="/" aria-label="Back" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border hover:bg-secondary">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <h1 className="font-display text-xl font-bold">Markets & Categories</h1>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search markets or categories"
              className="w-full bg-transparent text-base outline-none"
            />
            {q && (
              <button aria-label="Clear" onClick={() => setQ("")} className="grid h-6 w-6 shrink-0 place-items-center rounded-full hover:bg-secondary">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-5 lg:max-w-7xl lg:px-8">
        {/* Partnered markets */}
        <h2 className="flex items-center gap-2 font-display text-lg font-extrabold">
          <Store className="h-5 w-5 text-primary" /> Partnered markets
        </h2>
        <p className="mt-0.5 text-xs font-semibold text-muted-foreground">Shop from the store you like best.</p>

        {loading ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading markets…</p>
        ) : shownMarkets.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            {term ? "No markets match your search." : "No partnered markets yet."}
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shownMarkets.map(m => (
              <Link
                key={m.id}
                to="/market/$id"
                params={{ id: m.id }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-pop transition hover:bg-secondary"
              >
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10">
                  <Store className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="truncate font-display text-sm font-extrabold leading-tight">{m.name}</div>
                  <div className="truncate text-[11px] font-semibold text-muted-foreground">{m.address}</div>
                  <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-leaf">
                    <Clock className="h-3 w-3" />
                    {m.acceptingOrders ? `Ready in ~${m.prepMinutes} min` : "Currently paused"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Categories */}
        <h2 className="mt-8 flex items-center gap-2 font-display text-lg font-extrabold">
          <LayoutGrid className="h-5 w-5 text-primary" /> All categories
        </h2>
        {shownCategories.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">No categories match your search.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {shownCategories.map(c => {
              const n = countFor(c.slug);
              return (
                <Link
                  key={c.slug}
                  to="/category/$slug"
                  params={{ slug: c.slug }}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-pop transition hover:bg-secondary"
                >
                  <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${c.tint} text-2xl`}>{c.emoji}</div>
                  <div className="min-w-0">
                    <div className="truncate font-display text-sm font-extrabold leading-tight">{c.name}</div>
                    <div className="text-[11px] font-semibold text-muted-foreground">{n} item{n === 1 ? "" : "s"}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-2 lg:max-w-7xl">
          <Link to="/" className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-bold text-muted-foreground">
            <Home className="h-5 w-5" /> Home
          </Link>
          <Link to="/categories" className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-bold text-primary">
            <LayoutGrid className="h-5 w-5" /> Markets
          </Link>
          <Link to="/search" search={{ q: "" }} className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-bold text-muted-foreground">
            <TrendingUp className="h-5 w-5" /> Trending
          </Link>
          <Link to="/print" className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-bold text-muted-foreground">
            <Printer className="h-5 w-5" /> Print Store
          </Link>
        </div>
      </nav>
    </div>
  );
}
