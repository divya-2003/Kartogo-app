import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Heart } from "lucide-react";
import { Header } from "@/components/Header";
import { ProductCard } from "@/components/ProductCard";
import { useQuery } from "@tanstack/react-query";
import { useAuth, useCatalog, useWishlist } from "@/lib/store";
import { ListingCard } from "@/components/marketplace/Cards";
import { myFavoritesFn } from "@/lib/marketplace.functions";

export const Route = createFileRoute("/wishlist")({
  component: WishlistPage,
  head: () => ({ meta: [{ title: "Your Wishlist — Kartogo" }] }),
});

function WishlistPage() {
  const { ids } = useWishlist();
  const { products } = useCatalog();
  const list = products.filter(p => ids.includes(p.id));
  // Local-store products saved from the cart or a store page.
  const { customerToken } = useAuth();
  const { data: saved } = useQuery({
    queryKey: ["my-favorites", customerToken],
    enabled: !!customerToken,
    queryFn: () => myFavoritesFn({ data: { token: customerToken ?? undefined } }),
  });
  const storeList = (saved?.listings ?? []) as any[];
  const total = list.length + storeList.length;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/menu" aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-secondary">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold">Your Wishlist</h1>
            <p className="text-sm text-muted-foreground">{total} item{total === 1 ? "" : "s"} saved</p>
          </div>
        </div>

        {total === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
              <Heart className="h-7 w-7" />
            </div>
            <h2 className="mt-4 font-display text-lg font-bold">No wishlisted items yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">Tap the heart on any product to save it here for later.</p>
            <Link to="/" className="mt-5 inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground hover:bg-primary/90">
              Start shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {list.length > 0 && (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
                {list.map(p => <ProductCard key={p.id} p={p} />)}
              </div>
            )}
            {storeList.length > 0 && (
              <section>
                <h2 className="mb-3 font-display text-lg font-bold">From local stores</h2>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
                  {storeList.map(l => <ListingCard key={l.id} l={l} />)}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
