import { describe, expect, it } from "vitest";
import { clickLabel, findIncompleteActions, groupCustomerActivity, type ActivityEvent } from "./customer-activity";

let n = 0;
const ev = (event_type: string, minute: number, extra: Partial<ActivityEvent> = {}): ActivityEvent => ({
  id: `e${++n}`, phone: "9110310034", session_id: "s1", event_type, product_id: null, category: null,
  order_id: null, search_query: null, metadata: {}, created_at: new Date(Date.UTC(2026, 10, 7, 8, minute)).toISOString(), ...extra,
});

describe("incomplete customer actions", () => {
  it("flags a product added to cart that was never bought or removed", () => {
    const out = findIncompleteActions([ev("PRODUCT_ADDED_TO_CART", 1, { product_id: "p1" })]);
    expect(out.map(o => o.kind)).toEqual(["LEFT_IN_CART"]);
    expect(out[0].productIds).toEqual(["p1"]);
  });
  it("does not flag a product that was bought after being added", () => {
    const out = findIncompleteActions([
      ev("PRODUCT_ADDED_TO_CART", 1, { product_id: "p1" }),
      ev("CHECKOUT_STARTED", 2), ev("PAYMENT_STARTED", 3), ev("ORDER_PLACED", 4),
      ev("PRODUCT_PURCHASED", 4, { product_id: "p1" }),
    ]);
    expect(out).toEqual([]);
  });
  it("does not flag a product removed from the cart", () => {
    expect(findIncompleteActions([
      ev("PRODUCT_ADDED_TO_CART", 1, { product_id: "p1" }),
      ev("PRODUCT_REMOVED_FROM_CART", 2, { product_id: "p1" }),
    ])).toEqual([]);
  });
  it("flags checkout and payment started after the last order", () => {
    const out = findIncompleteActions([ev("ORDER_PLACED", 1), ev("CHECKOUT_STARTED", 5), ev("PAYMENT_STARTED", 6)]);
    expect(out.map(o => o.kind)).toEqual(["CHECKOUT_NOT_FINISHED", "PAYMENT_NOT_FINISHED"]);
  });
});

describe("grouping events per customer", () => {
  it("folds a guest session into the phone number that later signed in", () => {
    const groups = groupCustomerActivity([
      ev("ELEMENT_CLICKED", 1, { phone: null, session_id: "s9" }),
      ev("PRODUCT_VIEWED", 2, { phone: "9000000001", session_id: "s9" }),
    ], { "9000000001": "Ravi" });
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("Ravi");
    expect(groups[0].counts.ELEMENT_CLICKED).toBe(1);
  });
});

describe("click labels", () => {
  it("hides long digit runs such as phone numbers", () => {
    expect(clickLabel("Call 9177068427 now")).toBe("Call ••• now");
  });
});
