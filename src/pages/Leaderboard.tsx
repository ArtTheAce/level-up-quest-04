import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'framer-motion';
import { Trophy, Users, Globe, Crown } from 'lucide-react';

// Feature 4: XP, Level, Streak, Badges are always public.
// Only show_tasks_completed remains user-controllable.
interface LeaderboardEntry {
  user_id: string;
  username: string;
  display_name: string | null;
  xp: number;
  level: number;
  streak: number;
  total_tasks_completed: number;
  equipped_badge: string | null;
  earned_badges: string[];
  show_tasks_completed: boolean;
  custom_title: string | null;
  active_aura: string | null;
  is_ghost: boolean;
  is_dethroned: boolean;
  has_streak_crown: boolean;
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0 },
};

export default function Leaderboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'global' | 'friends'>('global');
  const [sortBy, setSortBy] = useState<'xp' | 'tasks'>('xp');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const buildEntries = async (gameStates: any[], profiles: any[] | null, userIds: string[]): Promise<LeaderboardEntry[]> => {
    const { data: effects } = await supabase
      .from('active_effects')
      .select('user_id, type, expires_at, consumed')
      .in('user_id', userIds)
      .eq('consumed', false)
      .in('type', ['ghost', 'dethroned', 'streak_crown']);
    const nowMs = Date.now();
    const live = (effects || []).filter(e => !e.expires_at || new Date(e.expires_at).getTime() > nowMs);
    const has = (uid: string, t: string) => live.some(e => e.user_id === uid && e.type === t);

    const crownEffect = live.filter(e => e.type === 'streak_crown');
    let crownHolder: string | null = null;
    if (crownEffect.length > 0) {
      const candidates = gameStates.filter(g => crownEffect.some(c => c.user_id === g.user_id));
      candidates.sort((a, b) => (b.streak || 0) - (a.streak || 0));
      crownHolder = candidates[0]?.user_id || null;
    } else {
      const top = [...gameStates].sort((a, b) => (b.streak || 0) - (a.streak || 0))[0];
      if (top && (top.streak || 0) > 0) crownHolder = top.user_id;
    }

    return gameStates.map(gs => {
      const profile = profiles?.find((p: any) => p.user_id === gs.user_id);
      return {
        ...gs,
        username: profile?.username || 'unknown',
        display_name: profile?.display_name || null,
        // Feature 4: only tasks_completed is user-settable; everything else always visible
        show_tasks_completed: profile?.show_tasks_completed ?? true,
        custom_title: profile?.custom_title ?? null,
        active_aura: profile?.active_aura ?? null,
        earned_badges: gs.earned_badges || [],
        is_ghost: has(gs.user_id, 'ghost'),
        is_dethroned: has(gs.user_id, 'dethroned'),
        has_streak_crown: gs.user_id === crownHolder,
      };
    });
  };

  const fetchGlobalLeaderboard = async () => {
    setLoading(true);
    const { data: gameStates } = await supabase
      .from('game_state')
      .select('user_id, xp, level, streak, total_tasks_completed, equipped_badge, earned_badges')
      .order(sortBy === 'xp' ? 'xp' : 'total_tasks_completed', { ascending: false })
      .limit(50);

    if (!gameStates || gameStates.length === 0) { setEntries([]); setLoading(false); return; }

    const userIds = gameStates.map(g => g.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, username, display_name, show_tasks_completed, custom_title, active_aura')
      .in('user_id', userIds);

    const merged = await buildEntries(gameStates, profiles, userIds);
    merged.sort((a, b) => sortBy === 'xp' ? b.xp - a.xp : b.total_tasks_completed - a.total_tasks_completed);
    setEntries(merged);
    setLoading(false);
  };

  const fetchFriendsLeaderboard = async () => {
    if (!user) return;
    setLoading(true);

    const { data: friendships } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    const friendIds = friendships?.map(f => f.user_id === user.id ? f.friend_id : f.user_id) || [];
    const allIds = [...new Set([user.id, ...friendIds])];

    if (allIds.length === 0) { setEntries([]); setLoading(false); return; }

    const { data: gameStates } = await supabase
      .from('game_state')
      .select('user_id, xp, level, streak, total_tasks_completed, equipped_badge, earned_badges')
      .in('user_id', allIds);

    if (!gameStates) { setEntries([]); setLoading(false); return; }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, username, display_name, show_tasks_completed, custom_title, active_aura')
      .in('user_id', allIds);

    const merged = await buildEntries(gameStates, profiles, allIds);
    merged.sort((a, b) => sortBy === 'xp' ? b.xp - a.xp : b.total_tasks_completed - a.total_tasks_completed);
    setEntries(merged);
    setLoading(false);
  };

  useEffect(() => {
    if (tab === 'global') fetchGlobalLeaderboard();
    else fetchFriendsLeaderboard();
  }, [tab, sortBy, user]);

  const getMedal = (rank: number) => {
    if (rank === 0) return '🥇';
    if (rank === 1) return '🥈';
    if (rank === 2) return '🥉';
    return `#${rank + 1}`;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold flex items-center gap-2">
          <Trophy className="h-8 w-8 text-primary" /> Leaderboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">See how you stack up!</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex gap-2">
          <button
            onClick={() => setTab('global')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === 'global' ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-muted-foreground hover:bg-secondary'
            }`}
          >
            <Globe className="h-4 w-4" /> Global
          </button>
          <button
            onClick={() => setTab('friends')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === 'friends' ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-muted-foreground hover:bg-secondary'
            }`}
          >
            <Users className="h-4 w-4" /> Friends
          </button>
        </div>
        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => setSortBy('xp')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              sortBy === 'xp' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            By XP
          </button>
          <button
            onClick={() => setSortBy('tasks')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              sortBy === 'tasks' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            By Tasks
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-4xl mb-2">🏆</p>
          <p>{tab === 'friends' ? 'Add friends to see the friends leaderboard!' : 'No players yet!'}</p>
        </div>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-2">
          {entries.map((entry, idx) => {
            const isMe = entry.user_id === user?.id;
            return (
              <motion.div
                key={entry.user_id}
                variants={item}
                onClick={() => navigate(`/profile/${entry.user_id}`)}
                className={`glass-card p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow ${
                  isMe ? 'ring-2 ring-primary/30 bg-primary/5' : ''
                } ${idx < 3 ? 'border-l-4 border-l-accent' : ''}`}
              >
                {/* Rank */}
                <div className="w-10 text-center shrink-0">
                  {idx < 3 ? (
                    <span className="text-2xl">{getMedal(idx)}</span>
                  ) : (
                    <span className="text-sm font-bold text-muted-foreground">#{idx + 1}</span>
                  )}
                </div>

                {/* User info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0"
                      style={auraStyle(entry.active_aura)}
                    >
                      {(entry.display_name || entry.username || '?')[0]?.toUpperCase()}
                    </span>
                    <p className="font-display font-bold truncate">
                      {entry.display_name || entry.username}
                      {isMe && <span className="text-primary ml-1">(you)</span>}
                    </p>
                    {entry.has_streak_crown && <span title="Streak Crown">👑</span>}
                    {entry.is_dethroned && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/15 text-red-500">
                        Dethroned 👊
                      </span>
                    )}
                    {/* Feature 4: badges always visible */}
                    {entry.equipped_badge && (
                      <span className="text-lg">{getEmojiForBadge(entry.equipped_badge)}</span>
                    )}
                    {idx === 0 && <Crown className="h-4 w-4 text-accent" />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    @{entry.username}
                    {entry.custom_title && <span className="ml-2 italic">· {entry.custom_title}</span>}
                  </p>
                </div>

                {/* Stats — Feature 4: XP, Level, Streak always shown; Tasks respects user preference */}
                <div className="flex items-center gap-4 text-sm shrink-0">
                  {entry.is_ghost && !isMe ? (
                    <div className="text-center">
                      <p className="font-bold text-muted-foreground">👻 ???</p>
                      <p className="text-xs text-muted-foreground">hidden</p>
                    </div>
                  ) : (
                    <>
                      <div className="text-center">
                        <p className="font-bold text-primary">{entry.xp}</p>
                        <p className="text-xs text-muted-foreground">XP</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-level">{entry.level}</p>
                        <p className="text-xs text-muted-foreground">Lvl</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-streak">🔥{entry.streak}</p>
                      </div>
                      {entry.show_tasks_completed && (
                        <div className="text-center">
                          <p className="font-bold">{entry.total_tasks_completed}</p>
                          <p className="text-xs text-muted-foreground">Tasks</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}

function getEmojiForBadge(badgeId: string): string {
  const map: Record<string, string> = {
    badge_fire: '🔥', badge_diamond: '💎', badge_crown: '👑',
    badge_rocket: '🚀', badge_star: '🌟', badge_scholar: '📚',
    badge_centurion: '⚔️', badge_focus: '🧘',
  };
  return map[badgeId] || '🏅';
}

function auraStyle(aura: string | null): React.CSSProperties {
  switch (aura) {
    case 'flame':     return { boxShadow: '0 0 0 2px #f97316, 0 0 10px 2px #f97316aa', animation: 'pulse 1.5s infinite' };
    case 'ice':       return { boxShadow: '0 0 0 2px #67e8f9, 0 0 10px 2px #67e8f9aa' };
    case 'lightning': return { boxShadow: '0 0 0 2px #fde047, 0 0 10px 4px #fde04799' };
    case 'villain':   return { boxShadow: '0 0 0 2px #ef4444, 0 0 12px 4px #ef444499', filter: 'contrast(1.1)' };
    default:          return {};
  }
}
