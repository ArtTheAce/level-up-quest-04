import { useState, useMemo, useEffect } from 'react';
import { useGame, type TimetableEntry, type Task } from '@/context/GameContext';
import { motion } from 'framer-motion';
import { Plus, X, CheckCircle2, Circle, ChevronLeft, ChevronRight, Pencil, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfWeek, addDays, addWeeks, subWeeks, startOfMonth, endOfMonth, addMonths, subMonths, isSameDay, isSameMonth, isToday } from 'date-fns';
import { cn } from '@/lib/utils';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7am - 9pm
const HOUR_HEIGHT = 56;

const COLOUR_PALETTE = [
  '#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ec4899', '#ef4444',
  '#14b8a6', '#eab308', '#6366f1', '#f43f5e', '#06b6d4', '#84cc16',
  '#64748b', '#f59e0b', '#7c3aed', '#0ea5e9',
];

function getBlockColour(entry: TimetableEntry): string {
  const c = entry.subjectColor as string;
  if (c && c.startsWith('#')) return c;
  const legacy: Record<string, string> = {
    math: '#3b82f6', physics: '#22c55e', chemistry: '#f97316',
    english: '#a855f7', history: '#f97316', art: '#ec4899',
    music: '#14b8a6', other: '#64748b',
  };
  return legacy[c] || '#64748b';
}

function dayIndexFromDate(d: Date): number {
  return (d.getDay() + 6) % 7; // Mon=0..Sun=6
}

function classOnDay(entry: TimetableEntry, dayIdx: number): boolean {
  const days = entry.days && entry.days.length > 0 ? entry.days : [entry.day];
  return days.includes(dayIdx);
}

