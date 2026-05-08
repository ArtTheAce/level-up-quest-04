import { useEffect, useMemo, useState } from 'react';
import { useGame } from '@/context/GameContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, CheckCircle2, Circle, Clock } from 'lucide-react';

interface QuestDef {
  id: string;
  label: string;
  emoji: string;
  target: number;
  rewardXp: number;
  rewardCoins: number;
  // metric is computed from current state
  metric: 'tasks_today' | 'hard_done' | 'focus_sessions' | 'streak' | 'overdue_done' | 'subject_done' | 'xp_today' | 'before_5pm';
  meta?: any;
}

const QUEST_POOL = (subjects: string[]): QuestDef[] => [
  { id: 'q_tasks_2',   label: 'Complete 2 tasks today',     emoji: '✅', target: 2, rewardXp: 20, rewardCoins: 25, metric: 'tasks_today' },
  { id: 'q_tasks_4',   label: 'Complete 4 tasks today',     emoji: '🚀', target: 4, rewardXp: 45, rewardCoins: 50, metric: 'tasks_today' },
  { id: 'q_hard_1',    label: 'Finish 1 hard task',         emoji: '💪', target: 1, rewardXp: 30, rewardCoins: 30, metric: 'hard_done' },
  { id: 'q_hard_2',    label: 'Finish 2 hard tasks',        emoji: '🔥', target: 2, rewardXp: 60, rewardCoins: 50, metric: 'hard_done' },
  { id: 'q_focus_1',   label: 'Run a focus session',        emoji: '🧠', target: 1, rewardXp: 20, rewardCoins: 20, metric: 'focus_sessions' },
  { id: 'q_focus_2',   label: 'Run 2 focus sessions',       emoji: '🎯', target: 2, rewardXp: 40, rewardCoins: 35, metric: 'focus_sessions' },
  { id: 'q_streak',    label: 'Keep your streak alive',     emoji: '🔥', target: 1, rewardXp: 15, rewardCoins: 15, metric: 'streak' },
  { id: 'q_overdue',   label: 'Finish 1 overdue task',      emoji: '⏰', target: 1, rewardXp: 35, rewardCoins: 30, metric: 'overdue_done' },
  { id: 'q_xp_100',    label: 'Earn 100 XP today',          emoji: '⚡', target: 100, rewardXp: 25, rewardCoins: 30, metric: 'xp_today' },
  { id: 'q_xp_200',    label: 'Earn 200 XP today',          emoji: '🌟', target: 200, rewardXp: 50, rewardCoins: 60, metric: 'xp_today' },
  { id: 'q_before5',   label: 'Complete 2 tasks before 5PM', emoji: '☀️', target: 2, rewardXp: 30, rewardCoins: 30, metric: 'before_5pm' },
  ...subjects.slice(0, 4).map(s => ({
    id: 'q_subj_' + s.toLowerCase().replace(/\s+/g, '_'),
    label: `Complete a ${s} task`,
    emoji: '📚',
    target: 1, rewardXp: 25, rewardCoins: 25,
    metric: 'subject_done' as const, meta: { subject: s },
  })),
];

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}

