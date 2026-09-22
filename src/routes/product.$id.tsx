import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useCart, useCatalog, useAuth, useWishlist } from "@/lib/store";
import { formatINR, PRODUCTS } from "@/lib/data";
import { getProductRatingsFn } from "@/lib/reviews.functions";
import { Heart, Star, ChevronLeft, ChevronRight, Search, Share2, Package, PackageCheck, Info, Timer, ShoppingCart, Minus, Plus } from "lucide-react";
import { useEffect, useMemo } from "react";
import { RecommendationRow } from "@/components/RecommendationRow";
import { useFrequentlyBoughtTogether, useCustomerTracking } from "@/hooks/use-recommendations";

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
  loader: async ({ params }) => {
    try {
      const res = await getProductRatingsFn({ data: { productIds: [params.id] } });
      const r = res.ratings.find((x: { productId: string }) => x.productId === params.id);
      return { rating: { average: r?.average ?? 0, count: r?.count ?? 0 } };
    } catch {
      return { rating: { average: 0, count: 0 } };
    }
  },
  staleTime: 0,
  gcTime: 0,
  shouldReload: true,
  head: ({ params }) => {
    const p = PRODUCTS.find((x) => x.id === params.id);
    if (!p) return {};
    const title = `${p.name} — Buy online in Ongole | Kartogo`.slice(0, 60);
    const desc = (p.description || `${p.name} delivered in 15 minutes across Ongole.`).slice(0, 160);
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: p.name },
        { property: "og:description", content: desc },
        { property: "og:type", content: "product" },
        { property: "og:url", content: `/product/${params.id}` },
        ...(p.image ? [{ property: "og:image", content: p.image }] : []),
      ],
      links: [{ rel: "canonical", href: `/product/${params.id}` }],
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: p.name,
          description: p.description,
          ...(p.image ? { image: p.image } : {}),
          offers: {
            "@type": "Offer",
            priceCurrency: "INR",
            price: p.price,
            availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          },
        }),
      }],
    };
  },
  notFoundComponent: () => <div className="p-10 text-center">Product not found.</div>,
  errorComponent: ({ error }) => <div className="p-10 text-center text-destructive">{error.message}</div>,
});

