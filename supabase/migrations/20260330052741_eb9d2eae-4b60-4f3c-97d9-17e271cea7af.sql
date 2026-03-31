
-- Drop the existing select policy and replace with a public one for leaderboard
DROP POLICY IF EXISTS "Users can view their own game state" ON public.game_state;

-- Allow all authenticated users to read game_state (for global leaderboard)
CREATE POLICY "Authenticated users can view game state" ON public.game_state 
  FOR SELECT TO authenticated USING (true);
