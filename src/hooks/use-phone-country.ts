import { useCallback, useEffect, useState } from "react";
import type { CountryCode } from "libphonenumber-js";
import {
  DEFAULT_COUNTRY,
  detectCountryFromLocale,
  detectCountryFromTimezone,
  isSupportedCountry,
} from "@/lib/phone";

const STORAGE_KEY = "qk_phone_country";

function readSavedCountry(): CountryCode | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && isSupportedCountry(saved)) return saved as CountryCode;
  } catch {
    /* storage unavailable */
  }
  return null;
}

/** Non-blocking IP fallback. Never throws, never delays the first paint. */
async function detectCountryFromIp(signal: AbortSignal): Promise<CountryCode | null> {
  try {
    const res = await fetch("https://ipapi.co/json/", { signal });
    if (!res.ok) return null;
    const json = (await res.json()) as { country_code?: string };
    const iso = json.country_code?.toUpperCase();
    return iso && isSupportedCountry(iso) ? (iso as CountryCode) : null;
  } catch {
    return null;
  }
}

/**
 * Resolves the most likely dialling country:
 * saved preference → browser locale → timezone → IP (async) → India.
 * The input renders immediately with India; better guesses arrive later.
 */
export function usePhoneCountryDetection() {
  const [country, setCountryState] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [userChosen, setUserChosen] = useState(false);

  useEffect(() => {
    const saved = readSavedCountry();
    if (saved) {
      setCountryState(saved);
      setUserChosen(true);
      return;
    }
    // Timezone tracks the device's actual location; browser locale is often
    // left at en-US, so it is only a secondary hint.
    const local = detectCountryFromTimezone() ?? detectCountryFromLocale();
    if (local) {
      setCountryState(local);
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    void detectCountryFromIp(controller.signal).then((iso) => {
      if (!cancelled && iso) setCountryState(iso);
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  /** Manual selection always wins and is remembered for the next visit. */
  const setCountry = useCallback((iso: CountryCode) => {
    setCountryState(iso);
    setUserChosen(true);
    try {
      localStorage.setItem(STORAGE_KEY, iso);
    } catch {
      /* storage unavailable */
    }
  }, []);

  return { country, setCountry, userChosen };
}