function ProductPage() {
  const { id } = Route.useParams();
  const { rating: ratingSummary } = Route.useLoaderData();
  const { products } = useCatalog();
  const p = products.find(x => x.id === id);
  const { add, items, setQty, count } = useCart();
  const { user } = useAuth();
  const { has, toggle } = useWishlist();
  const nav = useNavigate();
  const track = useCustomerTracking();
  const { items: together } = useFrequentlyBoughtTogether(id ? [id] : [], 4);
  const { products: allProducts } = useCatalog();
  useEffect(() => { if (p) track.trackProductView(p.id, p.category); }, [p, track]);
  const addAll = useMemo(() => together
    .map(r => allProducts.find(x => x.id === r.productId))
    .filter((x): x is NonNullable<typeof x> => Boolean(x && x.stock > 0)), [together, allProducts]);
  if (!p) throw notFound();
  const inCart = items.find(i => i.productId === p.id);
  const wished = has(p.id);
  const lowStock = p.stock > 0 && p.stock <= 5;

  const handleWishlist = () => {
    if (!user) {
      toast.info("Login to save items to your wishlist");
      nav({ to: "/login", search: { redirect: `/product/${p.id}` } });
      return;
    }
    toggle(p.id);
    toast.success(wished ? "Removed from wishlist" : "Added to wishlist");
  };

  const handleAdd = () => {
    if (!user) {
      toast.info("Please login to add items to your cart");
      nav({ to: "/login", search: { redirect: `/product/${p.id}` } });
      return;
    }
    add(p.id);
    track.trackAddToCart(p.id);
  };

  const off = p.mrp && p.mrp > p.price ? p.mrp - p.price : 0;

  return (
    <div className="min-h-screen bg-secondary/40 pb-28 lg:pb-10">
      {/* ---------- Hero image with floating controls (mobile & tablet only) ---------- */}
      <div className="relative bg-card lg:hidden">
        <div className="mx-auto grid aspect-square w-full max-w-xl place-items-center overflow-hidden md:aspect-[4/3]">
          {p.image ? (
            <img src={p.image} alt={p.name} width={768} height={768} className="h-full w-full object-contain" />
          ) : (
            <div className="text-[10rem]">{p.emoji}</div>
          )}
        </div>

        <button
          onClick={() => window.history.back()}
          aria-label="Go back"
          className="absolute left-3 top-3 grid h-10 w-10 place-items-center rounded-full border border-border bg-card shadow-pop"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="absolute right-3 top-3 flex items-center gap-2">
          <Link
            to="/search"
            search={{ q: "" }}
            aria-label="Search products"
            className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card shadow-pop"
          >
            <Search className="h-5 w-5" />
          </Link>
          <button
            onClick={() => {
              const url = typeof window !== "undefined" ? window.location.href : "";
              if (typeof navigator !== "undefined" && navigator.share) {
                void navigator.share({ title: p.name, url }).catch(() => {});
              } else {
                void navigator.clipboard?.writeText(url);
                toast.success("Link copied");
              }
            }}
            aria-label="Share product"
            className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card shadow-pop"
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>

        <div className="absolute bottom-16 right-3 flex flex-col gap-3">
          <button
            onClick={handleWishlist}
            aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
            aria-pressed={wished}
            className="grid h-11 w-11 place-items-center rounded-full border border-border bg-card shadow-pop"
          >
            <Heart className={`h-5 w-5 ${wished ? "fill-primary text-primary" : "text-muted-foreground"}`} />
          </button>
          <Link
            to="/category/$slug"
            params={{ slug: p.category }}
            aria-label={`More in ${p.category}`}
            className="grid h-11 w-11 place-items-center rounded-full border border-border bg-card shadow-pop"
          >
            <Package className="h-5 w-5 text-muted-foreground" />
          </Link>
        </div>
        <a
          href="#product-details"
          aria-label="Product information"
          className="absolute bottom-16 left-3 grid h-11 w-11 place-items-center rounded-full border border-border bg-card shadow-pop"
        >
          <Info className="h-5 w-5 text-muted-foreground" />
        </a>
      </div>

      {/* ---------- Mobile & tablet content column ---------- */}
      <div className="mx-auto max-w-3xl px-3 pt-3 lg:hidden">
        {/* ---------- Details card ---------- */}
        <div className="rounded-2xl bg-card p-4 shadow-pop">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {ratingSummary.count > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-leaf/10 px-2 py-0.5 font-bold text-leaf">
                <Star className="h-3.5 w-3.5 fill-leaf text-leaf" />
                {ratingSummary.average.toFixed(1)}
                <span className="font-semibold text-muted-foreground">({ratingSummary.count})</span>
              </span>
            ) : (
              <span className="rounded-lg bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">New</span>
            )}
            <span className="text-muted-foreground">|</span>
            <span className="font-semibold text-muted-foreground">15 mins</span>
          </div>

          <h1 className="mt-2 font-display text-xl font-extrabold leading-snug md:text-2xl">{p.name}</h1>
          <div className="mt-1 text-sm text-muted-foreground">Net quantity: {p.unit}</div>

          <div className="mt-3 inline-flex items-center rounded-xl bg-leaf px-3 py-1.5 font-display text-xl font-extrabold text-primary-foreground">
            {formatINR(p.price)}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            {p.mrp && p.mrp > p.price && (
              <>
                <span className="text-muted-foreground">MRP <span className="line-through">{formatINR(p.mrp)}</span></span>
                <span className="text-muted-foreground">(incl. of all taxes)</span>
                <span className="font-bold text-leaf">{formatINR(off)} OFF</span>
              </>
            )}
          </div>

          <Link
            to="/category/$slug"
            params={{ slug: p.category }}
            className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-3"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-lg">{p.emoji}</span>
              <span className="min-w-0 truncate font-bold">View all {p.category.replace(/-/g, " ")} products</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        </div>

        {/* ---------- Highlights ---------- */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="flex flex-col items-center gap-1 rounded-2xl bg-card p-4 text-center shadow-pop">
            <PackageCheck className="h-7 w-7 text-primary" />
            <div className="text-xs font-semibold text-muted-foreground">Easy returns &amp; refunds</div>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-2xl bg-card p-4 text-center shadow-pop">
            <Timer className="h-7 w-7 text-primary" />
            <div className="text-xs font-semibold text-muted-foreground">Superfast delivery</div>
          </div>
        </div>

        {/* ---------- Details ---------- */}
        <div id="product-details" className="mt-3 rounded-2xl bg-card p-4 shadow-pop">
          <h2 className="font-display text-lg font-extrabold">Product details</h2>
          <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
          {!!p.maxPerOrder && (
            <div className="mt-2 text-sm font-semibold text-muted-foreground">Max {p.maxPerOrder} per order</div>
          )}
          {p.stock <= 0 && <div className="mt-2 text-sm font-bold text-destructive">Out of stock</div>}
          {lowStock && <div className="mt-2 inline-flex rounded-lg bg-saffron/20 px-2.5 py-1 text-sm font-extrabold text-foreground">Only {p.stock} left — order soon</div>}
          <nav className="mt-3 text-xs text-muted-foreground">
            <Link to="/" className="hover:text-primary">Home</Link> /{" "}
            <Link to="/category/$slug" params={{ slug: p.category }} className="hover:text-primary">{p.category}</Link> /{" "}
            <span className="text-foreground">{p.name}</span>
          </nav>
        </div>

        {/* ---------- Frequently bought together (kept, moved below details) ---------- */}
        {addAll.length > 0 && (
          <div className="mt-3 rounded-2xl bg-card p-4 shadow-pop">
...
            <RecommendationRow title="" items={together} limit={4} compact />
          </div>
        )}
      </div>

      {/* ---------- Desktop (laptop) layout: two-column ---------- */}
      <div className="mx-auto hidden max-w-6xl gap-6 px-6 pt-6 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* Left: image panel */}
        <div className="relative self-start overflow-hidden rounded-3xl bg-card shadow-pop">
          <div className="grid aspect-square w-full place-items-center p-6">
            {p.image ? (
              <img src={p.image} alt={p.name} width={768} height={768} className="h-full w-full object-contain" />
            ) : (
              <div className="text-[12rem]">{p.emoji}</div>
            )}
          </div>
          <button
            onClick={() => window.history.back()}
            aria-label="Go back"
            className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-border bg-card shadow-pop"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="absolute right-4 top-4 flex items-center gap-2">
            <Link
              to="/search"
              search={{ q: "" }}
              aria-label="Search products"
              className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card shadow-pop"
            >
              <Search className="h-5 w-5" />
            </Link>
            <button
              onClick={() => {
                const url = typeof window !== "undefined" ? window.location.href : "";
                if (typeof navigator !== "undefined" && navigator.share) {
                  void navigator.share({ title: p.name, url }).catch(() => {});
                } else {
                  void navigator.clipboard?.writeText(url);
                  toast.success("Link copied");
                }
              }}
              aria-label="Share product"
              className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card shadow-pop"
            >
              <Share2 className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Right: details */}
        <div className="min-w-0 self-start rounded-3xl bg-card p-6 shadow-pop">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {ratingSummary.count > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-leaf/10 px-2 py-0.5 font-bold text-leaf">
                <Star className="h-3.5 w-3.5 fill-leaf text-leaf" />
                {ratingSummary.average.toFixed(1)}
                <span className="font-semibold text-muted-foreground">({ratingSummary.count})</span>
              </span>
            ) : (
              <span className="rounded-lg bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">New</span>
            )}
            <span className="text-muted-foreground">|</span>
            <span className="font-semibold text-muted-foreground">15 mins</span>
          </div>

          <h1 className="mt-2 font-display text-3xl font-extrabold leading-snug">{p.name}</h1>
          <div className="mt-1 text-sm text-muted-foreground">Net quantity: {p.unit}</div>

          <div className="mt-4 inline-flex items-center rounded-xl bg-leaf px-4 py-2 font-display text-2xl font-extrabold text-primary-foreground">
            {formatINR(p.price)}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            {p.mrp && p.mrp > p.price && (
              <>
                <span className="text-muted-foreground">MRP <span className="line-through">{formatINR(p.mrp)}</span></span>
                <span className="text-muted-foreground">(incl. of all taxes)</span>
                <span className="font-bold text-leaf">{formatINR(off)} OFF</span>
              </>
            )}
          </div>

          {/* Actions row: side by side */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {inCart ? (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-primary px-2 py-1 text-primary-foreground">
                <button
                  aria-label="Decrease quantity"
                  onClick={() => setQty(p.id, inCart.qty - 1)}
                  className="grid h-11 w-12 place-items-center rounded-lg hover:bg-primary/80"
                >
                  <Minus className="h-5 w-5" />
                </button>
                <span className="min-w-8 text-center font-display text-lg font-extrabold">{inCart.qty}</span>
                <button
                  aria-label="Increase quantity"
                  disabled={inCart.qty >= Math.min(p.maxPerOrder || Infinity, p.stock)}
                  onClick={() => setQty(p.id, inCart.qty + 1)}
                  className="grid h-11 w-12 place-items-center rounded-lg hover:bg-primary/80 disabled:opacity-50"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <button
                disabled={p.stock <= 0}
                onClick={handleAdd}
                className="rounded-xl bg-primary px-8 py-3 font-display text-base font-extrabold text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
              >
                {p.stock <= 0 ? "Out of stock" : "Add to Cart"}
              </button>
            )}
            <Link
              to="/cart"
              className="relative inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 font-bold"
            >
              <ShoppingCart className="h-5 w-5" /> View cart
              {count > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
                  {count}
                </span>
              )}
            </Link>
            <button
              onClick={handleWishlist}
              aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
              aria-pressed={wished}
              className="grid h-12 w-12 place-items-center rounded-xl border border-border bg-card shadow-pop"
            >
              <Heart className={`h-5 w-5 ${wished ? "fill-primary text-primary" : "text-muted-foreground"}`} />
            </button>
            <Link
              to="/category/$slug"
              params={{ slug: p.category }}
              aria-label={`More in ${p.category}`}
              className="grid h-12 w-12 place-items-center rounded-xl border border-border bg-card shadow-pop"
            >
              <Package className="h-5 w-5 text-muted-foreground" />
            </Link>
          </div>

          <Link
            to="/category/$slug"
            params={{ slug: p.category }}
            className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-3"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-lg">{p.emoji}</span>
              <span className="min-w-0 truncate font-bold">View all {p.category.replace(/-/g, " ")} products</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="flex flex-col items-center gap-1 rounded-2xl bg-secondary/60 p-4 text-center">
              <PackageCheck className="h-7 w-7 text-primary" />
              <div className="text-xs font-semibold text-muted-foreground">Easy returns &amp; refunds</div>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-2xl bg-secondary/60 p-4 text-center">
              <Timer className="h-7 w-7 text-primary" />
              <div className="text-xs font-semibold text-muted-foreground">Superfast delivery</div>
            </div>
          </div>

          <div className="mt-4">
            <h2 className="font-display text-lg font-extrabold">Product details</h2>
            <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
            {!!p.maxPerOrder && (
              <div className="mt-2 text-sm font-semibold text-muted-foreground">Max {p.maxPerOrder} per order</div>
            )}
            {p.stock <= 0 && <div className="mt-2 text-sm font-bold text-destructive">Out of stock</div>}
            {lowStock && <div className="mt-2 inline-flex rounded-lg bg-saffron/20 px-2.5 py-1 text-sm font-extrabold text-foreground">Only {p.stock} left — order soon</div>}
            <nav className="mt-3 text-xs text-muted-foreground">
              <Link to="/" className="hover:text-primary">Home</Link> /{" "}
              <Link to="/category/$slug" params={{ slug: p.category }} className="hover:text-primary">{p.category}</Link> /{" "}
              <span className="text-foreground">{p.name}</span>
            </nav>
          </div>
        </div>

        {/* FBT full width on desktop */}
        {addAll.length > 0 && (
          <div className="col-span-2 rounded-2xl bg-card p-5 shadow-pop">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-lg font-extrabold">Frequently bought together</h2>
                <p className="text-sm text-muted-foreground">Only items currently in stock are shown.</p>
              </div>
              <button
                onClick={() => {
                  addAll.forEach(x => { add(x.id); track.trackRecommendationAddedToCart(x.id, "FREQUENTLY_BOUGHT_TOGETHER"); });
                  toast.success(`Added ${addAll.length} item${addAll.length > 1 ? "s" : ""} to cart`);
                }}
                className="shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
              >
                Add all to cart
              </button>
            </div>
            <RecommendationRow title="" items={together} limit={4} compact />
          </div>
        )}
      </div>

      {/* ---------- Sticky bottom action bar (mobile & tablet only) ---------- */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link
            to="/cart"
            aria-label="View cart"
            className="relative flex shrink-0 items-center gap-2 rounded-xl border border-border px-4 py-3 font-bold"
          >
            <ShoppingCart className="h-5 w-5" />
            <span className="hidden sm:inline">View cart</span>
            {count > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
                {count}
              </span>
            )}
          </Link>
          {inCart ? (
            <div className="flex flex-1 items-center justify-between rounded-xl bg-primary px-2 py-1 text-primary-foreground">
              <button
                aria-label="Decrease quantity"
                onClick={() => setQty(p.id, inCart.qty - 1)}
                className="grid h-11 w-12 place-items-center rounded-lg hover:bg-primary/80"
              >
                <Minus className="h-5 w-5" />
              </button>
              <span className="font-display text-lg font-extrabold">{inCart.qty}</span>
              <button
                aria-label="Increase quantity"
                disabled={inCart.qty >= Math.min(p.maxPerOrder || Infinity, p.stock)}
                onClick={() => setQty(p.id, inCart.qty + 1)}
                className="grid h-11 w-12 place-items-center rounded-lg hover:bg-primary/80 disabled:opacity-50"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <button
              disabled={p.stock <= 0}
              onClick={handleAdd}
              className="flex-1 rounded-xl bg-primary py-3.5 font-display text-base font-extrabold text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
            >
              {p.stock <= 0 ? "Out of stock" : "Add to Cart"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
