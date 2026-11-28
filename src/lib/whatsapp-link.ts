import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { productShareUrl, PUBLIC_APP_ORIGIN } from "./share-link";

/** Stored Indian phones are national digits; other stored phones include a country code. */
export function whatsappPhone(raw: string): string | null {
  const clean = raw.trim().replace(/[\s().-]/g, "");
  if (!/^\+?\d+$/.test(clean)) return null;
  const international = /^\d{10}$/.test(clean) ? `+91${clean}` : clean.startsWith("+") ? clean : `+${clean}`;
  const parsed = parsePhoneNumberFromString(international);
  return parsed?.isValid() ? parsed.number.slice(1) : null;
}

export function whatsappMessage(name: string, productName: string, productId: string): string {
  const customer = name.replace(/[\r\n\t]/g, " ").trim() || "there";
  const product = productName.replace(/[\r\n\t]/g, " ").trim();
  return `Hi ${customer}! 👋\n\nWelcome to Kartogo!\n\nWe thought you might like our ${product}.\n\nExplore the product here:\n${productShareUrl(productId, PUBLIC_APP_ORIGIN)}\n\nHappy shopping! 🛍️\n\nTeam Kartogo`;
}

export function whatsappChatUrl(phone: string, message: string): string {
  const digits = whatsappPhone(phone);
  if (!digits) throw new Error("This customer needs a valid international phone number.");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}