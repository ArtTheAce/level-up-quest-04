import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell } from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  message: string;
  data: any;
  read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotifs = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setNotifs(data || []);
  };

  useEffect(() => {
    fetchNotifs();
    // Realtime subscription
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user?.id}`,
      }, () => fetchNotifs())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const unread = notifs.filter(n => !n.read).length;

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  };

  const typeIcon: Record<string, string> = {
    taunt: '😈', callout: '📢', bounty: '🎯', duel_request: '⚔️',
    curse: '🪄', xp_tax: '💸', rank_steal: '👊', silence: '🔇',
    friend_request: '👋',
  };

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(o => !o); if (!open && unread > 0) markAllRead(); }}
        className="relative text-xl hover:scale-110 transition-transform"
        title="Notifications"
      >
        <Bell className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute right-0 top-8 z-50 w-80 glass-card shadow-xl overflow-hidden"
            >
              <div className="p-3 border-b border-border flex items-center justify-between">
                <p className="font-display font-bold text-sm">Notifications</p>
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-xs text-muted-foreground hover:text-foreground">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No notifications yet</p>
                ) : (
                  notifs.map(n => (
                    <div
                      key={n.id}
                      className={`p-3 border-b border-border/50 text-sm ${!n.read ? 'bg-primary/5' : ''}`}
                    >
                      <p className="flex items-start gap-2">
                        <span className="text-base shrink-0">{typeIcon[n.type] || '🔔'}</span>
                        <span className="leading-snug">{n.message}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 pl-6">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
