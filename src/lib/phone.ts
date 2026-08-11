// Shared phone-number helpers (safe on both client and server).
import {
  parsePhoneNumberFromString,
  getCountries,
  getCountryCallingCode,
  getExampleNumber,
  type CountryCode,
} from "libphonenumber-js";
import examples from "libphonenumber-js/examples.mobile.json";

export const DEFAULT_COUNTRY: CountryCode = "IN";

/** Returns a strict E.164 number, or null when the input cannot be one. */
export function toE164(raw: string, country: CountryCode = DEFAULT_COUNTRY): string | null {
  const input = String(raw ?? "").trim();
  if (!input) return null;
  const parsed = parsePhoneNumberFromString(input, input.startsWith("+") ? undefined : country);
  if (parsed?.isValid()) return parsed.number;

  // Legacy-tolerant fallback for already-clean digit strings.
  const cleaned = input.replace(/[\s()\-.]/g, "");
  const digits = cleaned.replace(/^\+/, "");
  if (!digits || !/^\d+$/.test(digits)) return null;
  const withCc = cleaned.startsWith("+")
    ? `+${digits}`
    : digits.length === 10
      ? `+91${digits}`
      : `+${digits}`;
  return /^\+[1-9]\d{7,14}$/.test(withCc) ? withCc : null;
}

/** True when the number is a valid mobile-capable number for the given country. */
export function validatePhoneNumber(raw: string, country: CountryCode = DEFAULT_COUNTRY): boolean {
  const input = String(raw ?? "").trim();
  if (!input) return false;
  const parsed = parsePhoneNumberFromString(input, input.startsWith("+") ? undefined : country);
  return Boolean(parsed?.isValid());
}

/**
 * Canonical storage key for a phone number.
 *
 * Indian numbers keep their legacy 10-digit national form so every existing
 * row (customers, staff_accounts, wallets, orders…) keeps resolving to the same
 * user. Every other country is stored in full E.164 form.
 */
export function canonicalPhone(raw: string, country: CountryCode = DEFAULT_COUNTRY): string | null {
  const e164 = toE164(raw, country);
  if (!e164) return null;
  const parsed = parsePhoneNumberFromString(e164);
  if (parsed?.country === "IN") return parsed.nationalNumber;
  if (!parsed && /^\+91\d{10}$/.test(e164)) return e164.slice(3);
  return e164;
}

/** Turns a canonical stored phone back into an E.164 number for SMS delivery. */
export function canonicalToE164(canonical: string): string | null {
  const value = String(canonical ?? "").trim();
  if (/^\d{10}$/.test(value)) return `+91${value}`;
  return toE164(value);
}

export type Country = {
  iso: CountryCode;
  name: string;
  dialCode: string; // e.g. "+91"
  flag: string;
};

