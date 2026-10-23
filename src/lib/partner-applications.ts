// Shared (browser-safe) rules for partner seller applications.

export const PARTNER_TYPES = ["Retailer", "Restaurant / Food", "Pharmacy", "Salon", "Service Provider", "Furniture Seller", "Event Provider", "Home-Service Provider"] as const;
export type PartnerType = (typeof PARTNER_TYPES)[number];

/** Food businesses must hold an FSSAI licence to sell on Kartogo. */
export const needsFssai = (type: string) => type === "Restaurant / Food";

export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const FSSAI_RE = /^\d{14}$/;
export const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;
export const PINCODE_RE = /^[1-9]\d{5}$/;

export type PartnerApplicationInput = {
  partnerType: string;
  businessName: string;
  ownerName: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  pincode: string;
  lat?: number | null;
  lng?: number | null;
  gstin?: string;
  fssai?: string;
  pan?: string;
  categories?: string;
  notes?: string;
};

/** Returns a field → message map; empty when the application is valid. */
export function validatePartnerApplication(a: PartnerApplicationInput): Record<string, string> {
  const e: Record<string, string> = {};
  if (!PARTNER_TYPES.includes(a.partnerType as PartnerType)) e.partnerType = "Choose your business type";
  if (a.businessName.trim().length < 2) e.businessName = "Enter your business name";
  if (a.ownerName.trim().length < 2) e.ownerName = "Enter the owner's name";
  if (!/^\d{10}$/.test(a.phone.replace(/\D/g, "").slice(-10)) || a.phone.replace(/\D/g, "").length < 10) e.phone = "Enter a 10-digit mobile number";
  if (a.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email.trim())) e.email = "Enter a valid email";
  if (a.address.trim().length < 5) e.address = "Enter the shop address";
  if (a.city.trim().length < 2) e.city = "Enter the city";
  if (!PINCODE_RE.test(a.pincode.trim())) e.pincode = "Enter a 6-digit pincode";
  const gstin = (a.gstin ?? "").trim().toUpperCase();
  if (gstin && !GSTIN_RE.test(gstin)) e.gstin = "GSTIN should look like 37ABCDE1234F1Z5";
  const fssai = (a.fssai ?? "").trim();
  if (needsFssai(a.partnerType) && !fssai) e.fssai = "FSSAI licence number is required for food businesses";
  else if (fssai && !FSSAI_RE.test(fssai)) e.fssai = "FSSAI number has 14 digits";
  const pan = (a.pan ?? "").trim().toUpperCase();
  if (pan && !PAN_RE.test(pan)) e.pan = "PAN should look like ABCDE1234F";
  return e;
}
