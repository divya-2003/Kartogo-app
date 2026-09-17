import { createServerFn } from "@tanstack/react-start";

// Confirms a printer-service session token server-side. The portal gate never
// trusts the value sitting in localStorage.
export const verifyPrinterTokenFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token?: string }) => ({ token: String(data?.token ?? "") }))
  .handler(async ({ data }) => {
    const { verifyPrinterToken, PRINTER_SERVICE } = await import("./auth-tokens.server");
    const session = verifyPrinterToken(data.token);
    return { valid: !!session, name: PRINTER_SERVICE.name };
  });
