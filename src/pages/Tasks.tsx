import { useState, useMemo, useEffect } from 'react';
import { useGame, type Task, type Priority } from '@/context/GameContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, CheckCircle2, Circle, CalendarIcon, X, Pencil, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { getSavedSubjects, setSavedSubjects as persistSavedSubjects, subscribeSavedSubjects } from '@/lib/userPrefs';

const PRIORITY_CONFIG: Record<Priority, { label: string; class: string; xp: number; weight: number; dot: string }> = {
  easy:   { label: 'Low',    class: 'bg-easy/15 text-easy border-easy/30',       xp: 10, weight: 1, dot: 'bg-easy' },
  medium: { label: 'Medium', class: 'bg-medium/15 text-medium border-medium/30', xp: 25, weight: 2, dot: 'bg-medium' },
  hard:   { label: 'High',   class: 'bg-hard/15 text-hard border-hard/30',       xp: 50, weight: 3, dot: 'bg-hard' },
};

function getDeadlineStatus(deadline?: string, completed?: boolean) {
  if (!deadline || completed) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff < 0) return 'overdue';
  if (diff < 24 * 60 * 60 * 1000) return 'urgent';
  return 'normal';
}

function formatDeadline(deadline: string) {
  return format(new Date(deadline), "EEE d MMM, h:mm a");
}

interface FormState {
  title: string;
  description: string;
  priority: Priority;
  subject: string;
  tagsInput: string;
  deadlineDate: Date | undefined;
  deadlineTime: string;
}

const emptyForm = (): FormState => ({
  title: '', description: '', priority: 'medium', subject: '',
  tagsInput: '', deadlineDate: undefined, deadlineTime: '23:59',
});

