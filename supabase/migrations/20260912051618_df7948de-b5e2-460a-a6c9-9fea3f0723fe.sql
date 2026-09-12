DROP TABLE IF EXISTS public.orders;
DROP TABLE IF EXISTS public.products;
DROP TABLE IF EXISTS public.merchants;
DROP TABLE IF EXISTS public.drivers;
DROP TABLE IF EXISTS public.product_recommendations;
DROP TYPE IF EXISTS public.product_category;
DROP TYPE IF EXISTS public.order_status;
DROP TYPE IF EXISTS public.payment_status;

CREATE TABLE public.delivery_slots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.delivery_slots TO anon, authenticated;
GRANT ALL ON public.delivery_slots TO service_role;

ALTER TABLE public.delivery_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active delivery slots are public"
  ON public.delivery_slots FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE TRIGGER delivery_slots_touch
  BEFORE UPDATE ON public.delivery_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.delivery_slots (label, start_time, end_time, sort_order) VALUES
  ('Morning', '08:00', '11:00', 1),
  ('Afternoon', '12:00', '16:00', 2),
  ('Evening', '18:00', '21:00', 3);

ALTER TABLE public.app_orders
  ADD COLUMN IF NOT EXISTS scheduled_slot_label text,
  ADD COLUMN IF NOT EXISTS scheduled_date date,
  ADD COLUMN IF NOT EXISTS scheduled_start time,
  ADD COLUMN IF NOT EXISTS scheduled_end time;