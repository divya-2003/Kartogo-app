import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Clock, MapPin, Search, Store } from "lucide-react";
import { CATEGORIES } from "@/lib/data";
import { useCatalog } from "@/lib/store";
import { listPublicMarketsFn } from "@/lib/partners.functions";
import { ProductCard } from "@/components/ProductCard";

export const Route = createFileRoute("/market/$id")({
  component: MarketPage,
  head: () => ({
    meta: [
      { title: "Partnered Store — Kartogo Ongole" },
      { name: "description", content: "Browse products from this Kartogo partnered supermarket in Ongole and get them delivered in minutes." },
      { property: "og:title", content: "Partnered Store — Kartogo" },
      { property: "og:description", content: "Shop from your favourite Ongole store on Kartogo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function MarketPage() {
  const { id } = Route.useParams();
  const { products } = useCatalog();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");

  const { data: markets = [], isLoading } = useQuery({
    queryKey: ["public-markets"],
    queryFn: () => listPublicMarketsFn(),
  });
  const market = markets.find((m) => m.id === id) ?? null;

  const term = q.trim().toLowerCase();
  const shown = useMemo(
    () =>
      products.filter(
        (p) =>
          (cat === "all" || p.category === cat) &&
          (!term || `${p.name} ${p.description}`.toLowerCase().includes(term)),
      ),
    [products, cat, term],
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="mx-auto max-w-2xl px-4 py-3 lg:max-w-7xl lg:px-8">
          <div className="flex items-center gap-3">
            <Link to="/categories" aria-label="Back" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border hover:bg-secondary">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <h1 className="truncate font-display text-lg font-bold">{market?.name ?? (isLoading ? "Loading…" : "Store")}</h1>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-input bg-card px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search items in this store"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-5 lg:max-w-7xl lg:px-8">
        {market && (
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-pop">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/15">
              <Store className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-sm font-extrabold">{market.name}</div>
              <div className="mt-0.5 flex items-start gap-1 text-[11px] font-semibold text-muted-foreground">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{market.address}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-bold">
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">
                  <Clock className="h-3 w-3" /> ~{market.prepMinutes} min prep
                </span>
                <span className={`rounded-full px-2 py-0.5 ${market.acceptingOrders ? "bg-leaf/20 text-leaf-foreground" : "bg-destructive/15 text-destructive"}`}>
                  {market.acceptingOrders ? "Taking orders" : "Paused"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Category strip */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setCat("all")}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${cat === "all" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.slug}
              onClick={() => setCat(c.slug)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${cat === c.slug ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}
            >
              {c.emoji} {c.name}
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No items found in this store.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {shown.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
