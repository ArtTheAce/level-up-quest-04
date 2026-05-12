ALTER TABLE public.daily_quests
  ADD COLUMN IF NOT EXISTS baselines jsonb NOT NULL DEFAULT '{}'::jsonb;