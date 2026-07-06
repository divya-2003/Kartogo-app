import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { useAuth, useOrders, useCatalog } from "@/lib/store";
import { submitReviewsFn } from "@/lib/reviews.functions";
import { Star, ArrowLeft, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/rate-order/$orderId")({
  component: RateOrderPage,
  head: () => ({ meta: [{ title: "Rate your order — Kartogo" }] }),
});

type ItemRating = { rating: number; feedback: string };

function RateOrderPage() {
  const { orderId } = Route.useParams();
  const { orders } = useOrders();
  const { customerToken } = useAuth();
  const { products } = useCatalog();
  const navigate = useNavigate();

  const order = orders.find((o) => o.id === orderId);
  const [ratings, setRatings] = useState<Record<string, ItemRating>>({});
  const [hover, setHover] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const imageFor = (productId: string) => products.find((p) => p.id === productId)?.image;
  const emojiFor = (productId: string) => products.find((p) => p.id === productId)?.emoji ?? "📦";

  const ratedCount = useMemo(
    () => Object.values(ratings).filter((r) => r.rating >= 1).length,
    [ratings],
  );

  const setItemRating = (productId: string, rating: number) =>
    setRatings((prev) => ({ ...prev, [productId]: { rating, feedback: prev[productId]?.feedback ?? "" } }));
  const setItemFeedback = (productId: string, feedback: string) =>
    setRatings((prev) => ({
      ...prev,
      [productId]: { rating: prev[productId]?.rating ?? 0, feedback: feedback.slice(0, 300) },
    }));

  const markRated = (id: string) => {
    try {
      const raw = localStorage.getItem("kartigo-rated-orders");
      const ids = raw ? (JSON.parse(raw) as string[]) : [];
      if (!ids.includes(id)) localStorage.setItem("kartigo-rated-orders", JSON.stringify([...ids, id]));
    } catch {}
  };

  const handleSubmit = async () => {
    if (!order || !customerToken) return;
    const payload = order.items
      .map((it) => ({
        productId: it.productId,
        productName: it.name,
        rating: ratings[it.productId]?.rating ?? 0,
        feedback: ratings[it.productId]?.feedback ?? "",
      }))
      .filter((r) => r.rating >= 1);
    if (payload.length === 0) {
      toast.error("Please rate at least one item");
      return;
    }
    setSubmitting(true);
    try {
      await submitReviewsFn({ data: { token: customerToken, orderId: order.id, ratings: payload } });
      markRated(order.id);
      toast.success(`Thanks for rating ${payload.length} item${payload.length > 1 ? "s" : ""}! 🎉`);
      navigate({ to: "/orders" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit your ratings");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
        <Link
          to="/orders"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to orders
        </Link>

        {!order ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">Order not found.</p>
            <Link to="/orders" className="mt-3 inline-block text-sm font-bold text-primary">
              Go to my orders
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-5">
              <h1 className="font-display text-2xl font-bold">Rate your order</h1>
              <p className="text-sm text-muted-foreground">
                Order {order.id} · {order.items.length} item{order.items.length > 1 ? "s" : ""} · Tap the
                stars for each product
              </p>
            </div>

            <div className="space-y-3">
              {order.items.map((it) => {
                const current = ratings[it.productId]?.rating ?? 0;
                const hovered = hover[it.productId] ?? 0;
                const img = imageFor(it.productId);
                return (
                  <div
                    key={it.productId}
                    className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    {/* Left: item name */}
                    <div className="flex items-center gap-3">
                      <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-cream text-2xl">
                        {img ? (
                          <img src={img} alt={it.name} className="h-full w-full object-cover" />
                        ) : (
                          <span>{emojiFor(it.productId)}</span>
                        )}
                      </div>
                      <div>
                        <div className="font-semibold leading-tight">{it.name}</div>
                        <div className="text-xs text-muted-foreground">Qty {it.qty}</div>
                      </div>
                    </div>

                    {/* Right: star selector */}
                    <div className="flex flex-col items-start gap-2 sm:items-end">
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, idx) => {
                          const value = idx + 1;
                          const active = (hovered || current) >= value;
                          return (
                            <button
                              key={value}
                              type="button"
                              aria-label={`${value} star${value > 1 ? "s" : ""} for ${it.name}`}
                              onClick={() => setItemRating(it.productId, value)}
                              onMouseEnter={() => setHover((h) => ({ ...h, [it.productId]: value }))}
                              onMouseLeave={() => setHover((h) => ({ ...h, [it.productId]: 0 }))}
                              className="transition-transform hover:scale-110"
                            >
                              <Star
                                className={`h-7 w-7 ${
                                  active ? "fill-saffron text-saffron" : "text-muted-foreground/40"
                                }`}
                              />
                            </button>
                          );
                        })}
                      </div>
                      {current > 0 && current <= 4 && (
                        <input
                          value={ratings[it.productId]?.feedback ?? ""}
                          onChange={(e) => setItemFeedback(it.productId, e.target.value)}
                          placeholder="What could be better? (optional)"
                          className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-primary sm:w-64"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="sticky bottom-0 mt-5 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 p-4 backdrop-blur">
              <span className="text-sm text-muted-foreground">
                {ratedCount} of {order.items.length} rated
              </span>
              <button
                onClick={handleSubmit}
                disabled={submitting || ratedCount === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-saffron px-6 py-2.5 text-sm font-bold text-saffron-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" /> {submitting ? "Submitting…" : "Submit ratings"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
