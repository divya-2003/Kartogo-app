
-- 1) Partner market phone
ALTER TABLE public.partner_markets ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2) Driver ratings (one per order)
CREATE TABLE IF NOT EXISTS public.driver_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  driver_id TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_ratings TO authenticated;
GRANT SELECT ON public.driver_ratings TO anon;
GRANT ALL ON public.driver_ratings TO service_role;
ALTER TABLE public.driver_ratings ENABLE ROW LEVEL SECURITY;
-- Reads are through server functions with service role; keep table locked from clients.
CREATE POLICY "driver_ratings_no_client_access" ON public.driver_ratings
  FOR ALL USING (false) WITH CHECK (false);
CREATE INDEX IF NOT EXISTS idx_driver_ratings_driver ON public.driver_ratings(driver_id);
CREATE TRIGGER trg_driver_ratings_updated
  BEFORE UPDATE ON public.driver_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Combos (bundles of catalog items sold at a combo price)
CREATE TABLE IF NOT EXISTS public.combos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image TEXT,
  emoji TEXT,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  items JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{ productId: string, qty: number }]
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT, -- 'admin' or supplier slug
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.combos TO authenticated;
GRANT SELECT ON public.combos TO anon;
GRANT ALL ON public.combos TO service_role;
ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "combos_public_read_active" ON public.combos FOR SELECT USING (is_active = true);
CREATE TRIGGER trg_combos_updated
  BEFORE UPDATE ON public.combos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
