
-- =========================================================
-- WIMS: Warehouse & Inventory Management System
-- =========================================================

-- ---------- product costs (private) ----------
CREATE TABLE public.product_costs (
  product_id text PRIMARY KEY,
  cost_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.product_costs TO service_role;
ALTER TABLE public.product_costs ENABLE ROW LEVEL SECURITY;

-- ---------- inventory items (per market) ----------
CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES public.partner_markets(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  product_name text NOT NULL DEFAULT '',
  sku text NOT NULL DEFAULT '',
  barcode text NOT NULL DEFAULT '',
  current_stock integer NOT NULL DEFAULT 0,
  reserved_stock integer NOT NULL DEFAULT 0,
  available_stock integer GENERATED ALWAYS AS (current_stock - reserved_stock) STORED,
  min_stock integer NOT NULL DEFAULT 0,
  max_stock integer NOT NULL DEFAULT 0,
  reorder_level integer NOT NULL DEFAULT 0,
  selling_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (market_id, product_id),
  CHECK (current_stock >= 0),
  CHECK (reserved_stock >= 0)
);
CREATE INDEX inventory_items_product_idx ON public.inventory_items (product_id);
CREATE INDEX inventory_items_market_idx ON public.inventory_items (market_id);
CREATE INDEX inventory_items_available_idx ON public.inventory_items (available_stock);

GRANT SELECT ON public.inventory_items TO anon, authenticated;
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stock availability is public read-only"
  ON public.inventory_items FOR SELECT TO anon, authenticated USING (true);

CREATE TRIGGER inventory_items_touch BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- reservations ----------
CREATE TABLE public.inventory_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL,
  market_id uuid NOT NULL REFERENCES public.partner_markets(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  quantity integer NOT NULL,
  status text NOT NULL DEFAULT 'reserved',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inventory_reservations_order_idx ON public.inventory_reservations (order_id);
GRANT ALL ON public.inventory_reservations TO service_role;
ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;

-- ---------- transactions (audit log, never deleted) ----------
CREATE TABLE public.inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  market_id uuid,
  product_id text NOT NULL,
  product_name text NOT NULL DEFAULT '',
  old_quantity integer NOT NULL DEFAULT 0,
  new_quantity integer NOT NULL DEFAULT 0,
  old_reserved integer NOT NULL DEFAULT 0,
  new_reserved integer NOT NULL DEFAULT 0,
  reason text NOT NULL,
  order_id text,
  actor text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inventory_transactions_product_idx ON public.inventory_transactions (product_id, created_at DESC);
CREATE INDEX inventory_transactions_order_idx ON public.inventory_transactions (order_id);
GRANT ALL ON public.inventory_transactions TO service_role;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

-- ---------- alerts ----------
CREATE TABLE public.inventory_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  market_id uuid,
  product_id text NOT NULL,
  product_name text NOT NULL DEFAULT '',
  alert_type text NOT NULL,
  current_stock integer NOT NULL DEFAULT 0,
  reorder_level integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE UNIQUE INDEX inventory_alerts_open_idx
  ON public.inventory_alerts (inventory_item_id, alert_type) WHERE status = 'open';
GRANT SELECT ON public.inventory_alerts TO anon, authenticated;
GRANT ALL ON public.inventory_alerts TO service_role;
ALTER TABLE public.inventory_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Inventory alerts are readable"
  ON public.inventory_alerts FOR SELECT TO anon, authenticated USING (true);

-- ---------- purchase orders ----------
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid REFERENCES public.partner_markets(id) ON DELETE SET NULL,
  market_name text NOT NULL DEFAULT '',
  supplier_id text NOT NULL DEFAULT '',
  supplier_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  expected_cost numeric NOT NULL DEFAULT 0,
  notes text,
  auto_generated boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER purchase_orders_touch BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  product_name text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX purchase_order_items_po_idx ON public.purchase_order_items (purchase_order_id);
GRANT ALL ON public.purchase_order_items TO service_role;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- ---------- notifications ----------
CREATE TABLE public.inventory_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience text NOT NULL DEFAULT 'admin',
  supplier_id text,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'info',
  product_id text,
  order_id text,
  purchase_order_id uuid,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inventory_notifications_audience_idx ON public.inventory_notifications (audience, created_at DESC);
GRANT ALL ON public.inventory_notifications TO service_role;
ALTER TABLE public.inventory_notifications ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- Automation: alerts, notifications, draft purchase orders
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_inventory_thresholds()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_type text;
  v_alert_id uuid;
  v_po_id uuid;
  v_qty integer;
  v_cost numeric;
  v_market text;
BEGIN
  IF NEW.current_stock <= 0 THEN
    v_type := 'out_of_stock';
  ELSIF NEW.current_stock <= NEW.reorder_level THEN
    v_type := 'low_stock';
  ELSE
    -- healthy again: close any open alerts
    UPDATE public.inventory_alerts
      SET status = 'resolved', resolved_at = now()
      WHERE inventory_item_id = NEW.id AND status = 'open';
    RETURN NEW;
  END IF;

  -- resolve alerts of the other type
  UPDATE public.inventory_alerts
    SET status = 'resolved', resolved_at = now()
    WHERE inventory_item_id = NEW.id AND status = 'open' AND alert_type <> v_type;

  SELECT id INTO v_alert_id FROM public.inventory_alerts
    WHERE inventory_item_id = NEW.id AND alert_type = v_type AND status = 'open' LIMIT 1;

  IF v_alert_id IS NULL THEN
    SELECT name INTO v_market FROM public.partner_markets WHERE id = NEW.market_id;

    INSERT INTO public.inventory_alerts
      (inventory_item_id, market_id, product_id, product_name, alert_type, current_stock, reorder_level)
    VALUES (NEW.id, NEW.market_id, NEW.product_id, NEW.product_name, v_type, NEW.current_stock, NEW.reorder_level);

    INSERT INTO public.inventory_notifications (audience, title, body, kind, product_id)
    VALUES ('admin',
            CASE WHEN v_type = 'out_of_stock' THEN 'Out of stock' ELSE 'Stock at reorder level' END,
            COALESCE(NEW.product_name, NEW.product_id) || ' at ' || COALESCE(v_market, 'store') ||
            ' — ' || NEW.current_stock || ' left (reorder at ' || NEW.reorder_level || ')',
            v_type, NEW.product_id);

    INSERT INTO public.inventory_notifications (audience, title, body, kind, product_id)
    VALUES ('supplier',
            CASE WHEN v_type = 'out_of_stock' THEN 'Out of stock' ELSE 'Stock at reorder level' END,
            COALESCE(NEW.product_name, NEW.product_id) || ' needs replenishment at ' || COALESCE(v_market, 'store'),
            v_type, NEW.product_id);

    -- auto draft purchase order
    v_qty := GREATEST(COALESCE(NEW.max_stock, 0) - NEW.current_stock, GREATEST(NEW.reorder_level, 1));
    SELECT COALESCE(cost_price, 0) INTO v_cost FROM public.product_costs WHERE product_id = NEW.product_id;
    v_cost := COALESCE(v_cost, 0);

    SELECT id INTO v_po_id FROM public.purchase_orders
      WHERE market_id = NEW.market_id AND status = 'draft' AND auto_generated = true
      ORDER BY created_at DESC LIMIT 1;

    IF v_po_id IS NULL THEN
      INSERT INTO public.purchase_orders (market_id, market_name, status, expected_cost, auto_generated, notes)
      VALUES (NEW.market_id, COALESCE(v_market, ''), 'draft', 0, true, 'Auto-generated from reorder alerts')
      RETURNING id INTO v_po_id;

      INSERT INTO public.inventory_notifications (audience, title, body, kind, purchase_order_id)
      VALUES ('admin', 'Purchase order draft created',
              'A draft purchase order was created for ' || COALESCE(v_market, 'store'), 'purchase_order', v_po_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.purchase_order_items WHERE purchase_order_id = v_po_id AND product_id = NEW.product_id) THEN
      INSERT INTO public.purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_cost)
      VALUES (v_po_id, NEW.product_id, NEW.product_name, v_qty, v_cost);

      UPDATE public.purchase_orders
        SET expected_cost = COALESCE((SELECT SUM(quantity * unit_cost) FROM public.purchase_order_items WHERE purchase_order_id = v_po_id), 0),
            updated_at = now()
        WHERE id = v_po_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_inventory_thresholds
AFTER INSERT OR UPDATE OF current_stock, reorder_level, max_stock ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION public.handle_inventory_thresholds();

-- =========================================================
-- Transaction-safe reservation / commit / release
-- =========================================================
CREATE OR REPLACE FUNCTION public.reserve_inventory(p_order_id text, p_items jsonb, p_actor text DEFAULT 'customer')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  it jsonb;
  v_pid text;
  v_qty integer;
  v_need integer;
  v_take integer;
  r record;
  v_alloc jsonb := '[]'::jsonb;
BEGIN
  IF EXISTS (SELECT 1 FROM public.inventory_reservations WHERE order_id = p_order_id AND status = 'reserved') THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_pid := it ->> 'product_id';
    v_qty := COALESCE((it ->> 'quantity')::int, 0);
    IF v_pid IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;

    -- skip products that are not tracked in any store's inventory yet
    IF NOT EXISTS (SELECT 1 FROM public.inventory_items WHERE product_id = v_pid) THEN CONTINUE; END IF;

    v_need := v_qty;

    FOR r IN
      SELECT i.id, i.market_id, i.product_name, i.current_stock, i.reserved_stock,
             (i.current_stock - i.reserved_stock) AS avail
      FROM public.inventory_items i
      JOIN public.partner_markets m ON m.id = i.market_id
      WHERE i.product_id = v_pid AND m.is_active = true AND (i.current_stock - i.reserved_stock) > 0
      ORDER BY (i.current_stock - i.reserved_stock) DESC
      FOR UPDATE OF i
    LOOP
      EXIT WHEN v_need <= 0;
      v_take := LEAST(v_need, r.avail);

      UPDATE public.inventory_items
        SET reserved_stock = reserved_stock + v_take, updated_at = now()
        WHERE id = r.id;

      INSERT INTO public.inventory_reservations (order_id, market_id, product_id, quantity)
      VALUES (p_order_id, r.market_id, v_pid, v_take);

      INSERT INTO public.inventory_transactions
        (inventory_item_id, market_id, product_id, product_name, old_quantity, new_quantity,
         old_reserved, new_reserved, reason, order_id, actor)
      VALUES (r.id, r.market_id, v_pid, r.product_name, r.current_stock, r.current_stock,
              r.reserved_stock, r.reserved_stock + v_take, 'reserve', p_order_id, p_actor);

      v_alloc := v_alloc || jsonb_build_object('product_id', v_pid, 'market_id', r.market_id, 'quantity', v_take);
      v_need := v_need - v_take;
    END LOOP;

    IF v_need > 0 THEN
      RAISE EXCEPTION 'Out of stock: % (short by %)', COALESCE(v_pid, 'item'), v_need;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'allocations', v_alloc);
