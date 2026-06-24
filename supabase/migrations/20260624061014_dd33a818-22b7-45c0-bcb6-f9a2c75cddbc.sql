GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_orders TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_orders TO authenticated;
GRANT ALL ON public.app_orders TO service_role;