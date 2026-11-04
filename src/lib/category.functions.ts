import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * AI fallback for the seller/admin product form: picks the shop category for a
 * product name the keyword rules could not place. Only signed-in sellers and
 * admins may call it, so the public cannot run up AI costs.
 */
export const suggestCategoryFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      name: z.string().trim().min(3).max(120),
      description: z.string().max(600).optional(),
      allowed: z.array(z.object({ slug: z.string().max(40), name: z.string().max(60) })).min(1).max(40),
      supplierToken: z.string().max(4000).optional(),
      adminToken: z.string().max(4000).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { verifySupplierToken, verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifySupplierToken(data.supplierToken) && !verifyAdminToken(data.adminToken)) {
      return { slug: null as string | null, reason: "Not signed in" };
    }
    const slugs = data.allowed.map((c) => c.slug) as [string, ...string[]];
    try {
      const { aiObject } = await import("./ai-responses.server");
      const out = await aiObject({
        instructions:
          "You file products into the correct aisle of an Indian quick-commerce shop. Choose exactly one category slug from the list. " +
          "If the product clearly belongs to none of them, answer \"none\". Food never goes into cosmetics, grooming, pharmacy or stationery.",
        prompt:
          `Product name: ${data.name}\n` +
          (data.description ? `Description: ${data.description}\n` : "") +
          `Categories:\n${data.allowed.map((c) => `- ${c.slug}: ${c.name}`).join("\n")}`,
        schema: z.object({ slug: z.enum([...slugs, "none"] as [string, ...string[]]) }),
      });
      return { slug: out.slug === "none" ? null : out.slug, reason: "" };
    } catch (e) {
      console.error("suggestCategory failed", e);
      return { slug: null as string | null, reason: "AI unavailable" };
    }
  });
