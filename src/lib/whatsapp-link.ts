import { toE164, validatePhoneNumber } from "./phone";
import { productShareUrl, PUBLIC_APP_ORIGIN } from "./share-link";

export const WHATSAPP_DAILY_LIMIT = 25;
export const WHATSAPP_CAMPAIGN = "registered_not_ordered";

/** The shared legacy normalizer is deliberately followed by strict validation. */
export function whatsappPhone(raw: string): string | null {
  const number = toE164(raw);
  return number && validatePhoneNumber(number) ? number.slice(1) : null;
}

export function whatsappMessage(name: string, productName: string, productId: string): string {
  const clean = (text: string) => text.replace(/[\r\n\u0000-\u001f]/g, " ").trim().slice(0, 160);
  return `Hi ${clean(name) || "there"}! 👋\n\nWelcome to Kartogo!\n\nWe thought you might like our ${clean(productName)}.\n\nExplore the product here:\n${productShareUrl(productId, PUBLIC_APP_ORIGIN)}\n\nHappy shopping! 🛍️\n\nTeam Kartogo`;
}

export function whatsappLink(phone: string, name: string, productName: string, productId: string): string {
  const digits = whatsappPhone(phone);
  if (!digits) throw new Error("Invalid phone number — include the country code for international numbers.");
  if (!productId || !productName) throw new Error("Please select an available product.");
  return `https://wa.me/${digits}?text=${encodeURIComponent(whatsappMessage(name, productName, productId))}`;
}

export function indiaDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export type PromoProduct = { id: string; name: string; price: number; image: string | null; category: string };
export type ProductPreference = { product_id: string; interest_score: number; purchase_count: number };
export function selectPromoProduct(products: PromoProduct[], prefs: ProductPreference[], predictions: { product_id: string; status: string; confidence_score: number }[], categories: { category: string; purchase_count: number; interest_score: number }[], popular: { productId: string; count: number }[]): PromoProduct | null {
  const byId = new Map(products.map(p => [p.id, p]));
  const preferred = [...prefs].sort((a,b) => b.interest_score-a.interest_score || b.purchase_count-a.purchase_count).find(p => byId.has(p.product_id));
  if (preferred) return byId.get(preferred.product_id) ?? null;
  const predicted = [...predictions].filter(p => ["DUE", "OVERDUE"].includes(p.status)).sort((a,b) => b.confidence_score-a.confidence_score).find(p => byId.has(p.product_id));
  if (predicted) return byId.get(predicted.product_id) ?? null;
  const sales = new Map(popular.map(p => [p.productId, p.count]));
  const ranked = [...products].sort((a,b) => (sales.get(b.id) ?? 0)-(sales.get(a.id) ?? 0) || a.name.localeCompare(b.name));
  const topCategory = [...categories].sort((a,b) => b.purchase_count-a.purchase_count || b.interest_score-a.interest_score).find(c => ranked.some(p => p.category === c.category));
  return (topCategory ? ranked.find(p => p.category === topCategory.category) : null) ?? ranked[0] ?? null;
}