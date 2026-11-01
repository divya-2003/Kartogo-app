CREATE TABLE public.product_ai_recommendations (
  product_id text PRIMARY KEY,
  related_ids text[] NOT NULL DEFAULT '{}',
  catalog_size integer NOT NULL DEFAULT 0,
  generated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.product_ai_recommendations TO service_role;
ALTER TABLE public.product_ai_recommendations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ui_translations (
  lang text NOT NULL,
  source_hash text NOT NULL,
  source text NOT NULL,
  translated text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lang, source_hash)
);
GRANT ALL ON public.ui_translations TO service_role;
ALTER TABLE public.ui_translations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.daily_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_date date NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'running',
  summary text,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  email_status text NOT NULL DEFAULT 'not_sent',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.daily_briefings TO service_role;
ALTER TABLE public.daily_briefings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER daily_briefings_updated_at BEFORE UPDATE ON public.daily_briefings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();