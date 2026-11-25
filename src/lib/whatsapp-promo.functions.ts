import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { whatsappPhone, whatsappLink } from "./whatsapp-link";

export const listPendingPromosFn=createServerFn({method:"POST"})
  .inputValidator((input:unknown)=>z.object({adminToken:z.string().min(10).max(800),page:z.number().int().min(1).default(1),search:z.string().max(100).default("")}).parse(input))
  .handler(async({data})=>{
    const {requireActiveAdmin,requireAdminPermission}=await import("./admin-session.server");
    await requireActiveAdmin(data.adminToken);
    await requireAdminPermission(data.adminToken,"whatsapp_promos");
    const {pendingRecommendations}=await import("./whatsapp-promo.server");
    return pendingRecommendations(data.page,data.search);
  });

export const updatePromoStatusFn=createServerFn({method:"POST"})
  .inputValidator((input:unknown)=>z.object({adminToken:z.string().min(10).max(800),userId:z.string().uuid(),action:z.enum(["sent","skip"]),productId:z.string().min(1).max(200).optional()}).parse(input))
  .handler(async({data})=>{
    const {requireActiveAdmin,requireAdminPermission}=await import("./admin-session.server");
    await requireActiveAdmin(data.adminToken);
    const actor=await requireAdminPermission(data.adminToken,"whatsapp_promos");
    const {supabaseAdmin:db}=await import("@/integrations/supabase/client.server");
    if(data.action==="sent") {
      if(!data.productId) throw new Error("Please select an available product.");
      const {data:customer,error}=await db.from("customers").select("phone").eq("id",data.userId).maybeSingle();
      if(error || !customer) throw new Error("Customer could not be found.");
      if(!whatsappPhone(customer.phone)) throw new Error("Customer phone number is invalid.");
      const result=await db.rpc("claim_whatsapp_promo",{p_customer:data.userId,p_admin:actor,p_product:data.productId});
      if(result.error) throw new Error(result.error.message);
      return {sent:result.data};
    }
    const result=await db.rpc("skip_whatsapp_promo",{p_customer:data.userId,p_admin:actor});
    if(result.error) throw new Error(result.error.message);
    return {sent:result.data};
  });

export const getWhatsappConsentFn=createServerFn({method:"POST"})
  .inputValidator((input:unknown)=>z.object({token:z.string().min(10).max(800)}).parse(input))
  .handler(async({data})=>{
    const {verifyCustomerToken}=await import("./auth-tokens.server");
    const session=verifyCustomerToken(data.token);
    if(!session) throw new Error("Please log in to manage WhatsApp offers.");
    const {supabaseAdmin:db}=await import("@/integrations/supabase/client.server");
    const result=await db.from("customers").select("whatsapp_marketing_opt_in").eq("phone",session.phone).maybeSingle();
    if(result.error || !result.data) throw new Error("Could not load WhatsApp preferences.");
    return {optIn:result.data.whatsapp_marketing_opt_in};
  });

/** Fresh permission/consent/stock check at opening time; performs no status write. */
export const openPromoLinkFn=createServerFn({method:"POST"})
  .inputValidator((input:unknown)=>z.object({adminToken:z.string().min(10).max(800),userId:z.string().uuid(),productId:z.string().min(1).max(200)}).parse(input))
  .handler(async({data})=>{
    const {requireActiveAdmin,requireAdminPermission}=await import("./admin-session.server");
    await requireActiveAdmin(data.adminToken);
    await requireAdminPermission(data.adminToken,"whatsapp_promos");
    const {supabaseAdmin:db}=await import("@/integrations/supabase/client.server");
    const [c,p,history,counter]=await Promise.all([
      db.from("customers").select("name,phone,created_at,whatsapp_marketing_opt_in,whatsapp_marketing_opt_in_at,promo_sent_at,promo_skipped").eq("id",data.userId).maybeSingle(),
      db.from("catalog_items").select("id,name,stock,is_deleted,expiry_date").eq("id",data.productId).maybeSingle(),
      db.rpc("wa_customer_has_order",{p_customer:data.userId}),
      db.rpc("wa_promo_sent_today"),
    ]);
    if(c.error || p.error || history.error || counter.error) throw new Error("Could not verify this recommendation. Please try again.");
    const customer=c.data, product=p.data;
    if(!customer || !customer.whatsapp_marketing_opt_in || !customer.whatsapp_marketing_opt_in_at || customer.promo_sent_at || customer.promo_skipped || history.data || Date.now()-Date.parse(customer.created_at)<86_400_000) throw new Error("Customer is no longer eligible for this campaign.");
    const {indiaDate}=await import("./whatsapp-link");
    if(!product || product.is_deleted || product.stock<=0 || (product.expiry_date && product.expiry_date<indiaDate())) throw new Error("Selected product is no longer available.");
    if((counter.data ?? 0)>=25) throw new Error("Daily limit of 25 messages reached.");
    return {url:whatsappLink(customer.phone,customer.name,product.name,product.id)};
  });

export const saveWhatsappConsentFn=createServerFn({method:"POST"})
  .inputValidator((input:unknown)=>z.object({token:z.string().min(10).max(800),optIn:z.boolean()}).parse(input))
  .handler(async({data})=>{
    const {verifyCustomerToken}=await import("./auth-tokens.server");
    const session=verifyCustomerToken(data.token);
    if(!session) throw new Error("Please log in to manage WhatsApp offers.");
    const {supabaseAdmin:db}=await import("@/integrations/supabase/client.server");
    const {data:optIn,error}=await db.rpc("wa_set_consent",{p_phone:session.phone,p_opt_in:data.optIn});
    if(error) throw new Error("Could not save WhatsApp preferences.");
    return {optIn:Boolean(optIn)};
  });