import { useQuery } from "@tanstack/react-query";
import { searchMarketplaceFn } from "@/lib/marketplace.functions";
import { ListingCard, PartnerCard } from "./Cards";
import type { MpListing, MpPartner } from "@/lib/marketplace";

const GROUPS: { key: string; title: string; match: (l: MpListing) => boolean }[] = [
  { key: "furniture", title: "Furniture & electronics", match: l => l.transaction_type === "PRODUCT_ORDER" },
  { key: "salon", title: "Salon & beauty services", match: l => l.transaction_type === "SERVICE_BOOKING" },
  { key: "home", title: "Home services", match: l => l.transaction_type === "HOME_SERVICE_BOOKING" },
  { key: "events", title: "Event services", match: l => l.transaction_type === "EVENT_BOOKING" || l.transaction_type === "QUOTE_REQUEST" },
];

/** Services, stores and providers matching the search, grouped by listing type. */
export function MarketplaceResults({ q }: { q: string }) {
  const { data } = useQuery({ queryKey: ["mp-search", q], queryFn: () => searchMarketplaceFn({ data: { q } }), enabled: q.trim().length >= 2, staleTime: 30_000 });
  const listings = (data?.listings ?? []) as MpListing[];
  const partners = (data?.partners ?? []) as MpPartner[];
  if (!listings.length && !partners.length) return null;
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
      <h3 className="font-display text-base font-extrabold">Products</h3>
    </div>
  );
}
