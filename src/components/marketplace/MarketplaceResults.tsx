import { useQueries, useQuery } from "@tanstack/react-query";
import { listMpCategoriesFn, listCategoryFn, searchMarketplaceFn } from "@/lib/marketplace.functions";
import { ListingCard, PartnerCard } from "./Cards";
import { listingInSection, partnerInSection, sectionCategories, type HomeSection } from "@/lib/home-sections";
import type { MpCategory, MpListing, MpPartner } from "@/lib/marketplace";

const GROUPS: { key: string; title: string; match: (l: MpListing) => boolean }[] = [
  { key: "furniture", title: "Furniture & electronics", match: l => l.transaction_type === "PRODUCT_ORDER" },
  { key: "salon", title: "Salon & beauty services", match: l => l.transaction_type === "SERVICE_BOOKING" },
  { key: "home", title: "Home services", match: l => l.transaction_type === "HOME_SERVICE_BOOKING" },
  { key: "events", title: "Event services", match: l => l.transaction_type === "EVENT_BOOKING" || l.transaction_type === "QUOTE_REQUEST" },
];

/** Services, stores and providers matching the search, grouped by listing type. */
export function MarketplaceResults({ q, section }: { q: string; section?: HomeSection }) {
  const cats = useQuery({ queryKey: ["mp-cats"], queryFn: () => listMpCategoriesFn(), staleTime: 5 * 60_000 });
  const categories = (cats.data?.categories ?? []) as MpCategory[];
  const scopedCats = section ? sectionCategories(categories, section) : [];
  const browse = useQueries({ queries: scopedCats.map(c => ({ queryKey: ["mp-category", c.slug], queryFn: () => listCategoryFn({ data: { slug: c.slug } }), enabled: q.trim().length < 2, staleTime: 60_000 })) });
  const { data } = useQuery({ queryKey: ["mp-search", q], queryFn: () => searchMarketplaceFn({ data: { q } }), enabled: q.trim().length >= 2, staleTime: 30_000 });
  const sourceListings = q.trim().length < 2 ? browse.flatMap(r => r.data?.listings ?? []) : data?.listings ?? [];
  const sourcePartners = q.trim().length < 2 ? browse.flatMap(r => r.data?.partners ?? []) : data?.partners ?? [];
  const listings = Array.from(new Map((sourceListings as MpListing[]).filter(l => !section || listingInSection(l, categories, section)).map(l => [l.id, l])).values());
  const partners = Array.from(new Map((sourcePartners as MpPartner[]).filter(p => !section || partnerInSection(p, categories, section)).map(p => [p.id, p])).values());
  if (!listings.length && !partners.length) return section ? <p className="py-4 text-sm text-muted-foreground">{cats.isLoading || browse.some(r => r.isLoading) ? "Loading…" : "No matches in this section."}</p> : null;
  return (
    <div className="mb-6 space-y-5">
      {GROUPS.map(g => {
        const items = listings.filter(g.match);
        if (!items.length) return null;
        return (
          <section key={g.key}>
            <h3 className="mb-2 font-display text-base font-extrabold">{g.title}</h3>
            <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">{items.map(l => <ListingCard key={l.id} l={l} compact />)}</div>
          </section>
        );
      })}
      {partners.length > 0 && (
        <section>
          <h3 className="mb-2 font-display text-base font-extrabold">Stores & providers</h3>
          <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">{partners.map(p => <PartnerCard key={p.id} p={p} compact />)}</div>
        </section>
      )}
      {(!section || section === "shop") && <h3 className="font-display text-base font-extrabold">Products</h3>}
    </div>
  );
}
