import { describe, expect, it } from "vitest";
import { backMustReturnHome } from "./customer-navigation";

describe("bottom section back destinations", () => {
  for (const section of ["/categories", "/search", "/print"]) {
    it(`${section} must go Home instead of Login on back`, () => {
      expect(backMustReturnHome(section, "/login", "BACK")).toBe(true);
      expect(backMustReturnHome(section, "/menu", "GO")).toBe(true);
      expect(backMustReturnHome(section, "/", "BACK")).toBe(false);
    });
  }
  it("preserves forward links and back from detail pages", () => {
    expect(backMustReturnHome("/print", "/login", "PUSH")).toBe(false);
    expect(backMustReturnHome("/product/123", "/search", "BACK")).toBe(false);
  });
});