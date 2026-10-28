import { FoodExperience } from "@/components/marketplace/FoodExperience";
import { RidesExperience } from "@/components/marketplace/RidesExperience";
import { homeRedirectTarget } from "@/lib/portal-mode";
import { useQuery } from "@tanstack/react-query";
import { listMpCategoriesFn } from "@/lib/marketplace.functions";
import { catalogProductInShop } from "@/lib/home-sections";
import type { MpCategory } from "@/lib/marketplace";
import { HomeMarketplace } from "@/components/marketplace/HomeMarketplace";
import { BottomNav } from "@/components/marketplace/BottomNav";
import { SectionBar, type SectionId } from "@/components/marketplace/SectionBar";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Zap, Search, Wallet, User2, Home, LayoutGrid, ShoppingBag, TrendingUp, Ticket, CheckCircle2, Printer } from "lucide-react";
import { deliveryWindow, isQuickArea } from "@/lib/serviceability";
import { LocationPicker } from "@/components/LocationPicker";
import { AutoLocationGate } from "@/components/AutoLocationGate";
import { ProductCard } from "@/components/ProductCard";
import { RecommendationRow } from "@/components/RecommendationRow";
import { useRecommendationBundle, useCustomerTracking } from "@/hooks/use-recommendations";
import { formatINR } from "@/lib/data";
import { useCatalog, useAuth, useLocation, useCart, useWallet } from "@/lib/store";
import { COUPONS as PROMO_COUPONS } from "@/lib/promo";
import { toast } from "sonner";
import { useTypewriterPlaceholder } from "@/hooks/use-typewriter";
import { isQuickProduct } from "@/lib/delivery-tier";


const HOME_SEARCH_TERMS = ["milk", "haircut", "avakaya", "AC service", "sofa", "birthday decoration", "paneer"];

