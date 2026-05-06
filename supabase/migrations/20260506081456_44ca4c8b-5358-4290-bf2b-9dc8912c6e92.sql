CREATE OR REPLACE FUNCTION public.cast_task_curse(
  _target_user_id uuid,
  _title text,
  _subject text,
  _priority text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_id uuid;
  _is_friend boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  IF auth.uid() = _target_user_id THEN
    RAISE EXCEPTION 'Cannot curse yourself';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE (user_id = auth.uid() AND friend_id = _target_user_id)
       OR (user_id = _target_user_id AND friend_id = auth.uid())
  ) INTO _is_friend;

  IF NOT _is_friend THEN
    RAISE EXCEPTION 'Target is not your friend';
  END IF;

  INSERT INTO public.tasks (user_id, title, subject, subject_color, priority, completed)
  VALUES (_target_user_id, _title, _subject, 'other', _priority, false)
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;