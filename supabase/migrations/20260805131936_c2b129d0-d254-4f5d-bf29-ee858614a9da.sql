CREATE TABLE public.ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience text NOT NULL DEFAULT 'admin',
  supplier_id text,
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'low',
  product_id text,
  product_name text,
  market_id uuid,
  title text NOT NULL,
  body text NOT NULL,
  reasoning text NOT NULL DEFAULT '',
  recommended_quantity integer,
  confidence numeric NOT NULL DEFAULT 0,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.ai_insights TO service_role;
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

CREATE INDEX ai_insights_audience_idx ON public.ai_insights (audience, created_at DESC);
CREATE INDEX ai_insights_status_idx ON public.ai_insights (status);

CREATE TRIGGER ai_insights_touch BEFORE UPDATE ON public.ai_insights
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ai_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  product_id text NOT NULL,
  product_name text NOT NULL DEFAULT '',
  predicted_next_day numeric NOT NULL DEFAULT 0,
  predicted_next_week numeric NOT NULL DEFAULT 0,
  predicted_next_month numeric NOT NULL DEFAULT 0,
  available_stock integer NOT NULL DEFAULT 0,
  days_to_stockout numeric,
  recommended_quantity integer NOT NULL DEFAULT 0,
  confidence numeric NOT NULL DEFAULT 0,
  actual_units numeric,
  accuracy numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (forecast_date, product_id)
);

GRANT ALL ON public.ai_forecasts TO service_role;
ALTER TABLE public.ai_forecasts ENABLE ROW LEVEL SECURITY;

CREATE INDEX ai_forecasts_product_idx ON public.ai_forecasts (product_id, forecast_date DESC);

CREATE TRIGGER ai_forecasts_touch BEFORE UPDATE ON public.ai_forecasts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();