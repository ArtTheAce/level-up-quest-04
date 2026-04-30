import { useEffect, useRef, useState } from 'react';
import { useGame } from '@/context/GameContext';
import {
  loadSettings,
  loadOverrides,
  getItemLeads,
  playBeep,
  type NotificationSettings,
} from '@/lib/notificationSettings';
import { toast } from 'sonner';

interface ScheduledFire {
  key: string; // unique fire key (itemId+lead+occurrence)
  fireAt: number;
  itemType: 'task' | 'class';
  itemId: string;
  title: string;
  body: string;
  leadMin: number;
}

const FIRED_KEY = 'questify.notif.fired.v1';
const SNOOZE_KEY = 'questify.notif.snooze.v1';

function loadFired(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(FIRED_KEY) || '{}'); } catch { return {}; }
}
function markFired(key: string) {
  const all = loadFired();
  all[key] = Date.now();
  // Prune entries older than 7 days
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const k of Object.keys(all)) if (all[k] < cutoff) delete all[k];
  localStorage.setItem(FIRED_KEY, JSON.stringify(all));
}

function loadSnoozes(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(SNOOZE_KEY) || '{}'); } catch { return {}; }
}
function setSnooze(key: string, until: number) {
  const all = loadSnoozes();
  all[key] = until;
  localStorage.setItem(SNOOZE_KEY, JSON.stringify(all));
}

function nextOccurrenceOfDay(day: number, hhmm: string): Date {
  // day: 0=Mon..6=Sun
  const [h, m] = hhmm.split(':').map(Number);
  const now = new Date();
  const jsDow = now.getDay(); // 0=Sun..6=Sat
  const todayMon = (jsDow + 6) % 7; // 0=Mon
  let diff = day - todayMon;
  const candidate = new Date(now);
  candidate.setDate(now.getDate() + diff);
  candidate.setHours(h, m, 0, 0);
  if (candidate.getTime() <= now.getTime()) {
    candidate.setDate(candidate.getDate() + 7);
  }
  return candidate;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function NotificationScheduler() {
  const { state } = useGame();
  const [settings, setSettings] = useState<NotificationSettings>(loadSettings());
  const [tick, setTick] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const onChange = () => setSettings(loadSettings());
    window.addEventListener('questify:notif-settings', onChange);
    window.addEventListener('questify:notif-overrides', onChange);
    return () => {
      window.removeEventListener('questify:notif-settings', onChange);
      window.removeEventListener('questify:notif-overrides', onChange);
    };
  }, []);

  // Re-evaluate scheduler every 5 minutes so items entering the 24h window get scheduled.
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    // Clear existing timers
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    if (!settings.enabled || !state.loaded) return;

    const now = Date.now();
    const horizon = now + 24 * 60 * 60 * 1000; // schedule next 24h
    const fired = loadFired();
    const snoozes = loadSnoozes();
    const fires: ScheduledFire[] = [];

    // Tasks
    for (const t of state.tasks) {
      if (t.completed || !t.deadline) continue;
      const dl = new Date(t.deadline).getTime();
      const leads = getItemLeads(t.id, settings.taskLeads);
      if (!leads) continue;
      for (const lead of leads) {
        const fireAt = dl - lead * 60 * 1000;
        if (fireAt < now - 60_000 || fireAt > horizon) continue;
        const key = `task:${t.id}:${lead}`;
        if (fired[key]) continue;
        fires.push({
          key, fireAt, itemType: 'task', itemId: t.id,
          title: `⏰ Task due ${lead < 60 ? `in ${lead} min` : lead < 1440 ? `in ${Math.round(lead/60)}h` : `in ${Math.round(lead/1440)}d`}`,
          body: t.title,
          leadMin: lead,
        });
      }
      // Overdue once
      if (dl > now - 60_000 && dl <= horizon) {
        const key = `task:${t.id}:0`;
        if (!fired[key]) {
          fires.push({
            key, fireAt: dl, itemType: 'task', itemId: t.id,
            title: '🚨 Task due now',
            body: t.title,
            leadMin: 0,
          });
        }
      }
    }

    // Timetable classes (recurring)
    for (const e of state.timetable) {
      const start = nextOccurrenceOfDay(e.day, e.startTime);
      const lead = (() => {
        const o = getItemLeads(e.id, [settings.classLead]);
        return o;
      })();
      if (!lead) continue;
      for (const l of lead) {
        const fireAt = start.getTime() - l * 60 * 1000;
        if (fireAt < now - 60_000 || fireAt > horizon) continue;
        const dateTag = start.toISOString().slice(0, 10);
        const key = `class:${e.id}:${l}:${dateTag}`;
        if (fired[key]) continue;
        fires.push({
          key, fireAt, itemType: 'class', itemId: e.id,
          title: `📚 ${e.subject} starts in ${l} min`,
          body: `${DAY_NAMES[e.day]} ${e.startTime}–${e.endTime}`,
          leadMin: l,
        });
      }
    }

    // Apply snoozes
    for (const f of fires) {
      const sn = snoozes[f.key];
      if (sn && sn > now) f.fireAt = sn;
    }

    // Schedule
    for (const f of fires) {
      const delay = Math.max(0, f.fireAt - Date.now());
      if (delay > 2_147_000_000) continue; // setTimeout max
      const t = setTimeout(() => fireNotification(f, settings), delay);
      timersRef.current.push(t);
    }

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [state.tasks, state.timetable, state.loaded, settings, tick]);

  return null;
}

function fireNotification(f: ScheduledFire, settings: NotificationSettings) {
  markFired(f.key);

  if (settings.sound) playBeep();

  // Browser notification
  if (settings.push && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification(f.title, {
        body: f.body,
        tag: f.key,
        icon: '/placeholder.svg',
      });
      n.onclick = () => { window.focus(); n.close(); };
    } catch {/* ignore */}
  }

  // In-app toast with snooze
  toast(f.title, {
    description: f.body,
    duration: 12000,
    action: {
      label: 'Snooze 10m',
      onClick: () => {
        // re-schedule by clearing fired and adding a snooze entry, then trigger re-eval
        const all = loadFired();
        delete all[f.key];
        localStorage.setItem(FIRED_KEY, JSON.stringify(all));
        setSnooze(f.key, Date.now() + 10 * 60 * 1000);
        window.dispatchEvent(new CustomEvent('questify:notif-overrides'));
      },
    },
  });
}