-- ===== Partner Studio: category config, business profile, furniture inventory, appointment engine =====

-- Category configuration (admin managed)
ALTER TABLE public.mp_categories
  ADD COLUMN IF NOT EXISTS booking_mode text NOT NULL DEFAULT 'SELLER_APPROVAL',
  ADD COLUMN IF NOT EXISTS appointment_types text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.mp_categories DROP CONSTRAINT IF EXISTS mp_categories_booking_mode_chk;
ALTER TABLE public.mp_categories ADD CONSTRAINT mp_categories_booking_mode_chk CHECK (booking_mode IN ('INSTANT','SELLER_APPROVAL','BOOKING_REQUEST'));

-- Business profile + admin-controlled status
ALTER TABLE public.mp_partners
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS business_phone text,
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS booking_mode text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.mp_partners DROP CONSTRAINT IF EXISTS mp_partners_verification_chk;
ALTER TABLE public.mp_partners ADD CONSTRAINT mp_partners_verification_chk CHECK (verification_status IN ('PENDING','VERIFIED','REJECTED'));
ALTER TABLE public.mp_partners DROP CONSTRAINT IF EXISTS mp_partners_account_chk;
ALTER TABLE public.mp_partners ADD CONSTRAINT mp_partners_account_chk CHECK (account_status IN ('ACTIVE','SUSPENDED'));
ALTER TABLE public.mp_partners DROP CONSTRAINT IF EXISTS mp_partners_booking_mode_chk;
ALTER TABLE public.mp_partners ADD CONSTRAINT mp_partners_booking_mode_chk CHECK (booking_mode IS NULL OR booking_mode IN ('INSTANT','SELLER_APPROVAL','BOOKING_REQUEST'));
CREATE INDEX IF NOT EXISTS mp_partners_supplier_phone_idx ON public.mp_partners (supplier_phone);

-- Furniture inventory fields on listings
ALTER TABLE public.mp_listings
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS stock_qty integer,
  ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS variants jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.mp_listings DROP CONSTRAINT IF EXISTS mp_listings_stock_chk;
ALTER TABLE public.mp_listings ADD CONSTRAINT mp_listings_stock_chk CHECK (stock_qty IS NULL OR stock_qty >= 0);
ALTER TABLE public.mp_listings DROP CONSTRAINT IF EXISTS mp_listings_low_stock_chk;
ALTER TABLE public.mp_listings ADD CONSTRAINT mp_listings_low_stock_chk CHECK (low_stock_threshold >= 0);
CREATE UNIQUE INDEX IF NOT EXISTS mp_listings_partner_sku ON public.mp_listings (partner_id, lower(sku)) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS mp_listings_partner_idx ON public.mp_listings (partner_id);

-- Professionals
ALTER TABLE public.mp_staff
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS service_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS work_start time,
  ADD COLUMN IF NOT EXISTS work_end time,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Reviews: seller replies
ALTER TABLE public.mp_reviews
  ADD COLUMN IF NOT EXISTS reply text,
  ADD COLUMN IF NOT EXISTS replied_at timestamptz,
  ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES public.mp_bookings(id) ON DELETE SET NULL;

