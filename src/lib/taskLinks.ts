const KEY = 'questify.taskLinks';

type LinkMap = Record<string, string>; // taskId -> timetableEntryId

function read(): LinkMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function write(map: LinkMap) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
    window.dispatchEvent(new Event('questify:taskLinksChanged'));
  } catch {
    // ignore
  }
}

export function getTaskLinks(): LinkMap {
  return read();
}

export function getLinkedEntryId(taskId: string): string | undefined {
  return read()[taskId];
}

export function setTaskLink(taskId: string, entryId: string | null) {
  const map = read();
  if (!entryId) delete map[taskId];
  else map[taskId] = entryId;
  write(map);
}

export function getTasksForEntry(entryId: string): string[] {
  const map = read();
  return Object.keys(map).filter((taskId) => map[taskId] === entryId);
}

export function subscribeTaskLinks(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener('questify:taskLinksChanged', handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener('questify:taskLinksChanged', handler);
    window.removeEventListener('storage', handler);
  };
}