// Authoritative product catalog used to recompute order totals on the server.
// The browser never gets to decide prices — totals are always rebuilt here from
// these values, so a crafted "total: 0" order is impossible. Keep this in sync
// with src/lib/data.ts (this copy intentionally has no image imports so it stays
// a lightweight server module).
export type CatalogEntry = { name: string; price: number };

export const CATALOG: Record<string, CatalogEntry> = {
  p1: { name: "Andhra Avakaya Pickle", price: 180 },
  p2: { name: "Guntur Red Chilli Powder", price: 140 },
  p3: { name: "Sambar Powder", price: 95 },
  p4: { name: "Murukku (Hot)", price: 60 },
  p5: { name: "Mixture Namkeen", price: 80 },
  p6: { name: "Maggi 2-Min Noodles", price: 14 },
  p7: { name: "Yippee Magic Masala", price: 14 },
  p8: { name: "Classmate Notebook 200pg", price: 75 },
  p9: { name: "Reynolds Ball Pen (Blue)", price: 10 },
  p10: { name: "Park Avenue Soap", price: 55 },
  p11: { name: "Gillette Razor", price: 45 },
  p12: { name: "Idli Dosa Batter", price: 60 },
  p13: { name: "Ragi Dosa Batter", price: 75 },
  p14: { name: "Camphor Cubes", price: 35 },
  p15: { name: "Agarbatti — Sandalwood", price: 40 },
  p16: { name: "Lemon Pickle", price: 150 },
  p17: { name: "Banana Chips", price: 70 },
  p18: { name: "Lays Classic Salted", price: 20 },
  p19: { name: "Bru Coffee Powder", price: 85 },
  p20: { name: "Tetley Tea Powder", price: 95 },
};
