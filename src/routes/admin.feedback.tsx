import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/store";
import { listReviewsFn, type ReviewEntry } from "@/lib/reviews.functions";
import { Star, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/admin/feedback")({ component: Feedback });

function Stars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${value >= i + 1 ? "fill-saffron text-saffron" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

function Feedback() {
  const { adminToken } = useAuth();
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!adminToken) return;
    let active = true;
    (async () => {
      try {
        const res = await listReviewsFn({ data: { adminToken } });
        if (active) setReviews(res.reviews);
      } catch { /* keep empty */ }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [adminToken]);

  const summary = useMemo(() => {
    if (reviews.length === 0) return { average: 0, count: 0 };
    const sum = reviews.reduce((s, r) => s + r.rating, 0);
    return { average: Math.round((sum / reviews.length) * 10) / 10, count: reviews.length };
  }, [reviews]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">Customer feedback</h1>
        <p className="text-sm text-muted-foreground">Ratings and comments customers left on their products</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:max-w-md">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Star className="h-4 w-4" /> Average rating
          </div>
          <div className="mt-1 font-display text-2xl font-bold">
            {summary.count ? `${summary.average.toFixed(1)} ★` : "—"}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <MessageSquare className="h-4 w-4" /> Total reviews
          </div>
          <div className="mt-1 font-display text-2xl font-bold">{summary.count}</div>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading feedback…</div>
        ) : reviews.length === 0 ? (
          <div className="text-sm text-muted-foreground">No customer feedback yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {reviews.map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">{r.productName || r.productId}</div>
                  <Stars value={r.rating} />
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {r.customerName || "Customer"} · Order {r.orderId} · {new Date(r.createdAt).toLocaleString("en-IN")}
                </div>
                {r.feedback && <p className="mt-1.5 text-sm">{r.feedback}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
