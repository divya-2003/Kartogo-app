CREATE OR REPLACE FUNCTION public.wa_campaign_eligible(p_customer uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.customers c WHERE c.id=p_customer
 AND c.whatsapp_marketing_opt_in AND c.whatsapp_marketing_opt_in_at IS NOT NULL
 AND c.created_at<=clock_timestamp()-interval '24 hours' AND c.promo_sent_at IS NULL AND NOT c.promo_skipped
 AND NOT public.wa_customer_has_order(c.id)
 AND NOT EXISTS(SELECT 1 FROM public.customers x WHERE x.id<>c.id AND public.wa_phone_key(x.phone)=public.wa_phone_key(c.phone) AND (x.promo_sent_at IS NOT NULL OR x.promo_skipped)))
$$;
REVOKE ALL ON FUNCTION public.wa_campaign_eligible(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_campaign_eligible(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.wa_pending_customers(p_offset integer DEFAULT 0,p_take integer DEFAULT 500)
RETURNS TABLE(id uuid,name text,phone text,created_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT c.id,c.name,c.phone,c.created_at FROM public.customers c WHERE public.wa_campaign_eligible(c.id)
 ORDER BY c.created_at,c.id LIMIT least(greatest(p_take,1),500) OFFSET greatest(p_offset,0)
$$;
REVOKE ALL ON FUNCTION public.wa_pending_customers(integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_pending_customers(integer,integer) TO service_role;
CREATE OR REPLACE FUNCTION public.wa_promo_sent_today()
RETURNS integer LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=public AS $$
 SELECT count(*)::integer FROM public.customers WHERE promo_sent_at >= (date_trunc('day',clock_timestamp() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')
 AND promo_sent_at < ((date_trunc('day',clock_timestamp() AT TIME ZONE 'Asia/Kolkata')+interval '1 day') AT TIME ZONE 'Asia/Kolkata')
$$;
REVOKE ALL ON FUNCTION public.wa_promo_sent_today() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_promo_sent_today() TO service_role;
CREATE OR REPLACE FUNCTION public.claim_whatsapp_promo(p_customer uuid,p_admin text,p_product text,p_limit integer DEFAULT 25)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.customers%ROWTYPE; v_sent integer; v_now timestamptz;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('kartogo_whatsapp_promo'));
 SELECT * INTO c FROM public.customers WHERE id=p_customer FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
 IF NOT public.wa_campaign_eligible(c.id) THEN RAISE EXCEPTION 'Customer is no longer eligible or already processed'; END IF;
 IF coalesce(public.wa_phone_key(c.phone),'') !~ '^[1-9][0-9]{7,14}$' THEN RAISE EXCEPTION 'Invalid phone number'; END IF;
 IF nullif(trim(p_admin),'') IS NULL THEN RAISE EXCEPTION 'Admin identity required'; END IF;
 v_now:=clock_timestamp();
 IF NOT EXISTS(SELECT 1 FROM public.catalog_items i WHERE i.id=p_product AND i.is_deleted=false AND i.stock>0 AND (i.expiry_date IS NULL OR i.expiry_date>=(v_now AT TIME ZONE 'Asia/Kolkata')::date)) THEN RAISE EXCEPTION 'Selected product is not available'; END IF;
 v_sent:=public.wa_promo_sent_today();
 IF v_sent>=25 THEN RAISE EXCEPTION 'Daily limit of 25 messages reached'; END IF;
 UPDATE public.customers SET promo_sent_at=v_now WHERE id=p_customer;
 INSERT INTO public.admin_audit_log(actor,actor_role,action,entity_type,entity_id,details,created_at)
 VALUES(p_admin,'admin','whatsapp_promo.sent','customer',p_customer::text,jsonb_build_object('campaign','registered_not_ordered','action','sent','customer_id',p_customer,'admin_id',p_admin,'product_id',p_product,'at',v_now),v_now);
 RETURN v_sent+1;
END $$;
REVOKE ALL ON FUNCTION public.claim_whatsapp_promo(uuid,text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_promo(uuid,text,text,integer) TO service_role;
CREATE OR REPLACE FUNCTION public.skip_whatsapp_promo(p_customer uuid,p_admin text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.customers%ROWTYPE; v_now timestamptz;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('kartogo_whatsapp_promo'));
 SELECT * INTO c FROM public.customers WHERE id=p_customer FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
 IF c.promo_sent_at IS NOT NULL OR c.promo_skipped THEN RAISE EXCEPTION 'Customer already processed'; END IF;
 IF EXISTS(SELECT 1 FROM public.customers x WHERE x.id<>c.id AND public.wa_phone_key(x.phone)=public.wa_phone_key(c.phone) AND (x.promo_sent_at IS NOT NULL OR x.promo_skipped)) THEN RAISE EXCEPTION 'Phone already processed'; END IF;
 IF nullif(trim(p_admin),'') IS NULL THEN RAISE EXCEPTION 'Admin identity required'; END IF;
 v_now:=clock_timestamp();
 UPDATE public.customers SET promo_skipped=true WHERE id=p_customer;
 INSERT INTO public.admin_audit_log(actor,actor_role,action,entity_type,entity_id,details,created_at)
 VALUES(p_admin,'admin','whatsapp_promo.skip','customer',p_customer::text,jsonb_build_object('campaign','registered_not_ordered','action','skip','customer_id',p_customer,'admin_id',p_admin,'at',v_now),v_now);
 RETURN public.wa_promo_sent_today();
END $$;
REVOKE ALL ON FUNCTION public.skip_whatsapp_promo(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.skip_whatsapp_promo(uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.wa_set_consent(p_phone text,p_opt_in boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('kartogo_whatsapp_promo'));
 UPDATE public.customers SET whatsapp_marketing_opt_in=p_opt_in,whatsapp_marketing_opt_in_at=CASE WHEN p_opt_in THEN CASE WHEN whatsapp_marketing_opt_in THEN coalesce(whatsapp_marketing_opt_in_at,clock_timestamp()) ELSE clock_timestamp() END ELSE NULL END WHERE phone=p_phone;
 IF NOT FOUND THEN RAISE EXCEPTION 'Customer profile not found'; END IF;
 RETURN p_opt_in;
END $$;
REVOKE ALL ON FUNCTION public.wa_set_consent(text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_set_consent(text,boolean) TO service_role;