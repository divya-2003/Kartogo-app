import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/store";
import { listReviewsFn, type ReviewEntry } from "@/lib/reviews.functions";
import { listDriverFeedbackFn, type DriverFeedbackEntry } from "@/lib/driver-ratings.functions";
import { Star, MessageSquare, Package, Bike } from "lucide-react";

export const Route = createFileRoute("/admin/feedback")({ component: Feedback });

type Tab = "products" | "delivery";

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

function summarize(list: { rating: number }[]) {
  if (list.length === 0) return { average: 0, count: 0 };
  const sum = list.reduce((s, r) => s + r.rating, 0);
  return { average: Math.round((sum / list.length) * 10) / 10, count: list.length };
}

function Feedback() {
  const { adminToken } = useAuth();
  const [tab, setTab] = useState<Tab>("products");
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);
  const [riderFeedback, setRiderFeedback] = useState<DriverFeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!adminToken) return;
    let active = true;
    (async () => {
      const [products, riders] = await Promise.allSettled([
        listReviewsFn({ data: { adminToken } }),
        listDriverFeedbackFn({ data: { adminToken } }),
      ]);
      if (!active) return;
      if (products.status === "fulfilled") setReviews(products.value.reviews);
      if (riders.status === "fulfilled") setRiderFeedback(riders.value.feedback);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [adminToken]);

  const productSummary = useMemo(() => summarize(reviews), [reviews]);
  const riderSummary = useMemo(() => summarize(riderFeedback), [riderFeedback]);

  // Average per delivery partner, best first.
  const perRider = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    for (const f of riderFeedback) {
      const e = map.get(f.driverId) ?? { name: f.driverName, total: 0, count: 0 };
      e.total += f.rating; e.count += 1;
      map.set(f.driverId, e);
    }
    return [...map.entries()]
      .map(([id, e]) => ({ id, name: e.name, count: e.count, average: Math.round((e.total / e.count) * 10) / 10 }))
      .sort((a, b) => b.average - a.average || b.count - a.count);
  }, [riderFeedback]);

  const summary = tab === "products" ? productSummary : riderSummary;

  const TABS: { key: Tab; label: string; icon: typeof Package; count: number }[] = [
    { key: "products", label: "Products", icon: Package, count: reviews.length },
    { key: "delivery", label: "Delivery partners", icon: Bike, count: riderFeedback.length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">Customer feedback</h1>
        <p className="text-sm text-muted-foreground">Ratings and comments customers left on products and on their delivery partners</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition ${tab === t.key ? "bg-primary text-primary-foreground" : "border border-border bg-card hover:bg-secondary"}`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
            <span className={`rounded-full px-1.5 text-[10px] font-bold ${tab === t.key ? "bg-primary-foreground text-primary" : "bg-secondary text-foreground"}`}>{t.count}</span>
          </button>
        ))}
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

      {tab === "delivery" && perRider.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-display text-base font-bold">Rating by delivery partner</h2>
          <div className="flex flex-wrap gap-2">
            {perRider.map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                <Bike className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">{r.name}</span>
                <span className="font-bold">{r.average.toFixed(1)} ★</span>
                <span className="text-xs text-muted-foreground">({r.count})</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-5">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading feedback…</div>
        ) : tab === "products" ? (
          reviews.length === 0 ? (
            <div className="text-sm text-muted-foreground">No product feedback yet.</div>
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
          )
        ) : riderFeedback.length === 0 ? (
          <div className="text-sm text-muted-foreground">No delivery partner feedback yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {riderFeedback.map((f) => (
              <li key={f.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-semibold"><Bike className="h-4 w-4 text-muted-foreground" /> {f.driverName}</div>
                  <Stars value={f.rating} />
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {f.customerName} · Order {f.orderId} · {new Date(f.createdAt).toLocaleString("en-IN")}
                </div>
                {f.comment && <p className="mt-1.5 text-sm">{f.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