function endOfDayMs(): number {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function DailyQuests() {
  const { state, dispatch } = useGame();
  const { user } = useAuth();
  const [quests, setQuests] = useState<QuestDef[]>([]);
  const [claimed, setClaimed] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState<number>(endOfDayMs());
  const [now, setNow] = useState(Date.now());
  const [questsId, setQuestsId] = useState<string | null>(null);

  // Tick clock for countdown
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Load or generate quests from DB
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('daily_quests').select('*').eq('user_id', user.id).maybeSingle();
      const nowMs = Date.now();
      const expired = !data || new Date(data.expires_at).getTime() <= nowMs;
      if (!expired && data) {
        setQuests(data.quests as any as QuestDef[]);
        setClaimed((data.claimed as any as string[]) || []);
        setExpiresAt(new Date(data.expires_at).getTime());
        setQuestsId(data.id);
      } else {
        const subjects = Array.from(new Set(state.tasks.map(t => t.subject).filter(Boolean) as string[]));
        const pool = QUEST_POOL(subjects);
        const fresh = pickRandom(pool, 4);
        const exp = new Date(nowMs + 24 * 60 * 60 * 1000).toISOString();
        const { data: up } = await supabase.from('daily_quests').upsert({
          user_id: user.id,
          quests: fresh as any,
          claimed: [],
          generated_at: new Date(nowMs).toISOString(),
          expires_at: exp,
        }, { onConflict: 'user_id' }).select().single();
        setQuests(fresh);
        setClaimed([]);
        setExpiresAt(new Date(exp).getTime());
        setQuestsId(up?.id ?? null);
      }
    })();
  }, [user]);

  // Compute progress per metric
  const progress = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const completedToday = state.tasks.filter(t => t.completed && state.lastActiveDate === today);
    const beforeFive = completedToday.filter(t => {
      // approximate: any completion happening before 5pm local — we don't have completion time here, fall back to deadline
      const h = new Date().getHours();
      return h < 17;
    });
    return (q: QuestDef): number => {
      switch (q.metric) {
        case 'tasks_today': return completedToday.length;
        case 'hard_done': return state.tasks.filter(t => t.completed && t.priority === 'hard').length;
        case 'focus_sessions': return state.focusSessionsCompleted;
        case 'streak': return state.streak > 0 ? 1 : 0;
        case 'overdue_done': return state.tasks.filter(t => t.completed && t.deadline && new Date(t.deadline).getTime() < Date.now()).length;
        case 'subject_done': return state.tasks.filter(t => t.completed && t.subject === q.meta?.subject).length;
        case 'xp_today': return state.xp; // approximation: today's earned XP not separately tracked
        case 'before_5pm': return beforeFive.length;
        default: return 0;
      }
    };
  }, [state]);

  // Auto-claim rewards when target reached
  useEffect(() => {
    if (!user || !questsId || quests.length === 0) return;
    const newlyDone = quests.filter(q => !claimed.includes(q.id) && progress(q) >= q.target);
    if (newlyDone.length === 0) return;
    let xp = 0, coins = 0;
    newlyDone.forEach(q => { xp += q.rewardXp; coins += q.rewardCoins; });
    if (xp) dispatch({ type: 'ADD_XP', amount: xp });
    if (coins) dispatch({ type: 'ADD_COINS', amount: coins });
    const next = [...claimed, ...newlyDone.map(q => q.id)];
    setClaimed(next);
    supabase.from('daily_quests').update({ claimed: next as any }).eq('id', questsId).then(() => {});
  }, [progress, quests, claimed, questsId, user, dispatch]);

  const completedCount = quests.filter(q => progress(q) >= q.target).length;
  const remainingMs = Math.max(0, expiresAt - now);
  const hh = Math.floor(remainingMs / 3_600_000);
  const mm = Math.floor((remainingMs % 3_600_000) / 60_000);
  const ss = Math.floor((remainingMs % 60_000) / 1000);

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-lg flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Daily Quests
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded-full bg-primary/15 text-primary font-bold">
            {completedCount}/{quests.length}
          </span>
          <span className="text-[11px] px-2 py-1 rounded-full bg-muted text-muted-foreground font-mono inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {String(hh).padStart(2, '0')}:{String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
          </span>
        </div>
      </div>
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {quests.map((q, i) => {
            const cur = Math.min(progress(q), q.target);
            const done = cur >= q.target;
            const pct = (cur / q.target) * 100;
            return (
              <motion.div
                key={q.id}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.04 }}
                className={`p-3 rounded-lg border transition-colors ${
                  done ? 'bg-primary/10 border-primary/30' : 'bg-muted/40 border-border'
                }`}
              >
                <div className="flex items-center gap-3">
                  {done
                    ? <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    : <Circle className="h-5 w-5 text-muted-foreground shrink-0" />}
                  <span className="text-lg">{q.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${done ? 'line-through text-muted-foreground' : ''}`}>
                      {q.label}
                    </p>
                    <div className="w-full h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                      <motion.div
                        className="h-full xp-gradient"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6 }}
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[11px] font-bold text-primary block">+{q.rewardXp} XP</span>
                    <span className="text-[11px] font-bold text-coin block">+{q.rewardCoins}🪙</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
