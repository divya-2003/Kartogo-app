import { useCallback, useEffect, useState } from "react";
import { listActiveOffersFn, offersForProduct, type ProductOffer } from "@/lib/offers.functions";

// Shared, lightly cached view of the admin-authored "Additional offers".
// Cached at module level so every product card / product page reuses one fetch,
// and refreshed periodically so a "Save changes" in the admin panel lands on
// customer screens without a reload.
let cache: ProductOffer[] = [];
let inflight: Promise<ProductOffer[]> | null = null;
let fetchedAt = 0;
const listeners = new Set<(o: ProductOffer[]) => void>();
const TTL = 30_000;

async function load(force = false): Promise<ProductOffer[]> {
  if (!force && Date.now() - fetchedAt < TTL && cache.length >= 0 && fetchedAt !== 0) return cache;
  if (inflight) return inflight;
  inflight = listActiveOffersFn()
    .then((rows) => {
      cache = rows;
      fetchedAt = Date.now();
      listeners.forEach((l) => l(cache));
      return cache;
    })
    .catch(() => cache)
    .finally(() => { inflight = null; });
  return inflight;
}

export function useActiveOffers() {
  const [offers, setOffers] = useState<ProductOffer[]>(cache);

  useEffect(() => {
    listeners.add(setOffers);
    void load();
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, TTL);
    const onFocus = () => { if (document.visibilityState === "visible") void load(true); };
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      listeners.delete(setOffers);
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  const refresh = useCallback(() => void load(true), []);
  return { offers, refresh };
}

/** Offers that apply to one product, ready to render. */
export function useProductOffers(productId: string) {
  const { offers } = useActiveOffers();
  return offersForProduct(offers, productId);
}

export const OFFER_TONE_CLASS: Record<string, string> = {
  primary: "border-primary/30 bg-primary/10 text-primary",
  leaf: "border-leaf/30 bg-leaf/10 text-leaf",
  saffron: "border-saffron/40 bg-saffron/20 text-foreground",
  destructive: "border-destructive/30 bg-destructive/10 text-destructive",
  ink: "border-border bg-secondary text-foreground",
};
