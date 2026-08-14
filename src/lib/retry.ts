// Phase 7 — edge reliability.
//
// Small retry helper with exponential backoff + jitter, used for outbound
// calls to third parties (maps, SMS) that can blip. Never throws past the
// final attempt count; callers decide their own fallback.

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; baseDelayMs?: number; label?: string } = {},
): Promise<T> {
  const attempts = Math.max(1, opts.attempts ?? 3);
  const base = opts.baseDelayMs ?? 200;
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (i === attempts - 1) break;
      const delay = base * 2 ** i + Math.random() * base;
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  if (opts.label) console.error(`[retry] ${opts.label} failed after ${attempts} attempts`, lastError);
  throw lastError;
}

/** Fetch with retry on network errors and 5xx / 429 responses. */
export async function fetchWithRetry(
  input: string,
  init?: RequestInit,
  opts: { attempts?: number; label?: string } = {},
): Promise<Response> {
  return withRetry(
    async () => {
      const res = await fetch(input, init);
      if (res.status >= 500 || res.status === 429) throw new Error(`HTTP ${res.status}`);
      return res;
    },
    { attempts: opts.attempts ?? 3, label: opts.label },
  );
}
