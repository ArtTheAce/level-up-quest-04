// Cloud-synced user preferences.
//
// All prefs (task links, task durations, saved subjects, notification settings
// & per-item overrides) live on the `profiles` row for the signed-in user, so
// they follow the user across devices.
//
// We keep an in-memory cache so existing call sites can stay synchronous, and
// we still mirror to localStorage as an offline cache to avoid empty-state
// flicker on the next page load.

import { supabase } from '@/integrations/supabase/client';

export interface NotificationSettingsShape {
  enabled: boolean;
  sound: boolean;
  push: boolean;
  classLead: number;
  taskLeads: number[];
}

export type ItemOverrideShape = { leads: number[] } | { disabled: true };

interface PrefsShape {
  taskLinks: Record<string, string>;             // taskId -> entryId
  taskDurations: Record<string, number>;         // taskId -> minutes
  savedSubjects: string[];
  notificationSettings: Partial<NotificationSettingsShape>;
  notificationOverrides: Record<string, ItemOverrideShape>;
}

const EMPTY: PrefsShape = {
  taskLinks: {},
  taskDurations: {},
  savedSubjects: [],
  notificationSettings: {},
  notificationOverrides: {},
};

const CACHE_KEY = 'questify.userPrefs.cache.v1';

let cache: PrefsShape = loadFromLocalCache();
let currentUserId: string | null = null;
let pushTimer: ReturnType<typeof setTimeout> | undefined;

function loadFromLocalCache(): PrefsShape {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw);
    return { ...EMPTY, ...parsed };
  } catch {
    return { ...EMPTY };
  }
}

function saveToLocalCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

function emit(eventName: string) {
  try {
    window.dispatchEvent(new Event(eventName));
  } catch {
    // ignore
  }
}

function emitAll() {
  emit('questify:userPrefsChanged');
  emit('questify:taskLinksChanged');
  emit('questify:taskDurationsChanged');
  emit('questify:notif-settings');
  emit('questify:notif-overrides');
}

function schedulePush() {
  if (!currentUserId) return;
  if (pushTimer) clearTimeout(pushTimer);
  const userId = currentUserId;
  pushTimer = setTimeout(async () => {
    try {
      await supabase
        .from('profiles')
        .update({
          task_links: cache.taskLinks as any,
          task_durations: cache.taskDurations as any,
          saved_subjects: cache.savedSubjects as any,
          notification_settings: cache.notificationSettings as any,
          notification_overrides: cache.notificationOverrides as any,
        })
        .eq('user_id', userId);
    } catch {
      // ignore — local cache still up to date
    }
  }, 500);
}

/** Initialize prefs from the cloud for the given user. Call on login. */
export async function initUserPrefs(userId: string) {
  currentUserId = userId;
  try {
    const { data } = await supabase
      .from('profiles')
      .select('task_links, task_durations, saved_subjects, notification_settings, notification_overrides')
      .eq('user_id', userId)
      .single();
    if (data) {
      cache = {
        taskLinks: (data.task_links as any) ?? {},
        taskDurations: (data.task_durations as any) ?? {},
        savedSubjects: (data.saved_subjects as any) ?? [],
        notificationSettings: (data.notification_settings as any) ?? {},
        notificationOverrides: (data.notification_overrides as any) ?? {},
      };
      saveToLocalCache();
      emitAll();
    }
  } catch {
    // keep local cache
  }
}

/** Reset on logout. */
export function clearUserPrefs() {
  currentUserId = null;
  cache = { ...EMPTY };
  try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
  emitAll();
}

// ---------- Task links ----------
export function getTaskLinks(): Record<string, string> { return { ...cache.taskLinks }; }
export function getLinkedEntryId(taskId: string): string | undefined { return cache.taskLinks[taskId]; }
export function getTasksForEntry(entryId: string): string[] {
  return Object.keys(cache.taskLinks).filter((tid) => cache.taskLinks[tid] === entryId);
}
export function setTaskLink(taskId: string, entryId: string | null) {
  const next = { ...cache.taskLinks };
  if (!entryId) delete next[taskId];
  else next[taskId] = entryId;
  cache = { ...cache, taskLinks: next };
  saveToLocalCache();
  emit('questify:taskLinksChanged');
  schedulePush();
}
export function subscribeTaskLinks(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener('questify:taskLinksChanged', handler);
  return () => window.removeEventListener('questify:taskLinksChanged', handler);
}

// ---------- Task durations ----------
const DEFAULT_DURATION = 30;
export function getTaskDuration(taskId: string): number {
  return cache.taskDurations[taskId] ?? DEFAULT_DURATION;
}
export function setTaskDuration(taskId: string, minutes: number) {
  const next = { ...cache.taskDurations, [taskId]: Math.max(5, Math.round(minutes)) };
  cache = { ...cache, taskDurations: next };
  saveToLocalCache();
  emit('questify:taskDurationsChanged');
  schedulePush();
}
export function clearTaskDuration(taskId: string) {
  const next = { ...cache.taskDurations };
  delete next[taskId];
  cache = { ...cache, taskDurations: next };
  saveToLocalCache();
  emit('questify:taskDurationsChanged');
  schedulePush();
}
export function subscribeTaskDurations(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener('questify:taskDurationsChanged', handler);
  return () => window.removeEventListener('questify:taskDurationsChanged', handler);
}

// ---------- Saved subjects ----------
export function getSavedSubjects(): string[] { return [...cache.savedSubjects]; }
export function setSavedSubjects(subjects: string[]) {
  cache = { ...cache, savedSubjects: [...subjects] };
  saveToLocalCache();
  emit('questify:savedSubjectsChanged');
  schedulePush();
}
export function subscribeSavedSubjects(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener('questify:savedSubjectsChanged', handler);
  return () => window.removeEventListener('questify:savedSubjectsChanged', handler);
}

// ---------- Notification settings ----------
export function getNotificationSettingsRaw(): Partial<NotificationSettingsShape> {
  return { ...cache.notificationSettings };
}
export function setNotificationSettingsRaw(s: Partial<NotificationSettingsShape>) {
  cache = { ...cache, notificationSettings: { ...s } };
  saveToLocalCache();
  emit('questify:notif-settings');
  schedulePush();
}

// ---------- Notification per-item overrides ----------
export function getNotificationOverrides(): Record<string, ItemOverrideShape> {
  return { ...cache.notificationOverrides };
}
export function setNotificationOverride(itemId: string, override: ItemOverrideShape | null) {
  const next = { ...cache.notificationOverrides };
  if (override === null) delete next[itemId];
  else next[itemId] = override;
  cache = { ...cache, notificationOverrides: next };
  saveToLocalCache();
  emit('questify:notif-overrides');
  schedulePush();
}