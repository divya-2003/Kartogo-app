import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Printer, ChevronRight } from "lucide-react";
import { listMpCategoriesFn, homeMarketplaceFn } from "@/lib/marketplace.functions";
import { ListingCard, PartnerCard } from "./Cards";
import type { MpCategory, MpListing, MpPartner } from "@/lib/marketplace";

type Section = { key: string; title: string; is_visible: boolean; sort: number };

/** Marketplace discovery block for Home. Section visibility/order come from the database so admin can control them. */
export function HomeMarketplace() {
  const cats = useQuery({ queryKey: ["mp-cats"], queryFn: () => listMpCategoriesFn(), staleTime: 5 * 60_000 });
  const home = useQuery({ queryKey: ["mp-home"], queryFn: () => homeMarketplaceFn(), staleTime: 60_000 });
  const sections = ((cats.data?.sections ?? []) as Section[]).filter(s => s.is_visible);
  const visible = (k: string) => !cats.data || sections.some(s => s.key === k);
  const titleOf = (k: string, d: string) => sections.find(s => s.key === k)?.title ?? d;
  const popular = ((cats.data?.categories ?? []) as MpCategory[]).filter(c => c.is_popular).slice(0, 8);
  const trending = (home.data?.trending ?? []) as MpListing[];
  const fresh = ((home.data?.fresh ?? []) as MpListing[]).filter(l => l.transaction_type !== "PRODUCT_ORDER");
  const stores = (home.data?.stores ?? []) as MpPartner[];

  const blocks: Record<string, React.ReactNode> = {
    popular_categories: (
      <section key="popular_categories" className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-lg font-extrabold">{titleOf("popular_categories", "What are you looking for?")}</h2>
          <Link to="/categories" className="inline-flex items-center text-xs font-bold text-primary">View All Categories<ChevronRight className="h-4 w-4" /></Link>
        </div>
        <div className="grid grid-cols-4 gap-2 lg:grid-cols-8">
          {cats.isLoading ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-secondary" />) :
            popular.map(c => (
              <Link key={c.slug} to="/explore/$slug" params={{ slug: c.slug }} className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card p-2 text-center shadow-pop transition hover:-translate-y-0.5">
                <span className="text-2xl">{c.icon}</span><span className="text-[11px] font-bold leading-tight">{c.name}</span>
              </Link>
            ))}
        </div>
      </section>
    ),
    trending_services: trending.length > 0 && (
      <section key="trending_services" className="mt-5">
        <h2 className="mb-2 font-display text-lg font-extrabold">{titleOf("trending_services", "Trending Services")}</h2>
        <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">{trending.map(l => <ListingCard key={l.id} l={l} compact />)}</div>
      </section>
    ),
    new_stores: stores.length > 0 && (
      <section key="new_stores" className="mt-5">
        <h2 className="mb-2 font-display text-lg font-extrabold">{titleOf("new_stores", "New Stores")}</h2>
        <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">{stores.map(p => <PartnerCard key={p.id} p={p} compact />)}</div>
      </section>
    ),
    new_services: fresh.length > 0 && (
      <section key="new_services" className="mt-5">
        <h2 className="mb-2 font-display text-lg font-extrabold">{titleOf("new_services", "New Services")}</h2>
        <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">{fresh.map(l => <ListingCard key={l.id} l={l} compact />)}</div>
      </section>
    ),
  };
  const order = sections.length ? sections.map(s => s.key) : ["popular_categories", "trending_services", "new_stores", "new_services"];

  return (
    <>
      {order.filter(k => blocks[k] && visible(k)).map(k => blocks[k])}
      <Link to="/print" className="mt-5 flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-pop">
        <Printer className="h-5 w-5 text-primary" /><span className="flex-1 text-sm font-bold">Kartogo Print Store</span><ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Link>
    </>
  );
}
