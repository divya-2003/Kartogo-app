import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { validatePartnerApplication, type PartnerApplicationInput } from "./partner-applications";

const str = (max: number) => z.string().trim().max(max);

const inputSchema = z.object({
  partnerType: str(40),
  businessName: str(120),
  ownerName: str(80),
  phone: str(20),
  email: str(120).optional().default(""),
  address: str(400),
  city: str(60),
  pincode: str(10),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  gstin: str(20).optional().default(""),
  fssai: str(20).optional().default(""),
  pan: str(12).optional().default(""),
  categories: str(300).optional().default(""),
  notes: str(600).optional().default(""),
});

/** Public: a business applies to become a Kartogo partner seller. */
export const submitPartnerApplicationFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }) => {
    const errors = validatePartnerApplication(data as PartnerApplicationInput);
    if (Object.keys(errors).length) return { ok: false as const, errors };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const phone = data.phone.replace(/\D/g, "").slice(-10);
    // One open application per phone number — a resubmission updates nothing new.
    const { data: existing } = await supabaseAdmin
      .from("partner_applications")
      .select("id")
      .eq("phone", phone)
      .in("status", ["new", "contacted"])
      .maybeSingle();
    if (existing) return { ok: true as const, duplicate: true };
    const { error } = await supabaseAdmin.from("partner_applications").insert({
      partner_type: data.partnerType,
      business_name: data.businessName,
      owner_name: data.ownerName,
      phone,
      email: data.email || null,
      address: data.address,
      city: data.city,
      pincode: data.pincode,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      gstin: data.gstin ? data.gstin.toUpperCase() : null,
      fssai: data.fssai || null,
      pan: data.pan ? data.pan.toUpperCase() : null,
      categories: data.categories || null,
      notes: data.notes || null,
    });
    if (error) throw new Error("Could not send your application. Please try again.");
    return { ok: true as const, duplicate: false };
  });

async function requirePartnersAdmin(token: string) {
  const { resolveAccess } = await import("./admin-access.functions");
  const access = await resolveAccess(token);
  if (!access.valid || !(access.isSuperAdmin || access.permissions.includes("partners"))) throw new Error("Admin authorization required");
}

export const listPartnerApplicationsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(1).max(800) }).parse(d))
  .handler(async ({ data }) => {
    await requirePartnersAdmin(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("partner_applications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error("Could not load applications");
    return rows ?? [];
  });

export const setPartnerApplicationStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token: z.string().min(1).max(800),
    id: z.string().uuid(),
    status: z.enum(["new", "contacted", "approved", "rejected"]),
  }).parse(d))
  .handler(async ({ data }) => {
    await requirePartnersAdmin(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("partner_applications").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error("Could not update the application");
    return { ok: true as const };
  });
