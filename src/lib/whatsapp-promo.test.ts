import { describe, expect, it } from "vitest";
import { whatsappChatUrl, whatsappMessage, whatsappPhone } from "./whatsapp-link";
import { activePromoProduct, indiaDay, promoEligible, recommendPromoProduct, WHATSAPP_DAILY_LIMIT, type PromoProduct } from "./whatsapp-promo.shared";

const now = new Date("2026-11-23T05:07:00Z");
const customer = { whatsapp_marketing_opt_in: true, whatsapp_marketing_opt_in_at: "2026-11-20T00:00:00Z", created_at: "2026-11-22T05:07:00Z", promo_sent_at: null, promo_skipped: false };
const products: PromoProduct[] = [{ id: "rice", name: "Rice", category: "grocery", price: 75, url: "https://kartogoapp.lovable.app/product/rice" }, { id: "soap", name: "Soap", category: "fmcg", price: 50, url: "https://kartogoapp.lovable.app/product/soap" }];
describe("WhatsApp campaign eligibility", () => {
  it("requires voluntary consent", () => expect(promoEligible({ ...customer, whatsapp_marketing_opt_in: false }, false, now)).toBe(false));
  it("requires a consent timestamp", () => expect(promoEligible({ ...customer, whatsapp_marketing_opt_in_at: null }, false, now)).toBe(false));
  it("waits a full 24 hours", () => expect(promoEligible({ ...customer, created_at: "2026-11-22T05:07:01Z" }, false, now)).toBe(false));
  it("includes no-order customers exactly at 24 hours", () => expect(promoEligible(customer, false, now)).toBe(true));
  for (const status of ["placed", "packed", "out_for_delivery", "delivered", "cancelled", "refunded"]) it(`excludes a submitted ${status} order`, () => expect(promoEligible(customer, true, now)).toBe(false));
  it("does not count an unsaved checkout", () => expect(promoEligible(customer, false, now)).toBe(true));
  it("never repeats sent customers", () => expect(promoEligible({ ...customer, promo_sent_at: now.toISOString() }, false, now)).toBe(false));
  it("never repeats skipped customers", () => expect(promoEligible({ ...customer, promo_skipped: true }, false, now)).toBe(false));
  it("withdrawal immediately removes eligibility", () => expect(promoEligible({ ...customer, whatsapp_marketing_opt_in: false, whatsapp_marketing_opt_in_at: null }, false, now)).toBe(false));
});
describe("product availability and priority", () => {
  const active = { is_deleted: false, stock: 1, expiry_date: null };
  it("rejects deleted products", () => expect(activePromoProduct({ ...active, is_deleted: true }, now)).toBe(false));
  it("rejects zero stock", () => expect(activePromoProduct({ ...active, stock: 0 }, now)).toBe(false));
  it("rejects expired products", () => expect(activePromoProduct({ ...active, expiry_date: "2026-11-22" }, now)).toBe(false));
  it("accepts expiry today", () => expect(activePromoProduct({ ...active, expiry_date: "2026-11-23" }, now)).toBe(true));
  it("prioritizes personal preference", () => expect(recommendPromoProduct(products, [{ product_id: "soap", interest_score: 9 }], [], [{ productId: "rice", count: 20 }])?.id).toBe("soap"));
  it("then uses most-bought category", () => expect(recommendPromoProduct(products, [], [{ category: "fmcg", purchase_count: 2 }], [{ productId: "rice", count: 20 }])?.id).toBe("soap"));
  it("falls back to best seller", () => expect(recommendPromoProduct(products, [], [], [{ productId: "soap", count: 20 }])?.id).toBe("soap"));
  it("never recommends a missing inactive product", () => expect(recommendPromoProduct(products, [{ product_id: "expired", interest_score: 100 }], [], [])?.id).toBe("rice"));
  it("returns no product for empty catalog", () => expect(recommendPromoProduct([], [], [], [])).toBeNull());
});
describe("WhatsApp links and India day", () => {
  it("normalizes documented legacy Indian numbers", () => expect(whatsappPhone("9676486946")).toBe("919676486946"));
  it("preserves international country codes", () => expect(whatsappPhone("+44 7911 123456")).toBe("447911123456"));
  for (const raw of ["", "123", "abcdefgh", "+91 0000000000", "++919676486946"]) it(`rejects invalid phone ${raw}`, () => expect(whatsappPhone(raw)).toBeNull());
  it("encodes all message content and reuses public product URLs", () => { const message = whatsappMessage("Rahul", "Rice & Dal", "rice"); const url = new URL(whatsappChatUrl("9676486946", message)); expect(url.pathname).toBe("/919676486946"); expect(url.searchParams.get("text")).toBe(message); expect(message).toContain("https://kartogoapp.lovable.app/product/rice"); });
  it("rejects invalid link generation", () => expect(() => whatsappChatUrl("", "hello")).toThrow());
  it("changes day at India midnight", () => { expect(indiaDay(new Date("2026-11-22T18:29:59Z"))).toBe("2026-11-22"); expect(indiaDay(new Date("2026-11-22T18:30:00Z"))).toBe("2026-11-23"); });
  it("enforces the requested configured maximum", () => expect(WHATSAPP_DAILY_LIMIT).toBe(25));
});