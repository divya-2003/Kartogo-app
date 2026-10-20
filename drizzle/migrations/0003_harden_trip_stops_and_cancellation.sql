CREATE OR REPLACE FUNCTION public.validate_delivery_trip_stops() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE s jsonb;
BEGIN
 IF NEW.order_ids IS NULL OR cardinality(NEW.order_ids) NOT BETWEEN 1 AND 3 OR NEW.stops IS NULL OR jsonb_typeof(NEW.stops) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid trip'; END IF;
 FOR s IN SELECT value FROM jsonb_array_elements(NEW.stops) LOOP
  IF s->>'kind' IS NULL OR s->>'kind' NOT IN ('pickup','drop') OR s->>'orderId' IS NULL OR NOT(s->>'orderId'=ANY(NEW.order_ids)) OR s->>'address' IS NULL OR s->>'label' IS NULL OR s->>'done' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Invalid trip stop'; END IF;
  IF s->>'kind'='pickup' AND (coalesce(s->>'marketId','')='' OR NOT EXISTS(SELECT 1 FROM public.partner_markets WHERE id::text=s->>'marketId' AND is_active)) THEN RAISE EXCEPTION 'Invalid pickup store'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_delivery_trip_stops BEFORE INSERT ON public.delivery_trips FOR EACH ROW EXECUTE FUNCTION public.validate_delivery_trip_stops();
REVOKE ALL ON FUNCTION public.validate_delivery_trip_stops() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.validate_delivery_trip_stops() TO service_role;
CREATE OR REPLACE FUNCTION public.cleanup_cancelled_trip_order() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.delivery_trips%ROWTYPE; remaining integer; next_oid text;
BEGIN
 IF NEW.status<>'cancelled' OR OLD.status='cancelled' THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('kartogo_dispatch'));
 FOR t IN SELECT * FROM public.delivery_trips WHERE status='active' AND NEW.id=ANY(order_ids) FOR UPDATE LOOP
  SELECT coalesce(jsonb_agg(value ORDER BY ordinality),'[]'::jsonb) INTO t.stops FROM jsonb_array_elements(t.stops) WITH ORDINALITY WHERE value->>'orderId'<>NEW.id OR coalesce((value->>'done')::boolean,false);
  SELECT count(*) INTO remaining FROM jsonb_array_elements(t.stops) WHERE NOT coalesce((value->>'done')::boolean,false);
  SELECT value->>'orderId' INTO next_oid FROM jsonb_array_elements(t.stops) WITH ORDINALITY WHERE NOT coalesce((value->>'done')::boolean,false) ORDER BY ordinality LIMIT 1;
  UPDATE public.delivery_trips SET stops=t.stops,status=CASE WHEN remaining=0 THEN 'completed' ELSE 'active' END,updated_at=now() WHERE id=t.id;
  UPDATE public.delivery_assignments SET status='CANCELLED',reason='order_cancelled',responded_at=now() WHERE trip_id=t.id AND order_id=NEW.id AND status='ACCEPTED';
  UPDATE public.delivery_partners SET active_order_id=next_oid,status=CASE WHEN remaining=0 THEN 'AVAILABLE'::public.driver_status WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(t.stops) WHERE value->>'kind'='pickup' AND NOT coalesce((value->>'done')::boolean,false)) THEN 'PICKING_ORDER'::public.driver_status ELSE 'EN_ROUTE'::public.driver_status END,updated_at=now() WHERE driver_id=t.driver_id;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER cleanup_cancelled_trip_order AFTER UPDATE OF status ON public.app_orders FOR EACH ROW EXECUTE FUNCTION public.cleanup_cancelled_trip_order();
REVOKE ALL ON FUNCTION public.cleanup_cancelled_trip_order() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_cancelled_trip_order() TO service_role;
CREATE OR REPLACE FUNCTION public.commit_trip_delivery_inventory() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status='delivered' AND OLD.status<>'delivered' AND EXISTS(SELECT 1 FROM public.delivery_assignments WHERE order_id=NEW.id AND trip_id IS NOT NULL AND status='ACCEPTED') THEN PERFORM public.commit_inventory(NEW.id,'trip_delivery'); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER commit_trip_delivery_inventory AFTER UPDATE OF status ON public.app_orders FOR EACH ROW EXECUTE FUNCTION public.commit_trip_delivery_inventory();
REVOKE ALL ON FUNCTION public.commit_trip_delivery_inventory() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.commit_trip_delivery_inventory() TO service_role;