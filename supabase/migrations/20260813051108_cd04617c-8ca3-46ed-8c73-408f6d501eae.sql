CREATE TABLE public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  discount_type text NOT NULL DEFAULT 'flat',
  discount_value numeric NOT NULL DEFAULT 0,
  min_subtotal numeric NOT NULL DEFAULT 0,
  max_discount numeric,
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer,
  per_customer_limit integer NOT NULL DEFAULT 1,
  first_order_only boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.promo_codes TO anon, authenticated;
GRANT ALL ON public.promo_codes TO service_role;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active promo codes are public" ON public.promo_codes FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE TRIGGER promo_codes_touch BEFORE UPDATE ON public.promo_codes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  phone text NOT NULL,
  order_id text,
  discount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.promo_redemptions TO service_role;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX promo_redemptions_code_phone_idx ON public.promo_redemptions (code, phone);
CREATE UNIQUE INDEX promo_redemptions_order_code_idx ON public.promo_redemptions (order_id, code) WHERE order_id IS NOT NULL;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by text,
  ADD COLUMN IF NOT EXISTS referral_rewarded boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS customers_referral_code_idx ON public.customers (referral_code) WHERE referral_code IS NOT NULL;

INSERT INTO public.promo_codes (code, description, discount_type, discount_value, min_subtotal, per_customer_limit, first_order_only)
VALUES
  ('SAVE50',  '₹50 off on orders above ₹1000', 'flat', 50, 1000, 5, false),
  ('SAVE100', '₹100 off on orders above ₹1800', 'flat', 100, 1800, 5, false),
  ('SAVE150', '₹150 off on orders above ₹1999', 'flat', 150, 1999, 5, false),
  ('WELCOME75', '₹75 off your first Kartogo order above ₹499', 'flat', 75, 499, 1, true)
ON CONFLICT (code) DO NOTHING;