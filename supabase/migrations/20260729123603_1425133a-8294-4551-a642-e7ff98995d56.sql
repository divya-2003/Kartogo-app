CREATE TABLE public.product_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  badge text NOT NULL DEFAULT '',
  tone text NOT NULL DEFAULT 'primary',
  applies_to_all boolean NOT NULL DEFAULT false,
  product_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_offers TO anon;
GRANT SELECT ON public.product_offers TO authenticated;
GRANT ALL ON public.product_offers TO service_role;

ALTER TABLE public.product_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active offers are publicly readable"
  ON public.product_offers FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE TRIGGER update_product_offers_updated_at
  BEFORE UPDATE ON public.product_offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.stock_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL,
  product_name text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  customer_phone text,
  customer_name text,
  markets text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.stock_alerts TO service_role;

ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_alerts_no_client_access"
  ON public.stock_alerts FOR ALL
  USING (false) WITH CHECK (false);

CREATE TRIGGER update_stock_alerts_updated_at
  BEFORE UPDATE ON public.stock_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_stock_alerts_status ON public.stock_alerts (status, created_at DESC);