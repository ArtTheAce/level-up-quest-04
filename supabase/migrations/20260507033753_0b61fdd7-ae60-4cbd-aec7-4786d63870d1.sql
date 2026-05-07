-- Add fields needed for full ManageBac-style task management
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

-- Add multi-day recurrence + optional teacher/room to timetable entries.
-- We keep the existing `day` column for backward compatibility; new code reads `days` first.
ALTER TABLE public.timetable_entries
  ADD COLUMN IF NOT EXISTS days integer[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS teacher text,
  ADD COLUMN IF NOT EXISTS room text;

-- Backfill `days` from the legacy `day` column for existing rows.
UPDATE public.timetable_entries
SET days = ARRAY[day]
WHERE (days IS NULL OR array_length(days, 1) IS NULL) AND day IS NOT NULL;