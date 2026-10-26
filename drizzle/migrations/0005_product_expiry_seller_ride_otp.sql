ALTER TABLE public.catalog_items
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS seller_id text,
  ADD COLUMN IF NOT EXISTS seller_name text;

ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS ride_otp text,
  ADD COLUMN IF NOT EXISTS otp_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS otp_attempts integer NOT NULL DEFAULT 0;

UPDATE public.service_orders
  SET ride_otp = lpad((floor(random() * 10000))::int::text, 4, '0')
  WHERE kind = 'RIDE' AND ride_otp IS NULL AND status IN ('SEARCHING','ACCEPTED','ARRIVED');