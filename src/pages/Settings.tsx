import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useGame } from '@/context/GameContext';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, User, Bell, Shield, Moon, Sun, Trash2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { ThemeId } from '@/context/GameContext';

// All available themes with display metadata
const THEME_META: { id: ThemeId; name: string; icon: string; swatch: string }[] = [
  { id: 'default',  name: 'Default',   icon: '✨', swatch: 'hsl(145 63% 42%)' },
  { id: 'midnight', name: 'Midnight',  icon: '🌙', swatch: 'hsl(265 70% 58%)' },
  { id: 'sakura',   name: 'Sakura',    icon: '🌸', swatch: 'hsl(340 70% 60%)' },
  { id: 'ocean',    name: 'Ocean',     icon: '🌊', swatch: 'hsl(195 80% 50%)' },
  { id: 'neon',     name: 'Neon Glow', icon: '💜', swatch: 'hsl(280 100% 65%)' },
  { id: 'sunset',   name: 'Sunset',    icon: '🌅', swatch: 'hsl(15 85% 55%)' },
];

const DELETE_PHRASE = 'delete my account';

export default function Settings() {
  const { profile, user, refreshProfile } = useAuth();
  const { state, dispatch } = useGame();

  const [displayName, setDisplayName]           = useState('');
  const [username, setUsername]                 = useState('');
  const [showTasksCompleted, setShowTasksCompleted] = useState(true);
  const [notifyStreaks, setNotifyStreaks]        = useState(true);
  const [notifyFriends, setNotifyFriends]       = useState(true);
  const [notifyRivalry, setNotifyRivalry]       = useState(true);
  const [saving, setSaving]                     = useState(false);

  // Delete account dialog
  const [deleteOpen, setDeleteOpen]             = useState(false);
  const [deleteInput, setDeleteInput]           = useState('');

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '');
      setUsername(profile.username ?? '');
      setShowTasksCompleted(profile.show_tasks_completed ?? true);
    }
  }, [profile]);

  // ── Theme helpers ──────────────────────────────────────────────────────────
  const isOwned = (id: ThemeId) =>
    id === 'default' || state.purchasedItems.includes(`theme_${id}`);

  // Only show themes the user has actually purchased
  const ownedThemes = THEME_META.filter(t => isOwned(t.id));

  const equipTheme = (id: ThemeId) => {
    if (state.activeTheme === id) return;
    dispatch({ type: 'SET_THEME', themeId: id });
    const meta = THEME_META.find(t => t.id === id)!;
    toast.success(`${meta.name} theme equipped ${meta.icon}`);
  };

  // ── Save profile ───────────────────────────────────────────────────────────
  async function saveProfile() {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name:         displayName || null,
          username:             username,
          show_xp:              true,
          show_level:           true,
          show_streak:          true,
          show_badges:          true,
          show_tasks_completed: showTasksCompleted,
        })
        .eq('user_id', user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success('Profile saved! ✅');
    } catch (err: any) {
      toast.error('Failed to save', { description: err.message });
    } finally {
      setSaving(false);
    }
  }

  // ── Delete account ─────────────────────────────────────────────────────────
  function openDeleteDialog() {
    setDeleteInput('');
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    if (deleteInput !== DELETE_PHRASE) return;
    setDeleteOpen(false);
    toast.error('Account deletion must be completed through Supabase support for safety reasons.');
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
        <h2 className="font-display font-bold text-base flex items-center gap-2">
          <User className="h-5 w-5 text-primary" /> Profile
        </h2>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Display Name</Label>
            <Input id="displayName" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input id="username" value={username} onChange={e => setUsername(e.target.value)} placeholder="@username" />
          </div>
        </div>
      </motion.div>

      {/* Appearance */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0, transition: { delay: 0.05 } }}
        className="glass-card p-6 space-y-5"
      >
        <h2 className="font-display font-bold text-base flex items-center gap-2">
          {state.darkMode ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-primary" />}
          Appearance
        </h2>

        {/* Dark mode toggle — use `checked` param directly to avoid stale closure */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Dark Mode</p>
            <p className="text-sm text-muted-foreground">Use a darker colour scheme</p>
          </div>
          <Switch
            checked={state.darkMode}
            onCheckedChange={(checked) => dispatch({ type: 'SET_DARK_MODE', enabled: checked })}
          />
        </div>

        {/* Theme picker — only shows themes the user has purchased */}
        <div>
          <p className="font-medium mb-3">Theme</p>
          {ownedThemes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No themes purchased yet. Visit the Shop to unlock more!</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {ownedThemes.map(t => {
                const active = state.activeTheme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => equipTheme(t.id)}
                    className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                      active
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }`}
                  >
                    {/* Colour swatch */}
                    <span
                      className="w-8 h-8 rounded-full border border-border"
                      style={{ background: t.swatch }}
                    />
                    <span className="text-xs font-medium">{t.icon} {t.name}</span>
                    {active && (
                      <span className="absolute top-1 right-1">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {ownedThemes.length < THEME_META.length && (
            <p className="text-xs text-muted-foreground mt-2">
              {THEME_META.length - ownedThemes.length} more theme{THEME_META.length - ownedThemes.length > 1 ? 's' : ''} available in the Shop.
            </p>
          )}
        </div>
      </motion.div>

      {/* Privacy */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }}
        className="glass-card p-6 space-y-5"
      >
        <h2 className="font-display font-bold text-base flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" /> Privacy
        </h2>
        <div className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Always visible to others</p>
          <p>XP, Level, Streak, and Badges are always public — this keeps competition fair for everyone.</p>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Show Tasks Completed</p>
            <p className="text-sm text-muted-foreground">Let others see how many tasks you've finished</p>
          </div>
          <Switch checked={showTasksCompleted} onCheckedChange={setShowTasksCompleted} />
        </div>
      </motion.div>

      {/* Notifications */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0, transition: { delay: 0.15 } }}
        className="glass-card p-6 space-y-5"
      >
        <h2 className="font-display font-bold text-base flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" /> Notifications
        </h2>
        <div className="space-y-4">
          {[
            { label: 'Streak reminders', desc: 'Daily reminder to keep your streak alive', value: notifyStreaks,  set: setNotifyStreaks },
            { label: 'Friend activity',  desc: 'When friends send requests or level up',   value: notifyFriends, set: setNotifyFriends },
            { label: 'Rivalry alerts',   desc: 'Curses, duels, and wager updates',         value: notifyRivalry, set: setNotifyRivalry },
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
        <Button variant="destructive" size="sm" onClick={openDeleteDialog} className="gap-2">
          <Trash2 className="h-4 w-4" /> Delete Account
        </Button>
        <Button onClick={saveProfile} disabled={saving} className="px-8">
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>

      {/* Delete account confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Delete Account
            </DialogTitle>
            <DialogDescription className="pt-1">
              Are you sure you want to delete your account? This action is <strong>permanent and cannot be undone</strong>. All your XP, streaks, tasks, and progress will be lost forever.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              To confirm, type exactly: <strong>{DELETE_PHRASE}</strong>
            </div>
            <Input
              value={deleteInput}
              onChange={e => setDeleteInput(e.target.value)}
              placeholder={DELETE_PHRASE}
              className={deleteInput && deleteInput !== DELETE_PHRASE ? 'border-destructive' : ''}
            />
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleteInput !== DELETE_PHRASE}
                onClick={confirmDelete}
              >
                Permanently Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
