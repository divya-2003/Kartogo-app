// Server-only auth for scheduled/public webhook endpoints.
//
// Callers (the database scheduler) MUST present the server-only `CRON_SECRET`
// in the `x-cron-secret` header. The public anon/publishable key is NOT
// accepted — it ships in every browser bundle and is not a secret.
import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length || ab.length === 0) return false;
  return timingSafeEqual(ab, bb);
}

/** Returns null when authorised, or a 401 Response when not. */
export function verifyCronRequest(request: Request): Response | null {
  const cronSecret = process.env.CRON_SECRET?.trim() ?? "";
  // Fail closed: without a configured server-only secret nothing is authorised.
  if (!cronSecret) return new Response("Unauthorized", { status: 401 });

  const header = (request.headers.get("x-cron-secret") ?? "").trim();
  const bearer = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!safeEqual(header, cronSecret) && !safeEqual(bearer, cronSecret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  return null;
}
