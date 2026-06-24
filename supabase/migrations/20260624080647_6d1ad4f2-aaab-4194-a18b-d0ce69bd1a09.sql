-- The log is written only by the SECURITY DEFINER trigger, so remove the
-- permissive direct-insert path.
DROP POLICY IF EXISTS "Anyone can insert order status log" ON public.order_status_log;
REVOKE INSERT ON public.order_status_log FROM anon;
REVOKE INSERT ON public.order_status_log FROM authenticated;

-- Trigger functions don't need to be directly executable by API roles.
REVOKE EXECUTE ON FUNCTION public.validate_order_status_transition() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_order_status_transition() FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_order_status_transition() FROM authenticated;