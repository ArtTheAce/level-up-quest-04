import { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Bell, BellOff } from 'lucide-react';
import {
  loadOverrides,
  saveOverride,
  loadSettings,
  LEAD_OPTIONS,
  formatLead,
} from '@/lib/notificationSettings';

interface Props {
  itemId: string;
  kind: 'task' | 'class';
}

export function ReminderPicker({ itemId, kind }: Props) {
  const settings = loadSettings();
  const defaults = kind === 'task' ? settings.taskLeads : [settings.classLead];
  const [, force] = useState(0);

  useEffect(() => {
    const f = () => force(x => x + 1);
    window.addEventListener('questify:notif-overrides', f);
    window.addEventListener('questify:notif-settings', f);
    return () => {
      window.removeEventListener('questify:notif-overrides', f);
      window.removeEventListener('questify:notif-settings', f);
    };
  }, []);

  const overrides = loadOverrides();
  const o = overrides[itemId];
  const disabled = o && 'disabled' in o;
  const leads: number[] = disabled ? [] : (o && 'leads' in o ? o.leads : defaults);

  const toggleLead = (val: number) => {
    const next = leads.includes(val) ? leads.filter(l => l !== val) : [...leads, val].sort((a, b) => b - a);
    saveOverride(itemId, { leads: next });
  };

  const toggleEnabled = (on: boolean) => {
    if (on) saveOverride(itemId, { leads: defaults });
    else saveOverride(itemId, { disabled: true });
  };

  const reset = () => saveOverride(itemId, null);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:bg-secondary flex items-center gap-1"
          title="Reminder settings"
          onClick={e => e.stopPropagation()}
        >
          {disabled ? <BellOff className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
          {disabled ? 'Off' : leads.length === 0 ? 'None' : leads.length === 1 ? formatLead(leads[0]) : `${leads.length} reminders`}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end" onClick={e => e.stopPropagation()}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Reminders</span>
            <Switch checked={!disabled} onCheckedChange={toggleEnabled} />
          </div>
          {!disabled && (
            <>
              <p className="text-xs text-muted-foreground">Notify me before:</p>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {LEAD_OPTIONS.map(opt => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1">
                    <input
                      type="checkbox"
                      checked={leads.includes(opt.value)}
                      onChange={() => toggleLead(opt.value)}
                      className="accent-primary"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={reset}>
                Use defaults
              </Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}