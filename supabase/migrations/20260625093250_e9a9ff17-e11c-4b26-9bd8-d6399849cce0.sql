-- ============================================================
-- 1. Server-side wallet (replaces client-side localStorage wallet)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.customer_wallets (
  phone text PRIMARY KEY,
  balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  type text NOT NULL CHECK (type IN ('credit','debit')),
  amount numeric NOT NULL CHECK (amount > 0),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wallet_transactions_phone_idx
  ON public.wallet_transactions (phone, created_at DESC);

-- These tables hold money and are ONLY ever touched by trusted server functions
-- (service role). No anon/authenticated Data API access is granted, and RLS is
-- enabled with no policies => default deny for everyone except the service role.
GRANT ALL ON public.customer_wallets TO service_role;
GRANT ALL ON public.wallet_transactions TO service_role;

ALTER TABLE public.customer_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Keep updated_at fresh on the wallet row.
DROP TRIGGER IF EXISTS update_customer_wallets_updated_at ON public.customer_wallets;
CREATE TRIGGER update_customer_wallets_updated_at
  BEFORE UPDATE ON public.customer_wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atomic, race-safe balance change. Validates debits never overdraw, records a
-- transaction, and returns the new balance. SECURITY DEFINER so it runs with
-- the owner's rights; callers reach it only through service-role server fns.
CREATE OR REPLACE FUNCTION public.adjust_wallet(
  p_phone text,
  p_amount numeric,
  p_type text,
  p_note text
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
  v_delta numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  IF p_type NOT IN ('credit','debit') THEN
    RAISE EXCEPTION 'Invalid transaction type';
  END IF;

  INSERT INTO public.customer_wallets (phone, balance)
  VALUES (p_phone, 0)
  ON CONFLICT (phone) DO NOTHING;

  SELECT balance INTO v_balance FROM public.customer_wallets WHERE phone = p_phone FOR UPDATE;

  IF p_type = 'debit' THEN
    IF v_balance < p_amount THEN
      RAISE EXCEPTION 'Insufficient wallet balance';
    END IF;
    v_delta := -p_amount;
  ELSE
    v_delta := p_amount;
  END IF;

  UPDATE public.customer_wallets
    SET balance = balance + v_delta
    WHERE phone = p_phone
    RETURNING balance INTO v_balance;

  INSERT INTO public.wallet_transactions (phone, type, amount, note)
  VALUES (p_phone, p_type, p_amount, COALESCE(p_note, ''));

  RETURN v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_wallet(text, numeric, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_wallet(text, numeric, text, text) TO service_role;

-- ============================================================
-- 2. Formalize lockdown of sensitive tables (default deny).
--    These tables are only reached server-side via the service role.
--    Revoking direct Data API access makes the secure posture explicit so no
--    anonymous or authenticated client can ever read customer/driver/merchant
--    PII or financial fields, or read/write orders directly.
-- ============================================================
REVOKE ALL ON public.app_orders FROM anon, authenticated;
REVOKE ALL ON public.drivers   FROM anon, authenticated;
REVOKE ALL ON public.merchants FROM anon, authenticated;
REVOKE ALL ON public.customers FROM anon;