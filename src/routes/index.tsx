import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Zap, Search, Wallet, User2, Home, LayoutGrid, ShoppingBag, TrendingUp, Ticket } from "lucide-react";
import { LocationPicker } from "@/components/LocationPicker";
import { ProductCard } from "@/components/ProductCard";
import { CATEGORIES, formatINR } from "@/lib/data";
import { useCatalog, useAuth, useLocation, useCart } from "@/lib/store";
import promoBanner from "@/assets/promo-banner.jpg";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Kartigo — Ongole's 15-min neighbourhood store" },
      { name: "description", content: "Snacks, pickles, instant food, spices, pooja items, tiffin batter — delivered to your door in 15 minutes across Ongole." },
    ],
  }),
});

const STORE_TABS = [
  { label: "Kartigo", tag: null, slug: null },
  { label: "Fresh", tag: null, slug: "tiffin-batter" },
  { label: "Pantry", tag: null, slug: "spice-powders" },
  { label: "Pooja", tag: "From ₹35", slug: "pooja" },
];

const COUPONS = [
  { flat: "₹50 OFF", above: "above ₹599" },
  { flat: "₹100 OFF", above: "above ₹1199" },
  { flat: "₹150 OFF", above: "above ₹1799" },
];

function Index() {
  const { user, ready } = useAuth();
  const { ready: locReady, location } = useLocation();
  const nav = useNavigate();
  const { products } = useCatalog();
  const { count, subtotal } = useCart();
  const [q, setQ] = useState("");

  useEffect(() => {
    if (ready && !user) {
      nav({ to: "/login" });
    }
  }, [ready, user, nav]);

  if (!ready || !locReady || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <div className="font-display text-3xl font-bold tracking-tight text-foreground">Kartigo</div>
        <p className="mt-2 text-sm text-muted-foreground">Loading your store…</p>
      </div>
    );
  }

  const bestsellerIds = new Set(products.slice(0, 10).map(p => p.id));
  const local = products.filter(p => ["pickles", "local-snacks", "tiffin-batter", "spice-powders"].includes(p.category)).slice(0, 8);
  const dealProduct = products.find(p => p.mrp && p.mrp > p.price) ?? products[0];

  // Category "Deal Zone" tiles, modelled on the reference grid.
  const tiles = [
    { slug: "snacks", title: "Snacks & More", note: "Starting @ ₹14", emoji: "🍿" },
    { slug: "instant-food", title: "Instant Food", note: "Starting @ ₹14", emoji: "🍜" },
    { slug: "pickles", title: "Pickles & More", note: "Starting @ ₹150", emoji: "🥒" },
    { slug: "pooja", title: "Pooja Items", note: "Starting @ ₹35", emoji: "🪔" },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* ---------- Warm top ---------- */}
      <div className="bg-gradient-to-b from-[oklch(0.9_0.07_70)] to-background">
        <div className="mx-auto max-w-2xl px-4 pt-4">
          {/* row: delivery time + wallet + profile */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-display text-xl font-extrabold tracking-tight text-foreground">
                <Zap className="h-5 w-5 fill-saffron text-saffron" /> 15 minutes
              </div>
              <div className="mt-0.5 max-w-[220px]">
                <LocationPicker />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/cart" className="flex items-center gap-1 rounded-xl bg-card px-3 py-2 text-sm font-bold shadow-pop">
                <Wallet className="h-4 w-4 text-primary" /> {formatINR(subtotal)}
              </Link>
              <Link to="/menu" aria-label="Account" className="grid h-10 w-10 place-items-center rounded-full bg-card shadow-pop">
                <User2 className="h-5 w-5" />
              </Link>
            </div>
          </div>

          {/* store tabs */}
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {STORE_TABS.map((t, i) => (
              <Link
                key={t.label}
                to={t.slug ? "/category/$slug" : "/"}
                params={t.slug ? { slug: t.slug } : undefined}
                className={`flex shrink-0 flex-col items-center justify-center rounded-2xl border px-4 py-2 text-center transition ${
                  i === 0 ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                }`}
              >
                <span className="font-display text-sm font-extrabold leading-tight">{t.label}</span>
                {t.tag && <span className="rounded-full bg-saffron px-1.5 text-[10px] font-bold text-saffron-foreground">{t.tag}</span>}
              </Link>
            ))}
          </div>

          {/* search */}
          <form
            onSubmit={(e) => { e.preventDefault(); nav({ to: "/search", search: { q } }); }}
            className="mt-3 pb-4"
          >
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-pop">
              <Search className="h-5 w-5 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder='Search for "avakaya"'
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </form>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4">
        {/* ---------- Category icon row ---------- */}
        <div className="flex gap-4 overflow-x-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CATEGORIES.map(c => (
            <Link key={c.slug} to="/category/$slug" params={{ slug: c.slug }} className="flex w-16 shrink-0 flex-col items-center gap-1">
              <div className={`grid h-14 w-14 place-items-center rounded-2xl ${c.tint} text-2xl`}>{c.emoji}</div>
              <div className="text-center text-[11px] font-semibold leading-tight">{c.name}</div>
            </Link>
          ))}
        </div>

        {/* ---------- Hero promo banner ---------- */}
        <Link to="/category/$slug" params={{ slug: "pickles" }} className="relative mt-2 block overflow-hidden rounded-3xl">
          <img src={promoBanner} alt="Up to 50% off groceries" width={1280} height={640} className="h-44 w-full object-cover md:h-56" />
          <div className="absolute inset-0 flex flex-col justify-center px-6">
            <span className="font-display text-sm font-bold uppercase tracking-wide text-foreground/70">Up to</span>
            <span className="font-display text-5xl font-extrabold leading-none text-primary md:text-6xl">50% <span className="text-foreground">OFF</span></span>
            <span className="mt-1 text-xs font-semibold text-foreground/70">On pickles, podis & snacks</span>
          </div>
        </Link>

        {/* ---------- Deal tiles grid ---------- */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {/* Big deal-zone card */}
          <Link to="/product/$id" params={{ id: dealProduct.id }} className="row-span-2 flex flex-col overflow-hidden rounded-3xl border border-border bg-card p-3 shadow-pop">
            <div className="font-display text-lg font-extrabold">Deal Zone</div>
            <div className="my-2 grid flex-1 place-items-center">
              {dealProduct.image ? (
                <img src={dealProduct.image} alt={dealProduct.name} loading="lazy" className="h-32 w-32 rounded-2xl object-cover" />
              ) : (
                <div className="text-6xl">{dealProduct.emoji}</div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {dealProduct.mrp && <span className="text-sm text-muted-foreground line-through">{formatINR(dealProduct.mrp)}</span>}
              <span className="font-display text-xl font-extrabold text-primary">{formatINR(dealProduct.price)}</span>
            </div>
          </Link>

          {tiles.map(t => (
            <Link
              key={t.slug}
              to="/category/$slug"
              params={{ slug: t.slug }}
              className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border bg-card p-3 shadow-pop"
            >
              <div className="font-display text-sm font-extrabold leading-tight">{t.title}</div>
              <div className="mt-1 flex items-end justify-between">
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-secondary-foreground">{t.note}</span>
                <span className="text-3xl">{t.emoji}</span>
              </div>
            </Link>
          ))}
        </div>

        {/* ---------- Coupons & offers ---------- */}
        <div className="mt-6">
          <h2 className="font-display text-xl font-extrabold">Coupons & offers</h2>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {COUPONS.map(c => (
              <div key={c.flat} className="flex w-36 shrink-0 flex-col items-center gap-1 rounded-2xl border border-leaf/30 bg-leaf/10 p-3 text-center">
                <Ticket className="h-5 w-5 text-leaf" />
                <div className="text-[11px] font-bold uppercase text-muted-foreground">Flat</div>
                <div className="font-display text-lg font-extrabold text-foreground">{c.flat}</div>
                <div className="rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold">{c.above}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ---------- From Ongole homes ---------- */}
        <div className="mt-6">
          <h2 className="font-display text-xl font-extrabold">From Ongole homes</h2>
          <p className="text-sm text-muted-foreground">Pickles, podis & tiffin batter from local makers.</p>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
            {local.map(p => <ProductCard key={p.id} p={p} bestseller={bestsellerIds.has(p.id)} />)}
          </div>
        </div>

        {/* ---------- Free delivery strip ---------- */}
        <div className="mt-6 flex items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-background">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-background/10">
            <Zap className="h-4 w-4 text-saffron" />
          </div>
          <div>
            <div className="text-sm font-bold">Unlock free delivery</div>
            <div className="text-xs opacity-80">Shop for ₹199</div>
          </div>
        </div>
      </div>

      {/* ---------- Bottom nav ---------- */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-2">
          <Link to="/" className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-bold text-primary">
            <Home className="h-5 w-5" /> Home
          </Link>
          <Link to="/menu" className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-bold text-muted-foreground">
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
