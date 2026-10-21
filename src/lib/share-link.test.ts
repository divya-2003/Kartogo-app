import { describe, expect, it } from "vitest";
import { productShareUrl, shareTargetUrl } from "./share-link";

describe("product share links", () => {
  it("uses the public app for links created in the preview", () => {
    expect(productShareUrl("p1", "https://id-preview--abc.lovable.app")).toBe("https://kartogoapp.lovable.app/product/p1");
    expect(productShareUrl("p1", "http://localhost:8080")).toBe("https://kartogoapp.lovable.app/product/p1");
  });

  it("keeps the live site address when shared from the live site", () => {
    expect(productShareUrl("p1", "https://kartogo.com")).toBe("https://kartogo.com/product/p1");
  });

  it("puts the product link inside the WhatsApp message", () => {
    expect(shareTargetUrl("whatsapp", "https://kartogo.com/product/p1", "Honey"))
      .toBe("https://wa.me/?text=Honey%20https%3A%2F%2Fkartogo.com%2Fproduct%2Fp1");
  });
});
