// Pure, server-safe serviceability logic for the Kartogo Ongole dark store.
// No asset imports here so it can be bundled into a server function safely and
// also imported directly by client components (autocomplete suggestions).

export const DARK_STORE = {
  name: "Kartogo Dark Store",
  area: "Magunta Layout",
  city: "Ongole",
  state: "Andhra Pradesh",
};

/** Default delivery promise (minutes) when we can't pin down a specific area. */
export const DEFAULT_ETA_MINUTES = 15;

export type ServiceableArea = {
  /** Clean display label. */
  name: string;
  /** Lower-case match keyword. */
  keyword: string;
  /** Owning pincode. */
  pincode: string;
  /** Expected door delivery time in minutes. */
  etaMinutes: number;
};

// The localities our dark store reaches, each with its own delivery estimate.
// This is the single source of truth for both serviceability and autocomplete.
export const SERVICEABLE_AREAS: ServiceableArea[] = [
  { name: "Magunta Layout", keyword: "magunta", pincode: "523002", etaMinutes: 11 },
  { name: "Kurnool Road", keyword: "kurnool road", pincode: "523002", etaMinutes: 14 },
  { name: "Mangamuru Road", keyword: "mangamuru", pincode: "523001", etaMinutes: 13 },
  { name: "Trunk Road", keyword: "trunk road", pincode: "523001", etaMinutes: 12 },
  { name: "Lawyerpet", keyword: "lawyerpet", pincode: "523001", etaMinutes: 12 },
  { name: "Gandhi Nagar", keyword: "gandhi nagar", pincode: "523001", etaMinutes: 13 },
  { name: "Surya Nagar", keyword: "surya nagar", pincode: "523002", etaMinutes: 14 },
  { name: "Bhagya Nagar", keyword: "bhagya nagar", pincode: "523002", etaMinutes: 13 },
  { name: "Santhapeta", keyword: "santhapeta", pincode: "523001", etaMinutes: 12 },
  { name: "Addanki Bus Stand", keyword: "addanki bus stand", pincode: "523001", etaMinutes: 15 },
  { name: "RTC Bus Stand", keyword: "rtc bus stand", pincode: "523001", etaMinutes: 11 },
  { name: "Pernamitta", keyword: "pernamitta", pincode: "523002", etaMinutes: 16 },
  { name: "Kothapatnam Road", keyword: "kothapatnam road", pincode: "523002", etaMinutes: 17 },
  { name: "Throvagunta", keyword: "throvagunta", pincode: "523272", etaMinutes: 18 },
];

// Pincodes our dark store can reach.
export const SERVICEABLE_PINCODES = Array.from(
  new Set(SERVICEABLE_AREAS.map(a => a.pincode)),
);

// Locality / landmark keywords we deliver to (all in/around Ongole). "ongole"
// stays as a broad catch-all alongside the specific localities.
export const SERVICEABLE_KEYWORDS = [
  "ongole",
  ...SERVICEABLE_AREAS.map(a => a.keyword),
];

export type ServiceabilityResult = {
  serviceable: boolean;
  /** A clean label for the matched area, when serviceable. */
  area: string | null;
  /** Detected 6-digit pincode, if the user typed one. */
  pincode: string | null;
  /** Expected delivery time in minutes when serviceable. */
  etaMinutes: number | null;
  /** Human-readable explanation. */
  reason: string;
};

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** A readable delivery window like "9–12 min" derived from an ETA estimate. */
export function deliveryWindow(etaMinutes: number | null | undefined): string {
  const eta = etaMinutes && etaMinutes > 0 ? etaMinutes : DEFAULT_ETA_MINUTES;
  const low = Math.max(8, eta - 3);
  return `${low}–${eta} min`;
}

/**
 * Autocomplete: returns serviceable areas matching a partial query, ranked so
 * prefix matches come first. Empty query returns the nearest/fastest areas.
 */
export function searchServiceableAreas(rawQuery: string, limit = 6): ServiceableArea[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) {
    return [...SERVICEABLE_AREAS].sort((a, b) => a.etaMinutes - b.etaMinutes).slice(0, limit);
  }
  const matches = SERVICEABLE_AREAS.filter(
    a => a.name.toLowerCase().includes(q) || a.keyword.includes(q) || a.pincode.includes(q),
  );
  return matches
    .sort((a, b) => {
      const aPrefix = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bPrefix = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      if (aPrefix !== bPrefix) return aPrefix - bPrefix;
      return a.etaMinutes - b.etaMinutes;
    })
    .slice(0, limit);
}

/**
 * Decides whether a freely-typed location string falls inside the dark store's
 * delivery zone. Matches on a 6-digit pincode first, then on locality keywords.
 */
export function evaluateServiceability(rawQuery: string): ServiceabilityResult {
  const query = rawQuery.trim();
  if (!query) {
    return { serviceable: false, area: null, pincode: null, etaMinutes: null, reason: "Please enter your location." };
  }

  const lower = query.toLowerCase();
  const pinMatch = lower.match(/\b(\d{6})\b/);
  const pincode = pinMatch ? pinMatch[1] : null;

  const matchedArea = SERVICEABLE_AREAS.find(a => lower.includes(a.keyword));

  // 1) Pincode is the strongest signal.
  if (pincode) {
    if (SERVICEABLE_PINCODES.includes(pincode)) {
      const areaForPin = matchedArea ?? SERVICEABLE_AREAS.find(a => a.pincode === pincode);
      const eta = areaForPin?.etaMinutes ?? DEFAULT_ETA_MINUTES;
      return {
        serviceable: true,
        area: matchedArea?.name ?? `Ongole ${pincode}`,
        pincode,
        etaMinutes: eta,
        reason: `Great news — we deliver to your area in ${deliveryWindow(eta)}!`,
      };
    }
    return {
      serviceable: false,
      area: null,
      pincode,
      etaMinutes: null,
      reason: `We're not serviceable at pincode ${pincode} yet. We currently deliver only in Ongole.`,
    };
  }

  // 2) Locality / landmark keyword match.
  if (matchedArea) {
    return {
      serviceable: true,
      area: matchedArea.name,
      pincode: matchedArea.pincode,
      etaMinutes: matchedArea.etaMinutes,
      reason: `Great news — we deliver to your area in ${deliveryWindow(matchedArea.etaMinutes)}!`,
    };
  }

  // 2b) Broad "ongole" mention without a specific locality.
  if (lower.includes("ongole")) {
    return {
      serviceable: true,
      area: titleCase(query),
      pincode: null,
      etaMinutes: DEFAULT_ETA_MINUTES,
      reason: `Great news — we deliver to your area in ${deliveryWindow(DEFAULT_ETA_MINUTES)}!`,
    };
  }

  // 3) Nothing matched — outside our zone.
  return {
    serviceable: false,
    area: null,
    pincode: null,
    etaMinutes: null,
    reason: "Sorry, we're not serviceable in your area yet. We currently deliver only in Ongole.",
  };
}
