import { productShareUrl, PUBLIC_APP_ORIGIN } from "./share-link";
import { indiaDay, recommendPromoProduct, type PromoCustomer, type PromoProduct, type PromoQueue } from "./whatsapp-promo.shared";
import { whatsappChatUrl, whatsappMessage, whatsappPhone } from "./whatsapp-link";
import { popularProducts } from "./recommendations.server";

async function db() { return (await import("@/integrations/supabase/client.server")).supabaseAdmin; }

function failure(error: unknown): never {
  console.error("WhatsApp campaign operation failed", error);
  throw new Error("Could not save or load the WhatsApp campaign. Please refresh and try again.");
}

export async function promoProducts(): Promise<PromoProduct[]> {
  const client = await db();
  const products: PromoProduct[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from("catalog_items").select("id,name,category,price")
      .eq("is_deleted", false).gt("stock", 0).or(`expiry_date.is.null,expiry_date.gte.${indiaDay()}`)
      .order("id").range(offset, offset + 999);
    if (error) failure(error);
    for (const row of data ?? []) products.push({ id: row.id, name: row.name, category: row.category, price: Number(row.price), url: productShareUrl(row.id, PUBLIC_APP_ORIGIN) });
    if (!data || data.length < 1000) break;
  }
  return products;
}

export async function listPromos(search: string, page: number): Promise<PromoQueue> {
  const client = await db();
  const rows: Omit<PromoCustomer, "productId" | "productName" | "productUrl">[] = [];
  const seen = new Set<string>();
  let invalid = 0;
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.rpc("wa_pending_customers", { p_offset: offset, p_take: 500 });
    if (error) failure(error);
    for (const row of data ?? []) {
      const digits = whatsappPhone(row.phone);
      if (!digits) { invalid++; continue; }
      if (seen.has(digits)) continue;
      seen.add(digits);
      rows.push(row);
    }
    if (!data || data.length < 500) break;
  }
  const term = search.trim().toLowerCase();
  const filtered = rows.filter(c => !term || `${c.name} ${c.phone}`.toLowerCase().includes(term));
  const actualPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 25)));
  const visible = filtered.slice((actualPage - 1) * 25, actualPage * 25);
  const phones = visible.map(c => c.phone);
  const [products, popular, sentResult, skippedResult, preferences, categories] = await Promise.all([
    promoProducts(), popularProducts(400), client.rpc("wa_promo_sent_today"),
    client.from("customers").select("id", { count: "exact", head: true }).eq("promo_skipped", true),
    phones.length ? client.from("customer_product_preferences").select("phone,product_id,interest_score").in("phone", phones) : Promise.resolve({ data: [], error: null }),
    phones.length ? client.from("customer_category_preferences").select("phone,category,purchase_count").in("phone", phones) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [sentResult, skippedResult, preferences, categories]) if (result.error) failure(result.error);
  const customers = visible.map(c => {
    const product = recommendPromoProduct(products, (preferences.data ?? []).filter(p => p.phone === c.phone).map(p => ({ product_id: p.product_id, interest_score: Number(p.interest_score) })), (categories.data ?? []).filter(p => p.phone === c.phone).map(p => ({ category: p.category, purchase_count: Number(p.purchase_count) })), popular);
    return { ...c, productId: product?.id ?? null, productName: product?.name ?? null, productUrl: product?.url ?? null };
  });
  return { customers, products, page: actualPage, total: filtered.length, summary: { sent: Number(sentResult.data ?? 0), pending: rows.length, skipped: skippedResult.count ?? 0, invalid, day: indiaDay() } };
}

export async function assertPromoCustomer(id: string) {
  const client = await db();
  const [{ data: eligible, error: eligibilityError }, { data: customer, error }] = await Promise.all([
    client.rpc("wa_campaign_eligible", { p_customer: id }),
    client.from("customers").select("id,name,phone").eq("id", id).maybeSingle(),
  ]);
  if (error || eligibilityError) failure(error ?? eligibilityError);
  if (!eligible || !customer) throw new Error("This customer is no longer eligible. Refresh the recommendations.");
  if (!whatsappPhone(customer.phone)) throw new Error("This customer needs a valid international phone number.");
  return customer;
}

export async function assertPromoProduct(id: string) {
  const client = await db();
  const { data, error } = await client.from("catalog_items").select("id,name")
    .eq("id", id).eq("is_deleted", false).gt("stock", 0).or(`expiry_date.is.null,expiry_date.gte.${indiaDay()}`).maybeSingle();
  if (error) failure(error);
  if (!data) throw new Error("That product is no longer available. Select another product.");
  return data;
}

export async function preparePromo(id: string, productId: string) {
  const [customer, product] = await Promise.all([assertPromoCustomer(id), assertPromoProduct(productId)]);
  const { data, error } = await (await db()).rpc("wa_promo_sent_today");
  if (error) failure(error);
  if (Number(data) >= 25) throw new Error("Daily limit of 25 messages reached. Please return tomorrow.");
  const message = whatsappMessage(customer.name, product.name, product.id);
  return { url: whatsappChatUrl(customer.phone, message) };
}

export async function updatePromo(id: string, action: "sent" | "skip", productId: string | undefined, actor: string) {
  const client = await db();
  if (action === "sent") {
    if (!productId) throw new Error("Select a product first.");
    await Promise.all([assertPromoCustomer(id), assertPromoProduct(productId)]);
  }
  const result = action === "sent" && productId
    ? await client.rpc("claim_whatsapp_promo", { p_customer: id, p_admin: actor, p_product: productId, p_limit: 25 })
    : await client.rpc("skip_whatsapp_promo", { p_customer: id, p_admin: actor });
  if (result.error) {
    const message = result.error.message;
    if (/daily limit/i.test(message)) throw new Error("Daily limit of 25 messages reached. Please return tomorrow.");
    if (/eligible|processed|not found/i.test(message)) throw new Error("This customer is no longer eligible or was already processed. Refresh the list.");
    if (/not available/i.test(message)) throw new Error("That product is no longer available. Select another product.");
    failure(result.error);
  }
  return { sent: Number(result.data ?? 0) };
}

export async function customerConsent(token: string, optIn?: boolean) {
  const { verifyCustomerToken } = await import("./auth-tokens.server");
  const session = verifyCustomerToken(token);
  if (!session) throw new Error("Please sign in to manage WhatsApp consent.");
  const client = await db();
  if (typeof optIn === "boolean") {
    // Creates only the verified customer's missing profile, with all consent defaults still false.
    const { error: profileError } = await client.from("customers").upsert({ phone: session.phone }, { onConflict: "phone", ignoreDuplicates: true });
    if (profileError) failure(profileError);
    const { error } = await client.rpc("wa_set_consent", { p_phone: session.phone, p_opt_in: optIn });
    if (error) failure(error);
  }
  const { data, error } = await client.from("customers").select("whatsapp_marketing_opt_in,whatsapp_marketing_opt_in_at").eq("phone", session.phone).maybeSingle();
  if (error) failure(error);
  return { optedIn: data?.whatsapp_marketing_opt_in ?? false, optedInAt: data?.whatsapp_marketing_opt_in_at ?? null };
}