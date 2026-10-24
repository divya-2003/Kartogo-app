import { describe, it, expect } from "vitest";
import { validatePartnerApplication, type PartnerApplicationInput } from "./partner-applications";

const base: PartnerApplicationInput = {
  partnerType: "Retailer", businessName: "Sai Stores", ownerName: "Divya", phone: "9110310034",
  address: "Main Road, Lawyerpet", city: "Ongole", pincode: "523001",
};

describe("partner seller applications", () => {
  it("accepts a complete retailer without licences", () => {
    expect(validatePartnerApplication(base)).toEqual({});
  });
  it("requires FSSAI for food businesses", () => {
    expect(validatePartnerApplication({ ...base, partnerType: "Restaurant / Food" }).fssai).toBeTruthy();
    expect(validatePartnerApplication({ ...base, partnerType: "Restaurant / Food", fssai: "12345678901234" })).toEqual({});
  });
  it("rejects a malformed GSTIN and accepts a valid one", () => {
    expect(validatePartnerApplication({ ...base, gstin: "37ABC" }).gstin).toBeTruthy();
    expect(validatePartnerApplication({ ...base, gstin: "37abcde1234f1z5" }).gstin).toBeUndefined();
  });
  it("rejects a 5-digit pincode", () => {
    expect(validatePartnerApplication({ ...base, pincode: "52300" }).pincode).toBeTruthy();
  });
});
