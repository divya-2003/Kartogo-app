CREATE TABLE public.delivery_trips (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), driver_id text NOT NULL,
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','cancelled')),
 stops jsonb NOT NULL DEFAULT '[]', order_ids text[] NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.delivery_trips TO service_role;
ALTER TABLE public.delivery_trips ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX delivery_trips_one_active_driver ON public.delivery_trips(driver_id) WHERE status='active';
ALTER TABLE public.delivery_assignments ADD COLUMN IF NOT EXISTS trip_id uuid REFERENCES public.delivery_trips(id);
CREATE TABLE public.order_packing_confirmations (
 order_id text NOT NULL REFERENCES public.app_orders(id), supplier_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(order_id,supplier_id)
);
GRANT ALL ON public.order_packing_confirmations TO service_role;
ALTER TABLE public.order_packing_confirmations ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.claim_delivery_trip(p_driver text,p_orders text[],p_stops jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid; o public.app_orders%ROWTYPE; s jsonb; n integer; pickups integer; drops integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('kartogo_dispatch'));
 PERFORM 1 FROM public.delivery_partners WHERE driver_id=p_driver AND online AND status IN ('AVAILABLE','ONLINE') AND active_order_id IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Rider is no longer available'; END IF;
 IF cardinality(p_orders) NOT BETWEEN 1 AND 3 OR cardinality(p_orders)<>(SELECT count(DISTINCT x) FROM unnest(p_orders) x) THEN RAISE EXCEPTION 'Invalid trip size'; END IF;
 IF jsonb_typeof(p_stops)<>'array' OR jsonb_array_length(p_stops)<2 THEN RAISE EXCEPTION 'Invalid stops'; END IF;
 FOR o IN SELECT * FROM public.app_orders WHERE id=ANY(p_orders) ORDER BY id FOR UPDATE LOOP
  IF o.status<>'packed' OR o.delivery_boy_id IS NOT NULL THEN RAISE EXCEPTION 'Order is not ready or already assigned'; END IF;
 END LOOP;
 IF (SELECT count(*) FROM public.app_orders WHERE id=ANY(p_orders))<>cardinality(p_orders) THEN RAISE EXCEPTION 'Order missing'; END IF;
 FOREACH s IN ARRAY ARRAY(SELECT value FROM jsonb_array_elements(p_stops)) LOOP
  IF s->>'kind' NOT IN ('pickup','drop') OR NOT (s->>'orderId'=ANY(p_orders)) OR coalesce(s->>'done','false')<>'false' THEN RAISE EXCEPTION 'Invalid stop'; END IF;
 END LOOP;
 FOR n IN 1..cardinality(p_orders) LOOP
  SELECT count(*) FILTER(WHERE value->>'kind'='pickup'),count(*) FILTER(WHERE value->>'kind'='drop') INTO pickups,drops FROM jsonb_array_elements(p_stops) WHERE value->>'orderId'=p_orders[n];
  IF pickups<1 OR drops<>1 THEN RAISE EXCEPTION 'Missing pickup or drop'; END IF;
  IF (SELECT max(ordinality) FROM jsonb_array_elements(p_stops) WITH ORDINALITY WHERE value->>'orderId'=p_orders[n] AND value->>'kind'='pickup') >= (SELECT min(ordinality) FROM jsonb_array_elements(p_stops) WITH ORDINALITY WHERE value->>'orderId'=p_orders[n] AND value->>'kind'='drop') THEN RAISE EXCEPTION 'Pickup must precede delivery'; END IF;
 END LOOP;
 IF (SELECT count(DISTINCT value->>'marketId') FROM jsonb_array_elements(p_stops) WHERE value->>'kind'='pickup')>2 THEN RAISE EXCEPTION 'Too many pickup stores'; END IF;
 INSERT INTO public.delivery_trips(driver_id,order_ids,stops) VALUES(p_driver,p_orders,p_stops) RETURNING id INTO t;
 UPDATE public.delivery_assignments SET status='CANCELLED',reason='replaced_by_trip',responded_at=now() WHERE order_id=ANY(p_orders) AND status='OFFERED';
 UPDATE public.app_orders SET delivery_boy_id=p_driver,updated_at=now() WHERE id=ANY(p_orders);
 INSERT INTO public.delivery_assignments(order_id,driver_id,status,expires_at,responded_at,trip_id,pickup_latitude,pickup_longitude,drop_latitude,drop_longitude)
 SELECT x,p_driver,'ACCEPTED',now(),now(),t,
 (SELECT (value->'point'->>'lat')::float8 FROM jsonb_array_elements(p_stops) WHERE value->>'orderId'=x AND value->>'kind'='pickup' LIMIT 1),
 (SELECT (value->'point'->>'lng')::float8 FROM jsonb_array_elements(p_stops) WHERE value->>'orderId'=x AND value->>'kind'='pickup' LIMIT 1),
 (SELECT (value->'point'->>'lat')::float8 FROM jsonb_array_elements(p_stops) WHERE value->>'orderId'=x AND value->>'kind'='drop' LIMIT 1),
 (SELECT (value->'point'->>'lng')::float8 FROM jsonb_array_elements(p_stops) WHERE value->>'orderId'=x AND value->>'kind'='drop' LIMIT 1)
 FROM unnest(p_orders) x;
 UPDATE public.delivery_partners SET status='PICKING_ORDER',active_order_id=p_orders[1],updated_at=now() WHERE driver_id=p_driver;
 RETURN t;
