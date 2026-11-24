import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { whatsappPhone } from "./whatsapp-link";

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