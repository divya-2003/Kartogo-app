CREATE TABLE public.service_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('FOOD','RIDE')),
  customer_phone text NOT NULL,
  customer_name text,
  title text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'PLACED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.service_orders TO service_role;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;
CREATE INDEX service_orders_phone_idx ON public.service_orders (customer_phone, created_at DESC);
CREATE TRIGGER update_service_orders_updated_at BEFORE UPDATE ON public.service_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();