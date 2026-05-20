-- When true, inbound calls on the Margen line go straight to the AI receptionist.
-- When false, the business phone rings first for rings_before_ai, then AI on no-answer.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS always_use_ai boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.always_use_ai IS
  'If true, callers to margen_phone_number are connected to AI immediately (business hours). If false, dial business_phone first; AI after rings_before_ai.';
