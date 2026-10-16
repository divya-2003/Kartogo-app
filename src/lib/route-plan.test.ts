import { describe, expect, it } from "vitest";
import { planStops, MAX_FOOD_STOPS } from "./route-plan";

const job = (id: string, kitchen: string, status: string, at: string, ks = "NEW") => ({
  id, order_code: id, status, title: kitchen, accepted_at: at, details: { kitchen_id: kitchen, kitchen_status: ks, address: { line: `Addr ${id}` } },
});

describe("rider stop sequencing", () => {
  it("collects from every kitchen before any drop", () => {
    const stops = planStops([job("A", "k1", "ACCEPTED", "1"), job("B", "k2", "ACCEPTED", "2")]);
    expect(stops.map(s => s.type)).toEqual(["PICKUP", "PICKUP", "DROP", "DROP"]);
  });
  it("visits a shared kitchen once", () => {
    const stops = planStops([job("A", "k1", "ACCEPTED", "1"), job("B", "k1", "ACCEPTED", "2")]);
    expect(stops.filter(s => s.type === "PICKUP")).toHaveLength(1);
  });
  it("delivers the first collected order first", () => {
    const stops = planStops([job("B", "k2", "PICKED_UP", "2"), job("A", "k1", "PICKED_UP", "1")]);
    expect(stops.map(s => s.code)).toEqual(["A", "B"]);
  });
  it("caps a rider at 3 food orders", () => { expect(MAX_FOOD_STOPS).toBe(3); });
});
