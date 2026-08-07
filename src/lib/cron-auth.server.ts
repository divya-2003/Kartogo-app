// Server-only auth for scheduled/public webhook endpoints.
//
// Callers (the database scheduler) must present the project key either as an
// `apikey` header or as `Authorization: Bearer <key>`. Comparison is
// length-checked and constant-time so the endpoint can't be probed, and an
// optional `CRON_SECRET` header check can be layered on top when set.
import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length || ab.length === 0) return false;
  return timingSafeEqual(ab, bb);
}

/** Returns null when authorised, or a 401 Response when not. */
export function verifyCronRequest(request: Request): Response | null {
  const expected = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
  if (!expected) return new Response("Unauthorized", { status: 401 });

  const bearer = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const apikey = (request.headers.get("apikey") ?? "").trim();
  if (!safeEqual(apikey, expected) && !safeEqual(bearer, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Optional second factor: when CRON_SECRET is configured it must also match.
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret && !safeEqual((request.headers.get("x-cron-secret") ?? "").trim(), cronSecret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  return null;
}
