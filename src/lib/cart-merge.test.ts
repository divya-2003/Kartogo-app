import { describe, expect, it } from "vitest";
import { mergeCartLines } from "./cart-merge";

describe("mergeCartLines (login keeps the account's cart and the guest additions)", () => {
  it("keeps every product from the saved cart and the items added before login", () => {
    const merged = mergeCartLines([{ productId: "milk", qty: 2 }], [{ productId: "bread", qty: 1 }]);
    expect(merged.map((l) => [l.productId, l.qty])).toEqual([["milk", 2], ["bread", 1]]);
  });
  it("uses the larger quantity when the same product is in both, so reloading never doubles it", () => {
    const merged = mergeCartLines([{ productId: "milk", qty: 2 }], [{ productId: "milk", qty: 3 }]);
    expect(merged).toEqual([{ productId: "milk", qty: 3, listing: undefined, unselected: undefined }]);
    expect(mergeCartLines(merged, merged)[0].qty).toBe(3);
  });
});
