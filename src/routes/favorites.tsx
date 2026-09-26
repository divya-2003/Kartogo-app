import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { myFavoritesFn } from "@/lib/marketplace.functions";
import { ListingCard, PartnerCard, EmptyState, PageTop, SkeletonGrid } from "@/components/marketplace/Cards";
import { useAuth } from "@/lib/store";
import type { MpListing, MpPartner } from "@/lib/marketplace";

export const Route = createFileRoute("/favorites")({
  head: () => ({
    meta: [
      { title: "Your favourites — Kartogo" },
      { name: "description", content: "Saved stores, salons, services, furniture and event providers on Kartogo." },
      { property: "og:title", content: "Your favourites — Kartogo" },
      { property: "og:description", content: "Everything you've saved in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { customerToken } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ["mp-favs", customerToken], queryFn: () => myFavoritesFn({ data: { token: customerToken ?? undefined } }), enabled: !!customerToken });
  const listings = (data?.listings ?? []) as MpListing[];
  const partners = (data?.partners ?? []) as MpPartner[];
  return (
    <div className="min-h-screen bg-background pb-24">
      <PageTop title="Favourites" back="/menu" />
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-4 lg:max-w-5xl">
        <Link to="/wishlist" className="flex justify-between rounded-2xl border border-border bg-card p-4 text-sm font-bold">Saved grocery items <span className="text-primary">Open wishlist</span></Link>
        {!customerToken ? <EmptyState title="Login to see favourites"><Link to="/login" search={{ redirect: "/favorites" }} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Login</Link></EmptyState>
          : isLoading ? <SkeletonGrid n={4} />
          : !listings.length && !partners.length ? <EmptyState title="No favourites yet" body="Tap the heart on any store, service or package to save it." />
          : (
            <>
              {partners.length > 0 && <section><h2 className="mb-2 font-display font-bold">Stores & providers</h2><div className="grid gap-3 md:grid-cols-2">{partners.map(p => <PartnerCard key={p.id} p={p} />)}</div></section>}
              {listings.length > 0 && <section><h2 className="mb-2 font-display font-bold">Services, packages & products</h2><div className="grid grid-cols-2 gap-3 md:grid-cols-3">{listings.map(l => <ListingCard key={l.id} l={l} />)}</div></section>}
            </>
          )}
      </div>
    </div>
  );
}
