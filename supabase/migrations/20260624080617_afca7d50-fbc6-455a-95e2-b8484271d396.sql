-- Audit log of every order status transition (server-side source of truth)
CREATE TABLE public.order_status_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id text NOT NULL,
  from_status text,
  to_status text NOT NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.order_status_log TO authenticated;
GRANT SELECT, INSERT ON public.order_status_log TO anon;
GRANT ALL ON public.order_status_log TO service_role;

ALTER TABLE public.order_status_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read order status log"
  ON public.order_status_log FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert order status log"
  ON public.order_status_log FOR INSERT
  WITH CHECK (true);

-- Validate allowed status transitions and log them. Runs server-side on every
-- update of app_orders.status, so an invalid jump can never be persisted and
-- every accepted change is recorded.
CREATE OR REPLACE FUNCTION public.validate_order_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  from_rank int;
  to_rank int;
  ranks constant jsonb := '{"placed":1,"packed":2,"out_for_delivery":3,"delivered":4,"cancelled":99}'::jsonb;
BEGIN
  -- No status change: nothing to validate or log.
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Unknown target status.
  IF NOT (ranks ? NEW.status) THEN
    RAISE EXCEPTION 'Invalid order status "%"', NEW.status;
  END IF;

  -- Terminal states cannot transition further.
  IF OLD.status IN ('delivered', 'cancelled') THEN
    RAISE EXCEPTION 'Order % is already % and cannot change to %', OLD.id, OLD.status, NEW.status;
  END IF;

  from_rank := (ranks ->> OLD.status)::int;
  to_rank := (ranks ->> NEW.status)::int;

  -- Allow cancelling from any active state, and forward progression only.
  IF NEW.status <> 'cancelled' AND to_rank <= from_rank THEN
    RAISE EXCEPTION 'Cannot move order % backwards from % to %', OLD.id, OLD.status, NEW.status;
  END IF;

  INSERT INTO public.order_status_log (order_id, from_status, to_status)
  VALUES (OLD.id, OLD.status, NEW.status);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_order_status_transition
  BEFORE UPDATE OF status ON public.app_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_order_status_transition();