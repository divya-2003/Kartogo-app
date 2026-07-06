import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { useCart, useCatalog, useAuth, useWishlist } from "@/lib/store";
import { formatINR } from "@/lib/data";
import { getProductRatingsFn, getProductReviewsFn, type ReviewEntry } from "@/lib/reviews.functions";
import { Plus, Minus, ShoppingBag, Heart, Star } from "lucide-react";

function Stars({ value, className = "h-4 w-4" }: { value: number; className?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`${className} ${value >= i + 1 ? "fill-saffron text-saffron" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

export const Route = createFileRoute("/product/$id")({
  component: ProductPage,
  notFoundComponent: () => <div className="p-10 text-center">Product not found.</div>,
  errorComponent: ({ error }) => <div className="p-10 text-center text-destructive">{error.message}</div>,
});

function ProductPage() {
  const { id } = Route.useParams();
  const { products } = useCatalog();
  const p = products.find(x => x.id === id);
  const { add, items, setQty } = useCart();
  const { user } = useAuth();
  const { has, toggle } = useWishlist();
  const nav = useNavigate();
  if (!p) throw notFound();
  const inCart = items.find(i => i.productId === p.id);
  const wished = has(p.id);

  const [ratingSummary, setRatingSummary] = useState<{ average: number; count: number }>({ average: 0, count: 0 });
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [ratingRes, reviewRes] = await Promise.all([
          getProductRatingsFn({ data: { productIds: [id] } }),
          getProductReviewsFn({ data: { productId: id } }),
        ]);
        if (!active) return;
        const r = ratingRes.ratings.find((x) => x.productId === id);
        setRatingSummary({ average: r?.average ?? 0, count: r?.count ?? 0 });
        setReviews(reviewRes.reviews);
      } catch { /* keep empty on error */ }
    })();
    return () => { active = false; };
  }, [id]);

  const handleAdd = () => {
    add(p.id);
    if (!user) {
      toast.info("Please login to add items to your cart");
      nav({ to: "/login", search: { redirect: "/" } });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        <nav className="mb-4 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-primary">Home</Link> /{" "}
          <Link to="/category/$slug" params={{ slug: p.category }} className="hover:text-primary">{p.category}</Link> /{" "}
          <span className="text-foreground">{p.name}</span>
        </nav>
        <div className="grid gap-8 md:grid-cols-2">
          <div className="grid aspect-square place-items-center overflow-hidden rounded-3xl border border-border bg-cream bg-grain">
            {p.image ? (
              <img src={p.image} alt={p.name} width={768} height={768} className="h-full w-full object-cover" />
            ) : (
              <div className="text-[12rem]">{p.emoji}</div>
            )}
          </div>
          <div className="flex flex-col">
            <h1 className="font-display text-3xl font-bold leading-tight md:text-4xl">{p.name}</h1>
            <div className="mt-1 text-sm text-muted-foreground">{p.unit}</div>
            {ratingSummary.count > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <Stars value={Math.round(ratingSummary.average)} />
                <span className="text-sm font-bold">{ratingSummary.average.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground">
                  ({ratingSummary.count} rating{ratingSummary.count > 1 ? "s" : ""})
                </span>
              </div>
            )}
            <div className="mt-4 flex items-end gap-3">
              <div className="font-display text-3xl font-bold">{formatINR(p.price)}</div>
              {p.mrp && p.mrp > p.price && <div className="text-muted-foreground line-through">{formatINR(p.mrp)}</div>}
              {p.mrp && p.mrp > p.price && <div className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{Math.round((1 - p.price / p.mrp) * 100)}% OFF</div>}
            </div>
            <p className="mt-4 text-muted-foreground">{p.description}</p>
            <div className="mt-6">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Stock</div>
              <div className={`text-sm font-semibold ${p.stock > 5 ? "text-primary" : p.stock > 0 ? "text-saffron-foreground" : "text-destructive"}`}>
                {p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}
              </div>
            </div>
            <div className="mt-6 flex items-center gap-3">
              {inCart ? (
                <div className="flex items-center gap-2 rounded-xl border border-primary p-1">
                  <button onClick={() => setQty(p.id, inCart.qty - 1)} className="grid h-9 w-9 place-items-center rounded-lg text-primary hover:bg-primary/10"><Minus className="h-4 w-4" /></button>
                  <span className="min-w-8 text-center font-bold">{inCart.qty}</span>
                  <button onClick={() => setQty(p.id, inCart.qty + 1)} className="grid h-9 w-9 place-items-center rounded-lg text-primary hover:bg-primary/10"><Plus className="h-4 w-4" /></button>
                </div>
              ) : (
                <button disabled={p.stock <= 0} onClick={handleAdd} className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground">
                  <ShoppingBag className="h-4 w-4" /> Add to cart
                </button>
              )}
              <Link to="/cart" className="rounded-xl border border-border px-6 py-3 font-bold hover:bg-secondary">Go to cart</Link>
              <button
                onClick={() => { toggle(p.id); toast.success(wished ? "Removed from wishlist" : "Added to wishlist"); }}
                aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
                aria-pressed={wished}
                className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-border hover:bg-secondary"
              >
                <Heart className={`h-5 w-5 ${wished ? "fill-primary text-primary" : "text-muted-foreground"}`} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
