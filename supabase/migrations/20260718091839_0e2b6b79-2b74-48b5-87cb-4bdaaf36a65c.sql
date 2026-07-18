
CREATE TABLE public.order_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('customer','driver','admin')),
  sender_id text NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_messages_order_idx ON public.order_messages(order_id, created_at);
GRANT ALL ON public.order_messages TO service_role;
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.order_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL,
  caller_role text NOT NULL CHECK (caller_role IN ('customer','driver','admin')),
  caller_id text NOT NULL,
  callee_role text NOT NULL CHECK (callee_role IN ('customer','driver','admin')),
  callee_id text NOT NULL,
  status text NOT NULL DEFAULT 'initiated',
  provider_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_call_logs_order_idx ON public.order_call_logs(order_id, created_at);
GRANT ALL ON public.order_call_logs TO service_role;
ALTER TABLE public.order_call_logs ENABLE ROW LEVEL SECURITY;
