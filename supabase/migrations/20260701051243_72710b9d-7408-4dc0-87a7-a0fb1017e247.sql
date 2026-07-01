CREATE TABLE public.customer_wishlists (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone text NOT NULL,
  product_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (phone, product_id)
);

CREATE INDEX idx_customer_wishlists_phone ON public.customer_wishlists (phone);

GRANT ALL ON public.customer_wishlists TO service_role;

ALTER TABLE public.customer_wishlists ENABLE ROW LEVEL SECURITY;
