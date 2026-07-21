
ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS expired_at timestamptz;

CREATE INDEX IF NOT EXISTS wallet_transactions_expiry_idx
  ON public.wallet_transactions (phone, expires_at)
  WHERE type = 'credit' AND expires_at IS NOT NULL AND expired_at IS NULL;

CREATE OR REPLACE FUNCTION public.credit_wallet_with_expiry(
  p_phone text,
  p_amount numeric,
  p_note text,
  p_expires_at timestamptz
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  INSERT INTO public.customer_wallets (phone, balance)
  VALUES (p_phone, 0)
  ON CONFLICT (phone) DO NOTHING;

  UPDATE public.customer_wallets
    SET balance = balance + p_amount, updated_at = now()
    WHERE phone = p_phone
    RETURNING balance INTO v_balance;

  INSERT INTO public.wallet_transactions (phone, type, amount, note, expires_at)
  VALUES (p_phone, 'credit', p_amount, COALESCE(p_note, ''), p_expires_at);

  RETURN v_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_wallet_credits(p_phone text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_current numeric;
  v_debit numeric;
BEGIN
  FOR r IN
    SELECT id, amount
    FROM public.wallet_transactions
    WHERE phone = p_phone
      AND type = 'credit'
      AND expired_at IS NULL
      AND expires_at IS NOT NULL
      AND expires_at <= now()
    ORDER BY expires_at ASC
  LOOP
    SELECT balance INTO v_current FROM public.customer_wallets WHERE phone = p_phone FOR UPDATE;
    v_debit := LEAST(r.amount, COALESCE(v_current, 0));

    IF v_debit > 0 THEN
      UPDATE public.customer_wallets
        SET balance = balance - v_debit, updated_at = now()
        WHERE phone = p_phone;

      INSERT INTO public.wallet_transactions (phone, type, amount, note)
      VALUES (p_phone, 'debit', v_debit, 'Kartogo Cash credit expired');
    END IF;

    UPDATE public.wallet_transactions
      SET expired_at = now()
      WHERE id = r.id;
  END LOOP;
END;
$$;
