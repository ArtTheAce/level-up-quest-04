import { useState, useEffect } from 'react';
import { useGame, type TimetableEntry } from '@/context/GameContext';
import { motion } from 'framer-motion';
import { Plus, X, CheckCircle2, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ReminderPicker } from '@/components/ReminderPicker';
import { getTasksForEntry, subscribeTaskLinks, setTaskLink } from '@/lib/taskLinks';
import { getTaskWindow, subscribeTaskDurations } from '@/lib/taskSchedule';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);

const COLOUR_PALETTE = [
  { label: 'Blue',    hex: '#3b82f6' },
  { label: 'Green',   hex: '#22c55e' },
  { label: 'Orange',  hex: '#f97316' },
  { label: 'Purple',  hex: '#a855f7' },
  { label: 'Pink',    hex: '#ec4899' },
  { label: 'Red',     hex: '#ef4444' },
  { label: 'Teal',    hex: '#14b8a6' },
  { label: 'Yellow',  hex: '#eab308' },
  { label: 'Indigo',  hex: '#6366f1' },
  { label: 'Rose',    hex: '#f43f5e' },
  { label: 'Cyan',    hex: '#06b6d4' },
  { label: 'Lime',    hex: '#84cc16' },
  { label: 'Slate',   hex: '#64748b' },
  { label: 'Amber',   hex: '#f59e0b' },
  { label: 'Violet',  hex: '#7c3aed' },
  { label: 'Sky',     hex: '#0ea5e9' },
];

function getBlockColour(entry: TimetableEntry): string {
  const colour = entry.subjectColor as string;
  if (colour && colour.startsWith('#')) return colour;
  const legacy: Record<string, string> = {
    math: '#3b82f6', physics: '#22c55e', chemistry: '#f97316',
    english: '#a855f7', history: '#f97316', art: '#ec4899',
    music: '#14b8a6', other: '#64748b',
  };
  return legacy[colour] || '#64748b';
}

