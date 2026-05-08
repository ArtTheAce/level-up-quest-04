import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Snowflake, Ghost, Crosshair, Skull, Crown, Flame, Zap, VolumeX, Sparkles } from 'lucide-react';

interface Effect {
  id: string;
  type: string;
  source_user_id: string | null;
  payload: any;
  expires_at: string | null;
  created_at: string;
}

const ICONS: Record<string, any> = {
  vault: Shield, freeze: Snowflake, ghost: Ghost, bounty: Crosshair,
  dethroned: Skull, streak_crown: Crown, aura_flame: Flame,
  frame_lightning: Zap, silence: VolumeX, curse_block: Shield,
  xp_tax_pending: Sparkles,
};

const LABEL: Record<string, string> = {
  vault: 'Vault Active', freeze: 'Leaderboard Frozen', ghost: 'Ghost Mode',
  bounty: 'Bounty on you', dethroned: 'Dethroned', streak_crown: 'Streak Crown',
  aura_flame: 'Flame Aura', aura_ice: 'Ice Aura', frame_lightning: 'Lightning Frame',
  silence: 'Silenced', curse_block: 'Curse Block ready', xp_tax_pending: 'XP Tax pending',
  taunt: 'Taunted', custom_title: 'Custom Title', villain_arc: 'Villain Arc',
};

function fmt(ms: number) {
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function ActiveEffectsPanel() {
  const { user } = useAuth();
  const [effects, setEffects] = useState<Effect[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from('active_effects')
        .select('id,type,source_user_id,payload,expires_at,created_at')
        .eq('user_id', user.id)
        .eq('consumed', false)
        .order('created_at', { ascending: false });
      setEffects((data as any) || []);
    };
    load();
    const ch = supabase
      .channel('active-effects-' + user.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_effects', filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const live = effects.filter(e => !e.expires_at || new Date(e.expires_at).getTime() > now);
  if (live.length === 0) return null;

  return (
    <div className="glass-card p-5">
      <h2 className="font-display font-bold text-lg mb-3 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        Active Effects
      </h2>
      <div className="grid sm:grid-cols-2 gap-2">
        <AnimatePresence>
          {live.map(e => {
            const Icon = ICONS[e.type] || Sparkles;
            const remaining = e.expires_at ? new Date(e.expires_at).getTime() - now : null;
            return (
              <motion.div
                key={e.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/60"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{LABEL[e.type] || e.type}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {remaining != null ? fmt(remaining) : 'permanent'}
                    {e.payload?.fromName ? ` • from ${e.payload.fromName}` : ''}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
