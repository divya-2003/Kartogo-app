
-- Partner markets (supermarkets & partner stores managed by admin)
CREATE TABLE public.partner_markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  lat double precision,
  lng double precision,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.partner_markets TO service_role;
ALTER TABLE public.partner_markets ENABLE ROW LEVEL SECURITY;
-- All access goes through server functions using service_role. No direct client policy.

CREATE TRIGGER partner_markets_touch
BEFORE UPDATE ON public.partner_markets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Unserviceable-area requests submitted by customers who fell outside our zone
CREATE TABLE public.unserviceable_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text,
  pincode text,
  area_text text,
  lat double precision,
  lng double precision,
  note text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.unserviceable_requests TO service_role;
ALTER TABLE public.unserviceable_requests ENABLE ROW LEVEL SECURITY;
-- Server-function only.

CREATE TRIGGER unserviceable_requests_touch
BEFORE UPDATE ON public.unserviceable_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX unserviceable_requests_status_idx ON public.unserviceable_requests (status, created_at DESC);
