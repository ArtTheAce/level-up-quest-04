import { useGame } from '@/context/GameContext';
import { Flame } from 'lucide-react';

export function StudyHeatmap() {
  const { state } = useGame();

  // Build last 35 days
  const days: { date: string; count: number }[] = [];
  const today = new Date();
  for (let i = 34; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const count = state.tasks.filter(t => t.completed && t.createdAt.split('T')[0] === key).length;
    days.push({ date: key, count });
  }

  const intensity = (c: number) => {
    if (c === 0) return 'bg-muted';
    if (c < 2) return 'bg-primary/30';
    if (c < 4) return 'bg-primary/60';
    return 'bg-primary';
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-lg flex items-center gap-2">
          <Flame className="h-5 w-5 text-streak" />
          Activity (last 5 weeks)
        </h2>
        <span className="text-xs text-muted-foreground">🔥 {state.streak}-day streak</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map(d => (
          <div
            key={d.date}
            title={`${d.date}: ${d.count} task${d.count === 1 ? '' : 's'}`}
            className={`aspect-square rounded ${intensity(d.count)} hover:ring-2 hover:ring-primary/50 transition-all`}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
        <span>Less</span>
        <div className="w-3 h-3 rounded bg-muted" />
        <div className="w-3 h-3 rounded bg-primary/30" />
        <div className="w-3 h-3 rounded bg-primary/60" />
        <div className="w-3 h-3 rounded bg-primary" />
        <span>More</span>
      </div>
    </div>
  );
}
