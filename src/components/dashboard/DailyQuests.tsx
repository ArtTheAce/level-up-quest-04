import { useMemo } from 'react';
import { useGame } from '@/context/GameContext';
import { motion } from 'framer-motion';
import { Target, CheckCircle2, Circle, Flame } from 'lucide-react';

interface Quest {
  id: string;
  label: string;
  emoji: string;
  target: number;
  current: number;
  reward: number; // coins
}

export function DailyQuests() {
  const { state } = useGame();

  const quests = useMemo<Quest[]>(() => {
    const today = new Date().toISOString().split('T')[0];
    const completedToday = state.tasks.filter(
      t => t.completed && state.lastActiveDate === today
    ).length;
    const hardDone = state.tasks.filter(t => t.completed && t.priority === 'hard').length;

    return [
      { id: 'q1', label: 'Complete 3 tasks today', emoji: '✅', target: 3, current: Math.min(completedToday, 3), reward: 30 },
      { id: 'q2', label: 'Finish 1 hard task', emoji: '💪', target: 1, current: Math.min(hardDone, 1), reward: 25 },
      { id: 'q3', label: 'Run a focus session', emoji: '🧠', target: 1, current: Math.min(state.focusSessionsCompleted > 0 ? 1 : 0, 1), reward: 20 },
      { id: 'q4', label: 'Keep your streak alive', emoji: '🔥', target: 1, current: state.streak > 0 ? 1 : 0, reward: 15 },
    ];
  }, [state.tasks, state.streak, state.focusSessionsCompleted, state.lastActiveDate]);

  const completedCount = quests.filter(q => q.current >= q.target).length;

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-lg flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Daily Quests
        </h2>
        <span className="text-xs px-2 py-1 rounded-full bg-primary/15 text-primary font-bold">
          {completedCount}/{quests.length}
        </span>
      </div>
      <div className="space-y-3">
        {quests.map((q, i) => {
          const done = q.current >= q.target;
          const pct = Math.min(100, (q.current / q.target) * 100);
          return (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`p-3 rounded-lg border transition-colors ${
                done ? 'bg-primary/10 border-primary/30' : 'bg-muted/40 border-border'
              }`}
            >
              <div className="flex items-center gap-3">
                {done ? (
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
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
                <span className="text-xs font-bold text-coin shrink-0">+{q.reward}🪙</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