const SECTION_SEARCH: Partial<Record<SectionId, string[]>> = {
  shop: ["milk", "avakaya", "paneer", "bread", "agarbatti"],
  food: ["biryani", "idli", "dosa", "cake", "meals"],
  health: ["doctor appointment", "blood test", "clinic", "full body checkup"],
  beauty: ["haircut", "facial", "spa", "bridal makeup"],
  home: ["AC service", "plumber", "cleaning", "electrician"],
  events: ["birthday decoration", "photographer", "DJ", "catering"],
};

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Kartogo — Groceries, Food & Essentials Delivered Fast in Ongole" },
      { name: "description", content: "Order groceries, snacks, homemade pickles, tiffin batter and daily essentials on Kartogo with 15-minute quick delivery or scheduled slots across Ongole, Andhra Pradesh." },
      { property: "og:title", content: "Kartogo — Groceries, Food & Essentials Delivered Fast in Ongole" },
      { property: "og:description", content: "Order groceries, snacks, homemade pickles, tiffin batter and daily essentials on Kartogo with 15-minute quick delivery or scheduled slots across Ongole, Andhra Pradesh." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

/** Detects a saved admin/delivery/supplier session and returns where to send the user. */
function roleRedirectTarget() {
  // Only an explicit "shop as a customer" choice made during this app run keeps
  // a partner on the customer home; reopening the app always opens the portal.
  return homeRedirectTarget();
}




// Derived from the single shared coupon table so the storefront never shows an
// offer the checkout engine would reject.
const COUPONS = Object.entries(PROMO_COUPONS).map(([code, c]) => ({
  code,
  flat: `₹${c.value} OFF`,
  above: `above ₹${c.minSubtotal}`,
}));

function Index() {
  const { ready, user } = useAuth();
  const { ready: locReady, location } = useLocation();
  const nav = useNavigate();
  const { products: catalogProducts } = useCatalog();
  const categoriesQuery = useQuery({ queryKey: ["mp-cats"], queryFn: () => listMpCategoriesFn(), staleTime: 5 * 60_000 });
  const products = catalogProducts.filter(p => catalogProductInShop(p, (categoriesQuery.data?.categories ?? []) as MpCategory[]));
  const [section, setSection] = useState<SectionId>("shop");
  useEffect(() => {
    const saved = sessionStorage.getItem("qk_home_section");
    if (["shop", "food", "health", "rides", "beauty", "home", "events"].includes(saved ?? "")) setSection(saved as SectionId);
  }, []);
  const typedTerm = useTypewriterPlaceholder(SECTION_SEARCH[section] ?? HOME_SEARCH_TERMS);
  const { count, subtotal } = useCart();
  const { balance } = useWallet();
  const { bundle } = useRecommendationBundle(8);
  const track = useCustomerTracking();

  useEffect(() => {
    track.trackAppOpened();
    track.trackHomeViewed();
  }, [track]);
  
  // Delivery partners / admins who reopen the app land on this default URL — send
  // them to their own portal instead of the customer home page.
  const [roleTarget] = useState(roleRedirectTarget);

  // Quick (30-minute) delivery only exists in designated quick-service areas.
  // Shop is one page: every product is listed once, and customers inside a
  // Quick area see a Quick tag on the items that can arrive fast.
  const quickAvailable = !!location?.serviceable && isQuickArea(location.query || location.area);
  useEffect(() => {
    // Legacy "Go to standard" choice from the unserviceable screen — Shop no
    // longer splits by tier, so just clear it.
    try { localStorage.removeItem("qk_service_tier"); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (roleTarget) nav({ to: roleTarget, replace: true });
  }, [roleTarget, nav]);

  if (roleTarget || !ready || !locReady) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <div className="font-display text-3xl font-bold tracking-tight text-foreground">Kartogo</div>
        <p className="mt-2 text-sm text-muted-foreground">Loading your store…</p>
      </div>
    );
  }


  // One de-duplicated list of every Shop product (same id or same name counts as one).
  const seenProduct = new Set<string>();
  const tierProducts = products.filter(p => {
    const key = p.name.trim().toLowerCase();
    if (seenProduct.has(p.id) || seenProduct.has(key)) return false;
    seenProduct.add(p.id); seenProduct.add(key);
    return true;
  });
  const showQuickFlag = quickAvailable;
  const bestsellerIds = new Set(tierProducts.slice(0, 10).map(p => p.id));
  const dealProduct = tierProducts.find(p => p.mrp && p.mrp > p.price) ?? tierProducts[0];


  // Recommendation rails, then the full product list — a product shows up in
  // only one place on the page (Deal Zone, one rail, or the product list).
  const byId = new Map(tierProducts.map(p => [p.id, p]));
  const railShown = new Set<string>();
  if (dealProduct) railShown.add(dealProduct.id);
  const pickRail = (items: typeof bundle.personalized) => {
    const out: typeof items = [];
    for (const r of items) {
      const p = byId.get(r.productId);
      if (!p || p.stock <= 0 || railShown.has(r.productId)) continue;
      railShown.add(r.productId);
      out.push(r);
      if (out.length >= 8) break;
    }
    return out;
  };
  const rails = [
    { title: "Reorder", subtitle: "Your regulars and past favourites, ready to add again.", items: pickRail([...bundle.replenishment, ...bundle.buyAgain]) },
    { title: "Recommended for you", subtitle: "Picked from what you browse and buy.", items: pickRail(bundle.personalized) },
    { title: "Frequently bought together", subtitle: "Shoppers usually add these alongside your picks.", items: pickRail(bundle.frequentlyBoughtTogether) },
    { title: "Popular near you", subtitle: "Trending with Ongole shoppers this week.", items: pickRail(bundle.popular) },
  ];
  const remainingProducts = tierProducts.filter(p => !railShown.has(p.id));


  // Category "Deal Zone" tiles, modelled on the reference grid.
  const tiles = [
    { slug: "snacks", title: "Snacks & More", note: "Starting @ ₹14", emoji: "🍿", tint: "bg-saffron/15" },
    { slug: "instant-food", title: "Instant Food", note: "Starting @ ₹14", emoji: "🍜", tint: "bg-primary/10" },
    { slug: "pickles", title: "Pickles & More", note: "Starting @ ₹150", emoji: "🥒", tint: "bg-leaf/15" },
    { slug: "pooja", title: "Pooja Items", note: "Starting @ ₹35", emoji: "🪔", tint: "bg-saffron/25" },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <AutoLocationGate />
      <h1 className="sr-only">Kartogo — Ongole's 15-minute neighbourhood store</h1>
      {/* The top area scrolls naturally; only the search remains sticky. */}
      <div className="bg-gradient-to-b from-saffron/20 to-background">

        <div className="mx-auto max-w-2xl px-4 pt-4 lg:max-w-7xl lg:px-8">
          {/* row: delivery time + wallet + profile */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="min-w-0">
              {location && (
                <>
                  <div className="flex items-center gap-1.5 font-display text-lg font-extrabold leading-tight tracking-tight text-foreground sm:text-xl">
                    <Zap className="h-5 w-5 shrink-0 fill-saffron text-saffron" />
                    <span className="min-w-0 truncate">Delivery in {deliveryWindow(location.etaMinutes)}</span>
                  </div>
                  <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-leaf/10 px-2 py-0.5 text-[11px] font-bold text-leaf">
                    <CheckCircle2 className="h-3 w-3 shrink-0" /> Delivery available
                  </div>
                </>
              )}
              <div className="mt-0.5 w-full max-w-[220px]">
                <LocationPicker />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link to="/menu" aria-label="Kartogo Cash wallet" className="flex items-center gap-1 rounded-xl bg-card px-3 py-2 text-sm font-bold shadow-pop">
                <Wallet className="h-4 w-4 shrink-0 text-primary" /> {formatINR(balance)}
              </Link>
              <Link to="/menu" aria-label={user ? "Account" : "Login or register"} className={`flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-card px-3 shadow-pop ${user ? "w-10" : "min-w-0"}`}>
                <User2 className="h-5 w-5 shrink-0" />
                {!user && <span className="hidden text-xs font-extrabold sm:inline">Login / Register</span>}
              </Link>
            </div>
          </div>


          <SectionBar value={section} onChange={next => { sessionStorage.setItem("qk_home_section", next); setSection(next); }} />

          {section === "shop" && quickAvailable && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-saffron/15 px-3 py-1 text-xs font-bold text-foreground">
              <Zap className="h-3.5 w-3.5 shrink-0 fill-saffron text-saffron" /> Quick delivery available — look for the Quick tag
            </div>
          )}
        </div>
      </div>

      <div className="sticky top-0 z-30 bg-background shadow-sm">
        <div className="mx-auto max-w-2xl px-4 lg:max-w-7xl lg:px-8">
          {/* search — opens the full Trending / search page */}
          <Link to={(section === "rides" ? "/rides" : section === "food" ? "/food" : "/search") as never} search={(section === "rides" || section === "food" ? {} : { q: "", section }) as never} className="mt-3 block pb-4">
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-pop">
              <Search className="h-5 w-5 text-muted-foreground" />
              <span className="w-full truncate text-left text-sm text-muted-foreground">
                {section === "rides" ? "Where do you want to go?" : `Search for "${typedTerm}"`}
              </span>

            </div>
          </Link>

        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pb-56 lg:max-w-7xl lg:px-8">
        {section === "food" ? <FoodExperience embedded /> : section === "rides" ? <RidesExperience embedded /> : section !== "shop" ? <HomeMarketplace section={section} /> : <>
        {/* ---------- Categories + store listings (catalog duplicates hidden) ---------- */}
        <HomeMarketplace section="shop" hideNames={tierProducts.map(p => p.name)} />

        {/* ---------- Deal tiles grid ---------- */}
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {/* Big deal-zone card */}
          {dealProduct && <Link to="/product/$id" params={{ id: dealProduct.id }} className="row-span-2 flex flex-col overflow-hidden rounded-3xl border border-border bg-card p-3 shadow-pop">
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
          </Link>}

          {tiles.map(t => (
            <Link
              key={t.slug}
              to="/category/$slug"
              params={{ slug: t.slug }}
              className={`relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border p-3 shadow-pop ${t.tint}`}
            >
              <div className="font-display text-sm font-extrabold leading-tight">{t.title}</div>
              <div className="mt-1 flex items-end justify-between">
                <span className="rounded-full bg-card/80 px-2 py-0.5 text-[11px] font-bold text-foreground">{t.note}</span>
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
              <div key={c.code} className="flex w-40 shrink-0 flex-col items-center gap-1 rounded-2xl border border-leaf/30 bg-leaf/10 p-3 text-center">
                <Ticket className="h-5 w-5 text-leaf" />
                <div className="text-[11px] font-bold uppercase text-muted-foreground">Flat</div>
                <div className="font-display text-lg font-extrabold text-foreground">{c.flat}</div>
                <div className="rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold">{c.above}</div>
                <div className="text-[11px] font-bold tracking-wide text-primary">Code: {c.code}</div>

              </div>
            ))}
          </div>
        </div>


        {/* ---------- Personalised recommendations (real behaviour, never mock) ---------- */}
        {rails.map(r => (
          <RecommendationRow key={r.title} title={r.title} subtitle={r.subtitle} items={r.items} quickBadgeFor={p => showQuickFlag && isQuickProduct(p)} />
        ))}

        {/* ---------- Every Shop product, listed exactly once ---------- */}
        {remainingProducts.length > 0 && (
          <div className="mt-6">
            <h2 className="font-display text-xl font-extrabold">{railShown.size ? "More to explore" : "All products"}</h2>
            <p className="text-sm text-muted-foreground">
              {showQuickFlag ? "Quick items arrive in minutes; the rest come by Standard delivery today." : "Delivered by Standard delivery today."}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              {remainingProducts.map(p => <ProductCard key={p.id} p={p} bestseller={bestsellerIds.has(p.id)} quickBadge={showQuickFlag && isQuickProduct(p)} />)}
            </div>
          </div>
        )}

        <Link to="/print" className="mt-5 flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-pop"><Printer className="h-5 w-5 text-primary" /><span className="flex-1 text-sm font-bold">Kartogo Print Store</span></Link>
        </>}




      </div>

      {/* ---------- Floating free-delivery + cart bar ---------- */}
      {section === "shop" && <div className="pointer-events-none fixed inset-x-0 bottom-[72px] z-40 px-4">
        <div className="mx-auto flex max-w-2xl items-stretch gap-2 lg:max-w-7xl">
          <div className="pointer-events-auto flex flex-1 items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-background shadow-pop">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-background/10">
              <Zap className="h-4 w-4 text-saffron" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">
                {subtotal >= 199 ? "Free delivery unlocked 🎉" : "Unlock free delivery"}
              </div>
              <div className="truncate text-xs opacity-80">
                {subtotal >= 199 ? "Applied to this order" : `Shop for ${formatINR(199 - subtotal)} more`}
              </div>
            </div>
          </div>

          {count > 0 && (
            <Link
              to="/cart"
              className="pointer-events-auto flex shrink-0 items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-primary-foreground shadow-pop hover:bg-primary/90"
            >
              <ShoppingBag className="h-5 w-5" />
              <div className="leading-tight">
                <div className="text-sm font-bold">Cart</div>
                <div className="text-xs opacity-90">{count} item{count > 1 ? "s" : ""}</div>
              </div>
            </Link>
          )}
        </div>
      </div>
      }
      <BottomNav />
    </div>
  );
}
