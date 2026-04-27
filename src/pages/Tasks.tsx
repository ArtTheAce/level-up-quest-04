import { useState, useEffect } from 'react';
import { useGame, type Task, type Priority, type SubjectColor } from '@/context/GameContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, CheckCircle2, Circle, ArrowUpDown, CalendarIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ReminderPicker } from '@/components/ReminderPicker';
import { setTaskLink, getLinkedEntryId, subscribeTaskLinks } from '@/lib/taskLinks';
import { Link2, Link2Off } from 'lucide-react';

const SAVED_SUBJECTS_KEY = 'questify.savedSubjects';

function loadSavedSubjects(): string[] {
  try {
    const raw = localStorage.getItem(SAVED_SUBJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

const PRIORITY_CONFIG: Record<Priority, { label: string; class: string; xp: number; weight: number }> = {
  easy: { label: 'Easy', class: 'bg-easy/15 text-easy border-easy/30', xp: 10, weight: 1 },
  medium: { label: 'Medium', class: 'bg-medium/15 text-medium border-medium/30', xp: 25, weight: 2 },
  hard: { label: 'Hard', class: 'bg-hard/15 text-hard border-hard/30', xp: 50, weight: 3 },
};

function getDeadlineStatus(deadline?: string) {
  if (!deadline) return null;
  const now = new Date();
  const dl = new Date(deadline);
  const diff = dl.getTime() - now.getTime();
  if (diff < 0) return 'overdue';
  if (diff < 24 * 60 * 60 * 1000) return 'urgent';
  return 'normal';
}

function formatDeadline(deadline: string) {
  const d = new Date(deadline);
  return format(d, "EEE d MMM, h:mma").toLowerCase();
}

export default function Tasks() {
  const { state, dispatch } = useGame();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [subject, setSubject] = useState<string>('');
  const [savedSubjects, setSavedSubjects] = useState<string[]>(() => loadSavedSubjects());
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [deadlineDate, setDeadlineDate] = useState<Date | undefined>();
  const [deadlineTime, setDeadlineTime] = useState('23:59');
  const [sorted, setSorted] = useState(false);
  const [linkEntryId, setLinkEntryId] = useState<string>('');
  const [linkTick, setLinkTick] = useState(0);

  useEffect(() => subscribeTaskLinks(() => setLinkTick((t) => t + 1)), []);

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_SUBJECTS_KEY, JSON.stringify(savedSubjects));
    } catch {
      // ignore
    }
  }, [savedSubjects]);

  const persistSubject = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSavedSubjects((prev) =>
      prev.some((s) => s.toLowerCase() === trimmed.toLowerCase()) ? prev : [...prev, trimmed]
    );
  };

  const removeSavedSubject = (name: string) => {
    setSavedSubjects((prev) => prev.filter((s) => s !== name));
    if (subject === name) setSubject('');
  };

  const addTask = () => {
    if (!title.trim()) return;
    let deadline: string | undefined;
    if (deadlineDate) {
      const [h, m] = deadlineTime.split(':').map(Number);
      const d = new Date(deadlineDate);
      d.setHours(h, m, 0, 0);
      deadline = d.toISOString();
    }
    const subjectName = subject.trim();
    if (subjectName) persistSubject(subjectName);
    const newId = crypto.randomUUID();
    const task: Task = {
      id: newId,
      title: title.trim(),
      completed: false,
      priority,
      subject: subjectName || undefined,
      subjectColor: subjectName ? 'other' : undefined,
      deadline,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_TASK', task });
    if (linkEntryId) setTaskLink(newId, linkEntryId);
    setTitle('');
    setDeadlineDate(undefined);
    setDeadlineTime('23:59');
    setSubject('');
    setLinkEntryId('');
  };

  let filtered = state.tasks.filter(t => {
    if (filter === 'active') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  if (sorted) {
    filtered = [...filtered].sort((a, b) => {
      // Completed always last
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      // Sort by deadline (soonest first), no-deadline last
      const aTime = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const bTime = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      if (aTime !== bTime) return aTime - bTime;
      // Tiebreaker: highest difficulty first
      return PRIORITY_CONFIG[b.priority].weight - PRIORITY_CONFIG[a.priority].weight;
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">Tasks ✅</h1>
        <p className="text-muted-foreground text-sm mt-1">Complete tasks to earn XP and coins!</p>
      </div>

      {/* Add Task Form */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="What needs to be done?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTask()}
            className="flex-1"
          />
          <Button onClick={addTask} size="icon" className="shrink-0">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>{cfg.label} (+{cfg.xp} XP)</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Subject (optional)"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onBlur={() => subject.trim() && persistSubject(subject)}
            className="w-40"
            list="saved-subjects"
          />
          <datalist id="saved-subjects">
            {savedSubjects.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-44 justify-start text-left font-normal", !deadlineDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {deadlineDate ? format(deadlineDate, "MMM d, yyyy") : "Deadline"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={deadlineDate}
                onSelect={setDeadlineDate}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
              <div className="px-3 pb-3">
                <label className="text-xs text-muted-foreground mb-1 block">Time</label>
                <Input
                  type="time"
                  value={deadlineTime}
                  onChange={e => setDeadlineTime(e.target.value)}
                  className="w-full"
                />
              </div>
            </PopoverContent>
          </Popover>
          {deadlineDate && (
            <Button variant="ghost" size="sm" onClick={() => { setDeadlineDate(undefined); setDeadlineTime('23:59'); }} className="text-muted-foreground">
              Clear
            </Button>
          )}
          {state.timetable.length > 0 && (
            <Select value={linkEntryId || 'none'} onValueChange={(v) => setLinkEntryId(v === 'none' ? '' : v)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Link to class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No class</SelectItem>
                {state.timetable.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.subject} · {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][e.day]} {e.startTime}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {savedSubjects.length > 0 && (
          <div className="flex gap-1.5 flex-wrap pt-1">
            <span className="text-xs text-muted-foreground self-center mr-1">Saved:</span>
            {savedSubjects.map((s) => (
              <span
                key={s}
                className={cn(
                  'group/chip inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border cursor-pointer transition-colors',
                  subject === s
                    ? 'bg-primary/15 text-primary border-primary/30'
                    : 'bg-muted text-muted-foreground border-transparent hover:bg-secondary'
                )}
                onClick={() => setSubject(s)}
              >
                {s}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeSavedSubject(s); }}
                  className="opacity-50 hover:opacity-100"
                  aria-label={`Remove ${s}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Filter + Auto-sort */}
      <div className="flex gap-2 items-center">
        {(['all', 'active', 'completed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-secondary'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <Button
          variant={sorted ? 'default' : 'outline'}
          size="sm"
          className="ml-auto"
          onClick={() => setSorted(!sorted)}
        >
          <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
          Auto-sort
        </Button>
      </div>

      {/* Task List */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {filtered.map(task => {
            const dlStatus = getDeadlineStatus(task.deadline);
            const linkedId = getLinkedEntryId(task.id);
            const linkedEntry = linkedId ? state.timetable.find((e) => e.id === linkedId) : undefined;
            void linkTick;
            return (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                className={`glass-card p-4 flex items-center gap-3 group ${task.completed ? 'opacity-60' : ''}`}
              >
                <button
                  onClick={() => dispatch({ type: 'TOGGLE_TASK', taskId: task.id })}
                  className="shrink-0"
                >
                  {task.completed ? (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
                      <CheckCircle2 className="h-6 w-6 text-primary" />
                    </motion.div>
                  ) : (
                    <Circle className="h-6 w-6 text-muted-foreground hover:text-primary transition-colors" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <p className={`font-medium ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                    {task.title}
                  </p>
                  <div className="flex gap-2 mt-1 flex-wrap items-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${PRIORITY_CONFIG[task.priority].class}`}>
                      {PRIORITY_CONFIG[task.priority].label}
                    </span>
                    {task.subject && (
                      <span className={`text-xs px-2 py-0.5 rounded-full bg-subject-${task.subjectColor}/15 text-subject-${task.subjectColor}`}>
                        {task.subject}
                      </span>
                    )}
                    {task.deadline && !task.completed && (
                      <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        dlStatus === 'overdue' ? 'bg-destructive/15 text-destructive' :
                        dlStatus === 'urgent' ? 'bg-medium/15 text-medium' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        🗓️ Due: {formatDeadline(task.deadline)}
                      </span>
                    )}
                    {task.deadline && !task.completed && (
                      <ReminderPicker itemId={task.id} kind="task" />
                    )}
                    {linkedEntry && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary inline-flex items-center gap-1">
                        <Link2 className="h-3 w-3" />
                        {linkedEntry.subject}
                        <button
                          onClick={() => setTaskLink(task.id, null)}
                          className="ml-0.5 opacity-60 hover:opacity-100"
                          aria-label="Unlink"
                        >
                          <Link2Off className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    {!linkedEntry && state.timetable.length > 0 && !task.completed && (
                      <Select
                        value=""
                        onValueChange={(v) => v && setTaskLink(task.id, v)}
                      >
                        <SelectTrigger className="h-6 w-auto px-2 py-0 text-xs border-dashed gap-1">
                          <Link2 className="h-3 w-3" />
                          <span>Link class</span>
                        </SelectTrigger>
                        <SelectContent>
                          {state.timetable.map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.subject} · {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][e.day]} {e.startTime}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                {!task.completed && (
                  <span className="text-xs text-muted-foreground font-medium">+{PRIORITY_CONFIG[task.priority].xp} XP</span>
                )}

                <button
                  onClick={() => dispatch({ type: 'DELETE_TASK', taskId: task.id })}
                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-4xl mb-2">📝</p>
            <p>{filter === 'all' ? 'No tasks yet. Add one above!' : `No ${filter} tasks.`}</p>
          </div>
        )}
      </div>
    </div>
  );
}
