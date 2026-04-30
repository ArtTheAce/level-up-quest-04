import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Settings as SettingsIcon, Eye, LogOut, Bell } from 'lucide-react';
import {
  loadSettings,
  saveSettings,
  ensurePushPermission,
  playBeep,
  LEAD_OPTIONS,
  type NotificationSettings,
} from '@/lib/notificationSettings';

export default function Settings() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [showXp, setShowXp] = useState(profile?.show_xp ?? true);
  const [showLevel, setShowLevel] = useState(profile?.show_level ?? true);
  const [showStreak, setShowStreak] = useState(profile?.show_streak ?? true);
  const [showTasks, setShowTasks] = useState(profile?.show_tasks_completed ?? true);
  const [showBadges, setShowBadges] = useState(profile?.show_badges ?? true);
  const [saving, setSaving] = useState(false);
  const [savingUsername, setSavingUsername] = useState(false);

  // Notification settings (localStorage-backed)
  const [notif, setNotif] = useState<NotificationSettings>(loadSettings());
  const [pushPerm, setPushPerm] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );

  useEffect(() => {
    saveSettings(notif);
  }, [notif]);

  useEffect(() => {
    if (profile?.username) setUsername(profile.username);
    if (profile?.display_name) setDisplayName(profile.display_name);
  }, [profile?.username, profile?.display_name]);

  const sendTestNotification = async () => {
    if (notif.sound) playBeep();
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        await ensurePushPermission();
        setPushPerm(Notification.permission);
      }
      if (Notification.permission === 'granted') {
        try {
          new Notification('🔔 Questify test reminder', {
            body: "Notifications are working! You'll be alerted before tasks and classes.",
            icon: '/placeholder.svg',
          });
        } catch {/* ignore */}
      }
    }
    toast.success('Test notification sent ✅', {
      description: "If you didn't see a system popup, enable browser permission above.",
    });
  };

  const handleSaveUsername = async () => {
    if (!user) return;
    const trimmed = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(trimmed)) {
      toast.error('Username must be 3–20 chars: letters, numbers, underscore');
      return;
    }
    if (trimmed === profile?.username) {
      toast.info("That's already your username");
      return;
    }
    setSavingUsername(true);
    const { error } = await supabase
      .from('profiles')
      .update({ username: trimmed })
      .eq('user_id', user.id);
    if (error) {
      if ((error as any).code === '23505') toast.error('That username is already taken');
      else toast.error('Failed to update username');
    } else {
      toast.success('Username updated! 🎉');
      refreshProfile();
    }
    setSavingUsername(false);
  };

  const requestPush = async () => {
    const ok = await ensurePushPermission();
    setPushPerm(Notification.permission);
    if (ok) {
      setNotif(n => ({ ...n, push: true }));
      toast.success('Push notifications enabled 🔔');
    } else {
      toast.error('Permission denied. Enable in browser settings.');
    }
  };

  const toggleTaskLead = (val: number) => {
    setNotif(n => ({
      ...n,
      taskLeads: n.taskLeads.includes(val)
        ? n.taskLeads.filter(l => l !== val)
        : [...n.taskLeads, val].sort((a, b) => b - a),
    }));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName || null,
        show_xp: showXp,
        show_level: showLevel,
        show_streak: showStreak,
        show_tasks_completed: showTasks,
        show_badges: showBadges,
      })
      .eq('user_id', user.id);

    if (error) toast.error('Failed to save');
    else {
      toast.success('Settings saved! ✅');
      refreshProfile();
    }
    setSaving(false);
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold flex items-center gap-2">
          <SettingsIcon className="h-8 w-8 text-primary" /> Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your profile and privacy</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 space-y-6">
        <div>
          <h2 className="font-display font-bold text-lg mb-1">Profile</h2>
          <p className="text-xs text-muted-foreground mb-3">Your unique handle and shown name</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Username</label>
              <div className="flex gap-2 mt-1">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                  <Input
                    className="pl-7"
                    placeholder="username"
                    value={username}
                    onChange={e => setUsername(e.target.value.replace(/\s/g, '').toLowerCase())}
                    maxLength={20}
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveUsername}
                  disabled={savingUsername || !username || username === profile?.username}
                >
                  {savingUsername ? '...' : 'Save'}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">3–20 characters · letters, numbers, underscore</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Display name</label>
              <Input
                className="mt-1"
                placeholder="Display Name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                maxLength={50}
              />
            </div>
          </div>
        </div>

        <div>
          <h2 className="font-display font-bold text-lg mb-3 flex items-center gap-2">
            <Eye className="h-5 w-5" /> Leaderboard Visibility
          </h2>
          <p className="text-xs text-muted-foreground mb-4">Choose what other players can see on leaderboards</p>
          <div className="space-y-3">
            {[
              { label: 'Show XP', value: showXp, set: setShowXp },
              { label: 'Show Level', value: showLevel, set: setShowLevel },
              { label: 'Show Streak', value: showStreak, set: setShowStreak },
              { label: 'Show Tasks Completed', value: showTasks, set: setShowTasks },
              { label: 'Show Badges', value: showBadges, set: setShowBadges },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-sm font-medium">{s.label}</span>
                <Switch checked={s.value} onCheckedChange={s.set} />
              </div>
            ))}
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </motion.div>

      <div className="glass-card p-6">
        <Button variant="destructive" className="w-full" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" /> Log Out
        </Button>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 space-y-5">
        <div>
          <h2 className="font-display font-bold text-lg flex items-center gap-2">
            <Bell className="h-5 w-5" /> Notifications
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Smart reminders for tasks and classes</p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Enable reminders</p>
            <p className="text-xs text-muted-foreground">Master switch for all notifications</p>
          </div>
          <Switch checked={notif.enabled} onCheckedChange={v => setNotif(n => ({ ...n, enabled: v }))} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Sound alerts 🔔</p>
            <p className="text-xs text-muted-foreground">Play a chime when reminders fire</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={playBeep} className="text-xs text-muted-foreground hover:text-foreground underline">
              Test
            </button>
            <Switch checked={notif.sound} onCheckedChange={v => setNotif(n => ({ ...n, sound: v }))} />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Browser push notifications</p>
            <p className="text-xs text-muted-foreground">
              {pushPerm === 'granted' ? '✓ Permission granted' :
               pushPerm === 'denied' ? '✗ Blocked in browser' : 'Not yet requested'}
            </p>
          </div>
          {pushPerm !== 'granted' ? (
            <Button size="sm" variant="outline" onClick={requestPush} disabled={pushPerm === 'denied'}>
              Enable
            </Button>
          ) : (
            <Switch checked={notif.push} onCheckedChange={v => setNotif(n => ({ ...n, push: v }))} />
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border pt-4">
          <div>
            <p className="text-sm font-medium">Send a test reminder</p>
            <p className="text-xs text-muted-foreground">Confirm sound + popup are working</p>
          </div>
          <Button size="sm" variant="secondary" onClick={sendTestNotification}>
            Send test
          </Button>
        </div>

        <div className="border-t border-border pt-4 space-y-3">
          <div>
            <p className="text-sm font-medium">Class reminder lead time</p>
            <p className="text-xs text-muted-foreground mb-2">When to alert before scheduled classes</p>
            <div className="flex flex-wrap gap-1">
              {[5, 10, 15, 30, 60].map(v => (
                <button
                  key={v}
                  onClick={() => setNotif(n => ({ ...n, classLead: v }))}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    notif.classLead === v
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted border-border hover:bg-secondary'
                  }`}
                >
                  {v} min
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium">Task deadline reminders</p>
            <p className="text-xs text-muted-foreground mb-2">Pick one or more lead times for task deadlines</p>
            <div className="flex flex-wrap gap-1">
              {LEAD_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => toggleTaskLead(opt.value)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    notif.taskLeads.includes(opt.value)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted border-border hover:bg-secondary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground border-t border-border pt-3">
          💡 You can also customise reminders per-task and per-class using the bell icon next to each item.
        </p>
      </motion.div>
    </div>
  );
}