-- Appointment engine status (PENDING, CONFIRMED, REJECTED, RESCHEDULED, CANCELLED, COMPLETED, NO_SHOW)
CREATE OR REPLACE FUNCTION public.mp_appointment_status_of(p_status text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN p_status = 'CANCELLED' THEN 'CANCELLED'
    WHEN p_status = 'SERVICE_COMPLETED' THEN 'COMPLETED'
    WHEN p_status IN ('BOOKING_REQUESTED','QUOTE_SENT') OR p_status IS NULL THEN 'PENDING'
    ELSE 'CONFIRMED' END
$$;

ALTER TABLE public.mp_bookings
  ADD COLUMN IF NOT EXISTS appointment_status text,
  ADD COLUMN IF NOT EXISTS appointment_type text,
  ADD COLUMN IF NOT EXISTS location_type text,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN IF NOT EXISTS customer_notes text,
  ADD COLUMN IF NOT EXISTS seller_notes text,
  ADD COLUMN IF NOT EXISTS enquiry_id uuid,
  ADD COLUMN IF NOT EXISTS reschedule_count integer NOT NULL DEFAULT 0;
UPDATE public.mp_bookings SET appointment_status = public.mp_appointment_status_of(status) WHERE appointment_status IS NULL;
UPDATE public.mp_bookings SET location_type = CASE WHEN service_mode = 'HOME_SERVICE' OR (address IS NOT NULL AND coalesce(details->>'store_visit','false') <> 'true') THEN 'CUSTOMER' ELSE 'BUSINESS' END WHERE location_type IS NULL;
ALTER TABLE public.mp_bookings ALTER COLUMN appointment_status SET NOT NULL;
ALTER TABLE public.mp_bookings DROP CONSTRAINT IF EXISTS mp_bookings_appt_status_chk;
ALTER TABLE public.mp_bookings ADD CONSTRAINT mp_bookings_appt_status_chk CHECK (appointment_status IN ('PENDING','CONFIRMED','REJECTED','RESCHEDULED','CANCELLED','COMPLETED','NO_SHOW'));
ALTER TABLE public.mp_bookings DROP CONSTRAINT IF EXISTS mp_bookings_location_chk;
ALTER TABLE public.mp_bookings ADD CONSTRAINT mp_bookings_location_chk CHECK (location_type IS NULL OR location_type IN ('BUSINESS','CUSTOMER'));
ALTER TABLE public.mp_bookings DROP CONSTRAINT IF EXISTS mp_bookings_payment_chk;
ALTER TABLE public.mp_bookings ADD CONSTRAINT mp_bookings_payment_chk CHECK (payment_status IN ('UNPAID','PAID','REFUNDED','NOT_APPLICABLE'));
CREATE INDEX IF NOT EXISTS mp_bookings_partner_appt ON public.mp_bookings (partner_id, appointment_status, booking_date);

-- Availability settings (one row per business)
CREATE TABLE IF NOT EXISTS public.mp_appointment_settings (
  partner_id uuid PRIMARY KEY REFERENCES public.mp_partners(id) ON DELETE CASCADE,
  working_hours jsonb NOT NULL DEFAULT '[]'::jsonb,
  slot_minutes integer NOT NULL DEFAULT 30 CHECK (slot_minutes BETWEEN 10 AND 480),
  buffer_minutes integer NOT NULL DEFAULT 0 CHECK (buffer_minutes BETWEEN 0 AND 240),
  max_per_slot integer NOT NULL DEFAULT 1 CHECK (max_per_slot BETWEEN 1 AND 50),
  breaks jsonb NOT NULL DEFAULT '[]'::jsonb,
  date_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  paused_from date,
  paused_until date,
  allow_business_location boolean NOT NULL DEFAULT true,
  allow_customer_location boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.mp_appointment_settings TO service_role;
ALTER TABLE public.mp_appointment_settings ENABLE ROW LEVEL SECURITY;

-- Customer enquiries + history
CREATE TABLE IF NOT EXISTS public.mp_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.mp_partners(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES public.mp_listings(id) ON DELETE SET NULL,
  customer_phone text NOT NULL,
  customer_name text,
  message text NOT NULL CHECK (char_length(message) BETWEEN 2 AND 2000),
  status text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','RESPONDED','IN_PROGRESS','CONVERTED','CLOSED')),
  booking_id uuid REFERENCES public.mp_bookings(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mp_enquiries_partner ON public.mp_enquiries (partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mp_enquiries_customer ON public.mp_enquiries (customer_phone, created_at DESC);
GRANT ALL ON public.mp_enquiries TO service_role;
ALTER TABLE public.mp_enquiries ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.mp_enquiry_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id uuid NOT NULL REFERENCES public.mp_enquiries(id) ON DELETE CASCADE,
  actor text NOT NULL CHECK (actor IN ('CUSTOMER','SELLER','SYSTEM')),
  kind text NOT NULL DEFAULT 'MESSAGE' CHECK (kind IN ('MESSAGE','STATUS','CONVERTED')),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mp_enquiry_events_enquiry ON public.mp_enquiry_events (enquiry_id, created_at);
GRANT ALL ON public.mp_enquiry_events TO service_role;
ALTER TABLE public.mp_enquiry_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.mp_bookings DROP CONSTRAINT IF EXISTS mp_bookings_enquiry_fk;
ALTER TABLE public.mp_bookings ADD CONSTRAINT mp_bookings_enquiry_fk FOREIGN KEY (enquiry_id) REFERENCES public.mp_enquiries(id) ON DELETE SET NULL;

-- Seller notes about a customer
CREATE TABLE IF NOT EXISTS public.mp_partner_customer_notes (
  partner_id uuid NOT NULL REFERENCES public.mp_partners(id) ON DELETE CASCADE,
  customer_phone text NOT NULL,
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 2000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (partner_id, customer_phone)
);
GRANT ALL ON public.mp_partner_customer_notes TO service_role;
ALTER TABLE public.mp_partner_customer_notes ENABLE ROW LEVEL SECURITY;

-- Inventory movement log
CREATE TABLE IF NOT EXISTS public.mp_inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.mp_partners(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.mp_listings(id) ON DELETE CASCADE,
  change integer NOT NULL,
  qty_after integer NOT NULL,
  reason text NOT NULL CHECK (reason IN ('CREATED','MANUAL','BULK','ORDER','ORDER_CANCELLED')),
  booking_id uuid REFERENCES public.mp_bookings(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mp_inventory_movements_partner ON public.mp_inventory_movements (partner_id, created_at DESC);
GRANT ALL ON public.mp_inventory_movements TO service_role;
ALTER TABLE public.mp_inventory_movements ENABLE ROW LEVEL SECURITY;

-- Keep appointment_status in step with the legacy booking status
CREATE OR REPLACE FUNCTION public.mp_booking_sync_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.appointment_status IS NULL THEN NEW.appointment_status := public.mp_appointment_status_of(NEW.status); END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.appointment_status IS NOT DISTINCT FROM OLD.appointment_status THEN
    NEW.appointment_status := public.mp_appointment_status_of(NEW.status);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS mp_bookings_a_sync ON public.mp_bookings;
CREATE TRIGGER mp_bookings_a_sync BEFORE INSERT OR UPDATE ON public.mp_bookings FOR EACH ROW EXECUTE FUNCTION public.mp_booking_sync_status();

-- Duplicate / overlapping booking guard (professional overlap + per-slot capacity)
CREATE OR REPLACE FUNCTION public.mp_booking_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.mp_appointment_settings%ROWTYPE;
  v_slot integer;
  v_buffer integer;
  v_end time;
  v_count integer;
BEGIN
  IF NEW.booking_date IS NULL OR NEW.start_time IS NULL OR NEW.appointment_status NOT IN ('PENDING','CONFIRMED','RESCHEDULED') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.booking_date IS NOT DISTINCT FROM OLD.booking_date
     AND NEW.start_time IS NOT DISTINCT FROM OLD.start_time
     AND NEW.end_time IS NOT DISTINCT FROM OLD.end_time
     AND NEW.staff_id IS NOT DISTINCT FROM OLD.staff_id
     AND OLD.appointment_status IN ('PENDING','CONFIRMED','RESCHEDULED') THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(NEW.partner_id::text || ':' || NEW.booking_date::text));
  SELECT * INTO s FROM public.mp_appointment_settings WHERE partner_id = NEW.partner_id;
  v_slot := COALESCE(s.slot_minutes, 30);
  v_buffer := COALESCE(s.buffer_minutes, 0);
  v_end := COALESCE(NEW.end_time, NEW.start_time + make_interval(mins => v_slot));

  IF NEW.staff_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.mp_bookings b
    WHERE b.staff_id = NEW.staff_id AND b.booking_date = NEW.booking_date AND b.id <> NEW.id
      AND b.start_time IS NOT NULL AND b.appointment_status IN ('PENDING','CONFIRMED','RESCHEDULED')
      AND b.start_time < v_end + make_interval(mins => v_buffer)
      AND COALESCE(b.end_time, b.start_time + make_interval(mins => v_slot)) + make_interval(mins => v_buffer) > NEW.start_time
  ) THEN
    RAISE EXCEPTION 'That professional already has an appointment at this time' USING ERRCODE = '23505';
  END IF;

  IF s.partner_id IS NOT NULL THEN
    SELECT count(*) INTO v_count FROM public.mp_bookings b
    WHERE b.partner_id = NEW.partner_id AND b.booking_date = NEW.booking_date AND b.id <> NEW.id
      AND b.start_time IS NOT NULL AND b.appointment_status IN ('PENDING','CONFIRMED','RESCHEDULED')
      AND b.start_time < v_end
      AND COALESCE(b.end_time, b.start_time + make_interval(mins => v_slot)) > NEW.start_time;
    IF v_count >= s.max_per_slot THEN
      RAISE EXCEPTION 'This time slot is fully booked' USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.mp_booking_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS mp_bookings_b_guard ON public.mp_bookings;
CREATE TRIGGER mp_bookings_b_guard BEFORE INSERT OR UPDATE ON public.mp_bookings FOR EACH ROW EXECUTE FUNCTION public.mp_booking_guard();

-- Atomic stock helpers (server only)
CREATE OR REPLACE FUNCTION public.mp_take_stock(p_listing uuid, p_qty integer, p_booking uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_after integer; v_partner uuid; v_tracked boolean;
BEGIN
  SELECT partner_id, stock_qty IS NOT NULL INTO v_partner, v_tracked FROM public.mp_listings WHERE id = p_listing;
  IF v_partner IS NULL OR NOT v_tracked THEN RETURN NULL; END IF;
  UPDATE public.mp_listings SET stock_qty = stock_qty - p_qty, updated_at = now()
    WHERE id = p_listing AND stock_qty >= p_qty RETURNING stock_qty INTO v_after;
  IF v_after IS NULL THEN RAISE EXCEPTION 'OUT_OF_STOCK' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.mp_inventory_movements (partner_id, listing_id, change, qty_after, reason, booking_id)
    VALUES (v_partner, p_listing, -p_qty, v_after, 'ORDER', p_booking);
  RETURN v_after;
END $$;
REVOKE ALL ON FUNCTION public.mp_take_stock(uuid, integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mp_take_stock(uuid, integer, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.mp_set_stock(p_listing uuid, p_qty integer, p_reason text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old integer; v_partner uuid;
BEGIN
  IF p_qty < 0 THEN RAISE EXCEPTION 'Stock cannot be negative'; END IF;
  SELECT partner_id, COALESCE(stock_qty, 0) INTO v_partner, v_old FROM public.mp_listings WHERE id = p_listing FOR UPDATE;
  IF v_partner IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
  UPDATE public.mp_listings SET stock_qty = p_qty, updated_at = now() WHERE id = p_listing;
  IF p_qty <> v_old OR p_reason = 'CREATED' THEN
    INSERT INTO public.mp_inventory_movements (partner_id, listing_id, change, qty_after, reason)
      VALUES (v_partner, p_listing, p_qty - v_old, p_qty, p_reason);
  END IF;
  RETURN p_qty;
END $$;
REVOKE ALL ON FUNCTION public.mp_set_stock(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mp_set_stock(uuid, integer, text) TO service_role;

-- Give stock back when a product order is cancelled
CREATE OR REPLACE FUNCTION public.mp_booking_restock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_qty integer; v_after integer;
BEGIN
  IF NEW.transaction_type = 'PRODUCT_ORDER' AND NEW.status = 'CANCELLED' AND OLD.status <> 'CANCELLED' THEN
    v_qty := COALESCE((NEW.details->>'stock_taken')::integer, 0);
    IF v_qty > 0 AND NEW.listing_id IS NOT NULL THEN
      UPDATE public.mp_listings SET stock_qty = stock_qty + v_qty, updated_at = now()
        WHERE id = NEW.listing_id AND stock_qty IS NOT NULL RETURNING stock_qty INTO v_after;
      IF v_after IS NOT NULL THEN
        INSERT INTO public.mp_inventory_movements (partner_id, listing_id, change, qty_after, reason, booking_id)
          VALUES (NEW.partner_id, NEW.listing_id, v_qty, v_after, 'ORDER_CANCELLED', NEW.id);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.mp_booking_restock() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS mp_bookings_c_restock ON public.mp_bookings;
CREATE TRIGGER mp_bookings_c_restock AFTER UPDATE ON public.mp_bookings FOR EACH ROW EXECUTE FUNCTION public.mp_booking_restock();