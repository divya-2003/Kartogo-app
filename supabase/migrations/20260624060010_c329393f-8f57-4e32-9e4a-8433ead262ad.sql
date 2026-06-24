CREATE TABLE public.app_orders (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  customer_phone text NOT NULL,
  customer_name text NOT NULL,
  address text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  delivery_fee numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  status text NOT NULL DEFAULT 'placed',
  delivery_boy_id text
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_orders TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_orders TO authenticated;
GRANT ALL ON public.app_orders TO service_role;

ALTER TABLE public.app_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view orders"
  ON public.app_orders FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create orders"
  ON public.app_orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update orders"
  ON public.app_orders FOR UPDATE
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_app_orders_updated_at
  BEFORE UPDATE ON public.app_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.app_orders REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_orders;