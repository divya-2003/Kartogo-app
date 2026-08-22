import { useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth, useCart } from "@/lib/store";
import { customerEventService } from "@/lib/recommendations.client";
import {
  getRecommendationsFn,
  getFrequentlyBoughtTogetherFn,
} from "@/lib/recommendations.functions";

export type Recommendation = {
  productId: string;
  type: string;
  reason: string;
  score: number;
  sourceProductId?: string;
};

/**
 * One hook for all behaviour tracking. It resolves the signed-in shopper and
 * the anonymous session automatically — callers only pass what happened.
 */
export function useCustomerTracking() {
  return customerEventService;
}

function useBundle(limit = 8) {
  const { customerToken } = useAuth();
  const { items } = useCart();
  const cartProductIds = useMemo(() => items.map((i) => i.productId), [items]);
  const cartKey = cartProductIds.join(",");

  return useQuery({
    queryKey: ["recommendations", customerToken ? "auth" : "guest", cartKey, limit],
    queryFn: () =>
      getRecommendationsFn({
        data: { token: customerToken ?? "", cartProductIds, limit },
      }),
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export function useRecommendationBundle(limit = 8) {
  const query = useBundle(limit);
  return {
    ...query,
    bundle: query.data ?? {
      personalized: [] as Recommendation[],
      buyAgain: [] as Recommendation[],
      replenishment: [] as Recommendation[],
      frequentlyBoughtTogether: [] as Recommendation[],
      popular: [] as Recommendation[],
      isPersonalized: false,
    },
  };
}

export function usePersonalizedRecommendations(limit = 8) {
  const { bundle, isLoading, error } = useRecommendationBundle(limit);
  return { items: bundle.personalized as Recommendation[], isLoading, error };
}

export function useBuyAgain(limit = 8) {
  const { bundle, isLoading, error } = useRecommendationBundle(limit);
  return { items: bundle.buyAgain as Recommendation[], isLoading, error };
}

export function useReplenishmentPredictions(limit = 8) {
  const { bundle, isLoading, error } = useRecommendationBundle(limit);
  return { items: bundle.replenishment as Recommendation[], isLoading, error };
}

export function usePopularNearby(limit = 8) {
  const { bundle, isLoading, error } = useRecommendationBundle(limit);
  return { items: bundle.popular as Recommendation[], isLoading, error };
}

export function useFrequentlyBoughtTogether(productIds: string[], limit = 4) {
  const key = productIds.filter(Boolean).join(",");
  const query = useQuery({
    queryKey: ["fbt", key, limit],
    queryFn: () => getFrequentlyBoughtTogetherFn({ data: { productIds, limit } }),
    enabled: key.length > 0,
    staleTime: 10 * 60_000,
    retry: 1,
  });
  return { items: (query.data?.items ?? []) as Recommendation[], isLoading: query.isLoading };
}

export function useSimilarProducts(productId: string, limit = 4) {
  return useFrequentlyBoughtTogether(productId ? [productId] : [], limit);
}

/** Logs a recommendation impression once per product per section. */
export function useRecommendationImpressions(items: Recommendation[]) {
  const key = items.map((i) => i.productId).join(",");
  useEffect(() => {
    for (const item of items) {
      customerEventService.trackRecommendationViewed(item.productId, item.type);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return useCallback((item: Recommendation) => {
    customerEventService.trackRecommendationClicked(item.productId, item.type);
  }, []);
}
