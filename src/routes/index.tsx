import { FoodExperience } from "@/components/marketplace/FoodExperience";
import { RidesExperience } from "@/components/marketplace/RidesExperience";
import { homeRedirectTarget } from "@/lib/portal-mode";
import { useQuery } from "@tanstack/react-query";
import { listMpCategoriesFn } from "@/lib/marketplace.functions";
import { catalogProductInShop } from "@/lib/home-sections";
import type { MpCategory } from "@/lib/marketplace";
import { HomeMarketplace } from "@/components/marketplace/HomeMarketplace";
import { SectionBar, type SectionId } from "@/components/marketplace/SectionBar";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Zap, Search, Wallet, User2, Heart, ShoppingBag, Ticket, Printer, ArrowRight, X } from "lucide-react";
import { deliveryWindow } from "@/lib/serviceability";
import { LocationPicker } from "@/components/LocationPicker";
import { AutoLocationGate } from "@/components/AutoLocationGate";
import { ProductCard } from "@/components/ProductCard";
import { RecommendationRow } from "@/components/RecommendationRow";
import { useRecommendationBundle, useCustomerTracking } from "@/hooks/use-recommendations";
import { formatINR } from "@/lib/data";
import { useCatalog, useAuth, useLocation, useCart, useWallet } from "@/lib/store";
import { COUPONS as PROMO_COUPONS } from "@/lib/promo";
import { Button } from "@/components/ui/button";
import { HomeCategoryStrip, HomeRestaurants } from "@/components/HomeDiscovery";
import wordmark from "@/assets/kartogo-wordmark-transparent.png.asset.json";
import { useTypewriterPlaceholder } from "@/hooks/use-typewriter";
import { isQuickProduct, locationHasQuick } from "@/lib/delivery-tier";


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
      { title: "Kartogo — Your Neighbourhood Marketplace in Ongole" },
      { name: "description", content: "Shop groceries, fashion and electronics, order restaurant food and book health, beauty, home services and events with Kartogo in Ongole." },
      { property: "og:title", content: "Kartogo — Your Neighbourhood Marketplace in Ongole" },
      { property: "og:description", content: "Shop groceries, fashion and electronics, order restaurant food and book health, beauty, home services and events with Kartogo in Ongole." },
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
  const [benefitDismissed, setBenefitDismissed] = useState(false);
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
  const quickAvailable = locationHasQuick(location);
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
  const byId = new Map(tierProducts.map(p => [p.id, p]));
  const displayed = new Set<string>();
  const pickRail = <T extends { productId: string }>(items: T[]) => {
    const selected: T[] = [];
    for (const r of items) {
      const p = byId.get(r.productId);
      if (!p || p.stock <= 0 || displayed.has(p.id)) continue;
      displayed.add(p.id);
      selected.push(r);
      if (selected.length === 8) break;
    }
    return selected;
  };
  const rails = [
    { title: "Recommended for you", items: pickRail(bundle.personalized) },
    { title: "Popular near you", items: pickRail(bundle.popular) },
    { title: "Buy again", items: pickRail([...bundle.replenishment, ...bundle.buyAgain]) },
  ];
  const takeProducts = (predicate: (p: typeof tierProducts[number]) => boolean) => {
    const result = tierProducts.filter(p => !displayed.has(p.id) && p.stock > 0 && predicate(p)).slice(0, 8);
    result.forEach(p => displayed.add(p.id));
    return result;
  };
  const groups = [
    { title: "Best deals", products: takeProducts(p => !!p.mrp && p.mrp > p.price) },
    { title: "Grocery essentials", products: takeProducts(p => isQuickProduct(p)) },
    { title: "Fashion", products: takeProducts(p => ["clothes", "fashion", "clothing"].includes(p.category)) },
    { title: "Electronics & mobiles", products: takeProducts(p => ["electronics", "mobiles", "mobile"].includes(p.category)) },
    { title: "More to explore", products: tierProducts.filter(p => !displayed.has(p.id)) },
  ];
  const categories = (categoriesQuery.data?.categories ?? []) as MpCategory[];
  const offer = COUPONS[0];

  return (
    <div className="home-experience min-h-screen bg-card pb-24">
      <AutoLocationGate />
      <header className="bg-brand-navy text-brand-on-navy">
        <div className="mx-auto max-w-7xl px-3 pb-2 pt-4 sm:px-6 lg:px-8">
          <h1 className="mb-3"><img src={wordmark.url} alt="Kartogo" className="h-7 w-auto object-contain sm:h-9" /></h1>
          <SectionBar value={section} onChange={next => { sessionStorage.setItem("qk_home_section", next); setSection(next); }} />
        </div>
      </header>
      <div className="bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:px-6 lg:px-8">
          <div className="min-w-0 flex-1"><div className="max-w-[260px]"><LocationPicker /></div>
            {location && quickAvailable && <div className="mt-1 flex items-center gap-1 text-xs font-bold sm:text-sm"><Zap className="h-3.5 w-3.5 fill-saffron text-saffron" />Delivery in {deliveryWindow(location.etaMinutes)}</div>}
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {user && <Button asChild variant="ghost" size="natural" className="h-10 gap-1 rounded-full bg-card px-2 text-xs"><Link to="/menu" aria-label="Kartogo Cash wallet"><Wallet className="h-4 w-4 text-primary" /><span className="hidden sm:inline">{formatINR(balance)}</span></Link></Button>}
            <Button asChild variant="ghost" size="icon" className="rounded-full bg-card"><Link to={user ? "/wishlist" : "/login"} search={user ? {} : { redirect: "/wishlist" }} aria-label="Wishlist"><Heart className="h-5 w-5" /></Link></Button>
            <Button asChild variant="ghost" size="icon" className="relative rounded-full bg-card"><Link to="/cart" aria-label={`Cart, ${count} items`}><ShoppingBag className="h-5 w-5" />{count > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">{count}</span>}</Link></Button>
            <Button asChild variant="ghost" size="icon" className="rounded-full bg-card"><Link to="/menu" aria-label="Account"><User2 className="h-5 w-5" /></Link></Button>
          </div>
        </div>
      </div>
      <div className="sticky top-0 z-30 bg-background">
        <div className="mx-auto max-w-7xl px-3 pb-3 pt-1 sm:px-6 lg:px-8">
          <Link to={section === "food" ? "/food" : section === "rides" ? "/rides" : "/search"} search={section === "food" || section === "rides" ? {} : { q: "", section }} className="flex items-center gap-3 rounded-full border border-border bg-card px-4 py-3 shadow-sm" aria-label="Search Kartogo">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" /><span className="truncate text-sm text-muted-foreground">Search for "{typedTerm}"</span>
          </Link>
        </div>
      </div>
      <div className="bg-background"><div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8"><HomeCategoryStrip categories={categories} /></div></div>
      <main className="mx-auto max-w-7xl px-3 pb-24 sm:px-6 lg:px-8">
        {section === "food" ? <FoodExperience embedded /> : section === "rides" ? <RidesExperience embedded /> : section !== "shop" ? <HomeMarketplace section={section} /> : <>
          {offer && <Link to="/cart" className="mt-4 flex items-center justify-between gap-4 rounded-lg bg-sec-food/20 px-5 py-5 text-foreground sm:py-7"><div><p className="text-xs font-semibold text-muted-foreground">Kartogo offers</p><h2 className="mt-1 font-display text-xl font-extrabold sm:text-2xl">{offer.flat} {offer.above}</h2><p className="mt-2 text-xs font-bold text-primary">Use {offer.code}</p></div><Ticket className="h-10 w-10 shrink-0 text-primary" /></Link>}
          {rails.map(r => <RecommendationRow key={r.title} title={r.title} items={r.items} horizontal quickBadgeFor={p => showQuickFlag && isQuickProduct(p)} />)}
          {groups.map(g => g.products.length > 0 && <section key={g.title} className="mt-7"><div className="mb-3 flex items-center justify-between"><h2 className="font-display text-xl font-extrabold">{g.title}</h2><Link to="/categories" className="flex items-center gap-1 text-xs font-bold text-primary">View all <ArrowRight className="h-4 w-4" /></Link></div><div className="home-rail">{g.products.map(p => <ProductCard key={p.id} p={p} quickBadge={showQuickFlag && isQuickProduct(p)} />)}</div></section>)}
          <HomeRestaurants />
          <HomeMarketplace section="shop" preview hideNames={tierProducts.map(p => p.name)} />
          <HomeMarketplace section="health" preview />
          <HomeMarketplace section="beauty" preview />
          <HomeMarketplace section="home" preview />
          <HomeMarketplace section="events" preview />
          <section className="mt-6"><h2 className="mb-3 font-display text-xl font-extrabold">Coupons & offers</h2><div className="home-rail">{COUPONS.map(c => <Link to="/cart" key={c.code} className="rounded-lg border border-leaf/20 bg-leaf/10 p-4"><Ticket className="mb-2 h-5 w-5 text-leaf" /><div className="font-bold">{c.flat}</div><div className="mt-1 text-xs text-muted-foreground">{c.above}</div><div className="mt-3 text-xs font-bold text-primary">{c.code}</div></Link>)}</div></section>
          <Button asChild variant="outline" className="mt-6"><Link to="/print"><Printer className="h-4 w-4" />Kartogo Print Store</Link></Button>
        </>}
      </main>
      {section !== "food" && <div className="pointer-events-none fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-40 px-3">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-2">
          {count > 0 && <Button asChild className="pointer-events-auto h-12 rounded-full px-6 shadow-pop"><Link to="/cart"><ShoppingBag className="h-5 w-5" /><span>View cart · {count} item{count === 1 ? "" : "s"}</span><ArrowRight className="h-5 w-5" /></Link></Button>}
          {section === "shop" && count > 0 && !benefitDismissed && <div className="pointer-events-auto flex w-full items-center gap-3 rounded-full border border-border bg-card px-4 py-2 shadow-sm"><Zap className="h-5 w-5 shrink-0 text-primary" /><p className="flex-1 text-xs font-semibold">{subtotal >= 199 ? "Free grocery delivery unlocked" : `Shop for ${formatINR(199 - subtotal)} more to unlock free grocery delivery`}</p><Button size="icon" variant="ghost" aria-label="Dismiss delivery offer" onClick={() => setBenefitDismissed(true)} className="h-8 w-8 shrink-0 rounded-full"><X className="h-4 w-4" /></Button></div>}
        </div>
      </div>}
    </div>
  );
}
