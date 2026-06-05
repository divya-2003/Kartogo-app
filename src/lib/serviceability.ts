// Pure, server-safe serviceability logic for the Kartigo Ongole dark store.
// No asset imports here so it can be bundled into a server function safely.

export const DARK_STORE = {
  name: "Kartigo Dark Store",
  area: "Magunta Layout",
  city: "Ongole",
  state: "Andhra Pradesh",
};

// Pincodes our dark store can reach within ~15 minutes.
export const SERVICEABLE_PINCODES = [
  "523001",
  "523002",
  "523272", // Throvagunta
];

// Locality / landmark keywords we deliver to (all in/around Ongole).
export const SERVICEABLE_KEYWORDS = [
  "ongole",
  "magunta",
  "kurnool road",
  "mangamuru",
  "trunk road",
  "lawyerpet",
  "gandhi nagar",
  "surya nagar",
  "bhagya nagar",
  "santhapeta",
  "addanki bus stand",
  "pernamitta",
  "throvagunta",
  "kothapatnam road",
  "rtc bus stand",
];

export type ServiceabilityResult = {
  serviceable: boolean;
  /** A clean label for the matched area, when serviceable. */
  area: string | null;
  /** Detected 6-digit pincode, if the user typed one. */
  pincode: string | null;
  /** Human-readable explanation. */
  reason: string;
};

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Decides whether a freely-typed location string falls inside the dark store's
 * delivery zone. Matches on a 6-digit pincode first, then on locality keywords.
 */
export function evaluateServiceability(rawQuery: string): ServiceabilityResult {
  const query = rawQuery.trim();
  if (!query) {
    return { serviceable: false, area: null, pincode: null, reason: "Please enter your location." };
  }

  const lower = query.toLowerCase();
  const pinMatch = lower.match(/\b(\d{6})\b/);
  const pincode = pinMatch ? pinMatch[1] : null;

  // 1) Pincode is the strongest signal.
  if (pincode) {
    if (SERVICEABLE_PINCODES.includes(pincode)) {
      const keyword = SERVICEABLE_KEYWORDS.find(k => lower.includes(k));
      return {
        serviceable: true,
        area: keyword ? titleCase(keyword) : `Ongole ${pincode}`,
        pincode,
        reason: "Great news — we deliver to your area in 15 minutes!",
      };
    }
    return {
      serviceable: false,
      area: null,
      pincode,
      reason: `We're not serviceable at pincode ${pincode} yet. We currently deliver only in Ongole.`,
    };
  }

  // 2) Locality / landmark keyword match.
  const keyword = SERVICEABLE_KEYWORDS.find(k => lower.includes(k));
  if (keyword) {
    return {
      serviceable: true,
      area: titleCase(keyword),
      pincode: null,
      reason: "Great news — we deliver to your area in 15 minutes!",
    };
  }

  // 3) Nothing matched — outside our zone.
  return {
    serviceable: false,
    area: null,
    pincode: null,
    reason: "Sorry, we're not serviceable in your area yet. We currently deliver only in Ongole.",
  };
}
