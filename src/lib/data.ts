import p1 from "@/assets/products/p1.jpg";
import p2 from "@/assets/products/p2.jpg";
import p3 from "@/assets/products/p3.jpg";
import p4 from "@/assets/products/p4.jpg";
import p5 from "@/assets/products/p5.jpg";
import p6 from "@/assets/products/p6.jpg";
import p7 from "@/assets/products/p7.jpg";
import p8 from "@/assets/products/p8.jpg";
import p9 from "@/assets/products/p9.jpg";
import p10 from "@/assets/products/p10.jpg";
import p11 from "@/assets/products/p11.jpg";
import p12 from "@/assets/products/p12.jpg";
import p13 from "@/assets/products/p13.jpg";
import p14 from "@/assets/products/p14.jpg";
import p15 from "@/assets/products/p15.jpg";
import p16 from "@/assets/products/p16.jpg";
import p17 from "@/assets/products/p17.jpg";
import p18 from "@/assets/products/p18.jpg";
import p19 from "@/assets/products/p19.jpg";
import p20 from "@/assets/products/p20.jpg";

const IMG: Record<string, string> = { p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19, p20 };

export type Category = {
  slug: string;
  name: string;
  emoji: string;
  tint: string; // tailwind bg class
};

export type Product = {
  id: string;
  name: string;
  category: string;
  price: number; // INR
  mrp?: number;
  unit: string;
  stock: number;
  emoji: string;
  image?: string;
  description: string;
  tags?: string[];
};

export const CATEGORIES: Category[] = [
  { slug: "snacks", name: "Snacks", emoji: "🍿", tint: "bg-saffron/20" },
  { slug: "instant-food", name: "Instant Food", emoji: "🍜", tint: "bg-primary/15" },
  { slug: "stationery", name: "Stationery", emoji: "✏️", tint: "bg-leaf/15" },
  { slug: "grooming", name: "Grooming", emoji: "🧴", tint: "bg-saffron/15" },
  { slug: "pickles", name: "Pickles", emoji: "🥒", tint: "bg-primary/15" },
  { slug: "spice-powders", name: "Spice Powders", emoji: "🌶️", tint: "bg-saffron/25" },
  { slug: "local-snacks", name: "Local Snacks", emoji: "🥟", tint: "bg-leaf/15" },
  { slug: "pooja", name: "Pooja Items", emoji: "🪔", tint: "bg-saffron/25" },
  { slug: "tiffin-batter", name: "Tiffin Batter", emoji: "🥞", tint: "bg-primary/15" },
  { slug: "beverages", name: "Beverages", emoji: "☕", tint: "bg-leaf/15" },
];

const RAW_PRODUCTS: Product[] = [
  { id: "p1", name: "Andhra Avakaya Pickle", category: "pickles", price: 180, mrp: 260, unit: "250g jar", stock: 32, emoji: "🥭", description: "Traditional mango pickle from Ongole homes — fiery, oil-rich, ready to pair with curd rice." },
  { id: "p2", name: "Guntur Red Chilli Powder", category: "spice-powders", price: 140, mrp: 190, unit: "200g pack", stock: 60, emoji: "🌶️", description: "Stone-ground Guntur chillies. Bright red, sharp heat." },
  { id: "p3", name: "Sambar Powder", category: "spice-powders", price: 95, mrp: 130, unit: "200g pack", stock: 44, emoji: "🍲", description: "House-roasted dal and spice blend." },
  { id: "p4", name: "Murukku (Hot)", category: "local-snacks", price: 60, mrp: 80, unit: "200g", stock: 25, emoji: "🥨", description: "Crunchy rice-flour murukku, fresh batch daily." },
  { id: "p5", name: "Mixture Namkeen", category: "snacks", price: 80, mrp: 110, unit: "250g", stock: 50, emoji: "🥜", description: "Spicy South Indian mixture with peanuts and curry leaves." },
  { id: "p6", name: "Maggi 2-Min Noodles", category: "instant-food", price: 14, mrp: 18, unit: "70g pack", stock: 120, emoji: "🍜", description: "Classic masala noodles." },
  { id: "p7", name: "Yippee Magic Masala", category: "instant-food", price: 14, mrp: 18, unit: "70g pack", stock: 100, emoji: "🍝", description: "Non-sticky long noodles." },
  { id: "p8", name: "Classmate Notebook 200pg", category: "stationery", price: 75, mrp: 110, unit: "1 unit", stock: 40, emoji: "📒", description: "Single-line ruled notebook." },
  { id: "p9", name: "Reynolds Ball Pen (Blue)", category: "stationery", price: 10, mrp: 20, unit: "1 unit", stock: 200, emoji: "🖊️", description: "Smooth writing classic." },
  { id: "p10", name: "Park Avenue Soap", category: "grooming", price: 55, mrp: 75, unit: "125g", stock: 35, emoji: "🧼", description: "Refreshing daily-use soap." },
  { id: "p11", name: "Gillette Razor", category: "grooming", price: 45, mrp: 65, unit: "1 unit", stock: 28, emoji: "🪒", description: "Disposable twin-blade razor." },
  { id: "p12", name: "Idli Dosa Batter", category: "tiffin-batter", price: 60, mrp: 85, unit: "1 kg pouch", stock: 18, emoji: "🥞", description: "Freshly ground rice and urad dal batter — same-day delivery only." },
  { id: "p13", name: "Ragi Dosa Batter", category: "tiffin-batter", price: 75, mrp: 100, unit: "1 kg pouch", stock: 12, emoji: "🌾", description: "Wholesome ragi-based batter." },
  { id: "p14", name: "Camphor Cubes", category: "pooja", price: 35, mrp: 50, unit: "50g box", stock: 70, emoji: "🪔", description: "Pure camphor for daily aarti." },
  { id: "p15", name: "Agarbatti — Sandalwood", category: "pooja", price: 40, mrp: 55, unit: "20 sticks", stock: 90, emoji: "🕉️", description: "Long-lasting sandal fragrance." },
  { id: "p16", name: "Lemon Pickle", category: "pickles", price: 150, mrp: 210, unit: "250g jar", stock: 22, emoji: "🍋", description: "Tangy lemon pickle, less oil." },
  { id: "p17", name: "Banana Chips", category: "local-snacks", price: 70, mrp: 95, unit: "200g", stock: 38, emoji: "🍌", description: "Coconut-oil fried Kerala-style chips." },
  { id: "p18", name: "Lays Classic Salted", category: "snacks", price: 20, mrp: 30, unit: "52g", stock: 80, emoji: "🥔", description: "Crispy salted potato chips." },
];

export const PRODUCTS: Product[] = RAW_PRODUCTS.map(p => ({ ...p, image: IMG[p.id] }));

export const DELIVERY_BOYS = [
  { id: "d1", name: "Ravi Kumar", phone: "9876500001", active: true },
  { id: "d2", name: "Suresh M.", phone: "9876500002", active: true },
  { id: "d3", name: "Naveen P.", phone: "9876500003", active: false },
];




export const formatINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
