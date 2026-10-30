-- Home sections and reviews are only read by the app server (which uses the
-- service role and does not need RLS policies). The always-true SELECT
-- policies are removed so no browser role can list every row.
DROP POLICY IF EXISTS "Public reads home sections" ON public.mp_home_sections;
DROP POLICY IF EXISTS "Public reads reviews" ON public.mp_reviews;
REVOKE ALL ON public.mp_home_sections FROM anon, authenticated;
REVOKE ALL ON public.mp_reviews FROM anon, authenticated;
GRANT ALL ON public.mp_home_sections TO service_role;
GRANT ALL ON public.mp_reviews TO service_role;