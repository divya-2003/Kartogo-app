export const WHATSAPP_CAMPAIGN = "registered_not_ordered";
export const WHATSAPP_DAILY_LIMIT = 25;
export const WHATSAPP_WAIT_MS = 24 * 60 * 60 * 1000;

export type PromoProduct = { id: string; name: string; category: string; price: number; url: string };
export type PromoCustomer = { id: string; name: string; phone: string; created_at: string; productId: string | null; productName: string | null; productUrl: string | null };
export type PromoSummary = { sent: number; pending: number; skipped: number; invalid: number; day: string };
export type PromoQueue = { customers: PromoCustomer[]; products: PromoProduct[]; total: number; page: number; summary: PromoSummary };

export function indiaDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function promoEligible(customer: { whatsapp_marketing_opt_in: boolean; whatsapp_marketing_opt_in_at: string | null; created_at: string; promo_sent_at: string | null; promo_skipped: boolean }, hasSubmittedOrder: boolean, now = new Date()): boolean {
  return customer.whatsapp_marketing_opt_in && Boolean(customer.whatsapp_marketing_opt_in_at) && !customer.promo_sent_at && !customer.promo_skipped && !hasSubmittedOrder && Number.isFinite(Date.parse(customer.created_at)) && now.getTime() - Date.parse(customer.created_at) >= WHATSAPP_WAIT_MS;
}

export function activePromoProduct(product: { is_deleted: boolean; stock: number; expiry_date: string | null }, now = new Date()): boolean {
  return product.is_deleted === false && product.stock > 0 && (!product.expiry_date || product.expiry_date >= indiaDay(now));
}

export function recommendPromoProduct(products: PromoProduct[], preferences: { product_id: string; interest_score: number }[], categories: { category: string; purchase_count: number }[], popular: { productId: string; count: number }[]): PromoProduct | null {
  const byId = new Map(products.map(p => [p.id, p]));
  const interest = [...preferences].sort((a, b) => b.interest_score - a.interest_score || a.product_id.localeCompare(b.product_id));
  for (const pref of interest) { const product = byId.get(pref.product_id); if (product && pref.interest_score > 0) return product; }
  const sales = new Map(popular.map(p => [p.productId, p.count]));
  const ranked = [...products].sort((a, b) => (sales.get(b.id) ?? 0) - (sales.get(a.id) ?? 0) || a.id.localeCompare(b.id));
  const category = [...categories].filter(c => c.purchase_count > 0).sort((a, b) => b.purchase_count - a.purchase_count || a.category.localeCompare(b.category))[0];
  if (category) { const product = ranked.find(p => p.category === category.category); if (product) return product; }
  return ranked[0] ?? null;
}