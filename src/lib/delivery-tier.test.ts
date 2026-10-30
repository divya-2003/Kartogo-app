import { describe, expect, it } from "vitest";
import { isQuickProduct, locationHasQuick } from "./delivery-tier";

describe("Quick delivery eligibility", () => {
  it("gives Quick to a serviceable location with an ETA of 13 minutes or less", () => {
    expect(locationHasQuick({ serviceable: true, etaMinutes: 13, query: "Ongole 523001", area: "Ongole 523001" })).toBe(true);
  });
  it("gives Quick to a named Quick locality", () => {
    expect(locationHasQuick({ serviceable: true, etaMinutes: 15, query: "Magunta Layout, Ongole", area: "Magunta Layout" })).toBe(true);
  });
  it("keeps far serviceable areas on Standard", () => {
    expect(locationHasQuick({ serviceable: true, etaMinutes: 18, query: "Throvagunta", area: "Throvagunta" })).toBe(false);
  });
  it("never gives Quick to an unserviceable or missing location", () => {
    expect(locationHasQuick({ serviceable: false, etaMinutes: 11, query: "Magunta", area: "Magunta" })).toBe(false);
    expect(locationHasQuick(null)).toBe(false);
  });
  it("tags only fast-shelf categories as Quick products", () => {
    expect(isQuickProduct({ category: "snacks" })).toBe(true);
    expect(isQuickProduct({ category: "pickles" })).toBe(false);
  });
});
