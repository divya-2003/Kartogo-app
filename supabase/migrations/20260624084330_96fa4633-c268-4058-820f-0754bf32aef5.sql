-- Ensure log rows can be created without supplying id/changed_at
ALTER TABLE public.order_status_log
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN changed_at SET DEFAULT now();

-- Allow the app (anon/authenticated) to read the status history.
GRANT SELECT ON public.order_status_log TO anon, authenticated;
GRANT ALL ON public.order_status_log TO service_role;

-- Record status changes automatically from app_orders.
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_status_log (order_id, from_status, to_status, changed_at)
    VALUES (NEW.id, NULL, NEW.status, COALESCE(NEW.created_at, now()));
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_status_log (order_id, from_status, to_status, changed_at)
    VALUES (NEW.id, OLD.status, NEW.status, now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_order_status_change ON public.app_orders;
CREATE TRIGGER trg_log_order_status_change
AFTER INSERT OR UPDATE ON public.app_orders
FOR EACH ROW
EXECUTE FUNCTION public.log_order_status_change();

-- Backfill an initial "placed" entry for existing orders that have no history.
INSERT INTO public.order_status_log (order_id, from_status, to_status, changed_at)
SELECT o.id, NULL, o.status, COALESCE(o.created_at, now())
FROM public.app_orders o
WHERE NOT EXISTS (
  SELECT 1 FROM public.order_status_log l WHERE l.order_id = o.id
);