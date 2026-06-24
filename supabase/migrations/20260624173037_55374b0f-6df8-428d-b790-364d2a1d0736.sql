ALTER TABLE public.timetable_entries
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS specific_date date;

ALTER TABLE public.timetable_entries
  ADD CONSTRAINT check_one_time_has_date
    CHECK (
      (is_recurring = true) OR
      (is_recurring = false AND specific_date IS NOT NULL)
    );