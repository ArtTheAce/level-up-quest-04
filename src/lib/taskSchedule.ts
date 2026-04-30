// Frontend-only helpers to treat task deadlines as scheduled blocks
// on the timetable, plus conflict detection.

import type { Task, TimetableEntry } from '@/context/GameContext';
import {
  getTaskDuration,
  setTaskDuration,
  clearTaskDuration,
  subscribeTaskDurations,
} from './userPrefs';

export {
  getTaskDuration,
  setTaskDuration,
  clearTaskDuration,
  subscribeTaskDurations,
};

// ---------- Time helpers ----------

// Convert a JS Date to a "weekday index" matching the timetable (Mon=0..Sun=6).
export function dayIndexFromDate(d: Date): number {
  // JS: Sun=0..Sat=6  →  Mon=0..Sun=6
  return (d.getDay() + 6) % 7;
}

export function minutesFromHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function hhmmFromMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Compute the scheduled window for a task (if it has a deadline).
// Treats deadline as the START time of the work block.
export function getTaskWindow(task: Task): {
  day: number;
  startMinutes: number;
  endMinutes: number;
  startHHMM: string;
  endHHMM: string;
} | null {
  if (!task.deadline) return null;
  const d = new Date(task.deadline);
  if (Number.isNaN(d.getTime())) return null;
  const day = dayIndexFromDate(d);
  const startMinutes = d.getHours() * 60 + d.getMinutes();
  const dur = getTaskDuration(task.id);
  const endMinutes = Math.min(24 * 60, startMinutes + dur);
  return {
    day,
    startMinutes,
    endMinutes,
    startHHMM: hhmmFromMinutes(startMinutes),
    endHHMM: hhmmFromMinutes(endMinutes),
  };
}

export interface Conflict {
  kind: 'class' | 'task';
  label: string;
  startHHMM: string;
  endHHMM: string;
  day: number;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function dayName(day: number): string {
  return DAY_NAMES[day] ?? '?';
}

// Find conflicts for a candidate window against existing classes & scheduled tasks.
// Pass excludeTaskId to ignore the task being edited.
export function findConflicts(
  candidate: { day: number; startMinutes: number; endMinutes: number },
  classes: TimetableEntry[],
  tasks: Task[],
  excludeTaskId?: string
): Conflict[] {
  const conflicts: Conflict[] = [];
  const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
    aStart < bEnd && bStart < aEnd;

  for (const e of classes) {
    if (e.day !== candidate.day) continue;
    const s = minutesFromHHMM(e.startTime);
    const en = minutesFromHHMM(e.endTime);
    if (overlaps(candidate.startMinutes, candidate.endMinutes, s, en)) {
      conflicts.push({
        kind: 'class',
        label: e.subject,
        day: e.day,
        startHHMM: e.startTime,
        endHHMM: e.endTime,
      });
    }
  }

  for (const t of tasks) {
    if (t.id === excludeTaskId) continue;
    if (t.completed) continue;
    const w = getTaskWindow(t);
    if (!w) continue;
    if (w.day !== candidate.day) continue;
    if (overlaps(candidate.startMinutes, candidate.endMinutes, w.startMinutes, w.endMinutes)) {
      conflicts.push({
        kind: 'task',
        label: t.title,
        day: w.day,
        startHHMM: w.startHHMM,
        endHHMM: w.endHHMM,
      });
    }
  }

  return conflicts;
}
