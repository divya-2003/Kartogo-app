DROP POLICY IF EXISTS "Stock availability is public read-only" ON public.inventory_items;
DROP POLICY IF EXISTS "Inventory alerts are readable" ON public.inventory_alerts;
DROP POLICY IF EXISTS "Anyone can read driver access flags" ON public.driver_access_events;

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.inventory_items FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.inventory_alerts FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.driver_access_events FROM anon, authenticated;
GRANT ALL ON public.inventory_items TO service_role;
GRANT ALL ON public.inventory_alerts TO service_role;
GRANT ALL ON public.driver_access_events TO service_role;

REVOKE EXECUTE ON FUNCTION public.adjust_wallet(text, numeric, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_wallet_with_expiry(text, numeric, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_wallet_credits(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reserve_inventory(text, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.commit_inventory(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_inventory(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_inventory_thresholds() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_driver_access_event() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.adjust_wallet(text, numeric, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_wallet_with_expiry(text, numeric, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_wallet_credits(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_inventory(text, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.commit_inventory(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_inventory(text, text) TO service_role;