import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const LABELS: Record<string, { emoji: string; title: string; desc: (p: any) => string }> = {
  bounty:          { emoji: '🎯', title: 'Bounty placed on you!', desc: p => `${p?.fromName || 'Someone'} wants you to slip up.` },
  dethroned:       { emoji: '👊', title: 'You were DETHRONED!',     desc: p => `${p?.fromName || 'A rival'} stole your crown.` },
  silence:         { emoji: '🔇', title: 'You were silenced.',      desc: p => `${p?.fromName || 'Someone'} muted your celebrations for 24h.` },
  xp_tax_pending:  { emoji: '💸', title: 'XP Tax incoming!',        desc: p => `${p?.fromName || 'Someone'} will steal ${p?.percent || 5}% of your next XP.` },
};

export function IncomingEffectPopup() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel('incoming-effects-' + user.id)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'active_effects', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const e: any = payload.new;
          if (!e || e.source_user_id === user.id) return; // ignore self-applied
          const def = LABELS[e.type];
          if (!def) return;
          toast(`${def.emoji} ${def.title}`, {
            description: def.desc(e.payload || {}),
            duration: 6000,
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);
  return null;
}
