
CREATE OR REPLACE FUNCTION public.accept_friend_request(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _from uuid;
  _to uuid;
BEGIN
  SELECT from_user_id, to_user_id INTO _from, _to
  FROM public.friend_requests
  WHERE id = _request_id AND status = 'pending';

  IF _from IS NULL THEN
    RAISE EXCEPTION 'Friend request not found or already handled';
  END IF;

  IF auth.uid() <> _to THEN
    RAISE EXCEPTION 'Only the recipient can accept this request';
  END IF;

  UPDATE public.friend_requests SET status = 'accepted' WHERE id = _request_id;

  INSERT INTO public.friendships (user_id, friend_id) VALUES (_to, _from)
  ON CONFLICT DO NOTHING;
  INSERT INTO public.friendships (user_id, friend_id) VALUES (_from, _to)
  ON CONFLICT DO NOTHING;
END;
$$;
