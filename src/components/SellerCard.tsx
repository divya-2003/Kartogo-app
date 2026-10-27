import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, MapPin, Store, CalendarClock } from "lucide-react";
import { getProductSellerFn } from "@/lib/product-seller.functions";

function fmtExpiry(d: string) {
  const dt = new Date(`${d}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Expiry line shown with the product details. */
export function ExpiryLine({ date }: { date?: string }) {
  if (!date) return null;
  return (
    <div className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
      <CalendarClock className="h-4 w-4" /> Best before {fmtExpiry(date)}
    </div>
  );
}

/** "Sold by" box on the product page: seller name and the shops that stock it. */
export function SellerCard({ productId, className = "" }: { productId: string; className?: string }) {
  const { data } = useQuery({
    queryKey: ["product-seller", productId],
    queryFn: () => getProductSellerFn({ data: { productId } }),
    staleTime: 5 * 60_000,
  });
  if (!data) return null;
  return (
    <section aria-label="Seller details" className={`rounded-2xl bg-card p-4 shadow-pop ${className}`}>
      <h2 className="font-display text-lg font-extrabold">Seller details</h2>
      <div className="mt-3 flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Store className="h-5 w-5" /></span>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-muted-foreground">Sold by</div>
          <div className="truncate font-bold">{data.sellerName}</div>
          <div className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-leaf"><BadgeCheck className="h-3.5 w-3.5" />{data.sellerType}</div>
        </div>
      </div>
      {data.stores.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <div className="text-xs font-semibold text-muted-foreground">Ships from</div>
          {data.stores.map(s => (
            <div key={s.name} className="flex items-start gap-2 text-sm">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0"><span className="font-semibold">{s.name}</span>{s.address ? <span className="block text-xs text-muted-foreground">{s.address}</span> : null}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
