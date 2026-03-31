import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Settings as SettingsIcon, Eye, LogOut } from 'lucide-react';

export default function Settings() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [showXp, setShowXp] = useState(profile?.show_xp ?? true);
  const [showLevel, setShowLevel] = useState(profile?.show_level ?? true);
  const [showStreak, setShowStreak] = useState(profile?.show_streak ?? true);
  const [showTasks, setShowTasks] = useState(profile?.show_tasks_completed ?? true);
  const [showBadges, setShowBadges] = useState(profile?.show_badges ?? true);
  const [saving, setSaving] = useState(false);

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
          <p className="text-xs text-muted-foreground mb-4">Username: @{profile?.username}</p>
          <Input
            placeholder="Display Name"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            maxLength={50}
          />
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
    </div>
  );
}
