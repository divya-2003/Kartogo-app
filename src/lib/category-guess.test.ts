import { describe, expect, it } from "vitest";
import { guessCategory } from "./category-guess";

const pick = (name: string, desc = "") => guessCategory(name, desc)?.slug;

describe("automatic category from the product name", () => {
  it("never files a pickle under cosmetics", () => {
    expect(pick("Gongura Pickle 500g")).toBe("pickles");
    expect(pick("Homemade Mango Avakaya")).toBe("pickles");
    expect(pick("Lemon Pickle")).not.toBe("cosmetics");
  });
  it("puts spice powders in Spice Powders, not Snacks or Grooming", () => {
    expect(pick("Guntur Chilli Powder")).toBe("spice-powders");
    expect(pick("Sambar Powder 200g")).toBe("spice-powders");
  });
  it("recognises everyday shop items", () => {
    expect(pick("Lays Classic Salted Chips")).toBe("snacks");
    expect(pick("Maggi Masala Noodles")).toBe("instant-food");
    expect(pick("Idli Dosa Batter 1kg")).toBe("tiffin-batter");
    expect(pick("Bru Instant Coffee")).toBe("beverages");
    expect(pick("Lifebuoy Soap")).toBe("grooming");
    expect(pick("Lakme Lipstick Red")).toBe("cosmetics");
    expect(pick("Dolo 650 Tablets")).toBe("pharmacy");
    expect(pick("Sandalwood Agarbatti")).toBe("pooja");
    expect(pick("Classmate Notebook")).toBe("stationery");
    expect(pick("Kara Boondi")).toBe("local-snacks");
  });
  it("only picks from the seller's own categories", () => {
    expect(guessCategory("Gongura Pickle", "", ["snacks", "cosmetics"])).toBeNull();
  });
  it("returns nothing for unknown names so the AI can decide", () => {
    expect(guessCategory("Xyzzy 42")).toBeNull();
  });
});
