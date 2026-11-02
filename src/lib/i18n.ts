// App languages. Browser-safe. The whole customer, seller, rider and printer
// app is translated on the fly (see PageTranslator); admin pages stay English.

export type AppLanguage = { code: string; label: string; native: string };

/** English plus India's 22 scheduled languages, in alphabetical order. */
export const LANGUAGES: AppLanguage[] = [
  { code: "as", label: "Assamese", native: "অসমীয়া" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
  { code: "brx", label: "Bodo", native: "बड़ो" },
  { code: "doi", label: "Dogri", native: "डोगरी" },
  { code: "en", label: "English", native: "English" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ks", label: "Kashmiri", native: "کٲشُر" },
  { code: "kok", label: "Konkani", native: "कोंकणी" },
  { code: "mai", label: "Maithili", native: "मैथिली" },
  { code: "ml", label: "Malayalam", native: "മലയാളം" },
  { code: "mni", label: "Manipuri", native: "ꯃꯤꯇꯩꯂꯣꯟ" },
  { code: "mr", label: "Marathi", native: "मराठी" },
  { code: "ne", label: "Nepali", native: "नेपाली" },
  { code: "or", label: "Odia", native: "ଓଡ଼ିଆ" },
  { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "sa", label: "Sanskrit", native: "संस्कृतम्" },
  { code: "sat", label: "Santali", native: "ᱥᱟᱱᱛᱟᱲᱤ" },
  { code: "sd", label: "Sindhi", native: "سنڌي" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "ur", label: "Urdu", native: "اردو" },
];

export const LANGUAGE_CODES = LANGUAGES.map(l => l.code);
export const LANGUAGE_KEY = "qk_language";
export const LANGUAGE_EVENT = "qk-language-change";

export function languageLabel(code: string): string {
  return LANGUAGES.find(l => l.code === code)?.label ?? "English";
}

export function getLanguage(): string {
  if (typeof window === "undefined") return "en";
  try {
    const v = localStorage.getItem(LANGUAGE_KEY);
    return v && LANGUAGE_CODES.includes(v) ? v : "en";
  } catch { return "en"; }
}

export function setLanguage(code: string) {
  if (!LANGUAGE_CODES.includes(code)) return;
  try { localStorage.setItem(LANGUAGE_KEY, code); } catch { /* unavailable */ }
  window.dispatchEvent(new CustomEvent(LANGUAGE_EVENT, { detail: code }));
}

/** Pages that are never translated (admin and sub-admin portal). */
export function isUntranslatedPath(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/") || path.startsWith("/admin-");
}

/** Text worth translating: has letters, is not just a code, price or number. */
export function isTranslatableText(raw: string): boolean {
  const t = raw.trim();
  if (t.length < 2 || t.length > 400) return false;
  if (!/[A-Za-z]{2,}/.test(t)) return false;
  // Codes such as SAVE50, KB1A2B3C, order ids, URLs, emails, phone numbers.
  if (/^[A-Z0-9_-]{4,}$/.test(t)) return false;
  if (/^(https?:\/\/|www\.)\S+$/i.test(t) || /^\S+@\S+\.\S+$/.test(t)) return false;
  return true;
}
