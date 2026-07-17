
-- Surge pricing: singleton config + per-order snapshot columns

ALTER TABLE public.app_orders
  ADD COLUMN IF NOT EXISTS surge_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS surge_reason text,
  ADD COLUMN IF NOT EXISTS driver_surge_share numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.surge_config (
  id integer PRIMARY KEY DEFAULT 1,
  enabled boolean NOT NULL DEFAULT false,
  reason text NOT NULL DEFAULT 'high_demand',
  amount numeric NOT NULL DEFAULT 0,
  driver_share_percent numeric NOT NULL DEFAULT 50,
  note text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT surge_config_singleton CHECK (id = 1),
  CONSTRAINT surge_config_share_range CHECK (driver_share_percent >= 0 AND driver_share_percent <= 100),
  CONSTRAINT surge_config_amount_nonneg CHECK (amount >= 0)
);

GRANT ALL ON public.surge_config TO service_role;

ALTER TABLE public.surge_config ENABLE ROW LEVEL SECURITY;

-- No policies: the app reads/writes this table only through server functions
-- using the service role; direct Data API access is not allowed.

INSERT INTO public.surge_config (id, enabled, reason, amount, driver_share_percent)
VALUES (1, false, 'high_demand', 0, 50)
ON CONFLICT (id) DO NOTHING;

CREATE TRIGGER update_surge_config_updated_at
  BEFORE UPDATE ON public.surge_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
