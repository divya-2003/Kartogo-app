CREATE TABLE public.user_notification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_phone text NOT NULL,
  fcm_token text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'web',
  notification_enabled boolean NOT NULL DEFAULT true,
  device_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.user_notification_tokens TO service_role;
ALTER TABLE public.user_notification_tokens ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_unt_phone ON public.user_notification_tokens (user_phone);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_phone text NOT NULL,
  order_id text,
  notification_type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  fcm_token text,
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notifications_phone ON public.notifications (user_phone, created_at DESC);
CREATE INDEX idx_notifications_order ON public.notifications (order_id);
CREATE UNIQUE INDEX idx_notifications_dedupe ON public.notifications (user_phone, order_id, notification_type)
  WHERE order_id IS NOT NULL;

CREATE TABLE public.notification_preferences (
  user_phone text PRIMARY KEY,
  order_updates boolean NOT NULL DEFAULT true,
  delivery_updates boolean NOT NULL DEFAULT true,
  important_updates boolean NOT NULL DEFAULT true,
  promotional_offers boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER unt_touch BEFORE UPDATE ON public.user_notification_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER notification_preferences_touch BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();