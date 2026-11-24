import { whatsappPhone, selectPromoProduct, indiaDate, type PromoProduct } from "./whatsapp-link";
import { productShareUrl, PUBLIC_APP_ORIGIN } from "./share-link";
import { ensureFreshCustomer, popularProducts } from "./recommendations.server";

export async function pendingRecommendations(page: number, search: string) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const candidates: { id: string; name: string; phone: string; created_at: string }[] = [];
  for (let offset=0; ; offset+=500) {
    const { data, error } = await db.rpc("wa_pending_customers", { p_offset: offset, p_take: 500 });
    if (error) throw new Error("Could not load pending customers.");
    candidates.push(...(data ?? []));
    if ((data?.length ?? 0)<500) break;
  }
  const eligible = candidates.filter(c => whatsappPhone(c.phone));
  const invalid = candidates.filter(c => !whatsappPhone(c.phone));
  const term=search.toLowerCase();
  const filtered = eligible.filter(c => !term || c.name.toLowerCase().includes(term) || c.phone.includes(term));
  const pages=Math.max(1,Math.ceil(filtered.length/25));
  const currentPage=Math.min(page,pages);
  const batch=filtered.slice((currentPage-1)*25,currentPage*25);
  const [sentResult, skippedResult, popularity] = await Promise.all([
    db.rpc("wa_promo_sent_today"),
    db.from("customers").select("id", { count: "exact", head: true }).eq("promo_skipped",true),
    popularProducts(1000),
  ]);
  if (sentResult.error || skippedResult.error) throw new Error("Could not load campaign counts.");
  const products: PromoProduct[] = [];
  for (let offset=0; ; offset+=500) {
    const {data,error}=await db.from("catalog_items").select("id,name,price,image,category").eq("is_deleted",false).gt("stock",0).or(`expiry_date.is.null,expiry_date.gte.${indiaDate()}`).order("id").range(offset,offset+499);
    if(error) throw new Error("Could not load available products.");
    products.push(...(data ?? []));
    if((data?.length ?? 0)<500) break;
  }
  const customers = await Promise.all(batch.map(async c => {
    await ensureFreshCustomer(c.phone);
    const [pref, pred, cat] = await Promise.all([
      db.from("customer_product_preferences").select("product_id,interest_score,purchase_count").eq("phone",c.phone).order("interest_score",{ascending:false}).limit(120),
      db.from("customer_replenishment_predictions").select("product_id,status,confidence_score").eq("phone",c.phone).limit(120),
      db.from("customer_category_preferences").select("category,purchase_count,interest_score").eq("phone",c.phone).limit(100),
    ]);
    if(pref.error || pred.error || cat.error) throw new Error("Could not load customer recommendations.");
    const product=selectPromoProduct(products,pref.data ?? [],pred.data ?? [],cat.data ?? [],popularity);
    return { ...c, productId: product?.id ?? null, productName: product?.name ?? null, productUrl: product ? productShareUrl(product.id,PUBLIC_APP_ORIGIN) : null };
  }));
  return {customers,products,invalid:invalid.slice(0,25),invalidCount:invalid.length,page:currentPage,pages,total:filtered.length,pending:eligible.length,sent:sentResult.data ?? 0,skipped:skippedResult.count ?? 0};
}