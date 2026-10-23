CREATE TABLE public.partner_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_type text NOT NULL,
  business_name text NOT NULL,
  owner_name text NOT NULL,
  phone text NOT NULL,
  email text,
  address text NOT NULL,
  city text NOT NULL,
  pincode text NOT NULL,
  lat double precision,
  lng double precision,
  gstin text,
  fssai text,
  pan text,
  categories text,
  notes text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.partner_applications TO service_role;
ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;
CREATE INDEX partner_applications_created_idx ON public.partner_applications (created_at DESC);

INSERT INTO public.mp_categories (slug, name, group_key, icon, behavior, legacy_categories, sort, is_active, is_popular)
VALUES
  ('clothes', 'Clothes', 'shop', '👕', 'PRODUCT', '{}', 7, true, false),
  ('pharmacy', 'Pharmacy', 'shop', '💊', 'PRODUCT', '{pharmacy}', 8, true, false),
  ('combos', 'Combos', 'shop', '🎁', 'PRODUCT', '{combos}', 9, true, false)
ON CONFLICT (slug) DO NOTHING;

CREATE INDEX IF NOT EXISTS admin_audit_log_session_idx ON public.admin_audit_log (entity_type, created_at DESC);