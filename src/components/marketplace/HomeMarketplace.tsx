import { Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { listMpCategoriesFn, listCategoryFn } from "@/lib/marketplace.functions";
import { ListingCard, PartnerCard, SkeletonGrid } from "./Cards";
import { sectionCategories, type HomeSection } from "@/lib/home-sections";
import type { MpCategory, MpListing, MpPartner } from "@/lib/marketplace";
import { listCategoryRanksFn } from "@/lib/category-ranks.functions";
import { listingRef, rankLookup, sortByRank } from "@/lib/category-ranks";
import { TopPick } from "@/components/TopPick";

const DESIGN = {
  shop: { title: "Shop by category", note: "Groceries, clothes, pharmacy, combos & more", colour: "text-sec-shop", layout: "grid-cols-2 lg:grid-cols-4" },
  health: { title: "Hospitals & Healthcare", note: "Clinics, doctor appointments & lab tests near you", colour: "text-sec-health", layout: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" },
  beauty: { title: "Beauty & Wellness", note: "Salon appointments, spa rituals & beauty at home", colour: "text-sec-beauty", layout: "grid-cols-2 lg:grid-cols-4" },
  home: { title: "Home Services", note: "Cleaning, repairs & care for your home", colour: "text-sec-home", layout: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" },
  events: { title: "Events", note: "Venues, photography & celebrations", colour: "text-sec-events", layout: "grid-cols-2 lg:grid-cols-3" },
};

const TINTS = ["bg-saffron/15", "bg-leaf/15", "bg-primary/10"];

const rememberOrigin = (slug: string) => { try { sessionStorage.setItem(`qk_explore_origin:${slug}`, window.location.pathname + window.location.search); } catch { /* unavailable */ } };

/**
 * Shop category bar: one row that scrolls sideways on phones (and on any
 * screen where the categories don't fit), so new categories always have room.
 * Every column is the same width — the width the longest one-line name needs —
 * so all icons are equal squares and every name stays on one line.
 */
export function ShopCategoryStrip({ term = "" }: { term?: string }) {
  const cats = useQuery({ queryKey: ["mp-cats"], queryFn: () => listMpCategoriesFn(), staleTime: 5 * 60_000 });
  const q = term.trim().toLowerCase();
  const categories = sectionCategories((cats.data?.categories ?? []) as MpCategory[], "shop").filter(c => !q || c.name.toLowerCase().includes(q));
  const row = "grid w-max min-w-full grid-flow-col auto-cols-[minmax(64px,1fr)] gap-x-2 sm:auto-cols-[minmax(84px,1fr)] sm:gap-x-3";
  if (cats.isLoading) return <div className="-mx-4 overflow-hidden px-4"><div className={row}>{Array.from({ length: 9 }).map((_, i) => <div key={i} className="mx-auto aspect-square w-full max-w-[84px] animate-pulse rounded-2xl bg-secondary" />)}</div></div>;
  return (
    <div className="-mx-4 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <nav aria-label="Shop categories" className={row}>
        {categories.map((c, i) => (
          <Link key={c.slug} to="/explore/$slug" params={{ slug: c.slug }} onClick={() => rememberOrigin(c.slug)} className="flex min-w-0 flex-col items-center gap-1 text-center">
            <span className={`grid aspect-square w-full max-w-[84px] place-items-center rounded-2xl text-2xl sm:text-3xl ${TINTS[i % TINTS.length]}`}>{c.icon}</span>
            <span className="whitespace-nowrap px-0.5 text-[11px] font-semibold leading-tight text-foreground sm:text-xs">{c.name}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function HomeMarketplace({ section = "shop", term = "", hideNames }: { section?: Exclude<HomeSection, "food" | "rides">; term?: string; /** Names already listed elsewhere on the page — hidden here to avoid duplicates. */ hideNames?: string[] }) {
  const cats = useQuery({ queryKey: ["mp-cats"], queryFn: () => listMpCategoriesFn(), staleTime: 5 * 60_000 });
  const categories = sectionCategories((cats.data?.categories ?? []) as MpCategory[], section);
  const results = useQueries({ queries: categories.map(c => ({ queryKey: ["mp-category", c.slug], queryFn: () => listCategoryFn({ data: { slug: c.slug } }), staleTime: 60_000 })) });
  const listings = Array.from(new Map(results.flatMap(r => (r.data?.listings ?? []) as MpListing[]).map(l => [l.id, l])).values());
  const partners = Array.from(new Map(results.flatMap(r => (r.data?.partners ?? []) as MpPartner[]).map(p => [p.id, p])).values());
  const q = term.trim().toLowerCase();
  const hidden = new Set((hideNames ?? []).map(n => n.trim().toLowerCase()));
  const ranks = useQuery({ queryKey: ["category-ranks"], queryFn: () => listCategoryRanksFn(), staleTime: 60_000, enabled: section === "shop" });
  const rankOf = rankLookup(ranks.data ?? [], categories.map(c => c.slug));
  const unsorted = listings.filter(l => !hidden.has(l.name.trim().toLowerCase())).map(l => ({ ...l, images: l.images?.length ? l.images : [categories.find(c => c.slug === l.category_slug)?.image_url].filter((url): url is string => Boolean(url)) })).filter(l => !q || `${l.name} ${l.description ?? ""} ${l.partner?.name ?? ""}`.toLowerCase().includes(q));
  const shown = sortByRank(unsorted, l => listingRef(l.id), rankOf);
  const stores = partners.filter(p => !q || `${p.name} ${p.description ?? ""}`.toLowerCase().includes(q));
  const d = DESIGN[section];
  const loading = cats.isLoading || results.some(r => r.isLoading);
  const error = cats.isError || results.some(r => r.isError);
  return (
    <section className={section === "shop" ? "pb-6 pt-3" : "py-6"} aria-label={d.title}>
      {section !== "shop" && <div className="mb-5 border-b border-border pb-4">
        <h2 className={`font-display text-2xl font-extrabold ${d.colour}`}>{d.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{d.note}</p>
      </div>}
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
        {shown.length > 0 && <><h3 className="mb-3 font-display text-lg font-extrabold">{section === "shop" ? "Products from local stores" : section === "health" ? "Book a consultation or test" : section === "beauty" ? "Book your next appointment" : section === "home" ? "Services for your home" : "Plan your occasion"}</h3><div className={`grid gap-4 ${d.layout}`}>{shown.map(l => <TopPick key={l.id} rank={rankOf.get(listingRef(l.id))}><ListingCard l={l} /></TopPick>)}</div></>}
        {stores.length > 0 && <><h3 className="mb-3 mt-7 font-display text-lg font-extrabold">{section === "shop" ? "Stores" : section === "health" ? "Hospitals, clinics & labs" : section === "beauty" ? "Salons & wellness providers" : section === "home" ? "Service professionals" : "Event partners"}</h3><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{stores.map(p => <PartnerCard key={p.id} p={p} />)}</div></>}
        {!shown.length && !stores.length && !error && <p className="py-6 text-sm text-muted-foreground">{q ? "No matches in this section." : "New listings coming soon."}</p>}
      </>}
    </section>
  );
}
