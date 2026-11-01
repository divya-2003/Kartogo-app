import { describe, expect, it } from "vitest";
import { applyDeliveryZones, type DeliveryZone } from "./delivery-zones";
import { evaluateServiceability } from "./serviceability";
import { locationHasQuick } from "./delivery-tier";

const zone = (z: Partial<DeliveryZone>): DeliveryZone => ({
  id: z.id ?? "z", name: "Area", keyword: null, pincode: null, lat: null, lng: null,
  radius_km: 1, quick_enabled: true, eta_minutes: 15, is_active: true, ...z,
});

const run = (text: string, zones: DeliveryZone[], coords?: { lat: number; lng: number }) =>
  applyDeliveryZones(evaluateServiceability(text), zones, text, coords);

describe("Admin delivery areas", () => {
  it("admin turning Quick off for an area makes it Standard", () => {
    const r = run("Magunta Layout, Ongole", [zone({ name: "Magunta Layout", keyword: "magunta", quick_enabled: false, eta_minutes: 11 })]);
    expect(r.quick).toBe(false);
    expect(locationHasQuick({ serviceable: r.serviceable, etaMinutes: r.etaMinutes ?? undefined, quick: r.quick })).toBe(false);
  });

  it("admin turning Quick on for a far area gives it Quick", () => {
    const r = run("Throvagunta", [zone({ name: "Throvagunta", keyword: "throvagunta", quick_enabled: true, eta_minutes: 18 })]);
    expect(r.quick).toBe(true);
  });

  it("uses the admin's delivery time for the area", () => {
    const r = run("Lawyerpet, Ongole", [zone({ name: "Lawyerpet", keyword: "lawyerpet", eta_minutes: 22 })]);
    expect(r.etaMinutes).toBe(22);
  });

  it("a map point covers GPS positions inside its radius and wins over the area name", () => {
    const zones = [
      zone({ id: "name", name: "Magunta Layout", keyword: "magunta", quick_enabled: true, eta_minutes: 11 }),
      zone({ id: "point", name: "Magunta back lanes", lat: 15.5, lng: 80.05, radius_km: 0.5, quick_enabled: false, eta_minutes: 25 }),
    ];
    const inside = run("Magunta Layout, Ongole", zones, { lat: 15.502, lng: 80.05 });
    expect(inside.zoneId).toBe("point");
    expect(inside.quick).toBe(false);
    expect(inside.etaMinutes).toBe(25);
    const outside = run("Magunta Layout, Ongole", zones, { lat: 15.52, lng: 80.05 });
    expect(outside.zoneId).toBe("name");
  });

  it("a map point makes an unlisted place deliverable", () => {
    const r = run("Chimakurthy", [zone({ name: "Chimakurthy centre", lat: 15.58, lng: 79.87, radius_km: 2, eta_minutes: 30, quick_enabled: false })], { lat: 15.585, lng: 79.87 });
    expect(r.serviceable).toBe(true);
    expect(r.etaMinutes).toBe(30);
  });

  it("paused areas are ignored", () => {
    const r = run("Throvagunta", [zone({ keyword: "throvagunta", quick_enabled: true, is_active: false })]);
    expect(r.zoneId).toBeNull();
    expect(r.quick).toBe(false);
  });
});
