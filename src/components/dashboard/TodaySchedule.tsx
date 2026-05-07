import { useMemo } from 'react';
import { useGame } from '@/context/GameContext';
import { Clock, CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';

function getBlockColour(colour?: string): string {
  if (colour && colour.startsWith('#')) return colour;
  const legacy: Record<string, string> = {
    math: '#3b82f6', physics: '#22c55e', chemistry: '#f97316',
    english: '#a855f7', history: '#f97316', art: '#ec4899',
    music: '#14b8a6', other: '#64748b',
  };
  return legacy[colour || 'other'] || '#64748b';
}

export function TodaySchedule() {
  const { state } = useGame();

  const todayIdx = useMemo(() => {
    // Mon = 0 ... Sun = 6
    const js = new Date().getDay(); // Sun=0
    return (js + 6) % 7;
  }, []);

  const nowMin = useMemo(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }, []);

  const todayClasses = useMemo(() => {
    return state.timetable
      .filter(e => {
        const days = e.days && e.days.length > 0 ? e.days : [e.day];
        return days.includes(todayIdx);
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [state.timetable, todayIdx]);

  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const upcoming = todayClasses.find(c => toMin(c.endTime) > nowMin);

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-lg flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          Today's Schedule
        </h2>
        <Link to="/timetable" className="text-xs text-primary hover:underline">View all →</Link>
      </div>

      {todayClasses.length === 0 ? (
        <p className="text-sm text-muted-foreground">No classes scheduled today. Add some in your Timetable!</p>
      ) : (
        <>
          {upcoming && (
            <div
              className="rounded-lg p-3 mb-3 text-white"
              style={{ backgroundColor: getBlockColour(upcoming.subjectColor) }}
            >
              <p className="text-[10px] uppercase tracking-wider opacity-80 font-bold">Up next</p>
              <p className="font-display font-bold text-lg leading-tight">{upcoming.subject}</p>
              <p className="text-xs opacity-90 flex items-center gap-1 mt-0.5">
                <Clock className="h-3 w-3" /> {upcoming.startTime}–{upcoming.endTime}
              </p>
            </div>
          )}
          <div className="space-y-1.5 max-h-44 overflow-y-auto">
            {todayClasses.map(c => {
              const past = toMin(c.endTime) <= nowMin;
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-2 text-sm py-1.5 px-2 rounded ${past ? 'opacity-50' : ''}`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: getBlockColour(c.subjectColor) }}
                  />
                  <span className={`flex-1 truncate ${past ? 'line-through' : 'font-medium'}`}>
                    {c.subject}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {c.startTime}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
