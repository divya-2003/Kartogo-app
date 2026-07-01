CREATE TABLE public.wallet_topups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success','failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_wallet_topups_phone_created ON public.wallet_topups (phone, created_at DESC);

GRANT ALL ON public.wallet_topups TO service_role;

ALTER TABLE public.wallet_topups ENABLE ROW LEVEL SECURITY;