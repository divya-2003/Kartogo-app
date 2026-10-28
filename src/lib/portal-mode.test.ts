import { beforeEach, describe, expect, it, vi } from "vitest";

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
    removeItem: (k: string) => { m.delete(k); },
    clear: () => m.clear(),
  };
}

async function freshModule() {
  vi.resetModules();
  return import("./portal-mode");
}

describe("partner portal on reopen", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("sessionStorage", memoryStorage());
  });

  it("sends a seller with a saved session to the seller portal", async () => {
    localStorage.setItem("qk_supplier_token", JSON.stringify("signed.token"));
    const m = await freshModule();
    expect(m.homeRedirectTarget()).toBe("/supplier/sales");
  });

  it("lets a seller shop as a customer during the same app run", async () => {
    localStorage.setItem("qk_supplier_token", JSON.stringify("signed.token"));
    const m = await freshModule();
    m.enterCustomerMode();
    expect(m.homeRedirectTarget()).toBeNull();
  });

  it("reopening the app sends the seller back to the portal even after shopping as a customer", async () => {
    localStorage.setItem("qk_supplier_token", JSON.stringify("signed.token"));
    const first = await freshModule();
    first.enterCustomerMode();
    // A leftover tab flag from the earlier run must not keep them on customer pages.
    expect(sessionStorage.getItem("qk_customer_home")).toBe("1");
    const reopened = await freshModule();
    expect(reopened.homeRedirectTarget()).toBe("/supplier/sales");
  });

  it("customers without a partner session stay on the customer home", async () => {
    const m = await freshModule();
    expect(m.homeRedirectTarget()).toBeNull();
  });

  it("treats empty saved slots as signed out", async () => {
    localStorage.setItem("qk_delivery_token", "null");
    const m = await freshModule();
    expect(m.homeRedirectTarget()).toBeNull();
  });
});
