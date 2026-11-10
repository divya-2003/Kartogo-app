CREATE TABLE public.customer_carts (
  phone text PRIMARY KEY,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.customer_carts TO service_role;
ALTER TABLE public.customer_carts ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.customer_carts IS 'Saved cart per customer phone; read/written only via server functions with a signed customer token.';

CREATE TABLE public.kitchen_dishes (
  id text PRIMARY KEY DEFAULT ('kd-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  kitchen_id text NOT NULL,
  name text NOT NULL,
  price numeric NOT NULL CHECK (price >= 0),
  veg boolean NOT NULL DEFAULT true,
  description text NOT NULL DEFAULT '',
  image text,
  bestseller boolean NOT NULL DEFAULT false,
  addons jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_available boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kitchen_dishes_kitchen_idx ON public.kitchen_dishes (kitchen_id, sort);
GRANT ALL ON public.kitchen_dishes TO service_role;
ALTER TABLE public.kitchen_dishes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER kitchen_dishes_updated_at BEFORE UPDATE ON public.kitchen_dishes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS product_id text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS stock_alert_id uuid;