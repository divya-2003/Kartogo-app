// Shared phone-number helpers (safe on both client and server).

/** Returns a strict E.164 number, or null when the input cannot be one. */
export function toE164(raw: string): string | null {
  const cleaned = String(raw ?? "").replace(/[\s()\-.]/g, "");
  const digits = cleaned.replace(/^\+/, "");
  if (!digits || !/^\d+$/.test(digits)) return null;
  const withCc = cleaned.startsWith("+") ? `+${digits}` : digits.length === 10 ? `+91${digits}` : `+${digits}`;
  return /^\+[1-9]\d{7,14}$/.test(withCc) ? withCc : null;
}
