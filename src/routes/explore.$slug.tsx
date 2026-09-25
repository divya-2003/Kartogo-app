import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { listCategoryFn } from "@/lib/marketplace.functions";
import { ListingCard, PartnerCard, SkeletonGrid, EmptyState, PageTop } from "@/components/marketplace/Cards";
import { BottomNav } from "@/components/marketplace/BottomNav";
import { ProductCard } from "@/components/ProductCard";
import { useCatalog } from "@/lib/store";
import type { MpCategory, MpListing, MpPartner } from "@/lib/marketplace";

export const Route = createFileRoute("/explore/$slug")({
  head: ({ params }) => {
    const name = params.slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    return {
      meta: [
        { title: `${name} in Ongole — Kartogo` },
        { name: "description", content: `Browse ${name} near you on Kartogo — compare ratings, prices and book or order in a tap.` },
        { property: "og:title", content: `${name} in Ongole — Kartogo` },
        { property: "og:description", content: `Local ${name} listings on Kartogo.` },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: ExplorePage,
});

type Sort = "relevance" | "rating" | "price_low" | "price_high" | "distance";

function ExplorePage() {
  const { slug } = Route.useParams();
  const { products } = useCatalog();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["mp-category", slug],
    queryFn: () => listCategoryFn({ data: { slug } }),
  });
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("relevance");
  const [filter, setFilter] = useState<string>("all");

  const cat = data?.category as MpCategory | null | undefined;
  const behavior = cat?.behavior;
  const listings = (data?.listings ?? []) as MpListing[];
  const partners = (data?.partners ?? []) as MpPartner[];

  // Category-specific filters.
  const filters = useMemo(() => {
    if (behavior === "SALON") return [["all", "All"], ["AT_SALON", "At salon"], ["HOME_SERVICE", "Home service"], ["top", "4.5+ rated"]];
    if (behavior === "FURNITURE") return [["all", "All"], ["installation", "With installation"], ["under20k", "Under ₹20,000"]];
    if (behavior === "HOME_SERVICE") return [["all", "All"], ["under500", "Under ₹500"], ["top", "4.5+ rated"]];
    if (behavior === "EVENT" || behavior === "QUOTE") return [["all", "All"], ["package", "Fixed packages"], ["quote", "On quote"]];
    return [["all", "All"], ["top", "4.5+ rated"]];
  }, [behavior]);

  const priceOf = (l: MpListing) => Number(l.price ?? l.starting_price ?? Infinity);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    let r = listings.filter(l => !t || `${l.name} ${l.description ?? ""} ${l.partner?.name ?? ""}`.toLowerCase().includes(t));
    r = r.filter(l => {
      switch (filter) {
        case "AT_SALON": case "HOME_SERVICE": return l.service_modes?.includes(filter);
        case "top": return l.rating >= 4.5;
        case "installation": return !!l.attributes?.installation;
        case "under20k": return priceOf(l) < 20000;
        case "under500": return priceOf(l) < 500;
        case "package": return l.transaction_type === "EVENT_BOOKING";
        case "quote": return l.transaction_type === "QUOTE_REQUEST";
        default: return true;
      }
    });
    const s = [...r];
    if (sort === "rating") s.sort((a, b) => b.rating - a.rating);
    if (sort === "price_low") s.sort((a, b) => priceOf(a) - priceOf(b));
    if (sort === "price_high") s.sort((a, b) => priceOf(b) - priceOf(a));
    if (sort === "distance") s.sort((a, b) => Number(a.partner?.distance_km ?? 99) - Number(b.partner?.distance_km ?? 99));
    return s;
  }, [listings, q, filter, sort]);

  // Shop categories backed by the existing grocery catalogue keep the normal cart flow.
  const legacyProducts = useMemo(() => {
    if (!cat?.legacy_categories?.length) return [];
    const t = q.trim().toLowerCase();
    return products.filter(p => cat.legacy_categories.includes(p.category) && (!t || p.name.toLowerCase().includes(t)));
  }, [cat, products, q]);

  const shownPartners = partners.filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="min-h-screen bg-background pb-28">
      <PageTop title={cat?.name ?? "Explore"} back="/categories" />
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4 lg:max-w-5xl">
        <div className="flex gap-2">
          <label className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Search in ${cat?.name ?? "category"}`} className="w-full bg-transparent text-sm outline-none" />
          </label>
          <label className="flex items-center gap-1 rounded-xl border border-border bg-card px-2 text-sm">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <select aria-label="Sort" value={sort} onChange={e => setSort(e.target.value as Sort)} className="bg-transparent py-2 text-sm font-semibold outline-none">
              <option value="relevance">Relevance</option>
              <option value="rating">Rating</option>
              <option value="price_low">Price: low–high</option>
              <option value="price_high">Price: high–low</option>
              {(behavior === "SALON" || behavior === "PRODUCT") && <option value="distance">Distance</option>}
            </select>
          </label>
        </div>
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
          {filters.map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${filter === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>{label}</button>
          ))}
        </div>

        {isLoading ? <SkeletonGrid /> : isError ? (
          <EmptyState title="Couldn't load this category" body="Check your connection and try again."><button onClick={() => refetch()} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Retry</button></EmptyState>
        ) : !cat ? (
          <EmptyState title="Category not found"><Link to="/categories" className="font-bold text-primary">See all categories</Link></EmptyState>
        ) : (
          <>
            {shownPartners.length > 0 && (behavior !== "PRODUCT" || !legacyProducts.length) && (
              <section>
                <h2 className="mb-2 font-display text-base font-bold">{behavior === "SALON" ? "Salons near you" : behavior === "EVENT" || behavior === "QUOTE" ? "Event providers" : "Stores & providers"}</h2>
                <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">{shownPartners.map(p => <PartnerCard key={p.id} p={p} compact />)}</div>
              </section>
            )}
            {legacyProducts.length > 0 && (
              <section>
                <h2 className="mb-2 font-display text-base font-bold">Delivered fast</h2>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{legacyProducts.slice(0, 40).map(p => <ProductCard key={p.id} p={p} />)}</div>
              </section>
            )}
            {shown.length > 0 ? (
              <section>
                {legacyProducts.length > 0 && <h2 className="mb-2 font-display text-base font-bold">More from local stores</h2>}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{shown.map(l => <ListingCard key={l.id} l={l} />)}</div>
              </section>
            ) : legacyProducts.length === 0 && (
              <EmptyState title="Nothing here yet" body={q || filter !== "all" ? "Try a different search or filter." : "New partners are joining soon."} />
            )}
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
