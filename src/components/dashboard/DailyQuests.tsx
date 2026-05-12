import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '@/context/GameContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, CheckCircle2, Circle, Clock, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

type Metric =
  | 'tasks_today'
  | 'hard_done_today'
  | 'medium_done_today'
  | 'focus_sessions_today'
  | 'streak_alive'
  | 'overdue_done_today'
  | 'subject_done_today'
  | 'xp_today'
  | 'coins_today'
  | 'before_noon'
  | 'after_dinner';

interface QuestDef {
  id: string;
  label: string;
  emoji: string;
  target: number;
  rewardXp: number;
  rewardCoins: number;
  metric: Metric;
  meta?: { subject?: string };
}

const QUEST_POOL = (subjects: string[]): QuestDef[] => [
  { id: 'q_tasks_2',    label: 'Complete 2 tasks today',     emoji: '✅', target: 2, rewardXp: 20, rewardCoins: 25, metric: 'tasks_today' },
  { id: 'q_tasks_4',    label: 'Complete 4 tasks today',     emoji: '🚀', target: 4, rewardXp: 45, rewardCoins: 50, metric: 'tasks_today' },
  { id: 'q_tasks_6',    label: 'Crush 6 tasks today',        emoji: '🏆', target: 6, rewardXp: 80, rewardCoins: 90, metric: 'tasks_today' },
  { id: 'q_hard_1',     label: 'Finish 1 hard task',         emoji: '💪', target: 1, rewardXp: 30, rewardCoins: 30, metric: 'hard_done_today' },
  { id: 'q_hard_2',     label: 'Finish 2 hard tasks',        emoji: '🔥', target: 2, rewardXp: 60, rewardCoins: 50, metric: 'hard_done_today' },
  { id: 'q_medium_3',   label: 'Finish 3 medium tasks',      emoji: '⚙️', target: 3, rewardXp: 35, rewardCoins: 35, metric: 'medium_done_today' },
  { id: 'q_focus_1',    label: 'Run a focus session',        emoji: '🧠', target: 1, rewardXp: 20, rewardCoins: 20, metric: 'focus_sessions_today' },
  { id: 'q_focus_2',    label: 'Run 2 focus sessions',       emoji: '🎯', target: 2, rewardXp: 40, rewardCoins: 35, metric: 'focus_sessions_today' },
  { id: 'q_streak',     label: 'Keep your streak alive',     emoji: '🔥', target: 1, rewardXp: 15, rewardCoins: 15, metric: 'streak_alive' },
  { id: 'q_overdue',    label: 'Finish 1 overdue task',      emoji: '⏰', target: 1, rewardXp: 35, rewardCoins: 30, metric: 'overdue_done_today' },
  { id: 'q_xp_100',     label: 'Earn 100 XP today',          emoji: '⚡', target: 100, rewardXp: 25, rewardCoins: 30, metric: 'xp_today' },
  { id: 'q_xp_200',     label: 'Earn 200 XP today',          emoji: '🌟', target: 200, rewardXp: 50, rewardCoins: 60, metric: 'xp_today' },
  { id: 'q_coins_50',   label: 'Earn 50 coins today',        emoji: '🪙', target: 50, rewardXp: 20, rewardCoins: 25, metric: 'coins_today' },
  { id: 'q_morning',    label: 'Finish 2 tasks before noon', emoji: '🌅', target: 2, rewardXp: 35, rewardCoins: 35, metric: 'before_noon' },
  { id: 'q_evening',    label: 'Finish a task after 7PM',    emoji: '🌙', target: 1, rewardXp: 20, rewardCoins: 20, metric: 'after_dinner' },
  ...subjects.slice(0, 4).map(s => ({
    id: 'q_subj_' + s.toLowerCase().replace(/\s+/g, '_'),
    label: `Complete a ${s} task`,
    emoji: '📚',
    target: 1, rewardXp: 25, rewardCoins: 25,
    metric: 'subject_done_today' as const, meta: { subject: s },
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

function startOfDay(): Date {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d;
}
function endOfDay(): Date {
  const d = new Date(); d.setHours(23, 59, 59, 999); return d;
}

interface CompletionRow {
  task_id: string;
  xp_granted: number;
  coins_granted: number;
  completed_at: string;
}

export function DailyQuests() {
  const { state, dispatch } = useGame();
  const { user } = useAuth();
  const [quests, setQuests] = useState<QuestDef[]>([]);
  const [claimed, setClaimed] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState<number>(endOfDay().getTime());
  const [now, setNow] = useState(Date.now());
  const [questsId, setQuestsId] = useState<string | null>(null);
  const [baselines, setBaselines] = useState<{ focus_sessions?: number }>({});
  const [todayCompletions, setTodayCompletions] = useState<CompletionRow[]>([]);
  const claimingRef = useRef<Set<string>>(new Set());

  // Tick clock for countdown + auto-refresh on rollover
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Load or generate today's quests
  const ensureQuests = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('daily_quests').select('*').eq('user_id', user.id).maybeSingle();
    const nowMs = Date.now();
    const expired = !data || new Date(data.expires_at).getTime() <= nowMs;
    if (!expired && data) {
      setQuests(data.quests as any as QuestDef[]);
      setClaimed((data.claimed as any as string[]) || []);
      setExpiresAt(new Date(data.expires_at).getTime());
      setQuestsId(data.id);
      setBaselines((data.baselines as any) || {});
      return;
    }
    const subjects = Array.from(new Set(state.tasks.map(t => t.subject).filter(Boolean) as string[]));
    const fresh = pickRandom(QUEST_POOL(subjects), 4);
    const exp = endOfDay().toISOString();
    const baseline = { focus_sessions: state.focusSessionsCompleted };
    const { data: up } = await supabase.from('daily_quests').upsert({
      user_id: user.id,
      quests: fresh as any,
      claimed: [],
      generated_at: new Date(nowMs).toISOString(),
      expires_at: exp,
      baselines: baseline as any,
    }, { onConflict: 'user_id' }).select().single();
    setQuests(fresh);
    setClaimed([]);
    setExpiresAt(new Date(exp).getTime());
    setQuestsId(up?.id ?? null);
    setBaselines(baseline);
  }, [user, state.tasks, state.focusSessionsCompleted]);

  useEffect(() => { ensureQuests(); }, [user]);

  // Auto-rollover when day expires
  useEffect(() => {
    if (now >= expiresAt && questsId) {
      ensureQuests();
    }
  }, [now, expiresAt, questsId, ensureQuests]);

  // Load today's completions (accurate per-day metrics)
  const loadCompletions = useCallback(async () => {
    if (!user) return;
    const since = startOfDay().toISOString();
    const { data } = await supabase
      .from('task_completions')
      .select('task_id, xp_granted, coins_granted, completed_at')
      .eq('user_id', user.id)
      .eq('reversed', false)
      .gte('completed_at', since);
    setTodayCompletions(data || []);
  }, [user]);

  useEffect(() => { loadCompletions(); }, [user, state.totalTasksCompleted, state.xp, state.coins]);

  // Realtime updates so progress bars react instantly
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel('dq_completions_' + user.id)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'task_completions',
        filter: `user_id=eq.${user.id}`,
      }, () => loadCompletions())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, loadCompletions]);

  // Compute progress per metric, using task_completions joined with current task data
  const progress = useMemo(() => {
    const tasksById = new Map(state.tasks.map(t => [t.id, t]));
    const noon = new Date(); noon.setHours(12, 0, 0, 0);
    const evening = new Date(); evening.setHours(19, 0, 0, 0);

    const todays = todayCompletions.map(c => ({
      ...c,
      task: tasksById.get(c.task_id),
      ts: new Date(c.completed_at).getTime(),
    }));

    const sumXp = todays.reduce((a, c) => a + (c.xp_granted || 0), 0);
    const sumCoins = todays.reduce((a, c) => a + (c.coins_granted || 0), 0);

    return (q: QuestDef): number => {
      switch (q.metric) {
        case 'tasks_today': return todays.length;
        case 'hard_done_today': return todays.filter(c => c.task?.priority === 'hard').length;
        case 'medium_done_today': return todays.filter(c => c.task?.priority === 'medium').length;
        case 'focus_sessions_today':
          return Math.max(0, state.focusSessionsCompleted - (baselines.focus_sessions ?? 0));
        case 'streak_alive': return state.streak > 0 ? 1 : 0;
        case 'overdue_done_today':
          return todays.filter(c => {
            const dl = c.task?.deadline ? new Date(c.task.deadline).getTime() : 0;
            return dl > 0 && c.ts > dl;
          }).length;
        case 'subject_done_today':
          return todays.filter(c => c.task?.subject === q.meta?.subject).length;
        case 'xp_today': return sumXp;
        case 'coins_today': return sumCoins;
        case 'before_noon': return todays.filter(c => c.ts < noon.getTime()).length;
        case 'after_dinner': return todays.filter(c => c.ts >= evening.getTime()).length;
        default: return 0;
      }
    };
  }, [todayCompletions, state.tasks, state.focusSessionsCompleted, state.streak, baselines]);

  // Auto-claim rewards once target reached (idempotent + race-guarded)
  useEffect(() => {
    if (!user || !questsId || quests.length === 0) return;
    const newlyDone = quests.filter(
      q => !claimed.includes(q.id) && !claimingRef.current.has(q.id) && progress(q) >= q.target
    );
    if (newlyDone.length === 0) return;
    newlyDone.forEach(q => claimingRef.current.add(q.id));

    let xp = 0, coins = 0;
    newlyDone.forEach(q => { xp += q.rewardXp; coins += q.rewardCoins; });
    if (xp) dispatch({ type: 'ADD_XP', amount: xp });
    if (coins) dispatch({ type: 'ADD_COINS', amount: coins });
    const next = [...claimed, ...newlyDone.map(q => q.id)];
    setClaimed(next);
    supabase.from('daily_quests').update({ claimed: next as any }).eq('id', questsId).then(() => {});

    newlyDone.forEach(q => {
      toast.success(`Quest complete! ${q.emoji} ${q.label}`, {
        description: `+${q.rewardXp} XP · +${q.rewardCoins} 🪙`,
      });
    });
  }, [progress, quests, claimed, questsId, user, dispatch]);

  const completedCount = quests.filter(q => claimed.includes(q.id) || progress(q) >= q.target).length;
  const allDone = quests.length > 0 && completedCount === quests.length;
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
          {allDone && <Sparkles className="h-4 w-4 text-yellow-400 animate-pulse" />}
        </h2>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full font-bold ${
            allDone ? 'bg-yellow-400/20 text-yellow-300' : 'bg-primary/15 text-primary'
          }`}>
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
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className="h-full xp-gradient"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6 }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                        {cur}/{q.target}
                      </span>
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
