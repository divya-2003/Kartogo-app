ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS driver_id text,
  ADD COLUMN IF NOT EXISTS driver_name text,
  ADD COLUMN IF NOT EXISTS driver_phone text,
  ADD COLUMN IF NOT EXISTS driver_lat double precision,
  ADD COLUMN IF NOT EXISTS driver_lng double precision,
  ADD COLUMN IF NOT EXISTS driver_location_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_history jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS service_orders_status_idx ON public.service_orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS service_orders_driver_idx ON public.service_orders(driver_id);