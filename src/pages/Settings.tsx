import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useGame } from '@/context/GameContext';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, User, Bell, Shield, Moon, Sun, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';

export default function Settings() {
  // user.id is the auth UUID; profile holds display fields (no .id property)
  const { profile, user, refreshProfile } = useAuth();
  const { state, dispatch } = useGame();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername]       = useState('');

  // Feature 4: only show_tasks_completed is user-controllable
  const [showTasksCompleted, setShowTasksCompleted] = useState(true);

  const [notifyStreaks, setNotifyStreaks]  = useState(true);
  const [notifyFriends, setNotifyFriends] = useState(true);
  const [notifyRivalry, setNotifyRivalry] = useState(true);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '');
      setUsername(profile.username ?? '');
      setShowTasksCompleted(profile.show_tasks_completed ?? true);
    }
  }, [profile]);

  async function saveProfile() {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName || null,
          username: username,
          // Feature 4: always force these to true — XP, Level, Streak, Badges are always public
          show_xp:              true,
          show_level:           true,
          show_streak:          true,
          show_badges:          true,
          show_tasks_completed: showTasksCompleted,
        })
        .eq('user_id', user.id);  // profiles are keyed by user_id, not id

      if (error) throw error;
      await refreshProfile();
      toast.success('Profile saved! ✅');
    } catch (err: any) {
      toast.error('Failed to save', { description: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount() {
    if (!confirm('Are you sure? This action cannot be undone.')) return;
    toast.error('Account deletion must be requested via support for safety reasons.');
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold flex items-center gap-2">
          <SettingsIcon className="h-8 w-8 text-primary" /> Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your profile, appearance, and preferences.</p>
      </div>

      {/* Profile */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 space-y-5">
        <h2 className="font-display font-bold flex items-center gap-2">
          <User className="h-5 w-5 text-primary" /> Profile
        </h2>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="@username"
            />
          </div>
        </div>
      </motion.div>

      {/* Appearance */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0, transition: { delay: 0.05 } }}
        className="glass-card p-6 space-y-5"
      >
        <h2 className="font-display font-bold flex items-center gap-2">
          {state.darkMode ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-primary" />}
          Appearance
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Dark Mode</p>
              <p className="text-sm text-muted-foreground">Use a darker colour scheme</p>
            </div>
            <Switch
              checked={state.darkMode}
              onCheckedChange={() => dispatch({ type: 'SET_DARK_MODE', enabled: !state.darkMode })}
            />
          </div>
          <div>
            <p className="font-medium mb-2">Theme</p>
            <ThemeSwitcher />
          </div>
        </div>
      </motion.div>

      {/* Privacy — Feature 4 redesign */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }}
        className="glass-card p-6 space-y-5"
      >
        <h2 className="font-display font-bold flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" /> Privacy
        </h2>
        <div className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">What&apos;s always visible to others</p>
          <p>XP, Level, Streak, and Badges are always shown on your profile and the leaderboard. This keeps the competition fair and motivating for everyone.</p>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Show Tasks Completed</p>
            <p className="text-sm text-muted-foreground">Let others see how many tasks you&apos;ve finished</p>
          </div>
          <Switch
            checked={showTasksCompleted}
            onCheckedChange={setShowTasksCompleted}
          />
        </div>
      </motion.div>

      {/* Notifications */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0, transition: { delay: 0.15 } }}
        className="glass-card p-6 space-y-5"
      >
        <h2 className="font-display font-bold flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" /> Notifications
        </h2>
        <div className="space-y-4">
          {[
            { label: 'Streak reminders',   desc: 'Daily reminder to keep your streak alive', value: notifyStreaks,  set: setNotifyStreaks },
            { label: 'Friend activity',     desc: 'When friends send requests or level up',   value: notifyFriends, set: setNotifyFriends },
            { label: 'Rivalry alerts',      desc: 'Curses, duels, and wager updates',         value: notifyRivalry, set: setNotifyRivalry },
          ].map(pref => (
            <div key={pref.label} className="flex items-center justify-between">
              <div>
                <p className="font-medium">{pref.label}</p>
                <p className="text-sm text-muted-foreground">{pref.desc}</p>
              </div>
              <Switch checked={pref.value} onCheckedChange={pref.set} />
            </div>
          ))}
        </div>
      </motion.div>

      {/* Save / Danger */}
      <div className="flex items-center justify-between gap-4">
        <Button variant="destructive" size="sm" onClick={deleteAccount} className="gap-2">
          <Trash2 className="h-4 w-4" /> Delete Account
        </Button>
        <Button onClick={saveProfile} disabled={saving} className="px-8">
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
