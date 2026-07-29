CREATE TABLE IF NOT EXISTS public.driver_access_events (
  driver_id text PRIMARY KEY,
  active boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.driver_access_events TO anon;
GRANT SELECT ON public.driver_access_events TO authenticated;
GRANT ALL ON public.driver_access_events TO service_role;

ALTER TABLE public.driver_access_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read driver access flags" ON public.driver_access_events;
CREATE POLICY "Anyone can read driver access flags"
  ON public.driver_access_events FOR SELECT
  USING (true);

CREATE OR REPLACE FUNCTION public.sync_driver_access_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.driver_access_events (driver_id, active, updated_at)
  VALUES (NEW.driver_id, COALESCE(NEW.active, false), now())
  ON CONFLICT (driver_id) DO UPDATE
    SET active = EXCLUDED.active, updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_driver_access_event ON public.driver_availability;
CREATE TRIGGER trg_sync_driver_access_event
AFTER INSERT OR UPDATE ON public.driver_availability
FOR EACH ROW EXECUTE FUNCTION public.sync_driver_access_event();

INSERT INTO public.driver_access_events (driver_id, active, updated_at)
SELECT driver_id, COALESCE(active, false), now() FROM public.driver_availability
ON CONFLICT (driver_id) DO UPDATE SET active = EXCLUDED.active, updated_at = now();

ALTER TABLE public.driver_access_events REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_access_events;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;