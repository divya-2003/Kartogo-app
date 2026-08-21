CREATE TABLE public.customer_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text,
  session_id text,
  event_type text NOT NULL,
  product_id text,
  category text,
  order_id text,
  search_query text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.customer_events TO service_role;
ALTER TABLE public.customer_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_customer_events_phone ON public.customer_events(phone);
CREATE INDEX idx_customer_events_type ON public.customer_events(event_type);
CREATE INDEX idx_customer_events_product ON public.customer_events(product_id);
CREATE INDEX idx_customer_events_category ON public.customer_events(category);
CREATE INDEX idx_customer_events_created ON public.customer_events(created_at DESC);
CREATE INDEX idx_customer_events_phone_product ON public.customer_events(phone, product_id);
CREATE INDEX idx_customer_events_phone_type ON public.customer_events(phone, event_type);
CREATE UNIQUE INDEX idx_customer_events_purchase_once
  ON public.customer_events(phone, order_id, product_id)
  WHERE event_type = 'PRODUCT_PURCHASED';
CREATE UNIQUE INDEX idx_customer_events_order_once
  ON public.customer_events(phone, order_id)
  WHERE event_type = 'ORDER_PLACED';

CREATE TABLE public.customer_product_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  product_id text NOT NULL,
  interest_score numeric NOT NULL DEFAULT 0,
  view_count integer NOT NULL DEFAULT 0,
  search_count integer NOT NULL DEFAULT 0,
  cart_count integer NOT NULL DEFAULT 0,
  purchase_count integer NOT NULL DEFAULT 0,
  favorite_count integer NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,
  last_searched_at timestamptz,
  last_added_to_cart_at timestamptz,
  last_purchased_at timestamptz,
  average_purchase_interval_days numeric,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (phone, product_id)
);
GRANT ALL ON public.customer_product_preferences TO service_role;
ALTER TABLE public.customer_product_preferences ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_cpp_phone ON public.customer_product_preferences(phone);
CREATE INDEX idx_cpp_score ON public.customer_product_preferences(interest_score DESC);

CREATE TABLE public.customer_category_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  category text NOT NULL,
  interest_score numeric NOT NULL DEFAULT 0,
  view_count integer NOT NULL DEFAULT 0,
  purchase_count integer NOT NULL DEFAULT 0,
  last_activity_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (phone, category)
);
GRANT ALL ON public.customer_category_preferences TO service_role;
ALTER TABLE public.customer_category_preferences ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_ccp_phone ON public.customer_category_preferences(phone);

CREATE TABLE public.customer_replenishment_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  product_id text NOT NULL,
  last_purchase_at timestamptz,
  average_purchase_interval_days numeric,
  predicted_next_purchase_at timestamptz,
  days_until_predicted_purchase numeric,
  confidence_score numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'UPCOMING',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (phone, product_id)
);
GRANT ALL ON public.customer_replenishment_predictions TO service_role;
ALTER TABLE public.customer_replenishment_predictions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_crp_phone ON public.customer_replenishment_predictions(phone);
CREATE INDEX idx_crp_predicted ON public.customer_replenishment_predictions(predicted_next_purchase_at);

CREATE TABLE public.product_associations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL,
  associated_product_id text NOT NULL,
  co_purchase_count integer NOT NULL DEFAULT 0,
  association_score numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, associated_product_id)
);
GRANT ALL ON public.product_associations TO service_role;
ALTER TABLE public.product_associations ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_pa_product ON public.product_associations(product_id);
CREATE INDEX idx_pa_associated ON public.product_associations(associated_product_id);

CREATE TABLE public.product_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  product_id text NOT NULL,
  recommendation_type text NOT NULL,
  score numeric NOT NULL DEFAULT 0,
  reason text NOT NULL DEFAULT '',
  source_product_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);
GRANT ALL ON public.product_recommendations TO service_role;
ALTER TABLE public.product_recommendations ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_pr_phone ON public.product_recommendations(phone);
CREATE INDEX idx_pr_score ON public.product_recommendations(score DESC);

CREATE TABLE public.recommendation_settings (
  id integer PRIMARY KEY DEFAULT 1,
  view_weight numeric NOT NULL DEFAULT 1,
  search_weight numeric NOT NULL DEFAULT 3,
  favorite_weight numeric NOT NULL DEFAULT 4,
  cart_weight numeric NOT NULL DEFAULT 6,
  purchase_weight numeric NOT NULL DEFAULT 10,
  repeat_purchase_bonus numeric NOT NULL DEFAULT 5,
  min_co_purchase_count integer NOT NULL DEFAULT 3,
  recommendation_limit integer NOT NULL DEFAULT 8,
  min_recommendation_score numeric NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recommendation_settings_singleton CHECK (id = 1)
);
GRANT ALL ON public.recommendation_settings TO service_role;
ALTER TABLE public.recommendation_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.recommendation_settings (id) VALUES (1) ON CONFLICT DO NOTHING;