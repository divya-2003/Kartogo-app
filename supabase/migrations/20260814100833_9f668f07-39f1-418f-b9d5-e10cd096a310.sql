CREATE TABLE public.order_substitutions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id text NOT NULL,
  product_id text NOT NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  original_price numeric NOT NULL DEFAULT 0,
  replacement_product_id text,
  replacement_name text,
  replacement_price numeric NOT NULL DEFAULT 0,
  note text,
  suggested_by text NOT NULL DEFAULT 'supplier',
  status text NOT NULL DEFAULT 'pending',
  responded_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.order_substitutions TO service_role;

ALTER TABLE public.order_substitutions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_order_substitutions_order ON public.order_substitutions (order_id);

CREATE TRIGGER order_substitutions_touch
BEFORE UPDATE ON public.order_substitutions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.partner_markets
  ADD COLUMN IF NOT EXISTS accepting_orders boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS prep_minutes integer NOT NULL DEFAULT 12;