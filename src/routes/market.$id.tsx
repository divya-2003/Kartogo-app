import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Search, Store, Clock, MapPin, X } from "lucide-react";
import { getPublicMarketFn, type PublicMarket } from "@/lib/partners.functions";
import { useCatalog } from "@/lib/store";
import { ProductCard } from "@/components/ProductCard";
import { CATEGORIES } from "@/lib/data";

export const Route = createFileRoute("/market/$id")({
  component: MarketPage,
  head: () => ({
    meta: [
      { title: "Partnered market — Kartogo" },
      { name: "description", content: "Browse and order items from this Kartogo partnered market in Ongole." },
      { property: "og:title", content: "Partnered market — Kartogo" },
      { property: "og:description", content: "Browse and order items from this Kartogo partnered market in Ongole." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function MarketPage() {
  const { id } = Route.useParams();
  const { products } = useCatalog();
  const [market, setMarket] = useState<PublicMarket | null>(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");

  useEffect(() => {
    let alive = true;
    getPublicMarketFn({ data: { id } })
      .then(m => { if (alive) setMarket(m); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [id]);

  const term = q.trim().toLowerCase();
  const shown = useMemo(() => products.filter(p => {
    if (cat !== "all" && p.category !== cat) return false;
    if (!term) return true;
    return p.name.toLowerCase().includes(term);
  }), [products, cat, term]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="mx-auto max-w-2xl px-4 py-3 lg:max-w-7xl lg:px-8">
          <div className="flex items-center gap-3">
            <Link to="/categories" aria-label="Back" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border hover:bg-secondary">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate font-display text-xl font-bold">{market?.name ?? (error ? "Market unavailable" : "Loading market…")}</h1>
              {market && (
                <div className="flex min-w-0 items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0 text-primary" />
                  <span className="truncate">{market.address}</span>
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search items in this market"
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

      <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-7xl lg:px-8">
        {market && (
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-pop">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10">
              <Store className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0 text-sm">
              <div className="font-display font-extrabold">{market.name}</div>
              <div className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-leaf">
                <Clock className="h-3 w-3" />
                {market.acceptingOrders ? `Orders ready in ~${market.prepMinutes} min` : "Not taking orders right now"}
              </div>
            </div>
          </div>
        )}

        {/* Category filter strip */}
        <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
          <FilterChip active={cat === "all"} onClick={() => setCat("all")} label="All" />
          {CATEGORIES.map(c => (
            <FilterChip key={c.slug} active={cat === c.slug} onClick={() => setCat(c.slug)} label={`${c.emoji} ${c.name}`} />
          ))}
        </div>

        {shown.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No items match your search in this market.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {shown.map(p => <ProductCard key={p.id} p={p} highlight={term || undefined} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold transition ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
