ALTER TABLE public.notifications
  ADD COLUMN product_id text,
  ADD COLUMN stock_alert_id uuid REFERENCES public.stock_alerts(id) ON DELETE SET NULL;

CREATE INDEX idx_notifications_product ON public.notifications (product_id);
CREATE UNIQUE INDEX idx_notifications_stock_alert_dedupe
  ON public.notifications (user_phone, stock_alert_id, notification_type)
  WHERE stock_alert_id IS NOT NULL;