import { describe, expect, it } from "vitest";
import { normalizePicks, rankLookup, sortByRank, type CategoryRank } from "./category-ranks";

const ranks: CategoryRank[] = [
  { category_slug: "electronics", rank: 1, product_ref: "mp:earbuds" },
  { category_slug: "electronics", rank: 2, product_ref: "mp:mobile" },
  { category_slug: "electronics", rank: 3, product_ref: "mp:neckband" },
  { category_slug: "grocery", rank: 1, product_ref: "p-rice" },
];

describe("admin top picks per category", () => {
  it("puts the admin's 1st, 2nd and 3rd products at the top in that order", () => {
    const items = ["mp:ac", "mp:neckband", "mp:mobile", "mp:mixer", "mp:earbuds"];
    const sorted = sortByRank(items, x => x, rankLookup(ranks, ["electronics"]));
    expect(sorted).toEqual(["mp:earbuds", "mp:mobile", "mp:neckband", "mp:ac", "mp:mixer"]);
  });
  it("ignores picks made for a different category", () => {
    const sorted = sortByRank(["p-dal", "p-rice"], x => x, rankLookup(ranks, ["electronics"]));
    expect(sorted).toEqual(["p-dal", "p-rice"]);
  });
  it("keeps a blank 2nd slot blank and drops a duplicate pick", () => {
    expect(normalizePicks(["a", "", "a"])).toEqual([{ rank: 1, product_ref: "a" }]);
    expect(normalizePicks(["a", null, "c"])).toEqual([{ rank: 1, product_ref: "a" }, { rank: 3, product_ref: "c" }]);
  });
});
