import { describe, it, expect } from "vitest";
import { whatsappPhone, whatsappLink, whatsappMessage, indiaDate, selectPromoProduct, WHATSAPP_DAILY_LIMIT, type PromoProduct } from "./whatsapp-link";
import { canOpenAdminPath, permissionForAdminPath } from "./admin-access.shared";

describe("Manual WhatsApp rules", () => {
  it("uses the fixed 25-message allowance", () => { expect(WHATSAPP_DAILY_LIMIT).toBe(25); });
  it("normalizes a valid Indian national number", () => { expect(whatsappPhone("96764 86946")).toBe("919676486946"); });
  it("keeps international country codes", () => { expect(whatsappPhone("+44 7911 123456")).toBe("447911123456"); });
  it("rejects an invalid or missing phone", () => {
    expect(whatsappPhone("")).toBeNull(); expect(whatsappPhone("123")).toBeNull(); expect(whatsappPhone("+91 0000000000")).toBeNull();
    expect(() => whatsappLink("123", "Rahul", "Rice", "p1")).toThrow("Invalid phone");
  });
  it("encodes the entire personalized message and reuses the product URL", () => {
    const url=new URL(whatsappLink("+1 202-555-0123", "Rahul", "Rice & Oil", "a b"));
    expect(url.origin+url.pathname).toBe("https://wa.me/12025550123");
    expect(url.searchParams.get("text")).toBe(whatsappMessage("Rahul", "Rice & Oil", "a b"));
    expect(url.searchParams.get("text")).toContain("https://kartogoapp.lovable.app/product/a%20b");
  });
  it("uses India midnight, not UTC midnight", () => {
    expect(indiaDate(new Date("2026-11-23T18:29:59Z"))).toBe("2026-11-23");
    expect(indiaDate(new Date("2026-11-23T18:30:00Z"))).toBe("2026-11-24");
  });
  const products:PromoProduct[]=[{id:"rice",name:"Rice",price:10,image:null,category:"grocery"},{id:"soap",name:"Soap",price:20,image:null,category:"FMCG"}];
  it("prioritizes customer preferences over global best sellers", () => {
    expect(selectPromoProduct(products,[{product_id:"rice",interest_score:10,purchase_count:0}],[],[],[{productId:"soap",count:100}])?.id).toBe("rice");
  });
  it("uses the most-bought category before global popularity", () => {
    expect(selectPromoProduct(products,[],[],[{category:"grocery",purchase_count:3,interest_score:1}],[{productId:"soap",count:100}])?.id).toBe("rice");
  });
  it("ignores preferred products outside the active product set", () => {
    expect(selectPromoProduct(products,[{product_id:"deleted",interest_score:99,purchase_count:0}],[],[],[{productId:"soap",count:100}])?.id).toBe("soap");
    expect(selectPromoProduct([],[],[],[],[])).toBeNull();
  });
  it("requires the dedicated permission and does not trust another permission", () => {
    expect(permissionForAdminPath("/admin/whatsapp-recommendations")).toBe("whatsapp_promos");
    expect(canOpenAdminPath({isSuperAdmin:false,permissions:["customers"]},"/admin/whatsapp-recommendations")).toBe(false);
    expect(canOpenAdminPath({isSuperAdmin:false,permissions:["whatsapp_promos"]},"/admin/whatsapp-recommendations")).toBe(true);
  });
});