function minutesFromHHMM(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

interface ClassFormState {
  id: string | null;
  subject: string;
  colour: string;
  days: number[];
  startTime: string;
  endTime: string;
  teacher: string;
  room: string;
}

const emptyForm = (): ClassFormState => ({
  id: null, subject: '', colour: COLOUR_PALETTE[0], days: [],
  startTime: '09:00', endTime: '10:00', teacher: '', room: '',
});

export default function Timetable() {
  const { state, dispatch, toggleTask } = useGame();
  const [view, setView] = useState<'week' | 'month'>('week');
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [filter, setFilter] = useState<string>(''); // search
  const [classDialogOpen, setClassDialogOpen] = useState(false);
  const [form, setForm] = useState<ClassFormState>(emptyForm());

  // re-render every minute so "now" line moves
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force(n => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const openCreate = () => { setForm(emptyForm()); setClassDialogOpen(true); };
  const openEdit = (e: TimetableEntry) => {
    setForm({
      id: e.id, subject: e.subject, colour: getBlockColour(e),
      days: e.days && e.days.length > 0 ? e.days : [e.day],
      startTime: e.startTime, endTime: e.endTime,
      teacher: e.teacher || '', room: e.room || '',
    });
    setClassDialogOpen(true);
  };

  const saveClass = () => {
    if (!form.subject.trim() || form.days.length === 0) return;
    if (minutesFromHHMM(form.endTime) <= minutesFromHHMM(form.startTime)) return;
    const entry: TimetableEntry = {
      id: form.id ?? crypto.randomUUID(),
      subject: form.subject.trim(),
      subjectColor: form.colour as any,
      day: form.days[0],
      days: [...form.days].sort((a, b) => a - b),
      startTime: form.startTime,
      endTime: form.endTime,
      teacher: form.teacher.trim() || undefined,
      room: form.room.trim() || undefined,
    };
    dispatch({
      type: form.id ? 'UPDATE_TIMETABLE_ENTRY' : 'ADD_TIMETABLE_ENTRY',
      entry,
    });
    setClassDialogOpen(false);
  };

  const deleteClass = () => {
    if (form.id) dispatch({ type: 'DELETE_TIMETABLE_ENTRY', entryId: form.id });
    setClassDialogOpen(false);
  };

  const toggleDay = (d: number) =>
    setForm(f => ({ ...f, days: f.days.includes(d) ? f.days.filter(x => x !== d) : [...f.days, d] }));

  // ---------- Filtered tasks ----------
  const search = filter.trim().toLowerCase();
  const matchesSearch = (s: string) => !search || s.toLowerCase().includes(search);

  const visibleClasses = state.timetable.filter(e => matchesSearch(e.subject));
  const scheduledTasks = state.tasks.filter(t =>
    t.deadline && matchesSearch(t.title + ' ' + (t.subject || ''))
  );
  const unscheduledTasks = state.tasks.filter(t =>
    !t.deadline && matchesSearch(t.title + ' ' + (t.subject || ''))
  );

  // ---------- Navigation ----------
  const prev = () => setAnchor(view === 'week' ? subWeeks(anchor, 1) : subMonths(anchor, 1));
  const next = () => setAnchor(view === 'week' ? addWeeks(anchor, 1) : addMonths(anchor, 1));
  const goToday = () => setAnchor(new Date());

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold">Timetable 📅</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {view === 'week'
              ? `Week of ${format(startOfWeek(anchor, { weekStartsOn: 1 }), 'MMM d, yyyy')}`
              : format(anchor, 'MMMM yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            placeholder="Search classes & tasks…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="w-56"
          />
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Class</Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prev}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
          <Button variant="outline" size="icon" onClick={next}><ChevronRight className="h-4 w-4" /></Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarDays className="h-4 w-4" /> Jump to date
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={anchor}
                onSelect={d => d && setAnchor(d)}
                initialFocus
                className={cn('p-3 pointer-events-auto')}
              />
            </PopoverContent>
          </Popover>
        </div>

        <Tabs value={view} onValueChange={v => setView(v as 'week' | 'month')}>
          <TabsList>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {view === 'week' ? (
        <WeekView
          anchor={anchor}
          classes={visibleClasses}
          tasks={scheduledTasks}
          onEditClass={openEdit}
          onToggleTask={(id) => toggleTask(id)}
        />
      ) : (
        <MonthView
          anchor={anchor}
          classes={visibleClasses}
          tasks={scheduledTasks}
          onJumpDay={(d) => { setAnchor(d); setView('week'); }}
        />
      )}

      {/* Unscheduled */}
      <div className="glass-card p-5">
        <h2 className="font-display font-bold text-lg mb-3">Unscheduled</h2>
        {unscheduledTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">All your tasks are scheduled. 🎉</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {unscheduledTasks.map(t => (
              <div
                key={t.id}
                className={cn(
                  'flex items-center gap-2 p-3 rounded-lg border border-border bg-card/50 hover:bg-card transition-colors',
                  t.completed && 'opacity-50'
                )}
              >
                <button onClick={() => toggleTask(t.id)}>
                  {t.completed
                    ? <CheckCircle2 className="h-5 w-5 text-primary" />
                    : <Circle className="h-5 w-5 text-muted-foreground" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium truncate', t.completed && 'line-through')}>{t.title}</p>
                  {t.subject && (
                    <p className="text-xs text-muted-foreground truncate">{t.subject}</p>
                  )}
                </div>
                <span className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full uppercase font-semibold tracking-wide',
                  t.priority === 'hard' && 'bg-destructive/15 text-destructive',
                  t.priority === 'medium' && 'bg-medium/15 text-medium',
                  t.priority === 'easy' && 'bg-easy/15 text-easy',
                )}>
                  {t.priority}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Class create/edit dialog */}
      <Dialog open={classDialogOpen} onOpenChange={setClassDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              {form.id ? 'Edit Class' : 'Add Class'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              placeholder="Class name (e.g. Maths, Biology…)"
              value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              autoFocus
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Teacher (optional)"
                value={form.teacher}
                onChange={e => setForm(f => ({ ...f, teacher: e.target.value }))}
              />
              <Input
                placeholder="Room (optional)"
                value={form.room}
                onChange={e => setForm(f => ({ ...f, room: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-2 block font-medium">Repeats on</label>
              <div className="flex flex-wrap gap-1.5">
                {DAY_LABELS.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
                      form.days.includes(i)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted text-muted-foreground border-transparent hover:bg-secondary'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-2 block font-medium">Colour</label>
              <div className="flex flex-wrap gap-2 items-center">
                {COLOUR_PALETTE.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, colour: c }))}
                    className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: 'transparent',
                      outline: form.colour === c ? `3px solid ${c}` : 'none',
                      outlineOffset: '2px',
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={form.colour}
                  onChange={e => setForm(f => ({ ...f, colour: e.target.value }))}
                  className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent ml-1"
                  title="Custom colour"
                />
              </div>
            </div>

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

            <div className="flex gap-2 pt-2">
              {form.id && (
                <Button variant="destructive" onClick={deleteClass} className="mr-auto">
                  Delete
                </Button>
              )}
              <Button variant="ghost" onClick={() => setClassDialogOpen(false)} className="ml-auto">
                Cancel
              </Button>
              <Button
                onClick={saveClass}
                disabled={!form.subject.trim() || form.days.length === 0 || minutesFromHHMM(form.endTime) <= minutesFromHHMM(form.startTime)}
              >
                {form.id ? 'Save' : 'Add Class'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============== Week View ===============
function WeekView({
  anchor, classes, tasks, onEditClass, onToggleTask,
}: {
  anchor: Date;
  classes: TimetableEntry[];
  tasks: Task[];
  onEditClass: (e: TimetableEntry) => void;
  onToggleTask: (id: string) => void;
}) {
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const now = new Date();
  const todayIdx = isSameDay(weekStart, startOfWeek(now, { weekStartsOn: 1 })) ? dayIndexFromDate(now) : -1;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startBaseMin = HOURS[0] * 60;

  return (
    <div className="glass-card overflow-x-auto">
      <div className="min-w-[760px]">
        {/* Header */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border">
          <div className="p-2 text-xs text-muted-foreground font-medium">Time</div>
          {days.map((d, i) => {
            const today = isToday(d);
            return (
              <div key={i} className={cn('p-2 text-center', today && 'bg-primary/5')}>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{DAY_LABELS[i]}</div>
                <div className={cn(
                  'mt-0.5 inline-flex items-center justify-center text-sm font-display font-bold w-7 h-7 rounded-full',
                  today && 'bg-primary text-primary-foreground'
                )}>
                  {format(d, 'd')}
                </div>
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div className="relative grid grid-cols-[60px_repeat(7,1fr)]">
          {/* Hour rows */}
          <div className="col-start-1 col-end-2">
            {HOURS.map(h => (
              <div key={h} style={{ height: HOUR_HEIGHT }} className="px-2 pt-1 text-[10px] text-muted-foreground border-b border-border/40">
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>
          {days.map((d, dayIdx) => (
            <div key={dayIdx} className="relative border-l border-border/40">
              {HOURS.map(h => (
                <div key={h} style={{ height: HOUR_HEIGHT }} className="border-b border-border/40" />
              ))}

              {/* Now line */}
              {todayIdx === dayIdx && nowMin >= startBaseMin && nowMin <= (HOURS[HOURS.length - 1] + 1) * 60 && (
                <div
                  className="absolute left-0 right-0 h-0.5 bg-destructive z-20 pointer-events-none"
                  style={{ top: ((nowMin - startBaseMin) / 60) * HOUR_HEIGHT }}
                >
                  <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-destructive" />
                </div>
              )}

              {/* Class blocks */}
              {classes.filter(c => classOnDay(c, dayIdx)).map(c => {
                const s = minutesFromHHMM(c.startTime);
                const e = minutesFromHHMM(c.endTime);
                const top = ((s - startBaseMin) / 60) * HOUR_HEIGHT;
                const height = ((e - s) / 60) * HOUR_HEIGHT - 2;
                if (e <= startBaseMin || s >= (HOURS[HOURS.length - 1] + 1) * 60) return null;
                return (
                  <motion.button
                    key={c.id + '-' + dayIdx}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => onEditClass(c)}
                    className="absolute left-0.5 right-0.5 rounded-lg p-1.5 text-left text-white text-[11px] overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                    style={{ top, height: Math.max(20, height), backgroundColor: getBlockColour(c) }}
                  >
                    <div className="flex items-start gap-1">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold leading-tight truncate">{c.subject}</div>
                        <div className="opacity-85 text-[10px]">{c.startTime}–{c.endTime}</div>
                        {c.room && <div className="opacity-85 text-[10px] truncate">📍 {c.room}</div>}
                      </div>
                      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-80 shrink-0" />
                    </div>
                  </motion.button>
                );
              })}

              {/* Task deadlines */}
              {tasks.filter(t => {
                const td = new Date(t.deadline!);
                return isSameDay(td, d);
              }).map(t => {
                const td = new Date(t.deadline!);
                const m = td.getHours() * 60 + td.getMinutes();
                const top = ((m - startBaseMin) / 60) * HOUR_HEIGHT;
                const overdue = !t.completed && td.getTime() < now.getTime();
                return (
                  <motion.button
                    key={'task-' + t.id}
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => onToggleTask(t.id)}
                    className={cn(
                      'absolute left-0.5 right-0.5 rounded-md px-1.5 py-1 text-[11px] z-10 text-left flex items-center gap-1 backdrop-blur-sm',
                      'border-l-4 shadow-sm hover:shadow-md transition-shadow',
                      t.completed && 'opacity-50 line-through',
                      overdue
                        ? 'bg-destructive/20 border-destructive text-destructive-foreground'
                        : 'bg-primary/20 border-primary text-foreground'
                    )}
                    style={{ top: Math.max(0, top - 10), minHeight: 22 }}
                  >
                    {t.completed
                      ? <CheckCircle2 className="h-3 w-3 shrink-0" />
                      : <Circle className="h-3 w-3 shrink-0" />}
                    <span className="truncate font-medium">{t.title}</span>
                  </motion.button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============== Month View ===============
function MonthView({
  anchor, classes, tasks, onJumpDay,
}: {
  anchor: Date;
  classes: TimetableEntry[];
  tasks: Task[];
  onJumpDay: (d: Date) => void;
}) {
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const cells: Date[] = [];
  let cur = gridStart;
  while (cur <= monthEnd || cells.length % 7 !== 0) {
    cells.push(cur);
    cur = addDays(cur, 1);
    if (cells.length > 42) break;
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border">
        {DAY_LABELS.map(d => (
          <div key={d} className="p-2 text-center text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const dayIdx = dayIndexFromDate(d);
          const inMonth = isSameMonth(d, anchor);
          const today = isToday(d);
          const dayClasses = classes.filter(c => classOnDay(c, dayIdx));
          const dayTasks = tasks.filter(t => isSameDay(new Date(t.deadline!), d));
          return (
            <button
              key={i}
              onClick={() => onJumpDay(d)}
              className={cn(
                'min-h-[100px] border-b border-r border-border/40 p-1.5 text-left hover:bg-muted/40 transition-colors',
                !inMonth && 'opacity-40',
                today && 'bg-primary/5'
              )}
            >
              <div className={cn(
                'inline-flex items-center justify-center text-xs font-bold w-6 h-6 rounded-full mb-1',
                today && 'bg-primary text-primary-foreground'
              )}>
                {format(d, 'd')}
              </div>
              <div className="space-y-0.5">
                {dayClasses.slice(0, 2).map(c => (
                  <div
                    key={c.id}
                    className="text-[10px] px-1 py-0.5 rounded text-white truncate"
                    style={{ backgroundColor: getBlockColour(c) }}
                  >
                    {c.startTime} {c.subject}
                  </div>
                ))}
                {dayTasks.slice(0, 2).map(t => (
                  <div
                    key={t.id}
                    className={cn(
                      'text-[10px] px-1 py-0.5 rounded truncate border-l-2',
                      t.completed
                        ? 'border-muted text-muted-foreground line-through'
                        : 'border-primary text-foreground bg-primary/10'
                    )}
                  >
                    📝 {t.title}
                  </div>
                ))}
                {(dayClasses.length + dayTasks.length) > 4 && (
                  <div className="text-[9px] text-muted-foreground">+{dayClasses.length + dayTasks.length - 4} more</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}