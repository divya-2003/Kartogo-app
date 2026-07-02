import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Home, LayoutGrid, TrendingUp, ShoppingBag } from "lucide-react";
import { CATEGORIES } from "@/lib/data";
import { useCatalog, useCart } from "@/lib/store";

export const Route = createFileRoute("/categories")({
  component: CategoriesPage,
  head: () => ({
    meta: [
      { title: "All Categories — Kartogo Ongole" },
      { name: "description", content: "Browse all Kartogo categories — snacks, pickles, instant food, spices, pooja items, tiffin batter, pharmacy and more, delivered in 15 minutes across Ongole." },
    ],
  }),
});

function CategoriesPage() {
  const { products } = useCatalog();
  const { count } = useCart();

  const countFor = (slug: string) => products.filter(p => p.category === slug).length;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Top bar */}
      <div className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 lg:max-w-7xl lg:px-8">
          <Link to="/" aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-secondary">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display text-xl font-bold">All Categories</h1>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-5 lg:max-w-7xl lg:px-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.map(c => {
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
      </div>

      {/* Bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-2 lg:max-w-7xl">
          <Link to="/" className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-bold text-muted-foreground">
            <Home className="h-5 w-5" /> Home
          </Link>
          <Link to="/categories" className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-bold text-primary">
            <LayoutGrid className="h-5 w-5" /> Categories
          </Link>
          <Link to="/search" search={{ q: "" }} className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-bold text-muted-foreground">
            <TrendingUp className="h-5 w-5" /> Trending
          </Link>
          <Link to="/cart" className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-bold text-muted-foreground">
            <span className="relative">
              <ShoppingBag className="h-5 w-5" />
              {count > 0 && (
                <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-saffron px-1 text-[10px] text-saffron-foreground">{count}</span>
              )}
            </span>
            Cart
          </Link>
        </div>
      </nav>
    </div>
  );
}
