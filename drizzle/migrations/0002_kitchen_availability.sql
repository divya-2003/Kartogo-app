CREATE TABLE IF NOT EXISTS public.kitchen_availability (
  kitchen_id text PRIMARY KEY,
  is_open boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.kitchen_availability TO service_role;
ALTER TABLE public.kitchen_availability ENABLE ROW LEVEL SECURITY;