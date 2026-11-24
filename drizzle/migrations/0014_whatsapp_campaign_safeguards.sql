CREATE OR REPLACE FUNCTION public.wa_customer_has_order(p_customer uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.app_orders o JOIN public.customers c ON c.id=p_customer WHERE public.wa_phone_key(o.customer_phone)=public.wa_phone_key(c.phone) OR EXISTS(SELECT 1 FROM public.mobile_number_changes m WHERE m.user_id=c.user_id AND public.wa_phone_key(o.customer_phone) IN (public.wa_phone_key(m.old_mobile_number),public.wa_phone_key(m.new_mobile_number))))
$$;
CREATE OR REPLACE FUNCTION public.wa_promo_sent_today() RETURNS integer LANGUAGE sql STABLE SET search_path=public AS $$
 SELECT count(*)::int FROM public.customers WHERE promo_sent_at >= (date_trunc('day',now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata') AND promo_sent_at < ((date_trunc('day',now() AT TIME ZONE 'Asia/Kolkata')+interval '1 day') AT TIME ZONE 'Asia/Kolkata')
$$;
CREATE OR REPLACE FUNCTION public.guard_wa_customer_fields() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF current_user NOT IN ('postgres','service_role','supabase_admin') THEN
  IF TG_OP='INSERT' THEN
   IF NEW.promo_sent_at IS NOT NULL OR NEW.promo_skipped OR NEW.whatsapp_marketing_opt_in OR NEW.whatsapp_marketing_opt_in_at IS NOT NULL THEN RAISE EXCEPTION 'WhatsApp fields require verified server access'; END IF;
  ELSE
   IF NEW.promo_sent_at IS DISTINCT FROM OLD.promo_sent_at OR NEW.promo_skipped IS DISTINCT FROM OLD.promo_skipped OR NEW.whatsapp_marketing_opt_in IS DISTINCT FROM OLD.whatsapp_marketing_opt_in OR NEW.whatsapp_marketing_opt_in_at IS DISTINCT FROM OLD.whatsapp_marketing_opt_in_at THEN RAISE EXCEPTION 'WhatsApp fields require verified server access'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER guard_wa_customer_fields BEFORE INSERT OR UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.guard_wa_customer_fields();
CREATE OR REPLACE FUNCTION public.wa_pending_customers(p_offset integer DEFAULT 0,p_take integer DEFAULT 500) RETURNS TABLE(id uuid,name text,phone text,created_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT c.id,c.name,c.phone,c.created_at FROM public.customers c WHERE c.whatsapp_marketing_opt_in AND c.whatsapp_marketing_opt_in_at IS NOT NULL AND c.created_at<=now()-interval '24 hours' AND c.promo_sent_at IS NULL AND NOT c.promo_skipped AND NOT public.wa_customer_has_order(c.id) ORDER BY c.created_at,c.id LIMIT least(greatest(p_take,1),500) OFFSET greatest(p_offset,0)
$$;
CREATE OR REPLACE FUNCTION public.claim_whatsapp_promo(p_customer uuid,p_admin text,p_product text,p_limit integer DEFAULT 25) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.customers%ROWTYPE; v_sent integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('kartogo_whatsapp_promo'));
 SELECT * INTO c FROM public.customers WHERE id=p_customer FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
 IF c.promo_sent_at IS NOT NULL OR c.promo_skipped THEN RAISE EXCEPTION 'Customer already processed'; END IF;
 IF NOT c.whatsapp_marketing_opt_in OR c.whatsapp_marketing_opt_in_at IS NULL THEN RAISE EXCEPTION 'Customer has not opted in to WhatsApp offers'; END IF;
 IF c.created_at>now()-interval '24 hours' THEN RAISE EXCEPTION 'Customer registered less than 24 hours ago'; END IF;
 IF public.wa_customer_has_order(c.id) THEN RAISE EXCEPTION 'Customer has already placed an order'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.catalog_items i WHERE i.id=p_product AND NOT i.is_deleted AND i.stock>0 AND (i.expiry_date IS NULL OR i.expiry_date>=(now() AT TIME ZONE 'Asia/Kolkata')::date)) THEN RAISE EXCEPTION 'Selected product is not available'; END IF;
 IF EXISTS(SELECT 1 FROM public.customers x WHERE x.id<>c.id AND public.wa_phone_key(x.phone)=public.wa_phone_key(c.phone) AND (x.promo_sent_at IS NOT NULL OR x.promo_skipped)) THEN RAISE EXCEPTION 'This phone was already processed'; END IF;
 v_sent:=public.wa_promo_sent_today();
 IF v_sent>=25 THEN RAISE EXCEPTION 'Daily limit of 25 messages reached'; END IF;
 UPDATE public.customers SET promo_sent_at=now() WHERE id=p_customer;
 INSERT INTO public.admin_audit_log(actor,actor_role,action,entity_type,entity_id,details) VALUES(p_admin,'admin','whatsapp_promo.sent','customer',p_customer::text,jsonb_build_object('campaign','registered_not_ordered','action','sent','customer_id',p_customer,'admin_id',p_admin,'product_id',p_product,'at',now()));
 RETURN v_sent+1;
END $$;
CREATE OR REPLACE FUNCTION public.wa_set_consent(p_phone text,p_opt_in boolean) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.customers SET whatsapp_marketing_opt_in=p_opt_in,whatsapp_marketing_opt_in_at=CASE WHEN p_opt_in THEN CASE WHEN whatsapp_marketing_opt_in THEN coalesce(whatsapp_marketing_opt_in_at,now()) ELSE now() END ELSE NULL END WHERE phone=p_phone;
 IF NOT FOUND THEN RAISE EXCEPTION 'Customer profile not found'; END IF;
 RETURN p_opt_in;
END $$;
REVOKE EXECUTE ON FUNCTION public.wa_customer_has_order(uuid),public.wa_pending_customers(integer,integer),public.wa_set_consent(text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_customer_has_order(uuid),public.wa_pending_customers(integer,integer),public.wa_set_consent(text,boolean) TO service_role;