export default function Timetable() {
  const { state, dispatch } = useGame();
  const [open, setOpen] = useState(false);
  const [, setLinkTick] = useState(0);
  useEffect(() => subscribeTaskLinks(() => setLinkTick((t) => t + 1)), []);
  useEffect(() => subscribeTaskDurations(() => setLinkTick((t) => t + 1)), []);
  const [form, setForm] = useState({
    subject: '',
    colour: COLOUR_PALETTE[0].hex,
    day: 0,
    startTime: '09:00',
    endTime: '10:00',
  });

  const addEntry = () => {
    if (!form.subject.trim()) return;
    const entry: TimetableEntry = {
      id: crypto.randomUUID(),
      subject: form.subject.trim(),
      subjectColor: form.colour as any,
      day: form.day,
      startTime: form.startTime,
      endTime: form.endTime,
    };
    dispatch({ type: 'ADD_TIMETABLE_ENTRY', entry });
    setOpen(false);
    setForm({ subject: '', colour: COLOUR_PALETTE[0].hex, day: 0, startTime: '09:00', endTime: '10:00' });
  };

  const getEntriesForDayHour = (day: number, hour: number) =>
    state.timetable.filter(e => {
      const startH = parseInt(e.startTime.split(':')[0]);
      const endH = parseInt(e.endTime.split(':')[0]);
      return e.day === day && hour >= startH && hour < endH;
    });

  const isStartOfBlock = (entry: TimetableEntry, hour: number) =>
    parseInt(entry.startTime.split(':')[0]) === hour;

  const getBlockHeight = (entry: TimetableEntry) =>
    parseInt(entry.endTime.split(':')[0]) - parseInt(entry.startTime.split(':')[0]);

  // Tasks with a deadline → render as scheduled blocks on the grid.
  const scheduledTasks = state.tasks
    .map((t) => ({ task: t, win: getTaskWindow(t) }))
    .filter((x) => x.win !== null) as { task: typeof state.tasks[number]; win: NonNullable<ReturnType<typeof getTaskWindow>> }[];

  const getTasksForDayHour = (day: number, hour: number) =>
    scheduledTasks.filter(({ win }) => {
      const startH = Math.floor(win.startMinutes / 60);
      const endH = Math.ceil(win.endMinutes / 60);
      return win.day === day && hour >= startH && hour < endH;
    });

  const isTaskStart = (winStart: number, hour: number) =>
    Math.floor(winStart / 60) === hour;

  // Unique subjects for legend
  const uniqueSubjects = [...new Map(state.timetable.map(e => [e.subject, e])).values()];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">Timetable 📅</h1>
          <p className="text-muted-foreground text-sm mt-1">Plan your week like a pro.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add Class</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">Add Class</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <Input
                placeholder="Subject name (e.g. Maths, Biology, French…)"
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addEntry()}
              />

              <div>
                <label className="text-xs text-muted-foreground mb-2 block font-medium">Pick a colour</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {COLOUR_PALETTE.map(c => (
                    <button
                      key={c.hex}
                      title={c.label}
                      onClick={() => setForm(f => ({ ...f, colour: c.hex }))}
                      className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        backgroundColor: c.hex,
                        borderColor: 'transparent',
                        outline: form.colour === c.hex ? `3px solid ${c.hex}` : 'none',
                        outlineOffset: '2px',
                      }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={form.colour}
                    onChange={e => setForm(f => ({ ...f, colour: e.target.value }))}
                    className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent"
                    title="Custom colour"
                  />
                  <span className="text-xs text-muted-foreground">or pick any custom colour</span>
                  <span
                    className="ml-auto text-xs px-2 py-0.5 rounded-full text-white font-medium"
                    style={{ backgroundColor: form.colour }}
                  >
                    {form.subject || 'Preview'}
                  </span>
                </div>
              </div>

              <Select value={form.day.toString()} onValueChange={v => setForm(f => ({ ...f, day: parseInt(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAYS.map((d, i) => (
                    <SelectItem key={i} value={i.toString()}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Start</label>
                  <Input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">End</label>
                  <Input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
                </div>
              </div>

              <Button onClick={addEntry} className="w-full" disabled={!form.subject.trim()}>
                Add to Timetable
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Subject legend */}
      {uniqueSubjects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {uniqueSubjects.map(e => (
            <span
              key={e.subject}
              className="text-xs px-3 py-1 rounded-full text-white font-medium"
              style={{ backgroundColor: getBlockColour(e) }}
            >
              {e.subject}
            </span>
          ))}
        </div>
      )}

      {/* Timetable Grid */}
      <div className="glass-card overflow-x-auto">
        <div className="min-w-[700px]">
          <div className="grid grid-cols-8 border-b border-border">
            <div className="p-3 text-xs text-muted-foreground font-medium">Time</div>
            {DAYS.map(d => (
              <div key={d} className="p-3 text-center text-sm font-display font-bold">{d}</div>
            ))}
          </div>
          {HOURS.map(hour => (
            <div key={hour} className="grid grid-cols-8 border-b border-border/50 min-h-[52px]">
              <div className="p-2 text-xs text-muted-foreground flex items-start pt-3">
                {hour.toString().padStart(2, '0')}:00
              </div>
              {DAYS.map((_, dayIdx) => {
                const entries = getEntriesForDayHour(dayIdx, hour);
                const taskBlocks = getTasksForDayHour(dayIdx, hour);
                return (
                  <div key={dayIdx} className="p-0.5 relative">
                    {entries.map(entry =>
                      isStartOfBlock(entry, hour) ? (
                        <motion.div
                          key={entry.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="rounded-lg p-2 text-xs font-medium relative group cursor-default text-white overflow-hidden"
                          style={{
                            backgroundColor: getBlockColour(entry),
                            height: `${getBlockHeight(entry) * 52 - 4}px`,
                          }}
                        >
                          <span className="font-bold leading-tight block truncate">{entry.subject}</span>
                          <span className="opacity-85 text-[10px]">{entry.startTime}–{entry.endTime}</span>
                          {(() => {
                            const linkedIds = getTasksForEntry(entry.id);
                            const linkedTasks = state.tasks.filter((t) => linkedIds.includes(t.id));
                            if (linkedTasks.length === 0) return null;
                            return (
                              <div className="mt-1 space-y-0.5">
                                {linkedTasks.slice(0, 4).map((t) => (
                                  <div key={t.id} className="flex items-center gap-1 text-[10px] bg-black/20 rounded px-1 py-0.5">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        dispatch({ type: 'TOGGLE_TASK', taskId: t.id });
                                      }}
                                      className="shrink-0"
                                    >
                                      {t.completed
                                        ? <CheckCircle2 className="h-2.5 w-2.5" />
                                        : <Circle className="h-2.5 w-2.5" />}
                                    </button>
                                    <span className={`truncate flex-1 ${t.completed ? 'line-through opacity-70' : ''}`}>
                                      {t.title}
                                    </span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setTaskLink(t.id, null); }}
                                      className="opacity-0 group-hover:opacity-70 hover:opacity-100"
                                      aria-label="Unlink"
                                    >
                                      <X className="h-2.5 w-2.5" />
                                    </button>
                                  </div>
                                ))}
                                {linkedTasks.length > 4 && (
                                  <div className="text-[9px] opacity-80">+{linkedTasks.length - 4} more</div>
                                )}
                              </div>
                            );
                          })()}
                          <div className="mt-1" onClick={e => e.stopPropagation()}>
                            <ReminderPicker itemId={entry.id} kind="class" />
                          </div>
                          <button
                            onClick={() => dispatch({ type: 'DELETE_TIMETABLE_ENTRY', entryId: entry.id })}
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </motion.div>
                      ) : null
                    )}
                    {taskBlocks.map(({ task, win }) =>
                      isTaskStart(win.startMinutes, hour) ? (
                        <motion.div
                          key={`task-${task.id}`}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className={`rounded-lg p-2 text-xs font-medium relative group cursor-default text-white overflow-hidden border-2 border-dashed border-white/40 mt-0.5 ${task.completed ? 'opacity-60' : ''}`}
                          style={{
                            backgroundColor: '#0ea5e9',
                            height: `${Math.max(1, Math.ceil((win.endMinutes - win.startMinutes) / 60)) * 52 - 4}px`,
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => dispatch({ type: 'TOGGLE_TASK', taskId: task.id })}
                              className="shrink-0"
                              aria-label="Toggle task"
                            >
                              {task.completed
                                ? <CheckCircle2 className="h-3 w-3" />
                                : <Circle className="h-3 w-3" />}
                            </button>
                            <span className={`font-bold leading-tight truncate ${task.completed ? 'line-through' : ''}`}>
                              📝 {task.title}
                            </span>
                          </div>
                          <span className="opacity-85 text-[10px] block">
                            {win.startHHMM}–{win.endHHMM}
                          </span>
                        </motion.div>
                      ) : null
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
