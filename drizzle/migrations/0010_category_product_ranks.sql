CREATE TABLE public.category_product_ranks (
  category_slug text NOT NULL,
  rank smallint NOT NULL CHECK (rank BETWEEN 1 AND 3),
  product_ref text NOT NULL,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (category_slug, rank),
  UNIQUE (category_slug, product_ref)
);
GRANT ALL ON public.category_product_ranks TO service_role;
ALTER TABLE public.category_product_ranks ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.category_product_ranks IS 'Admin-chosen 1st/2nd/3rd products per Shop category. product_ref is a catalog product id or mp:<listing uuid>. Read and written only through server functions.';
CREATE INDEX IF NOT EXISTS customer_events_created_at_idx ON public.customer_events (created_at DESC);
CREATE INDEX IF NOT EXISTS customer_events_phone_created_idx ON public.customer_events (phone, created_at DESC);