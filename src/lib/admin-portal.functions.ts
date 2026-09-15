// Lets a signed-in admin step into the supplier or delivery portal without
// creating a separate account. The admin token is verified on the server and
// a normal, short-lived portal session token is minted from it — the client
// never gets to pick its own role.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PortalTargets = {
  suppliers: { id: string; name: string }[];
  drivers: { id: string; name: string; phone: string; active: boolean }[];
};

const tokenSchema = z.string().min(1).max(800);

async function requireAdmin(token: string) {
  const { verifyAdminToken } = await import("./auth-tokens.server");
  if (!verifyAdminToken(token)) throw new Error("Admin authorization required");
}

export const listPortalTargetsFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: tokenSchema }).parse(input))
  .handler(async ({ data }): Promise<PortalTargets> => {
    await requireAdmin(data.token);
    const { SUPPLIERS } = await import("./suppliers");
    const { listRoster } = await import("./driver-roster.server");
    const roster = await listRoster();
    return {
      suppliers: SUPPLIERS.map((s) => ({ id: s.id, name: s.name })),
      drivers: roster.map((d) => ({ id: d.id, name: d.name, phone: d.phone, active: d.active })),
    };
  });

export const openPortalAsAdminFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ token: tokenSchema, role: z.enum(["supplier", "delivery"]), refId: z.string().min(1).max(60) }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const { issueSupplierToken, issueDeliveryToken } = await import("./auth-tokens.server");

    if (data.role === "supplier") {
      const { findSupplierById } = await import("./suppliers");
      const supplier = findSupplierById(data.refId);
      if (!supplier) throw new Error("Unknown supplier");
      return {
        role: "supplier" as const,
        token: issueSupplierToken(supplier.id, supplier.phone),
        profile: { id: supplier.id, name: supplier.name, phone: supplier.phone },
      };
    }

    const { findRosterDriverById } = await import("./driver-roster.server");
    const driver = await findRosterDriverById(data.refId);
    if (!driver) throw new Error("Unknown delivery partner");
    return {
      role: "delivery" as const,
      token: issueDeliveryToken(driver.id, driver.phone),
      profile: { id: driver.id, name: driver.name, phone: driver.phone },
    };
  });
