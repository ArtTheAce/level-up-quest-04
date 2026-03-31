-- Notifications table (for social/rivalry actions targeting other users)
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Any authenticated user can insert a notification for another user (needed for social/rivalry features)
CREATE POLICY "Authenticated users can send notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);
CREATE INDEX idx_notifications_read ON public.notifications USING btree (user_id, read);

-- AI tokens table (tracks remaining token budget per user)
CREATE TABLE public.ai_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  tokens_remaining INTEGER NOT NULL DEFAULT 100000,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own token balance"
  ON public.ai_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own token record"
  ON public.ai_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own token balance"
  ON public.ai_tokens FOR UPDATE
  USING (auth.uid() = user_id);

-- Allow tasks to be inserted for target users (needed for Task Curse)
-- We expand the existing tasks insert policy to allow friends to insert cursed tasks
DROP POLICY IF EXISTS "Users can create their own tasks" ON public.tasks;
CREATE POLICY "Users can create their own tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.friendships
      WHERE (friendships.user_id = auth.uid() AND friendships.friend_id = tasks.user_id)
         OR (friendships.friend_id = auth.uid() AND friendships.user_id = tasks.user_id)
    )
  );

-- Also allow leaderboard to read all game_state (needed for global leaderboard)
DROP POLICY IF EXISTS "Users can view their own game state" ON public.game_state;
CREATE POLICY "Users can view game state"
  ON public.game_state FOR SELECT
  USING (true);
