import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Home, LayoutGrid, TrendingUp, Printer, Search, Store, Clock, MapPin } from "lucide-react";
import { CATEGORIES } from "@/lib/data";
import { useCatalog } from "@/lib/store";
import { listPublicMarketsFn } from "@/lib/partners.functions";

export const Route = createFileRoute("/categories")({
  component: CategoriesPage,
  head: () => ({
    meta: [
      { title: "Partnered Stores & Categories — Kartogo Ongole" },
      { name: "description", content: "Browse Kartogo's partnered supermarkets in Ongole and shop by category — snacks, pickles, spices, pooja items, pharmacy and more, delivered in 15 minutes." },
      { property: "og:title", content: "Partnered Stores & Categories — Kartogo" },
      { property: "og:description", content: "Pick your favourite Ongole store or shop by category on Kartogo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function CategoriesPage() {
  const { products } = useCatalog();
  const [q, setQ] = useState("");

  const { data: markets = [], isLoading } = useQuery({
    queryKey: ["public-markets"],
    queryFn: () => listPublicMarketsFn(),
  });

  const term = q.trim().toLowerCase();
  const countFor = (slug: string) => products.filter((p) => p.category === slug).length;

  const shownMarkets = useMemo(
    () =>
      !term
        ? markets
        : markets.filter((m) => `${m.name} ${m.address}`.toLowerCase().includes(term)),
    [markets, term],
  );
  const shownCategories = useMemo(
    () => (!term ? CATEGORIES : CATEGORIES.filter((c) => c.name.toLowerCase().includes(term))),
    [term],
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Top bar */}
      <div className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="mx-auto max-w-2xl px-4 py-3 lg:max-w-7xl lg:px-8">
          <div className="flex items-center gap-3">
            <Link to="/" aria-label="Back" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border hover:bg-secondary">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <h1 className="font-display text-xl font-bold">Stores & Categories</h1>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-input bg-card px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search stores or categories"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-5 lg:max-w-7xl lg:px-8">
        {/* Partnered stores */}
        <h2 className="font-display text-base font-extrabold">Partnered stores</h2>
        <p className="text-xs font-semibold text-muted-foreground">Shop from the store you like</p>

        {isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading stores…</p>
        ) : shownMarkets.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            No stores match "{q}".
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shownMarkets.map((m) => (
              <Link
                key={m.id}
                to="/market/$id"
                params={{ id: m.id }}
                className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-pop transition hover:bg-secondary"
              >
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/15">
                  <Store className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-sm font-extrabold leading-tight">{m.name}</div>
                  <div className="mt-0.5 flex items-start gap-1 text-[11px] font-semibold text-muted-foreground">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                    <span className="line-clamp-2">{m.address}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-bold">
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">
                      <Clock className="h-3 w-3" /> ~{m.prepMinutes} min
                    </span>
                    <span className={`rounded-full px-2 py-0.5 ${m.acceptingOrders ? "bg-leaf/20 text-leaf-foreground" : "bg-destructive/15 text-destructive"}`}>
                      {m.acceptingOrders ? "Open" : "Paused"}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Categories */}
        <h2 className="mt-7 font-display text-base font-extrabold">All categories</h2>
        {shownCategories.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            No categories match "{q}".
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {shownCategories.map((c) => {
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
            <LayoutGrid className="h-5 w-5" /> Stores
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
