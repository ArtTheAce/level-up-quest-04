import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { EARNABLE_BADGES } from '@/context/GameContext';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, UserPlus, Check } from 'lucide-react';

// Feature 4: Only show_tasks_completed remains user-configurable.
// XP, Level, Streak, and Badges are always visible on profiles.
interface ProfileData {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  show_tasks_completed: boolean;
}

interface GameData {
  xp: number;
  level: number;
  streak: number;
  total_tasks_completed: number;
  equipped_badge: string | null;
  earned_badges: string[];
}

function getBadgeEmoji(badgeId: string): string {
  const map: Record<string, string> = {
    badge_fire: '🔥', badge_diamond: '💎', badge_crown: '👑',
    badge_rocket: '🚀', badge_star: '🌟', badge_scholar: '📚',
    badge_centurion: '⚔️', badge_focus: '🧘',
  };
  return map[badgeId] || '🏅';
}

export default function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [friendStatus, setFriendStatus] = useState<'none' | 'pending' | 'friends'>('none');
  const [sendingRequest, setSendingRequest] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      setLoading(true);
      const [profileRes, gameRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, username, display_name, avatar_url, show_tasks_completed')
          .eq('user_id', userId)
          .single(),
        supabase
          .from('game_state')
          .select('xp, level, streak, total_tasks_completed, equipped_badge, earned_badges')
          .eq('user_id', userId)
          .single(),
      ]);
      if (profileRes.data) setProfile(profileRes.data as ProfileData);
      if (gameRes.data) setGameData(gameRes.data as GameData);

      if (gameRes.data) {
        const { count } = await supabase
          .from('game_state')
          .select('*', { count: 'exact', head: true })
          .gt('xp', gameRes.data.xp);
        setRank((count ?? 0) + 1);
      }

      if (user && userId !== user.id) {
        const { data: friendship } = await supabase
          .from('friendships')
          .select('id')
          .or(`and(user_id.eq.${user.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${user.id})`)
          .limit(1);
        if (friendship && friendship.length > 0) {
          setFriendStatus('friends');
        } else {
          const { data: pending } = await supabase
            .from('friend_requests')
            .select('id')
            .eq('sender_id', user.id)
            .eq('receiver_id', userId)
            .eq('status', 'pending')
            .limit(1);
          if (pending && pending.length > 0) setFriendStatus('pending');
        }
      }

      setLoading(false);
    };
    load();
  }, [userId, user]);

  const sendFriendRequest = async () => {
    if (!user || !userId) return;
    setSendingRequest(true);
    const { error } = await supabase.from('friend_requests').insert({
      sender_id: user.id,
      receiver_id: userId,
    });
    if (!error) setFriendStatus('pending');
    setSendingRequest(false);
  };

  if (loading) {
    return <div className="max-w-lg mx-auto text-center py-20 text-muted-foreground">Loading profile...</div>;
  }

  if (!profile || !gameData) {
    return (
      <div className="max-w-lg mx-auto text-center py-20 text-muted-foreground">
        <p className="text-4xl mb-2">🤷</p>
        <p>User not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/leaderboard')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Leaderboard
        </Button>
      </div>
    );
  }

  const isMe = user?.id === userId;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 text-center">
        {/* Avatar */}
        <div className="relative inline-block mb-4">
          <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center text-4xl mx-auto border-4 border-primary/20">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <span>{profile.username.charAt(0).toUpperCase()}</span>
            )}
          </div>
          {/* Feature 4: equipped badge always shown */}
          {gameData.equipped_badge && (
            <span className="absolute -bottom-1 -right-1 text-2xl">
              {getBadgeEmoji(gameData.equipped_badge)}
            </span>
          )}
        </div>

        <h1 className="text-2xl font-display font-bold">
          {profile.display_name || profile.username}
        </h1>
        <p className="text-muted-foreground text-sm">@{profile.username}</p>

        {rank && (
          <div className="mt-2 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-accent/15 text-accent text-sm font-bold">
            #{rank} Global Rank
          </div>
        )}
      </motion.div>

      {/* Stats — Feature 4: XP, Level, Streak always shown; Tasks respects user setting */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 gap-3"
      >
        <StatBox label="XP"      value={gameData.xp.toString()}      icon="⚡" />
        <StatBox label="Level"   value={gameData.level.toString()}    icon="🎮" />
        <StatBox label="Streak"  value={`${gameData.streak} days`}   icon="🔥" />
        <StatBox
          label="Tasks Done"
          value={profile.show_tasks_completed ? gameData.total_tasks_completed.toString() : null}
          icon="✅"
        />
      </motion.div>

      {/* Badges — Feature 4: always visible */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-6"
      >
        <h2 className="font-display font-bold text-lg mb-3">Badges</h2>
        {gameData.earned_badges && gameData.earned_badges.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {gameData.earned_badges.map(badgeId => {
              const badge = EARNABLE_BADGES.find(b => b.id === badgeId);
              return (
                <div key={badgeId} className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
                  <span className="text-xl">{getBadgeEmoji(badgeId)}</span>
                  <span className="text-sm font-medium">{badge?.name || badgeId}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No badges earned yet</p>
        )}
      </motion.div>

      {/* Actions */}
      <div className="flex gap-3">
        {!isMe && (
          <Button
            className="flex-1"
            disabled={friendStatus !== 'none' || sendingRequest}
            onClick={sendFriendRequest}
          >
            {friendStatus === 'friends' ? (
              <><Check className="h-4 w-4 mr-2" /> Friends ✅</>
            ) : friendStatus === 'pending' ? (
              <><Check className="h-4 w-4 mr-2" /> Request Sent ✓</>
            ) : (
              <><UserPlus className="h-4 w-4 mr-2" /> + Friend Request</>
            )}
          </Button>
        )}
        <Button variant="outline" className="flex-1" onClick={() => navigate('/leaderboard')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Leaderboard
        </Button>
      </div>
    </div>
  );
}

function StatBox({ label, value, icon }: { label: string; value: string | null; icon: string }) {
  return (
    <div className="glass-card p-4 text-center">
      <span className="text-2xl">{icon}</span>
      <p className="font-display font-bold text-xl mt-1">
        {value !== null ? value : '👻 Hidden'}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
