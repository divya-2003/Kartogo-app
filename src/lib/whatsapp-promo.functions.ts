import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const token = z.string().min(1).max(4096);
const customer = z.string().uuid();
const product = z.string().trim().min(1).max(200);
const adminInput = z.object({ token });

export const pendingWhatsAppFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token, search: z.string().max(120).default(""), page: z.number().int().min(1).max(1000000).default(1) }))
  .handler(async ({ data }) => {
    const { requireAdminPermission } = await import("./admin-session.server");
    await requireAdminPermission(data.token, "whatsapp_promos");
    const { listPromos } = await import("./whatsapp-promo.server");
    return listPromos(data.search, data.page);
  });

export const prepareWhatsAppFn = createServerFn({ method: "POST" })
  .inputValidator(adminInput.extend({ userId: customer, productId: product }))
  .handler(async ({ data }) => {
    const { requireAdminPermission } = await import("./admin-session.server");
    await requireAdminPermission(data.token, "whatsapp_promos");
    const { preparePromo } = await import("./whatsapp-promo.server");
    return preparePromo(data.userId, data.productId);
  });

export const updateWhatsAppFn = createServerFn({ method: "POST" })
  .inputValidator(adminInput.extend({ userId: customer, action: z.enum(["sent", "skip"]), productId: product.optional() }).refine(d => d.action === "skip" || Boolean(d.productId), { message: "Select a product first." }))
  .handler(async ({ data }) => {
    const { requireAdminPermission } = await import("./admin-session.server");
    const actor = await requireAdminPermission(data.token, "whatsapp_promos");
    const { updatePromo } = await import("./whatsapp-promo.server");
    return updatePromo(data.userId, data.action, data.productId, actor);
  });

export const readWhatsAppConsentFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token }))
  .handler(async ({ data }) => {
    const { customerConsent } = await import("./whatsapp-promo.server");
    return customerConsent(data.token);
  });

export const saveWhatsAppConsentFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token, optedIn: z.boolean() }))
  .handler(async ({ data }) => {
    const { customerConsent } = await import("./whatsapp-promo.server");
    return customerConsent(data.token, data.optedIn);
  });