function flagEmoji(iso: string): string {
  return iso
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

let countryCache: Country[] | null = null;

/** Full ISO country list with dialling codes, sorted by localized name. */
export function getCountryList(): Country[] {
  if (countryCache) return countryCache;
  let display: Intl.DisplayNames | null = null;
  try {
    display = new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    display = null;
  }
  countryCache = getCountries()
    .map((iso) => ({
      iso,
      name: display?.of(iso) ?? iso,
      dialCode: `+${getCountryCallingCode(iso)}`,
      flag: flagEmoji(iso),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return countryCache;
}

export function getCountry(iso: string): Country {
  const list = getCountryList();
  return list.find((c) => c.iso === iso) ?? list.find((c) => c.iso === DEFAULT_COUNTRY)!;
}

export function isSupportedCountry(iso: string): iso is CountryCode {
  return getCountries().includes(iso.toUpperCase() as CountryCode);
}

// ---------------- Country detection ----------------

/** en-IN / hi_IN / en-Latn-IN → "IN". Returns null when no region is present. */
export function detectCountryFromLocale(
  locales?: readonly string[] | string,
): CountryCode | null {
  const list =
    typeof locales === "string"
      ? [locales]
      : locales ??
        (typeof navigator !== "undefined"
          ? [...(navigator.languages ?? []), navigator.language].filter(Boolean)
          : []);
  for (const raw of list) {
    if (!raw) continue;
    const parts = String(raw).replace(/_/g, "-").split("-");
    for (const part of parts.slice(1)) {
      const iso = part.toUpperCase();
      if (/^[A-Z]{2}$/.test(iso) && isSupportedCountry(iso)) return iso;
    }
  }
  return null;
}

/** Common IANA timezone → ISO country. Safe subset; unknown zones return null. */
const TIMEZONE_COUNTRY: Record<string, CountryCode> = {
  "Asia/Kolkata": "IN",
  "Asia/Calcutta": "IN",
  "Asia/Dubai": "AE",
  "Asia/Karachi": "PK",
  "Asia/Dhaka": "BD",
  "Asia/Colombo": "LK",
  "Asia/Kathmandu": "NP",
  "Asia/Singapore": "SG",
  "Asia/Kuala_Lumpur": "MY",
  "Asia/Hong_Kong": "HK",
  "Asia/Tokyo": "JP",
  "Asia/Seoul": "KR",
  "Asia/Shanghai": "CN",
  "Asia/Riyadh": "SA",
  "Asia/Qatar": "QA",
  "Asia/Kuwait": "KW",
  "Asia/Muscat": "OM",
  "Asia/Bahrain": "BH",
  "Asia/Jakarta": "ID",
  "Asia/Manila": "PH",
  "Asia/Bangkok": "TH",
  "Europe/London": "GB",
  "Europe/Dublin": "IE",
  "Europe/Paris": "FR",
  "Europe/Berlin": "DE",
  "Europe/Madrid": "ES",
  "Europe/Rome": "IT",
  "Europe/Amsterdam": "NL",
  "Europe/Brussels": "BE",
  "Europe/Zurich": "CH",
  "Europe/Vienna": "AT",
  "Europe/Stockholm": "SE",
  "Europe/Oslo": "NO",
  "Europe/Copenhagen": "DK",
  "Europe/Helsinki": "FI",
  "Europe/Lisbon": "PT",
  "Europe/Warsaw": "PL",
  "Europe/Prague": "CZ",
  "Europe/Moscow": "RU",
  "Europe/Istanbul": "TR",
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Phoenix": "US",
  "America/Los_Angeles": "US",
  "America/Anchorage": "US",
  "Pacific/Honolulu": "US",
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
  "America/Edmonton": "CA",
  "America/Winnipeg": "CA",
  "America/Mexico_City": "MX",
  "America/Sao_Paulo": "BR",
  "America/Argentina/Buenos_Aires": "AR",
  "America/Bogota": "CO",
  "America/Santiago": "CL",
  "America/Lima": "PE",
  "Africa/Johannesburg": "ZA",
  "Africa/Lagos": "NG",
  "Africa/Nairobi": "KE",
  "Africa/Cairo": "EG",
  "Africa/Accra": "GH",
  "Australia/Sydney": "AU",
  "Australia/Melbourne": "AU",
  "Australia/Brisbane": "AU",
  "Australia/Perth": "AU",
  "Pacific/Auckland": "NZ",
};

export function detectCountryFromTimezone(tz?: string): CountryCode | null {
  try {
    const zone = tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone) return null;
    return TIMEZONE_COUNTRY[zone] ?? null;
  } catch {
    return null;
  }
}

/**
 * Server-side guard: the frontend may send any user-typed format, so the
 * backend re-parses and normalizes before it is used for auth/OTP.
 */
export function normalizeIncomingPhone(raw: unknown): string {
  const canonical = canonicalPhone(String(raw ?? ""));
  if (!canonical) throw new Error("Please enter a valid mobile number.");
  return canonical;
}

/**
 * How many national digits a mobile number may have in a country (India → 10,
 * excluding the +91 dial code). Derived from libphonenumber's example numbers
 * so every country stays correct without a hand-maintained table.
 */
export function maxNationalDigits(country: CountryCode = DEFAULT_COUNTRY): number {
  try {
    const example = getExampleNumber(country, examples);
    const len = example?.nationalNumber?.length ?? 0;
    return len > 0 ? len : 15;
  } catch {
    return 15;
  }
}