export default function Tasks() {
  const { state, dispatch, toggleTask } = useGame();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'overdue'>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all');

  const [savedSubjects, setSavedSubjects] = useState<string[]>(() => getSavedSubjects());
  useEffect(() => subscribeSavedSubjects(() => setSavedSubjects(getSavedSubjects())), []);
  useEffect(() => {
    const remote = getSavedSubjects();
    if (remote.length !== savedSubjects.length || remote.some((s, i) => s !== savedSubjects[i])) {
      persistSavedSubjects(savedSubjects);
    }
  }, [savedSubjects]);

  const persistSubject = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSavedSubjects(prev =>
      prev.some(s => s.toLowerCase() === trimmed.toLowerCase()) ? prev : [...prev, trimmed]
    );
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setEditorOpen(true);
  };

  const openEdit = (t: Task) => {
    setEditingId(t.id);
    const d = t.deadline ? new Date(t.deadline) : undefined;
    setForm({
      title: t.title,
      description: t.description || '',
      priority: t.priority,
      subject: t.subject || '',
      tagsInput: (t.tags || []).join(', '),
      deadlineDate: d,
      deadlineTime: d ? format(d, 'HH:mm') : '23:59',
    });
    setEditorOpen(true);
  };

  const saveTask = () => {
    if (!form.title.trim()) return;
    let deadline: string | undefined;
    if (form.deadlineDate) {
      const [h, m] = form.deadlineTime.split(':').map(Number);
      const d = new Date(form.deadlineDate);
      d.setHours(h, m, 0, 0);
      deadline = d.toISOString();
    }
    const subjectName = form.subject.trim();
    if (subjectName) persistSubject(subjectName);
    const tags = form.tagsInput.split(',').map(s => s.trim()).filter(Boolean);

    if (editingId) {
      const existing = state.tasks.find(t => t.id === editingId);
      if (!existing) return;
      dispatch({
        type: 'UPDATE_TASK',
        task: {
          ...existing,
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          priority: form.priority,
          subject: subjectName || undefined,
          subjectColor: subjectName ? 'other' : undefined,
          tags,
          deadline,
        },
      });
    } else {
      const task: Task = {
        id: crypto.randomUUID(),
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        completed: false,
        priority: form.priority,
        subject: subjectName || undefined,
        subjectColor: subjectName ? 'other' : undefined,
        tags,
        deadline,
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: 'ADD_TASK', task });
    }
    setEditorOpen(false);
    setForm(emptyForm());
    setEditingId(null);
  };

  const allSubjects = useMemo(() => {
    const s = new Set<string>();
    state.tasks.forEach(t => t.subject && s.add(t.subject));
    savedSubjects.forEach(x => s.add(x));
    return Array.from(s).sort();
  }, [state.tasks, savedSubjects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    let list = state.tasks.filter(t => {
      if (q) {
        const hay = (t.title + ' ' + (t.subject || '') + ' ' + (t.description || '') + ' ' + (t.tags || []).join(' ')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter === 'active' && t.completed) return false;
      if (statusFilter === 'completed' && !t.completed) return false;
      if (statusFilter === 'overdue' && (t.completed || !t.deadline || new Date(t.deadline).getTime() >= now)) return false;
      if (subjectFilter !== 'all' && t.subject !== subjectFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const aT = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const bT = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      if (aT !== bT) return aT - bT;
      return PRIORITY_CONFIG[b.priority].weight - PRIORITY_CONFIG[a.priority].weight;
    });
    return list;
  }, [state.tasks, search, statusFilter, subjectFilter, priorityFilter]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold">Tasks ✅</h1>
          <p className="text-muted-foreground text-sm mt-1">Plan, prioritise and crush your assignments.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />New Task</Button>
      </div>

      {/* Toolbar */}
      <div className="glass-card p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={v => setPriorityFilter(v as any)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="hard">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="easy">Low</SelectItem>
          </SelectContent>
        </Select>
        {allSubjects.length > 0 && (
          <Select value={subjectFilter} onValueChange={setSubjectFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Subject" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subjects</SelectItem>
              {allSubjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Task list */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {filtered.map(task => {
            const dlStatus = getDeadlineStatus(task.deadline, task.completed);
            return (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -60 }}
                className={cn(
                  'glass-card p-4 flex items-start gap-3 group transition-all',
                  task.completed && 'opacity-60',
                  dlStatus === 'overdue' && 'ring-1 ring-destructive/50'
                )}
              >
                <button
                  onClick={() => toggleTask(task.id)}
                  className="shrink-0 mt-0.5"
                  aria-label="Toggle complete"
                >
                  {task.completed
                    ? <CheckCircle2 className="h-6 w-6 text-primary" />
                    : <Circle className="h-6 w-6 text-muted-foreground hover:text-primary transition-colors" />}
                </button>

                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEdit(task)}>
                  <div className="flex items-start gap-2">
                    <span className={cn('w-1.5 h-1.5 rounded-full mt-2 shrink-0', PRIORITY_CONFIG[task.priority].dot)} />
                    <p className={cn('font-medium leading-snug', task.completed && 'line-through text-muted-foreground')}>
                      {task.title}
                    </p>
                  </div>
                  {task.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 ml-3.5">{task.description}</p>
                  )}
                  <div className="flex gap-1.5 mt-2 flex-wrap items-center ml-3.5">
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wide', PRIORITY_CONFIG[task.priority].class)}>
                      {PRIORITY_CONFIG[task.priority].label}
                    </span>
                    {task.subject && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                        {task.subject}
                      </span>
                    )}
                    {task.deadline && (
                      <span className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full font-medium',
                        dlStatus === 'overdue' && 'bg-destructive/15 text-destructive',
                        dlStatus === 'urgent' && 'bg-medium/15 text-medium',
                        dlStatus === 'normal' && 'bg-muted text-muted-foreground',
                        task.completed && 'bg-muted text-muted-foreground',
                      )}>
                        🗓 {formatDeadline(task.deadline)}
                      </span>
                    )}
                    {(task.tags || []).map(tag => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {!task.completed && (
                    <span className="text-xs text-muted-foreground font-medium hidden sm:inline">+{PRIORITY_CONFIG[task.priority].xp} XP</span>
                  )}
                  <button
                    onClick={() => openEdit(task)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-muted"
                    aria-label="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => dispatch({ type: 'DELETE_TASK', taskId: task.id })}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-destructive/10"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-4xl mb-2">📝</p>
            <p>No tasks match your filters.</p>
          </div>
        )}
      </div>

      {/* Editor dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">{editingId ? 'Edit Task' : 'New Task'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input
              placeholder="Task name"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              autoFocus
            />
            <Textarea
              placeholder="Notes / description (optional)"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Priority</label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as Priority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hard">High (+50 XP)</SelectItem>
                    <SelectItem value="medium">Medium (+25 XP)</SelectItem>
                    <SelectItem value="easy">Low (+10 XP)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Subject / Class</label>
                <Input
                  placeholder="e.g. Maths"
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  list="task-subjects-list"
                />
                <datalist id="task-subjects-list">
                  {allSubjects.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Deadline date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !form.deadlineDate && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.deadlineDate ? format(form.deadlineDate, 'MMM d, yyyy') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.deadlineDate}
                      onSelect={d => setForm(f => ({ ...f, deadlineDate: d }))}
                      initialFocus
                      className={cn('p-3 pointer-events-auto')}
                    />
                    {form.deadlineDate && (
                      <div className="px-3 pb-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => setForm(f => ({ ...f, deadlineDate: undefined }))}
                        >
                          Clear deadline
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Deadline time</label>
                <Input
                  type="time"
                  value={form.deadlineTime}
                  onChange={e => setForm(f => ({ ...f, deadlineTime: e.target.value }))}
                  disabled={!form.deadlineDate}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tags (comma-separated, optional)</label>
              <Input
                placeholder="e.g. exam, group-project"
                value={form.tagsInput}
                onChange={e => setForm(f => ({ ...f, tagsInput: e.target.value }))}
              />
            </div>

            {editingId && (
              <div className="flex items-center justify-between pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const t = state.tasks.find(x => x.id === editingId);
                    if (t) toggleTask(t.id);
                  }}
                >
                  {state.tasks.find(t => t.id === editingId)?.completed ? 'Mark incomplete' : 'Mark complete'}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    dispatch({ type: 'DELETE_TASK', taskId: editingId });
                    setEditorOpen(false);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                </Button>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="ghost" onClick={() => setEditorOpen(false)} className="ml-auto">Cancel</Button>
              <Button onClick={saveTask} disabled={!form.title.trim()}>
                {editingId ? 'Save' : 'Add Task'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}