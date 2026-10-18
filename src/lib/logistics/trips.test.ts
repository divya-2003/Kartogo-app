import { describe, expect, it } from "vitest";
import { compatibleTrip, sequenceStops, type TripOrder } from "./trips";
const point = { lat: 15.5, lng: 80.05 };
function order(id: string, marketId = "a", delta = 0): TripOrder {
  return { id, ready: true, quick: true, pickups: [{ kind: "pickup", orderId: id, marketId, label: marketId, address: "store", point: { ...point, lat: point.lat + delta }, done: false }], drop: { kind: "drop", orderId: id, marketId: "", label: id, address: "door", point: { ...point, lat: point.lat + .008 }, done: false } };
}
describe("safe multi-stop trips", () => {
  it("allows two ready side-by-side stores inside 200 metres and four minutes", () => expect(compatibleTrip([order("1"), order("2", "b", .001)], 240)).toBe(true));
  it("rejects stores beyond 200 metres", () => expect(compatibleTrip([order("1"), order("2", "b", .002)], 120)).toBe(false));
  it("rejects extra pickup time above four minutes or unknown road time", () => { expect(compatibleTrip([order("1"), order("2", "b", .001)], 241)).toBe(false); expect(compatibleTrip([order("1"), order("2", "b", .001)], null)).toBe(false); });
  it("never allows a third store", () => expect(compatibleTrip([order("1"), order("2", "b"), order("3", "c")], 120)).toBe(false));
  it("limits trips to three orders", () => expect(compatibleTrip([order("1"), order("2"), order("3"), order("4")], 0)).toBe(false));
  it("requires every store order to be ready", () => expect(compatibleTrip([order("1"), { ...order("2"), ready: false }], 0)).toBe(false));
  it("does not batch drops outside the 1.2 kilometre corridor", () => { const far = order("2"); far.drop.point = { ...point, lat: point.lat + .03 }; expect(compatibleTrip([order("1"), far], 0)).toBe(false); });
  it("collects all orders before their drops and preserves the exact address", () => { const orders = [order("1"), order("2", "b", .001)]; orders[0].drop.address = "Flat 201, Sai Residency, Near SBI ATM"; const route = sequenceStops(point, orders); for (const o of orders) expect(route.findIndex(s => s.kind === "pickup" && s.orderId === o.id)).toBeLessThan(route.findIndex(s => s.kind === "drop" && s.orderId === o.id)); expect(route.find(s => s.kind === "drop" && s.orderId === "1")?.address).toBe("Flat 201, Sai Residency, Near SBI ATM"); });
});