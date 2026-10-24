import { Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { listMpCategoriesFn, listCategoryFn } from "@/lib/marketplace.functions";
import { ListingCard, PartnerCard, SkeletonGrid } from "./Cards";
import { sectionCategories, type HomeSection } from "@/lib/home-sections";
import type { MpCategory, MpListing, MpPartner } from "@/lib/marketplace";

const DESIGN = {
  shop: { title: "Shop by category", note: "Groceries, clothes, pharmacy, combos & more", colour: "text-sec-shop", layout: "grid-cols-2 lg:grid-cols-4" },
  health: { title: "Hospitals & Healthcare", note: "Clinics, doctor appointments & lab tests near you", colour: "text-sec-health", layout: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" },
  beauty: { title: "Beauty & Wellness", note: "Salon appointments, spa rituals & beauty at home", colour: "text-sec-beauty", layout: "grid-cols-2 lg:grid-cols-4" },
  home: { title: "Home Services", note: "Cleaning, repairs & care for your home", colour: "text-sec-home", layout: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" },
  events: { title: "Events", note: "Venues, photography & celebrations", colour: "text-sec-events", layout: "grid-cols-2 lg:grid-cols-3" },
};

const TINTS = ["bg-saffron/15", "bg-leaf/15", "bg-primary/10"];

const rememberOrigin = (slug: string) => { try { sessionStorage.setItem(`qk_explore_origin:${slug}`, window.location.pathname + window.location.search); } catch { /* unavailable */ } };

/** Compact, single-row Shop category strip (icon tile + label), scrolls sideways. */
export function ShopCategoryStrip({ term = "" }: { term?: string }) {
  const cats = useQuery({ queryKey: ["mp-cats"], queryFn: () => listMpCategoriesFn(), staleTime: 5 * 60_000 });
  const q = term.trim().toLowerCase();
  const categories = sectionCategories((cats.data?.categories ?? []) as MpCategory[], "shop").filter(c => !q || c.name.toLowerCase().includes(q));
  if (cats.isLoading) return <div className="mt-4 flex gap-4 overflow-hidden">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-[88px] w-[72px] shrink-0 animate-pulse rounded-2xl bg-secondary" />)}</div>;
  return (
    <nav aria-label="Shop categories" className="-mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:gap-5 lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden">
      {categories.map((c, i) => (
        <Link key={c.slug} to="/explore/$slug" params={{ slug: c.slug }} onClick={() => rememberOrigin(c.slug)} className="flex w-[72px] shrink-0 flex-col items-center gap-1.5 text-center sm:w-20">
          <span className={`grid h-16 w-16 place-items-center rounded-2xl text-3xl sm:h-[70px] sm:w-[70px] ${TINTS[i % TINTS.length]}`}>{c.icon}</span>
          <span className="w-full text-[11px] font-semibold leading-tight text-foreground sm:text-xs">{c.name}</span>
        </Link>
      ))}
    </nav>
  );
}

export function HomeMarketplace({ section = "shop", term = "" }: { section?: Exclude<HomeSection, "food" | "rides">; term?: string }) {
  const cats = useQuery({ queryKey: ["mp-cats"], queryFn: () => listMpCategoriesFn(), staleTime: 5 * 60_000 });
  const categories = sectionCategories((cats.data?.categories ?? []) as MpCategory[], section);
  const results = useQueries({ queries: categories.map(c => ({ queryKey: ["mp-category", c.slug], queryFn: () => listCategoryFn({ data: { slug: c.slug } }), staleTime: 60_000 })) });
  const listings = Array.from(new Map(results.flatMap(r => (r.data?.listings ?? []) as MpListing[]).map(l => [l.id, l])).values());
  const partners = Array.from(new Map(results.flatMap(r => (r.data?.partners ?? []) as MpPartner[]).map(p => [p.id, p])).values());
  const q = term.trim().toLowerCase();
  const shown = listings.map(l => ({ ...l, images: l.images?.length ? l.images : [categories.find(c => c.slug === l.category_slug)?.image_url].filter((url): url is string => Boolean(url)) })).filter(l => !q || `${l.name} ${l.description ?? ""} ${l.partner?.name ?? ""}`.toLowerCase().includes(q));
  const stores = partners.filter(p => !q || `${p.name} ${p.description ?? ""}`.toLowerCase().includes(q));
  const d = DESIGN[section];
  const loading = cats.isLoading || results.some(r => r.isLoading);
  const error = cats.isError || results.some(r => r.isError);
  return (
    <section className="py-6" aria-label={d.title}>
      <div className={section === "shop" ? "mb-1" : "mb-5 border-b border-border pb-4"}>
        <h2 className={`font-display text-2xl font-extrabold ${d.colour}`}>{d.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{d.note}</p>
      </div>
      {section === "shop" ? <div className="mb-6"><ShopCategoryStrip term={term} /></div> : <div className={`mb-6 grid gap-3 ${section === "events" ? "grid-cols-2 md:grid-cols-4" : "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6"}`}>
        {categories.filter(c => !q || c.name.toLowerCase().includes(q)).map(c => (
          <Link key={c.slug} to="/explore/$slug" params={{ slug: c.slug }} onClick={() => rememberOrigin(c.slug)} className="overflow-hidden rounded-xl border border-border bg-card">
            {c.image_url ? <img src={c.image_url} alt={c.name} loading="lazy" className={`${section === "events" ? "aspect-[3/2]" : "aspect-square"} w-full object-cover`} /> : <span className="grid aspect-square place-items-center bg-secondary text-4xl">{c.icon}</span>}
            <span className="block px-2 py-3 text-center text-xs font-bold">{c.name}</span>
          </Link>
        ))}
      </div>}
      {loading ? <SkeletonGrid n={4} /> : <>
        {error && <p role="alert" className="py-4 text-sm text-muted-foreground">Couldn't load all listings. Please try again.</p>}
        {shown.length > 0 && <><h3 className="mb-3 font-display text-lg font-extrabold">{section === "shop" ? "Products from local stores" : section === "health" ? "Book a consultation or test" : section === "beauty" ? "Book your next appointment" : section === "home" ? "Services for your home" : "Plan your occasion"}</h3><div className={`grid gap-4 ${d.layout}`}>{shown.map(l => <ListingCard key={l.id} l={l} />)}</div></>}
        {stores.length > 0 && <><h3 className="mb-3 mt-7 font-display text-lg font-extrabold">{section === "shop" ? "Stores" : section === "health" ? "Hospitals, clinics & labs" : section === "beauty" ? "Salons & wellness providers" : section === "home" ? "Service professionals" : "Event partners"}</h3><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{stores.map(p => <PartnerCard key={p.id} p={p} />)}</div></>}
        {!shown.length && !stores.length && !error && <p className="py-6 text-sm text-muted-foreground">{q ? "No matches in this section." : "New listings coming soon."}</p>}
      </>}
    </section>
  );
}
