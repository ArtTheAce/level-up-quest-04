export interface NotificationSettings {
  enabled: boolean;
  sound: boolean;
  push: boolean;
  // Default lead times in minutes
  classLead: number; // before timetable event
  taskLeads: number[]; // before deadline (multiple)
}

const KEY = 'questify.notifications.v1';
const OVERRIDES_KEY = 'questify.notifications.overrides.v1';

export const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  sound: true,
  push: true,
  classLead: 10,
  taskLeads: [1440, 60], // 1 day, 1 hour
};

export function loadSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: NotificationSettings) {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent('questify:notif-settings'));
}

// Per-item override: lead minutes array, or null = disabled, or undefined = use defaults
export type ItemOverride = { leads: number[] } | { disabled: true };

export function loadOverrides(): Record<string, ItemOverride> {
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveOverride(itemId: string, override: ItemOverride | null) {
  const all = loadOverrides();
  if (override === null) delete all[itemId];
  else all[itemId] = override;
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(all));
  window.dispatchEvent(new CustomEvent('questify:notif-overrides'));
}

export function getItemLeads(
  itemId: string,
  defaults: number[],
): number[] | null {
  const overrides = loadOverrides();
  const o = overrides[itemId];
  if (!o) return defaults;
  if ('disabled' in o) return null;
  return o.leads;
}

export const LEAD_OPTIONS = [
  { value: 5, label: '5 min before' },
  { value: 10, label: '10 min before' },
  { value: 15, label: '15 min before' },
  { value: 30, label: '30 min before' },
  { value: 60, label: '1 hour before' },
  { value: 180, label: '3 hours before' },
  { value: 360, label: '6 hours before' },
  { value: 720, label: '12 hours before' },
  { value: 1440, label: '1 day before' },
  { value: 2880, label: '2 days before' },
];

export function formatLead(min: number): string {
  const opt = LEAD_OPTIONS.find(o => o.value === min);
  if (opt) return opt.label;
  if (min < 60) return `${min} min before`;
  if (min < 1440) return `${Math.round(min / 60)}h before`;
  return `${Math.round(min / 1440)}d before`;
}

// Audio: short beep using WebAudio
let audioCtx: AudioContext | null = null;
export function playBeep() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioCtx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.6);
    setTimeout(() => {
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.type = 'sine';
      o2.frequency.value = 1320;
      g2.gain.setValueAtTime(0, ctx.currentTime);
      g2.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.02);
      g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      o2.connect(g2).connect(ctx.destination);
      o2.start();
      o2.stop(ctx.currentTime + 0.5);
    }, 180);
  } catch {
    // ignore
  }
}

export async function ensurePushPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const res = await Notification.requestPermission();
  return res === 'granted';
}