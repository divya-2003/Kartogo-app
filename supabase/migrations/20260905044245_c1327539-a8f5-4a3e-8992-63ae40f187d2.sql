CREATE TABLE public.admin_access (
  user_id uuid PRIMARY KEY REFERENCES public.staff_accounts(user_id) ON DELETE CASCADE,
  is_super_admin boolean NOT NULL DEFAULT false,
  permissions text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_access_permissions_valid CHECK (permissions <@ ARRAY['dashboard','inventory','warehouse','ai','alerts','notifications','orders','refunds','feedback','delivery','logistics','print','partners','combos','promos','requests','sales','reports','recommendations','sub_admins','account']::text[])
);

GRANT ALL ON public.admin_access TO service_role;

ALTER TABLE public.admin_access ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER admin_access_touch
BEFORE UPDATE ON public.admin_access
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.admin_access (user_id, is_super_admin, permissions)
SELECT user_id, true, '{}'::text[]
FROM public.staff_accounts
WHERE role = 'admin'
ON CONFLICT (user_id) DO NOTHING;