ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS whatsapp_marketing_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_marketing_opt_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS promo_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS promo_skipped boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS customers_promo_sent_at_idx ON public.customers (promo_sent_at) WHERE promo_sent_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS customers_wa_queue_idx ON public.customers (created_at) WHERE whatsapp_marketing_opt_in AND promo_sent_at IS NULL AND NOT promo_skipped;

CREATE OR REPLACE FUNCTION public.wa_phone_key(p text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN d ~ '^91\d{10}$' THEN substr(d, 3)
    ELSE d END
  FROM (SELECT regexp_replace(coalesce(p, ''), '\D', '', 'g') AS d) x
$$;

CREATE INDEX IF NOT EXISTS app_orders_wa_phone_key_idx ON public.app_orders (public.wa_phone_key(customer_phone));

CREATE OR REPLACE FUNCTION public.wa_promo_sent_today() RETURNS integer
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT count(*)::int FROM public.customers
  WHERE promo_sent_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')
$$;

CREATE OR REPLACE FUNCTION public.claim_whatsapp_promo(p_customer uuid, p_admin text, p_product text, p_limit integer DEFAULT 25)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.customers%ROWTYPE; v_sent integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('kartogo_whatsapp_promo'));
  SELECT * INTO c FROM public.customers WHERE id = p_customer FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
  IF c.promo_sent_at IS NOT NULL THEN RAISE EXCEPTION 'Already marked as sent'; END IF;
  IF c.promo_skipped THEN RAISE EXCEPTION 'Customer was skipped'; END IF;
  IF NOT c.whatsapp_marketing_opt_in THEN RAISE EXCEPTION 'Customer has not opted in to WhatsApp offers'; END IF;
  IF c.created_at > now() - interval '24 hours' THEN RAISE EXCEPTION 'Customer registered less than 24 hours ago'; END IF;
  IF EXISTS (SELECT 1 FROM public.app_orders o WHERE public.wa_phone_key(o.customer_phone) = public.wa_phone_key(c.phone)) THEN
    RAISE EXCEPTION 'Customer has already placed an order';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.catalog_items i WHERE i.id = p_product AND NOT i.is_deleted AND i.stock > 0
                 AND (i.expiry_date IS NULL OR i.expiry_date >= (now() AT TIME ZONE 'Asia/Kolkata')::date)) THEN
    RAISE EXCEPTION 'Selected product is not available';
  END IF;
  v_sent := public.wa_promo_sent_today();
  IF v_sent >= p_limit THEN RAISE EXCEPTION 'Daily limit of % messages reached', p_limit; END IF;
  UPDATE public.customers SET promo_sent_at = now() WHERE id = p_customer;
  INSERT INTO public.admin_audit_log (actor, actor_role, action, entity_type, entity_id, details)
  VALUES (p_admin, 'admin', 'whatsapp_promo.sent', 'customer', p_customer::text,
          jsonb_build_object('campaign', 'registered_not_ordered', 'action', 'sent', 'customer_id', p_customer, 'admin_id', p_admin, 'product_id', p_product, 'at', now()));
  RETURN v_sent + 1;
END $$;

CREATE OR REPLACE FUNCTION public.skip_whatsapp_promo(p_customer uuid, p_admin text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.customers%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('kartogo_whatsapp_promo'));
  SELECT * INTO c FROM public.customers WHERE id = p_customer FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
  IF c.promo_sent_at IS NOT NULL THEN RAISE EXCEPTION 'Already marked as sent'; END IF;
  IF c.promo_skipped THEN RAISE EXCEPTION 'Customer was already skipped'; END IF;
  UPDATE public.customers SET promo_skipped = true WHERE id = p_customer;
  INSERT INTO public.admin_audit_log (actor, actor_role, action, entity_type, entity_id, details)
  VALUES (p_admin, 'admin', 'whatsapp_promo.skip', 'customer', p_customer::text,
          jsonb_build_object('campaign', 'registered_not_ordered', 'action', 'skip', 'customer_id', p_customer, 'admin_id', p_admin, 'at', now()));
  RETURN public.wa_promo_sent_today();
END $$;

REVOKE EXECUTE ON FUNCTION public.claim_whatsapp_promo(uuid, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.skip_whatsapp_promo(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wa_promo_sent_today() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_promo(uuid, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.skip_whatsapp_promo(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.wa_promo_sent_today() TO service_role;