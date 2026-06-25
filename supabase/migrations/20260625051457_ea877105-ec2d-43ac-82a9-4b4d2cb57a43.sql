-- ============================================================
-- Security hardening migration
-- Locks down sensitive tables and routes all access through
-- server functions (service role). Adds server-side OTP storage.
-- ============================================================

-- 1) app_orders: remove all public/anon/authenticated access.
--    All reads/writes now go exclusively through trusted server functions
--    (service role). This closes open SELECT/INSERT/UPDATE and stops PII leakage.
DROP POLICY IF EXISTS "Anyone can view orders"   ON public.app_orders;
DROP POLICY IF EXISTS "Anyone can create orders" ON public.app_orders;
DROP POLICY IF EXISTS "Anyone can update orders" ON public.app_orders;

REVOKE ALL ON public.app_orders FROM anon, authenticated;
GRANT ALL ON public.app_orders TO service_role;
-- RLS stays enabled; with no policies, anon/authenticated are fully denied.

-- Stop broadcasting customer PII (phone, name, address) over Realtime.
ALTER PUBLICATION supabase_realtime DROP TABLE public.app_orders;

-- 2) merchants: financial fields (balance, commission_rate) must not be public.
--    The app does not read this table from the browser, so remove public access
--    entirely; privileged reads go through the service role.
DROP POLICY IF EXISTS "Merchants are publicly viewable" ON public.merchants;
REVOKE ALL ON public.merchants FROM anon, authenticated;
GRANT ALL ON public.merchants TO service_role;

-- 3) drivers: driver phone numbers and live coordinates must not be readable
--    by every authenticated user. Restrict to the service role only.
DROP POLICY IF EXISTS "Drivers viewable by authenticated" ON public.drivers;
REVOKE ALL ON public.drivers FROM anon, authenticated;
GRANT ALL ON public.drivers TO service_role;

-- 4) Server-side OTP storage. Codes are stored hashed, expire, and are
--    single-use. Only the service role (server functions) can touch this table.
CREATE TABLE public.otp_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       text NOT NULL,
  code_hash   text NOT NULL,
  expires_at  timestamptz NOT NULL,
  consumed    boolean NOT NULL DEFAULT false,
  attempts    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.otp_codes TO service_role;

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated: the table is reachable only via the
-- service role inside server functions.

CREATE INDEX idx_otp_codes_phone ON public.otp_codes (phone);
CREATE INDEX idx_otp_codes_expires_at ON public.otp_codes (expires_at);