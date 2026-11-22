import { describe, expect, it } from "vitest";
import { filterInventory, type InventoryFilter } from "./inventory-filter";

const items = [
  { name: "Ragi Batter", unit: "1 kg", category: "tiffin-batter", stock: 0 },
  { name: "Milk", unit: "500 ml", category: "dairy", stock: 3 },
  { name: "Rice", unit: "5 kg", category: "staples", stock: 5 },
  { name: "Soap", unit: "1 pc", category: "personal", stock: 6 },
  { name: "Atta", unit: "10 kg", category: "staples", stock: 40 },
];
const base: InventoryFilter = { q: "", stockFilter: "all", min: "", max: "", sort: "default" };
const names = (f: Partial<InventoryFilter>) => filterInventory(items, { ...base, ...f }).map(p => p.name);

describe("admin inventory stock filter", () => {
  it("out of stock shows only items with 0 left", () => {
    expect(names({ stockFilter: "out" })).toEqual(["Ragi Batter"]);
  });
  it("low shows 1 to 5 left", () => {
    expect(names({ stockFilter: "low" })).toEqual(["Milk", "Rice"]);
  });
  it("in stock shows 6 or more", () => {
    expect(names({ stockFilter: "ok" })).toEqual(["Soap", "Atta"]);
  });
  it("filters by a typed stock number range", () => {
    expect(names({ min: "3", max: "6" })).toEqual(["Milk", "Rice", "Soap"]);
  });
  it("sorts by stock low to high", () => {
    expect(names({ sort: "stock-asc" })).toEqual(["Ragi Batter", "Milk", "Rice", "Soap", "Atta"]);
  });
});
