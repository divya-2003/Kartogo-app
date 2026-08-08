-- Phase 10: logistics core

CREATE TYPE public.driver_status AS ENUM (
  'OFFLINE','ONLINE','AVAILABLE','ASSIGNED','PICKING_ORDER','EN_ROUTE','DELIVERED','BREAK'
);

CREATE TYPE public.assignment_status AS ENUM (
  'OFFERED','ACCEPTED','REJECTED','EXPIRED','CANCELLED','COMPLETED'
);

-- 1. delivery_partners -------------------------------------------------
CREATE TABLE public.delivery_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id text NOT NULL UNIQUE,
  name text NOT NULL,
  mobile_number text NOT NULL,
  vehicle_type text NOT NULL DEFAULT 'bike',
  current_latitude double precision,
  current_longitude double precision,
  status public.driver_status NOT NULL DEFAULT 'OFFLINE',
  online boolean NOT NULL DEFAULT false,
  rating numeric NOT NULL DEFAULT 5,
  rating_count integer NOT NULL DEFAULT 0,
  completed_orders integer NOT NULL DEFAULT 0,
  active_order_id text,
  last_location_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.delivery_partners TO service_role;
ALTER TABLE public.delivery_partners ENABLE ROW LEVEL SECURITY;

-- 2. driver_locations --------------------------------------------------
CREATE TABLE public.driver_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy double precision,
  speed double precision,
  heading double precision,
  order_id text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_driver_locations_driver_time ON public.driver_locations (driver_id, recorded_at DESC);
GRANT ALL ON public.driver_locations TO service_role;
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- 3. driver_status_history --------------------------------------------
CREATE TABLE public.driver_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id text NOT NULL,
  from_status public.driver_status,
  to_status public.driver_status NOT NULL,
  order_id text,
  actor text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_driver_status_history_driver ON public.driver_status_history (driver_id, created_at DESC);
GRANT ALL ON public.driver_status_history TO service_role;
ALTER TABLE public.driver_status_history ENABLE ROW LEVEL SECURITY;

-- 4. delivery_assignments ---------------------------------------------
CREATE TABLE public.delivery_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL,
  driver_id text NOT NULL,
  status public.assignment_status NOT NULL DEFAULT 'OFFERED',
  attempt integer NOT NULL DEFAULT 1,
  distance_meters double precision,
  pickup_latitude double precision,
  pickup_longitude double precision,
  drop_latitude double precision,
  drop_longitude double precision,
  offered_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '20 seconds'),
  responded_at timestamptz,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_delivery_assignments_order ON public.delivery_assignments (order_id, created_at DESC);
CREATE INDEX idx_delivery_assignments_driver ON public.delivery_assignments (driver_id, status);
CREATE UNIQUE INDEX idx_delivery_assignments_one_active
  ON public.delivery_assignments (order_id) WHERE status IN ('OFFERED','ACCEPTED');
GRANT ALL ON public.delivery_assignments TO service_role;
ALTER TABLE public.delivery_assignments ENABLE ROW LEVEL SECURITY;

-- 5. delivery_events ---------------------------------------------------
CREATE TABLE public.delivery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL,
  driver_id text,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_delivery_events_order ON public.delivery_events (order_id, created_at DESC);
GRANT ALL ON public.delivery_events TO service_role;
ALTER TABLE public.delivery_events ENABLE ROW LEVEL SECURITY;

-- updated_at triggers ---------------------------------------------------
CREATE TRIGGER update_delivery_partners_updated_at BEFORE UPDATE ON public.delivery_partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_delivery_assignments_updated_at BEFORE UPDATE ON public.delivery_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- log every driver status change ---------------------------------------
CREATE OR REPLACE FUNCTION public.log_driver_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.driver_status_history (driver_id, from_status, to_status, order_id)
    VALUES (NEW.driver_id, OLD.status, NEW.status, NEW.active_order_id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.log_driver_status_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_log_driver_status_change AFTER UPDATE ON public.delivery_partners
  FOR EACH ROW EXECUTE FUNCTION public.log_driver_status_change();
