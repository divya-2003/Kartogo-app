import { createServerFn } from "@tanstack/react-start";

const tok = (v: unknown) => (typeof v === "string" && v.length < 4096 ? v : null);

/**
 * Re-signs every genuine session token on this device with a fresh expiry so
 * customers, sellers, riders, the printer service and admins stay signed in.
 * Tokens that fail signature checks are simply not returned.
 */
export const renewSessionsFn = createServerFn({ method: "POST" })
  .inputValidator((d: Record<string, unknown>) => ({
    customer: tok(d?.customer),
    admin: tok(d?.admin),
    delivery: tok(d?.delivery),
    supplier: tok(d?.supplier),
    printer: tok(d?.printer),
  }))
  .handler(async ({ data }) => {
    const { renewSessionTokens } = await import("./auth-tokens.server");
    return renewSessionTokens(data);
  });
