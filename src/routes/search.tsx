import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, Home, LayoutGrid, TrendingUp, Printer, Search, Flame, X } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { useCatalog } from "@/lib/store";
import { z } from "zod";

const SearchSchema = z.object({ q: z.string().optional().default("") });

export const Route = createFileRoute("/search")({
  validateSearch: SearchSchema,
  component: SearchPage,
  head: () => ({
    meta: [
      { title: "Trending — Kartogo Ongole" },
      { name: "description", content: "Trending deals and best-sellers on Kartogo — snacks, pickles, instant food, spices and more, delivered in 15 minutes across Ongole." },
    ],
  }),
});

function SearchPage() {
  const { q } = Route.useSearch();
  const { products } = useCatalog();
  const nav = useNavigate();
  const [input, setInput] = useState(q ?? "");

  // keep the input box in sync when the URL query changes (e.g. tapping Trending)
  useEffect(() => { setInput(q ?? ""); }, [q]);

  const query = q.trim().toLowerCase();
  const results = query
    ? products.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query),
      )
    : [];

  // Trending = hottest deals first (biggest discount %), then best-sellers fill the grid
  const bestsellerIds = new Set(products.slice(0, 10).map(p => p.id));
  const trending = [...products]
    .map(p => ({ p, discount: p.mrp ? 1 - p.price / p.mrp : 0 }))
    .sort((a, b) => b.discount - a.discount || (bestsellerIds.has(b.p.id) ? 1 : 0) - (bestsellerIds.has(a.p.id) ? 1 : 0))
    .slice(0, 10)
    .map(x => x.p);

  const submitSearch = (value: string) => {
    setInput(value);
    nav({ to: "/search", search: { q: value }, replace: true });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* ---------- Sticky top bar + search ---------- */}
      <div className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 lg:max-w-7xl lg:px-8">
          <Link to="/" aria-label="Back" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border hover:bg-secondary">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display text-xl font-bold">Trending</h1>
        </div>
        <div className="mx-auto max-w-2xl px-4 pb-3 lg:max-w-7xl lg:px-8">
          <form onSubmit={(e) => { e.preventDefault(); submitSearch(input); }}>
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-pop">
              <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
              <input
                value={input}
                onChange={(e) => submitSearch(e.target.value)}
                placeholder='Search for "avakaya"'
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                aria-label="Search products"
              />
              {input && (
                <button type="button" onClick={() => submitSearch("")} aria-label="Clear search" className="shrink-0 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-5 lg:max-w-7xl lg:px-8">
        {query ? (
          <>
            <h2 className="font-display text-xl font-extrabold">
              Results for "<span className="text-primary">{q}</span>"
            </h2>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              {results.length} item{results.length === 1 ? "" : "s"} found
            </p>
            {results.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
                Nothing matched. Try a different word.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
                {results.map(p => <ProductCard key={p.id} p={p} />)}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 fill-saffron text-saffron" />
              <h2 className="font-display text-xl font-extrabold">Trending now</h2>
            </div>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              Hottest deals flying off the shelves in Ongole.
            </p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
              {trending.map(p => <ProductCard key={p.id} p={p} bestseller={bestsellerIds.has(p.id)} />)}
            </div>
          </>
        )}
      </div>

      {/* ---------- Bottom nav ---------- */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-2 lg:max-w-7xl">
          <Link to="/" className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-bold text-muted-foreground">
            <Home className="h-5 w-5" /> Home
          </Link>
          <Link to="/categories" className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-bold text-muted-foreground">
            <LayoutGrid className="h-5 w-5" /> Categories
          </Link>
          <Link to="/search" search={{ q: "" }} className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-bold text-primary">
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