END;
$$;

CREATE OR REPLACE FUNCTION public.commit_inventory(p_order_id text, p_actor text DEFAULT 'system')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v record;
BEGIN
  FOR r IN
    SELECT * FROM public.inventory_reservations WHERE order_id = p_order_id AND status = 'reserved' FOR UPDATE
  LOOP
    SELECT * INTO v FROM public.inventory_items
      WHERE market_id = r.market_id AND product_id = r.product_id FOR UPDATE;
    IF FOUND THEN
      UPDATE public.inventory_items
        SET current_stock = GREATEST(0, current_stock - r.quantity),
            reserved_stock = GREATEST(0, reserved_stock - r.quantity),
            updated_at = now()
        WHERE id = v.id;

      INSERT INTO public.inventory_transactions
        (inventory_item_id, market_id, product_id, product_name, old_quantity, new_quantity,
         old_reserved, new_reserved, reason, order_id, actor)
      VALUES (v.id, v.market_id, v.product_id, v.product_name, v.current_stock,
              GREATEST(0, v.current_stock - r.quantity), v.reserved_stock,
              GREATEST(0, v.reserved_stock - r.quantity), 'deliver', p_order_id, p_actor);
    END IF;

    UPDATE public.inventory_reservations SET status = 'committed', updated_at = now() WHERE id = r.id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_inventory(p_order_id text, p_actor text DEFAULT 'system')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v record;
BEGIN
  FOR r IN
    SELECT * FROM public.inventory_reservations WHERE order_id = p_order_id AND status = 'reserved' FOR UPDATE
  LOOP
    SELECT * INTO v FROM public.inventory_items
      WHERE market_id = r.market_id AND product_id = r.product_id FOR UPDATE;
    IF FOUND THEN
      UPDATE public.inventory_items
        SET reserved_stock = GREATEST(0, reserved_stock - r.quantity), updated_at = now()
        WHERE id = v.id;

      INSERT INTO public.inventory_transactions
        (inventory_item_id, market_id, product_id, product_name, old_quantity, new_quantity,
         old_reserved, new_reserved, reason, order_id, actor)
      VALUES (v.id, v.market_id, v.product_id, v.product_name, v.current_stock, v.current_stock,
              v.reserved_stock, GREATEST(0, v.reserved_stock - r.quantity), 'release', p_order_id, p_actor);
    END IF;

    UPDATE public.inventory_reservations SET status = 'released', updated_at = now() WHERE id = r.id;
  END LOOP;
END;
$$;

-- =========================================================
-- Realtime
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_alerts;
