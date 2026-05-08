
CREATE TABLE public.task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  user_id uuid NOT NULL,
  xp_granted integer NOT NULL DEFAULT 0,
  coins_granted integer NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now(),
  reversed boolean NOT NULL DEFAULT false,
  reversed_at timestamptz
);
CREATE INDEX idx_task_completions_task ON public.task_completions(task_id);
CREATE INDEX idx_task_completions_user ON public.task_completions(user_id);
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own completions" ON public.task_completions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert own completions" ON public.task_completions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own completions" ON public.task_completions FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE public.daily_quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  quests jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  claimed jsonb NOT NULL DEFAULT '[]'::jsonb
);
ALTER TABLE public.daily_quests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own quests" ON public.daily_quests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert own quests" ON public.daily_quests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own quests" ON public.daily_quests FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete own quests" ON public.daily_quests FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.active_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_user_id uuid,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  consumed boolean NOT NULL DEFAULT false
);
CREATE INDEX idx_active_effects_user ON public.active_effects(user_id);
CREATE INDEX idx_active_effects_type ON public.active_effects(type);
CREATE INDEX idx_active_effects_expires ON public.active_effects(expires_at);
ALTER TABLE public.active_effects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public view cosmetics" ON public.active_effects FOR SELECT USING (
  type IN ('aura_flame','aura_ice','frame_lightning','custom_title','streak_crown','ghost','dethroned','villain_arc')
  OR auth.uid() = user_id OR auth.uid() = source_user_id
);
CREATE POLICY "insert effects on self" ON public.active_effects FOR INSERT WITH CHECK (
  auth.uid() = user_id AND (source_user_id IS NULL OR source_user_id = auth.uid())
);
CREATE POLICY "update own effects" ON public.active_effects FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = source_user_id);
CREATE POLICY "delete own effects" ON public.active_effects FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.duel_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid NOT NULL,
  opponent_id uuid NOT NULL,
  stake integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  challenger_score integer NOT NULL DEFAULT 0,
  opponent_score integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  winner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.duel_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own duels" ON public.duel_sessions FOR SELECT USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);
CREATE POLICY "insert duels" ON public.duel_sessions FOR INSERT WITH CHECK (auth.uid() = challenger_id);
CREATE POLICY "update own duels" ON public.duel_sessions FOR UPDATE USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

CREATE TABLE public.pinned_callouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL,
  sender_user_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
ALTER TABLE public.pinned_callouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public view callouts" ON public.pinned_callouts FOR SELECT USING (true);
CREATE POLICY "send callouts" ON public.pinned_callouts FOR INSERT WITH CHECK (auth.uid() = sender_user_id);
CREATE POLICY "delete own callouts" ON public.pinned_callouts FOR DELETE USING (auth.uid() = sender_user_id OR auth.uid() = target_user_id);

CREATE OR REPLACE FUNCTION public.cast_effect(
  _target_user_id uuid, _type text, _payload jsonb, _expires_at timestamptz
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _new_id uuid; _is_friend boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be authenticated'; END IF;
  IF auth.uid() <> _target_user_id THEN
    SELECT EXISTS(SELECT 1 FROM friendships
      WHERE (user_id = auth.uid() AND friend_id = _target_user_id)
         OR (user_id = _target_user_id AND friend_id = auth.uid())) INTO _is_friend;
    IF NOT _is_friend THEN RAISE EXCEPTION 'Target is not a friend'; END IF;
  END IF;
  INSERT INTO active_effects (user_id, source_user_id, type, payload, expires_at)
  VALUES (_target_user_id, auth.uid(), _type, COALESCE(_payload, '{}'::jsonb), _expires_at)
  RETURNING id INTO _new_id;
  RETURN _new_id;
END; $$;

CREATE OR REPLACE FUNCTION public.consume_curse_block(_target_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  SELECT id INTO _id FROM active_effects
   WHERE user_id = _target_user_id AND type = 'curse_block' AND consumed = false
   ORDER BY created_at ASC LIMIT 1;
  IF _id IS NULL THEN RETURN false; END IF;
  UPDATE active_effects SET consumed = true WHERE id = _id;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.resolve_duel(_duel_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _d duel_sessions%ROWTYPE; _winner uuid; _pot integer;
BEGIN
  SELECT * INTO _d FROM duel_sessions WHERE id = _duel_id FOR UPDATE;
  IF _d.id IS NULL OR _d.status = 'completed' THEN RETURN NULL; END IF;
  IF _d.challenger_score > _d.opponent_score THEN _winner := _d.challenger_id;
  ELSIF _d.opponent_score > _d.challenger_score THEN _winner := _d.opponent_id;
  ELSE _winner := NULL; END IF;
  _pot := _d.stake * 2;
  IF _winner IS NOT NULL THEN
    UPDATE game_state SET coins = coins + _pot WHERE user_id = _winner;
  ELSE
    UPDATE game_state SET coins = coins + _d.stake WHERE user_id IN (_d.challenger_id, _d.opponent_id);
  END IF;
  UPDATE duel_sessions SET status = 'completed', winner_id = _winner WHERE id = _duel_id;
  RETURN _winner;
END; $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.active_effects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.duel_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pinned_callouts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_state;
