// Food delivery menu. Shared by the /food page (display) and the server
// (price verification), so customers can never set their own prices.

export type Dish = {
  id: string;
  name: string;
  price: number;
  veg: boolean;
  desc: string;
  bestseller?: boolean;
  /** Optional add-ons shown in the customizer. */
  addons?: { id: string; name: string; price: number }[];
};

export type Kitchen = {
  id: string;
  name: string;
  cuisine: string;
  eta: number; // minutes
  pureVeg: boolean;
  image: string;
  tag?: string;
  dishes: Dish[];
};

const img = (q: string) => `https://images.unsplash.com/${q}?auto=format&fit=crop&w=800&q=70`;

export const FOOD_DELIVERY_FEE = 25;

export const KITCHENS: Kitchen[] = [
  {
    id: "andhra-ruchulu", name: "Andhra Ruchulu", cuisine: "Andhra meals · Biryani", eta: 30, pureVeg: false,
    image: img("photo-1563379091339-03b21ab4a4f8"), tag: "Daily special",
    dishes: [
      { id: "ar-1", name: "Chicken Dum Biryani", price: 229, veg: false, bestseller: true, desc: "Slow-cooked basmati, tender chicken, raita & salan.", addons: [{ id: "egg", name: "Extra boiled egg", price: 15 }, { id: "raita", name: "Extra raita", price: 20 }] },
      { id: "ar-2", name: "Andhra Veg Meals", price: 149, veg: true, desc: "Rice, pappu, two curries, sambar, rasam, curd & pickle.", addons: [{ id: "ghee", name: "Ghee", price: 15 }] },
      { id: "ar-3", name: "Gongura Mutton", price: 299, veg: false, desc: "Tangy sorrel-leaf mutton curry." },
      { id: "ar-4", name: "Paneer Biryani", price: 199, veg: true, desc: "Fragrant rice layered with spiced paneer." },
    ],
  },
  {
    id: "amma-tiffins", name: "Amma Tiffins", cuisine: "South Indian tiffins", eta: 20, pureVeg: true,
    image: img("photo-1589301760014-d929f3979dbc"), tag: "Tiffins",
    dishes: [
      { id: "at-1", name: "Ghee Karam Dosa", price: 79, veg: true, bestseller: true, desc: "Crisp dosa with spicy red chutney and ghee.", addons: [{ id: "chutney", name: "Extra chutney", price: 10 }] },
      { id: "at-2", name: "Idli (4 pcs)", price: 49, veg: true, desc: "Soft idlis with sambar and two chutneys." },
      { id: "at-3", name: "Pesarattu Upma", price: 89, veg: true, desc: "Green gram dosa stuffed with upma." },
      { id: "at-4", name: "Mysore Bajji", price: 59, veg: true, desc: "Fluffy fritters with coconut chutney." },
    ],
  },
  {
    id: "combo-kitchen", name: "Kartogo Combo Kitchen", cuisine: "Meal combos · North Indian", eta: 35, pureVeg: false,
    image: img("photo-1585937421612-70a008356fbe"), tag: "Meal combos",
    dishes: [
      { id: "ck-1", name: "Butter Chicken Combo", price: 249, veg: false, bestseller: true, desc: "Butter chicken, 2 butter naan, jeera rice, gulab jamun." },
      { id: "ck-2", name: "Paneer Thali", price: 199, veg: true, desc: "Paneer masala, dal, roti, rice, salad & sweet.", addons: [{ id: "roti", name: "Extra roti", price: 15 }] },
      { id: "ck-3", name: "Chole Bhature", price: 129, veg: true, desc: "Two bhature with spicy chole and onion salad." },
    ],
  },
];

export function findDish(dishId: string) {
  for (const k of KITCHENS) {
    const d = k.dishes.find(x => x.id === dishId);
    if (d) return { kitchen: k, dish: d };
  }
  return null;
}

export function dishUnitPrice(dish: Dish, addonIds: string[]) {
  return dish.price + (dish.addons ?? []).filter(a => addonIds.includes(a.id)).reduce((s, a) => s + a.price, 0);
}
