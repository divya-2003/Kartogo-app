import { describe, expect, it } from "vitest";
import { allowedActions, canUse, defaultSettings, generateSlots, initialStatusFor, legacyStatusFor, stockState, studioKindOf } from "./studio";

describe("Partner Studio access", () => {
  it("furniture sellers get inventory and enquiries", () => {
    expect(studioKindOf({ partner_type: "FURNITURE_SELLER" })).toBe("furniture");
    expect(canUse("furniture", "inventory")).toBe(true);
    expect(canUse("furniture", "enquiries")).toBe(true);
  });
  it("service providers never get inventory", () => {
    expect(studioKindOf({ partner_type: "SERVICE_PROVIDER" })).toBe("service");
    expect(canUse("service", "inventory")).toBe(false);
    expect(canUse("service", "services")).toBe(true);
    expect(canUse("service", "availability")).toBe(true);
  });
});

describe("appointment engine", () => {
  const s = { ...defaultSettings("10:00", "12:00"), slot_minutes: 30 };
  const date = "2026-11-18"; // Wednesday
  it("instant booking confirms, approval waits", () => {
    expect(initialStatusFor("INSTANT")).toBe("CONFIRMED");
    expect(initialStatusFor("SELLER_APPROVAL")).toBe("PENDING");
    expect(initialStatusFor("BOOKING_REQUEST")).toBe("PENDING");
  });
  it("offers slots inside opening hours only", () => {
    expect(generateSlots({ date, settings: s, booked: [] }).map(x => x.time)).toEqual(["10:00", "10:30", "11:00", "11:30"]);
  });
  it("blocks a full slot (max 1 per slot)", () => {
    const slots = generateSlots({ date, settings: s, booked: [{ start: "10:30", end: "11:00" }] });
    expect(slots.map(x => x.time)).not.toContain("10:30");
  });
  it("allows a second booking when 2 per slot are allowed", () => {
    const slots = generateSlots({ date, settings: { ...s, max_per_slot: 2 }, booked: [{ start: "10:30", end: "11:00" }] });
    expect(slots.find(x => x.time === "10:30")?.remaining).toBe(1);
  });
  it("skips breaks, holidays and closed days", () => {
    expect(generateSlots({ date, settings: { ...s, breaks: [{ start: "11:00", end: "11:30" }] }, booked: [] }).map(x => x.time)).not.toContain("11:00");
    expect(generateSlots({ date, settings: s, holidays: [date], booked: [] })).toEqual([]);
    expect(generateSlots({ date, settings: { ...s, date_overrides: { [date]: { closed: true } } }, booked: [] })).toEqual([]);
  });
  it("never double-books a professional, including buffer time", () => {
    const slots = generateSlots({ date, settings: { ...s, max_per_slot: 5, buffer_minutes: 15 }, staffIds: ["a"], booked: [{ start: "10:00", end: "10:30", staffId: "a" }] });
    expect(slots.map(x => x.time)).toEqual(["11:00", "11:30"]);
  });
});

describe("status rules", () => {
  it("only open appointments can be acted on", () => {
    expect(allowedActions("PENDING")).toContain("ACCEPT");
    expect(allowedActions("CONFIRMED")).toContain("NO_SHOW");
    expect(allowedActions("COMPLETED")).toEqual([]);
    expect(allowedActions("CANCELLED")).toEqual([]);
  });
  it("keeps the customer's booking status in step", () => {
    expect(legacyStatusFor("CONFIRMED", "BOOKING_REQUESTED")).toBe("PROVIDER_CONFIRMED");
    expect(legacyStatusFor("REJECTED", "BOOKING_REQUESTED")).toBe("CANCELLED");
    expect(legacyStatusFor("COMPLETED", "PROVIDER_CONFIRMED")).toBe("SERVICE_COMPLETED");
  });
  it("flags low and out-of-stock furniture", () => {
    expect(stockState(0, 3)).toBe("out");
    expect(stockState(2, 3)).toBe("low");
    expect(stockState(10, 3)).toBe("in");
    expect(stockState(null)).toBe("untracked");
  });
});
