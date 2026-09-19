import { describe, it, expect } from "vitest";
import {
  canTransition,
  allowedNextStatuses,
  inventoryEffectFor,
  isOrderStatus,
  isTerminal,
} from "./order-status";

describe("order lifecycle transitions", () => {
  it("allows forward progress along the happy path", () => {
    expect(canTransition("placed", "packed").ok).toBe(true);
    expect(canTransition("packed", "out_for_delivery").ok).toBe(true);
    expect(canTransition("out_for_delivery", "delivered").ok).toBe(true);
  });

  it("allows skipping ahead but never going backwards", () => {
    expect(canTransition("placed", "delivered").ok).toBe(true);
    expect(canTransition("out_for_delivery", "packed").ok).toBe(false);
    expect(canTransition("delivered", "out_for_delivery").ok).toBe(false);
  });

  it("allows cancelling from any live state only", () => {
    expect(canTransition("placed", "cancelled").ok).toBe(true);
    expect(canTransition("out_for_delivery", "cancelled").ok).toBe(true);
    expect(canTransition("delivered", "cancelled").ok).toBe(false);
    expect(canTransition("cancelled", "placed").ok).toBe(false);
  });

  it("treats a same-status write as a harmless no-op", () => {
    expect(canTransition("packed", "packed").ok).toBe(true);
    expect(canTransition("delivered", "delivered").ok).toBe(true);
  });

  it("rejects unknown statuses", () => {
    expect(canTransition("placed", "shipped").ok).toBe(false);
    expect(canTransition(undefined, "packed").ok).toBe(false);
    expect(isOrderStatus("delivered")).toBe(true);
    expect(isOrderStatus("refunded")).toBe(false);
  });

  it("knows which states are terminal", () => {
    expect(isTerminal("delivered")).toBe(true);
    expect(isTerminal("cancelled")).toBe(true);
    expect(isTerminal("placed")).toBe(false);
  });

  it("offers operators only legal next statuses", () => {
    expect(allowedNextStatuses("placed")).toEqual([
      "packed",
      "out_for_delivery",
      "delivered",
      "cancelled",
    ]);
    expect(allowedNextStatuses("delivered")).toEqual([]);
    expect(allowedNextStatuses("cancelled")).toEqual([]);
  });
});

describe("inventory effects of a status", () => {
  it("commits held stock only on delivery", () => {
    expect(inventoryEffectFor("delivered")).toBe("commit");
  });

  it("releases held stock on cancellation", () => {
    expect(inventoryEffectFor("cancelled")).toBe("release");
  });

  it("leaves stock reserved while the order is in flight", () => {
    expect(inventoryEffectFor("placed")).toBe("none");
    expect(inventoryEffectFor("packed")).toBe("none");
    expect(inventoryEffectFor("out_for_delivery")).toBe("none");
  });
});
