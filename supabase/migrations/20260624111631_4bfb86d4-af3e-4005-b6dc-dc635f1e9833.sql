ALTER TABLE public.app_orders
  ADD COLUMN IF NOT EXISTS promo_code text,
  ADD COLUMN IF NOT EXISTS discount numeric NOT NULL DEFAULT 0;