END $$;
REVOKE ALL ON FUNCTION public.claim_delivery_trip(text,text[],jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_delivery_trip(text,text[],jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.finish_delivery_stop(p_driver text,p_trip uuid,p_index integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.delivery_trips%ROWTYPE; s jsonb; first_index integer; remaining integer; oid text; next_order text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('kartogo_dispatch'));
 SELECT * INTO t FROM public.delivery_trips WHERE id=p_trip AND driver_id=p_driver FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Trip not found'; END IF;
 IF p_index<0 OR p_index>=jsonb_array_length(t.stops) THEN RAISE EXCEPTION 'Invalid stop'; END IF;
 s:=t.stops->p_index;
 IF (s->>'done')::boolean THEN RETURN jsonb_build_object('changed',false); END IF;
 IF t.status<>'active' THEN RAISE EXCEPTION 'Trip closed'; END IF;
 SELECT (ordinality-1)::integer INTO first_index FROM jsonb_array_elements(t.stops) WITH ORDINALITY WHERE coalesce((value->>'done')::boolean,false)=false ORDER BY ordinality LIMIT 1;
 IF first_index<>p_index THEN RAISE EXCEPTION 'Complete the previous stop first'; END IF;
 oid:=s->>'orderId';
 PERFORM 1 FROM public.app_orders WHERE id=oid AND delivery_boy_id=p_driver AND status IN ('packed','out_for_delivery') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order is no longer active'; END IF;
 t.stops:=jsonb_set(t.stops,ARRAY[p_index::text,'done'],'true');
 t.stops:=jsonb_set(t.stops,ARRAY[p_index::text,'completedAt'],to_jsonb(now()));
 IF s->>'kind'='pickup' THEN
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(t.stops) WHERE value->>'orderId'=oid AND value->>'kind'='pickup' AND coalesce((value->>'done')::boolean,false)=false) THEN
   UPDATE public.app_orders SET status='out_for_delivery',updated_at=now() WHERE id=oid AND status='packed';
  END IF;
 ELSE
  UPDATE public.app_orders SET status='delivered',updated_at=now() WHERE id=oid AND status='out_for_delivery';
  IF NOT FOUND THEN RAISE EXCEPTION 'Collect all items before delivery'; END IF;
  UPDATE public.delivery_assignments SET status='COMPLETED',responded_at=now() WHERE trip_id=p_trip AND order_id=oid AND status='ACCEPTED';
  UPDATE public.delivery_partners SET completed_orders=completed_orders+1 WHERE driver_id=p_driver;
 END IF;
 SELECT count(*) INTO remaining FROM jsonb_array_elements(t.stops) WHERE coalesce((value->>'done')::boolean,false)=false;
 SELECT value->>'orderId' INTO next_order FROM jsonb_array_elements(t.stops) WITH ORDINALITY WHERE coalesce((value->>'done')::boolean,false)=false ORDER BY ordinality LIMIT 1;
 UPDATE public.delivery_trips SET stops=t.stops,status=CASE WHEN remaining=0 THEN 'completed' ELSE 'active' END,updated_at=now() WHERE id=p_trip;
 UPDATE public.delivery_partners SET active_order_id=next_order,status=CASE WHEN remaining=0 THEN 'AVAILABLE'::public.driver_status WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(t.stops) WHERE value->>'kind'='pickup' AND coalesce((value->>'done')::boolean,false)=false) THEN 'PICKING_ORDER'::public.driver_status ELSE 'EN_ROUTE'::public.driver_status END,updated_at=now() WHERE driver_id=p_driver;
 RETURN jsonb_build_object('changed',true,'orderId',oid,'kind',s->>'kind');
END $$;
REVOKE ALL ON FUNCTION public.finish_delivery_stop(text,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_delivery_stop(text,uuid,integer) TO service_role;