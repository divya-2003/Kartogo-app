import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Explicit opt-in only: fixtures are private, never contacted and always removed.
const enabled = process.env["KARTOGO_WHATSAPP_DB_TEST"] === "1";
describe.skipIf(!enabled)("WhatsApp campaign database rules", () => {
  const db = createClient<Database>(process.env["SUPABASE_URL"] ?? "http://localhost", process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "missing", { auth: { persistSession: false, autoRefreshToken: false } });
  const prefix = `wa-test-${crypto.randomUUID()}`;
  const ids: string[] = [];
  const phones: string[] = [];
  const today = new Date().toISOString();
  const old = new Date(Date.now()-48*3_600_000).toISOString();
  let productId = "";
  const expiredId = `${prefix}-expired`;
  const outId = `${prefix}-out`;
  let plain = "", young = "", eligible = "", cancelled = "", delivered = "", skipId = "", duplicateId = "", withdrawn = "";

  async function customer(overrides: Record<string, unknown> = {}) {
    const id = crypto.randomUUID();
    const phone = `+1202555${String(100+ids.length).padStart(4,"0")}`;
    ids.push(id); phones.push(phone);
    const { error } = await db.from("customers").insert({ id, phone, name: prefix, created_at: old, whatsapp_marketing_opt_in: true, whatsapp_marketing_opt_in_at: old, ...overrides });
    if (error) throw new Error(error.message);
    return id;
  }
  const mark = (id: string, product = productId) => db.rpc("claim_whatsapp_promo", { p_customer: id, p_admin: prefix, p_product: product });

  beforeAll(async () => {
    const {data:sent,error:countError}=await db.rpc("wa_promo_sent_today");
    if(countError || sent !== 0) throw new Error("Only run fixture tests on a day with no real campaign sends.");
    const products=await db.from("catalog_items").select("id,expiry_date").eq("is_deleted",false).gt("stock",0);
    productId=products.data?.find(p=>!p.expiry_date || p.expiry_date>=today.slice(0,10))?.id ?? "";
    if(!productId) throw new Error("No available product for integration tests.");
    const bad=await db.from("catalog_items").insert([
      {id:expiredId,name:prefix,category:"grocery",price:1,stock:1,expiry_date:"2000-01-01"},
      {id:outId,name:prefix,category:"grocery",price:1,stock:0},
    ]);
    if(bad.error) throw new Error(bad.error.message);
    plain=await customer({whatsapp_marketing_opt_in:false,whatsapp_marketing_opt_in_at:null});
    young=await customer({created_at:today});
    eligible=await customer(); cancelled=await customer(); delivered=await customer();
    skipId=await customer(); duplicateId=await customer(); withdrawn=await customer();
    const orders=await db.from("app_orders").insert([
      {id:`${prefix}-cancelled`,customer_phone:phones[3] ?? "",customer_name:prefix,address:"Test only",status:"cancelled"},
      {id:`${prefix}-delivered`,customer_phone:phones[4] ?? "",customer_name:prefix,address:"Test only",status:"delivered"},
    ]);
    if(orders.error) throw new Error(orders.error.message);
  },60_000);

  afterAll(async () => {
    // Only this run's generated identifiers are touched.
    const results = await Promise.all([
      db.from("admin_audit_log").delete().eq("actor",prefix),
      db.from("app_orders").delete().in("id",[`${prefix}-cancelled`,`${prefix}-delivered`]),
      db.from("order_status_log").delete().in("order_id",[`${prefix}-cancelled`,`${prefix}-delivered`]),
      db.from("customers").delete().in("id",ids),
      db.from("catalog_items").delete().in("id",[expiredId,outId]),
    ]);
    for(const result of results) if(result.error) throw new Error(`Fixture cleanup failed: ${result.error.message}`);
  },60_000);

  it("defaults existing/new customers to opted out and excludes under-24h records",async()=>{
    const defaults=await db.from("customers").insert({phone:`+12025559999`,name:prefix}).select("id,whatsapp_marketing_opt_in,whatsapp_marketing_opt_in_at").single();
    if(defaults.data) ids.push(defaults.data.id);
    expect(defaults.error).toBeNull();
    expect(defaults.data?.whatsapp_marketing_opt_in).toBe(false);
    expect(defaults.data?.whatsapp_marketing_opt_in_at).toBeNull();
    const queue=await db.rpc("wa_pending_customers",{p_offset:0,p_take:500});
    expect(queue.error).toBeNull();
    const pending=queue.data?.map(c=>c.id) ?? [];
    expect(pending).toContain(eligible);
    expect(pending).not.toContain(plain); expect(pending).not.toContain(young);
  });
  it("excludes both delivered and cancelled submitted orders",async()=>{
    expect((await db.rpc("wa_customer_has_order",{p_customer:cancelled})).data).toBe(true);
    expect((await db.rpc("wa_customer_has_order",{p_customer:delivered})).data).toBe(true);
    expect((await mark(cancelled)).error).not.toBeNull(); expect((await mark(delivered)).error).not.toBeNull();
    expect((await db.rpc("wa_customer_has_order",{p_customer:eligible})).data).toBe(false);
  });
  it("rechecks voluntary consent, age and live product availability on sent actions",async()=>{
    expect((await mark(plain)).error).not.toBeNull(); expect((await mark(young)).error).not.toBeNull();
    expect((await mark(eligible,expiredId)).error).not.toBeNull(); expect((await mark(eligible,outId)).error).not.toBeNull();
    const change=await db.rpc("wa_set_consent",{p_phone:phones[7] ?? "",p_opt_in:false});
    expect(change.error).toBeNull(); expect(change.data).toBe(false);
    expect((await mark(withdrawn)).error).not.toBeNull();
    expect((await db.rpc("wa_promo_sent_today")).data).toBe(0);
  });
  it("skips once without consuming a daily message and audits the campaign",async()=>{
    const skip=await db.rpc("skip_whatsapp_promo",{p_customer:skipId,p_admin:prefix});
    expect(skip.error).toBeNull(); expect(skip.data).toBe(0);
    expect((await mark(skipId)).error).not.toBeNull();
    expect((await db.rpc("skip_whatsapp_promo",{p_customer:skipId,p_admin:prefix})).error).not.toBeNull();
    const audit=await db.from("admin_audit_log").select("details").eq("actor",prefix).eq("entity_id",skipId);
    expect(audit.data).toHaveLength(1);
    expect(audit.data?.[0]?.details).toMatchObject({campaign:"registered_not_ordered",action:"skip",customer_id:skipId,admin_id:prefix});
  });
  it("two simultaneous marks for the same customer commit one sent and one audit",async()=>{
    const results=await Promise.all([mark(duplicateId),mark(duplicateId)]);
    expect(results.filter(r=>!r.error)).toHaveLength(1);
    expect((await db.rpc("wa_promo_sent_today")).data).toBe(1);
    const c=await db.from("customers").select("promo_sent_at").eq("id",duplicateId).single();
    expect(c.data?.promo_sent_at).not.toBeNull();
    const audit=await db.from("admin_audit_log").select("details").eq("actor",prefix).eq("entity_id",duplicateId);
    expect(audit.data).toHaveLength(1);
    expect(audit.data?.[0]?.details).toMatchObject({campaign:"registered_not_ordered",action:"sent",product_id:productId,customer_id:duplicateId,admin_id:prefix});
  });
  it("allows only two of five concurrent requests when 23 have been confirmed",async()=>{
    for(let n=0;n<22;n++) await customer({promo_sent_at:today});
    expect((await db.rpc("wa_promo_sent_today")).data).toBe(23);
    const extra=await Promise.all(Array.from({length:5},()=>customer()));
    const results=await Promise.all(extra.map(id=>mark(id)));
    expect(results.filter(r=>!r.error)).toHaveLength(2);
    expect((await db.rpc("wa_promo_sent_today")).data).toBe(25);
    expect((await mark(eligible)).error).not.toBeNull();
    const bypass=await db.rpc("claim_whatsapp_promo",{p_customer:eligible,p_admin:prefix,p_product:productId,p_limit:999});
    expect(bypass.error).not.toBeNull();
  },60_000);
});