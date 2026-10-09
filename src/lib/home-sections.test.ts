import { describe, it, expect } from "vitest";
import { catalogProductInShop, listingInSection, partnerInSection, sectionCategories } from "./home-sections";
import type { MpCategory } from "./marketplace";

const categories = [
  { slug: "furniture", group_key: "shop", legacy_categories: [] },
  { slug: "salon", group_key: "beauty", legacy_categories: ["hair-services"] },
  { slug: "electrical", group_key: "home_services", legacy_categories: [] },
  { slug: "photography", group_key: "events", legacy_categories: [] },
] as MpCategory[];

describe("dedicated home sections", () => {
  it("keeps salon services out of Shop", () => {
    expect(listingInSection({ category_slug: "salon" }, categories, "shop")).toBe(false);
    expect(listingInSection({ category_slug: "salon" }, categories, "beauty")).toBe(true);
    expect(catalogProductInShop({ category: "hair-services" }, categories)).toBe(false);
    expect(catalogProductInShop({ category: "cosmetics" }, categories)).toBe(true);
  });
  it("shows furniture only in Shop", () => {
    expect(listingInSection({ category_slug: "furniture" }, categories, "shop")).toBe(true);
    expect(listingInSection({ category_slug: "furniture" }, categories, "events")).toBe(false);
  });
  it("separates electrical services from event photography", () => {
    expect(sectionCategories(categories, "home").map(c => c.slug)).toEqual(["electrical"]);
    expect(sectionCategories(categories, "events").map(c => c.slug)).toEqual(["photography"]);
  });
  it("keeps marketplace content out of Food and Rides", () => {
    expect(sectionCategories(categories, "food")).toEqual([]);
    expect(sectionCategories(categories, "rides")).toEqual([]);
  });
  it("matches providers only through categories in the active section", () => {
    expect(partnerInSection({ category_slugs: ["salon"] }, categories, "shop")).toBe(false);
    expect(partnerInSection({ category_slugs: ["salon"] }, categories, "beauty")).toBe(true);
  });
});