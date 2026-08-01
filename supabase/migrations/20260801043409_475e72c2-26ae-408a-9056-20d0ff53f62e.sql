CREATE TABLE IF NOT EXISTS public.staff_accounts (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  mobile_number text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('admin','vendor','delivery_partner')),
  ref_id text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.staff_accounts TO service_role;
ALTER TABLE public.staff_accounts ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS staff_accounts_role_ref_idx
  ON public.staff_accounts (role, ref_id) WHERE ref_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.mobile_number_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.staff_accounts(user_id) ON DELETE CASCADE,
  old_mobile_number text NOT NULL,
  new_mobile_number text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.mobile_number_changes TO service_role;
ALTER TABLE public.mobile_number_changes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_staff_accounts_updated_at ON public.staff_accounts;
CREATE TRIGGER update_staff_accounts_updated_at
BEFORE UPDATE ON public.staff_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.staff_accounts (full_name, mobile_number, role, ref_id) VALUES
  ('Kartogo Admin', '9110310034', 'admin', 'admin'),
  ('Pharmacy Supplier', '9999999999', 'vendor', 'pharmacy'),
  ('Pickles & Local Snacks Supplier', '9999999998', 'vendor', 'pickles-snacks'),
  ('General Store Supplier', '9999999997', 'vendor', 'general'),
  ('Ravi Kumar', '9876500001', 'delivery_partner', 'd1'),
  ('Suresh M.', '9876500002', 'delivery_partner', 'd2'),
  ('Naveen P.', '9876500003', 'delivery_partner', 'd3')
ON CONFLICT (mobile_number) DO NOTHING;