import { describe, it, expect, beforeAll } from "vitest";

// Secrets are read lazily inside each helper, so setting them here is enough.
beforeAll(() => {
  process.env.ADMIN_SESSION_SECRET = "test-admin-secret";
  process.env.CUSTOMER_SESSION_SECRET = "test-customer-secret";
  process.env.DELIVERY_SESSION_SECRET = "test-delivery-secret";
  process.env.SUPPLIER_SESSION_SECRET = "test-supplier-secret";
});

describe("signed session tokens", () => {
  it("round-trips a customer session and binds it to one phone", async () => {
    const m = await import("./auth-tokens.server");
    const token = m.issueCustomerToken("9110310034");
    expect(m.verifyCustomerToken(token)).toEqual({ phone: "9110310034" });
  });

  it("rejects a tampered payload", async () => {
    const m = await import("./auth-tokens.server");
    const token = m.issueCustomerToken("9110310034");
    const [, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ phone: "9999999999", exp: Date.now() + 1000 }))
      .toString("base64url");
    expect(m.verifyCustomerToken(`${forged}.${sig}`)).toBeNull();
  });

  it("rejects garbage and missing tokens", async () => {
    const m = await import("./auth-tokens.server");
    expect(m.verifyCustomerToken(undefined)).toBeNull();
    expect(m.verifyCustomerToken("")).toBeNull();
    expect(m.verifyCustomerToken("not-a-token")).toBeNull();
    expect(m.verifyAdminToken("a.b")).toBe(false);
  });

  it("never lets one role's token pass as another", async () => {
    const m = await import("./auth-tokens.server");
    const customer = m.issueCustomerToken("9110310034");
    const admin = m.issueAdminToken("user-1");
    const driver = m.issueDeliveryToken("d1", "9876500001");
    const supplier = m.issueSupplierToken("s1", "9999999999");
    const printer = m.issuePrinterToken("9999999996");
    const pending = m.issuePendingDriverToken("d1", "9876500001");

    expect(m.verifyAdminToken(customer)).toBe(false);
    expect(m.verifyCustomerToken(admin)).toBeNull();
    expect(m.verifyDeliveryToken(supplier)).toBeNull();
    // Printer tokens share a secret with suppliers but carry a distinct role.
    expect(m.verifySupplierToken(printer)).toBeNull();
    expect(m.verifyPrinterToken(supplier)).toBeNull();
    // A paused rider's pending token must not open the delivery portal.
    expect(m.verifyDeliveryToken(pending)).toBeNull();
    expect(m.verifyPendingDriverToken(driver)).toBeNull();
  });

  it("carries the delivery identity it was issued with", async () => {
    const m = await import("./auth-tokens.server");
    const token = m.issueDeliveryToken("d2", "9876500002", "user-9");
    expect(m.verifyDeliveryToken(token)).toEqual({
      driverId: "d2",
      phone: "9876500002",
      userId: "user-9",
    });
  });

  it("refuses an expired token", async () => {
    const m = await import("./auth-tokens.server");
    const { createHmac } = await import("node:crypto");
    const body = Buffer.from(JSON.stringify({ phone: "9110310034", exp: Date.now() - 1 }))
      .toString("base64url");
    const sig = createHmac("sha256", process.env.CUSTOMER_SESSION_SECRET!)
      .update(body)
      .digest("base64url");
    expect(m.verifyCustomerToken(`${body}.${sig}`)).toBeNull();
  });
});

describe("sessions stay signed in", () => {
  const decode = (t: string) => JSON.parse(Buffer.from(t.split(".")[0], "base64url").toString("utf8"));

  it("issues sessions that last a year", async () => {
    const m = await import("./auth-tokens.server");
    const exp = decode(m.issueCustomerToken("9110310034")).exp as number;
    expect(exp - Date.now()).toBeGreaterThan(364 * 86_400_000);
  });

  it("renews every role with the same identity", async () => {
    const m = await import("./auth-tokens.server");
    const out = m.renewSessionTokens({
      customer: m.issueCustomerToken("9110310034"),
      admin: m.issueAdminToken("u1"),
      delivery: m.issueDeliveryToken("d1", "9876500001"),
      supplier: m.issueSupplierToken("s1", "9000000001"),
      printer: m.issuePrinterToken("9999999996"),
    });
    expect(m.verifyCustomerToken(out.customer!)).toEqual({ phone: "9110310034" });
    expect(m.readAdminToken(out.admin!)).toEqual({ userId: "u1" });
    expect(m.verifyDeliveryToken(out.delivery!)?.driverId).toBe("d1");
    expect(m.verifySupplierToken(out.supplier!)?.supplierId).toBe("s1");
    expect(m.verifyPrinterToken(out.printer!)).toEqual({ phone: "9999999996" });
  });

  it("renews a genuine session that expired months ago", async () => {
    const { createHmac } = await import("node:crypto");
    const m = await import("./auth-tokens.server");
    const body = Buffer.from(JSON.stringify({ phone: "9110310034", exp: Date.now() - 90 * 86_400_000 })).toString("base64url");
    const sig = createHmac("sha256", "test-customer-secret").update(body).digest("base64url");
    const old = `${body}.${sig}`;
    expect(m.verifyCustomerToken(old)).toBeNull();
    expect(m.verifyCustomerToken(m.renewSessionTokens({ customer: old }).customer!)).toEqual({ phone: "9110310034" });
  });

  it("never renews a forged session", async () => {
    const m = await import("./auth-tokens.server");
    const forged = Buffer.from(JSON.stringify({ phone: "9999999999", exp: Date.now() + 1000 })).toString("base64url");
    expect(m.renewSessionTokens({ customer: `${forged}.bad`, admin: "garbage" })).toEqual({});
  });
});
