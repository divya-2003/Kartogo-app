
CREATE TABLE public.catalog_items (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  mrp numeric,
  unit text NOT NULL DEFAULT '',
  stock integer NOT NULL DEFAULT 0,
  emoji text NOT NULL DEFAULT '🛒',
  image text,
  description text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'supplier',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.catalog_items TO anon;
GRANT SELECT ON public.catalog_items TO authenticated;
GRANT ALL ON public.catalog_items TO service_role;

ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Catalog items are publicly readable"
  ON public.catalog_items FOR SELECT
  USING (true);

CREATE TRIGGER catalog_items_updated_at
  BEFORE UPDATE ON public.catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
