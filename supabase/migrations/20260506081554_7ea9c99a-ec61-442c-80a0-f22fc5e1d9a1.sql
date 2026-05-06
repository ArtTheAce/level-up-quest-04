ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS custom_title text,
  ADD COLUMN IF NOT EXISTS active_aura text;