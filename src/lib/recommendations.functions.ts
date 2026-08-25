import { createServerFn } from "@tanstack/react-start";
import {
  cleanString,
  validateAdminInput,
  validateIngestInput,
  validateProductIdsInput,
  validateRecommendationInput,
  validateSettingsInput,
  validateTrackInput,
  type TrackInput,
} from "./recommendations.shared";

export const trackCustomerEventsFn = createServerFn({ method: "POST" })
  .inputValidator(validateTrackInput)
  .handler(async ({ data }) => {
    const { verifyCustomerToken } = await import("./auth-tokens.server");
    const { trackEvents } = await import("./recommendations-operations.server");
    const session = verifyCustomerToken(data.token);
    return trackEvents(session?.phone ?? null, data.sessionId, data.events);
  });

export const getRecommendationsFn = createServerFn({ method: "POST" })
  .inputValidator(validateRecommendationInput)
  .handler(async ({ data }) => {
    const { verifyCustomerToken } = await import("./auth-tokens.server");
    const { buildRecommendations } = await import("./recommendations.server");
    const session = verifyCustomerToken(data.token);
    try {
      return await buildRecommendations(session?.phone ?? null, {
        cartProductIds: data.cartProductIds,
        limit: data.limit,
      });
    } catch (error) {
      console.error("getRecommendations failed", error);
      return { personalized: [], buyAgain: [], replenishment: [], frequentlyBoughtTogether: [], popular: [], isPersonalized: false };
    }
  });

export const getFrequentlyBoughtTogetherFn = createServerFn({ method: "POST" })
  .inputValidator(validateProductIdsInput)
  .handler(async ({ data }) => {
    if (data.productIds.length === 0) return { items: [] };
    const { frequentlyBoughtTogether, similarProducts } = await import("./recommendations.server");
    try {
      let items = await frequentlyBoughtTogether(data.productIds, data.limit);
      if (items.length === 0 && data.productIds[0]) items = await similarProducts(data.productIds[0], data.limit);
      return { items };
    } catch (error) {
      console.error("getFrequentlyBoughtTogether failed", error);
      return { items: [] };
    }
  });

export const ingestOrderFn = createServerFn({ method: "POST" })
  .inputValidator(validateIngestInput)
  .handler(async ({ data }) => {
    const { verifyCustomerToken } = await import("./auth-tokens.server");
    const { ingestOrder } = await import("./recommendations-operations.server");
    const session = verifyCustomerToken(data.token);
    if (!session) return { ok: false };
    return ingestOrder(session.phone, data.orderId, data.recommendationProductIds);
  });

export const recommendationAnalyticsFn = createServerFn({ method: "POST" })
  .inputValidator(validateAdminInput)
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");
    const { getAnalytics } = await import("./recommendations-operations.server");
    return getAnalytics(data.days);
  });

export const getRecommendationSettingsFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken?: string }) => ({ adminToken: cleanString(data?.adminToken, 800) }))
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");
    const { getSettings } = await import("./recommendations.server");
    return getSettings();
  });

export const saveRecommendationSettingsFn = createServerFn({ method: "POST" })
  .inputValidator(validateSettingsInput)
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");
    const { saveSettings } = await import("./recommendations-operations.server");
    return saveSettings(data.settings);
  });

export const rebuildRecommendationsFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken?: string }) => ({ adminToken: cleanString(data?.adminToken, 800) }))
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");
    const { rebuildAll } = await import("./recommendations-operations.server");
    return rebuildAll();
  });

export type { TrackInput };
