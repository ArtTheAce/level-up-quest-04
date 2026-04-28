import { useState } from 'react';
import { useGame } from '@/context/GameContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 15, scale: 0.95 }, show: { opacity: 1, y: 0, scale: 1 } };

interface SocialItem {
  id: string;
  icon: string;
  name: string;
  description: string;
  price: number;
  action: string;
}

const SOCIAL_ITEMS: SocialItem[] = [
  { id: 'taunt',    icon: '😈', name: 'Taunt Card',        description: "Send a friend an annoying nudge: 'You're falling behind 👀'",              price: 80,  action: 'taunt' },
  { id: 'callout',  icon: '📢', name: 'Public Callout',    description: 'Pin a message on a friend\'s profile visible to the whole group for 24hrs', price: 200, action: 'callout' },
  { id: 'freeze',   icon: '🧊', name: 'Leaderboard Freeze',description: "Freeze your displayed rank for 24hrs so friends can't see you slipped",     price: 150, action: 'freeze' },
  { id: 'bounty',   icon: '🎯', name: 'Bounty',            description: "Place a coin bounty on a friend's incomplete task",                         price: 300, action: 'bounty' },
  { id: 'duel',     icon: '⚔️', name: 'Duel',              description: 'Challenge a friend: whoever completes more tasks in 24hrs wins double coins', price: 250, action: 'duel' },
  { id: 'vault',    icon: '🔒', name: 'Vault',             description: 'Protect your coins from theft or taxes for 48hrs',                          price: 180, action: 'vault' },
];

export function SocialTab() {
  const { state, dispatch } = useGame();
  const { user } = useAuth();
  const [modal, setModal] = useState<string | null>(null);
  const [friends, setFriends] = useState<{ id: string; username: string; display_name: string | null }[]>([]);
  const [selectedFriend, setSelectedFriend] = useState('');
  const [calloutText, setCalloutText] = useState('');
  const [loading, setLoading] = useState(false);

  const openModal = async (action: string, price: number) => {
    if (state.coins < price) {
      toast.error('Not enough coins!', { description: 'Complete more tasks to earn coins.' });
      return;
    }
    // Load friends list
    if (user) {
      const { data: fs } = await supabase.from('friendships').select('user_id, friend_id').or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);
      const ids = (fs || []).map(f => f.user_id === user.id ? f.friend_id : f.user_id);
      if (ids.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, username, display_name').in('user_id', ids);
        setFriends((profiles || []).map(p => ({ id: p.user_id, username: p.username, display_name: p.display_name })));
      }
    }
    setSelectedFriend('');
    setCalloutText('');
    setModal(action);
  };

  const sendNotification = async (toUserId: string, type: string, message: string, data?: any) => {
    await supabase.from('notifications').insert({
      user_id: toUserId,
      type,
      message,
      data: data || {},
      read: false,
    }).then(() => {});
  };

  const execute = async (action: string, price: number) => {
    if (!selectedFriend && action !== 'freeze' && action !== 'vault') return;
    setLoading(true);
    try {
      const senderName = (await supabase.from('profiles').select('username, display_name').eq('user_id', user?.id).single()).data;
      const name = senderName?.display_name || senderName?.username || 'Someone';

      if (action === 'taunt') {
        await sendNotification(selectedFriend, 'taunt', `😈 ${name} taunted you: "You're falling behind 👀" — time to get to work!`);
        toast.success('Taunt sent! 😈');
      } else if (action === 'callout') {
        if (!calloutText.trim()) { toast.error('Write a message first!'); setLoading(false); return; }
        await sendNotification(selectedFriend, 'callout', `📢 Public callout from ${name}: "${calloutText}"`, {
          message: calloutText,
          sender: name,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
        toast.success('Callout pinned! 📢');
      } else if (action === 'freeze') {
        dispatch({
          type: 'ADD_TIMED_BOOST',
          boost: {
            type: 'leaderboard_freeze',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
        });
        toast.success('Leaderboard Freeze active for 24hrs! 🧊');
      } else if (action === 'bounty') {
        await sendNotification(selectedFriend, 'bounty', `🎯 ${name} placed a bounty on you! Complete your tasks or lose ${price} coins!`, {
          bountyAmount: price,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          fromUserId: user?.id,
          fromName: name,
        });
        toast.success('Bounty placed! 🎯');
      } else if (action === 'duel') {
        await sendNotification(selectedFriend, 'duel_request', `⚔️ ${name} challenged you to a duel! Whoever completes more tasks in 24hrs wins double coins!`, {
          fromUserId: user?.id,
          fromName: name,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          stake: price,
        });
        toast.success('Duel request sent! ⚔️ Waiting for acceptance...');
      } else if (action === 'vault') {
        dispatch({
          type: 'ADD_TIMED_BOOST',
          boost: {
            type: 'vault',
            expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
          },
        });
        toast.success('Vault active for 48hrs! 🔒 Your coins are protected.');
      }

      // Deduct coins
      dispatch({ type: 'ADD_COINS', amount: -price });
      setModal(null);
    } catch (err) {
      console.error('Shop social action failed:', err);
      toast.error('Something went wrong');
    }
    setLoading(false);
  };

  return (
    <>
      <motion.div variants={container} initial="hidden" animate="show" className="grid sm:grid-cols-2 gap-4">
        {SOCIAL_ITEMS.map(si => (
          <motion.div
            key={si.id}
            variants={item}
            whileHover={{ scale: 1.02 }}
            className="glass-card p-5 flex flex-col gap-3 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start gap-3">
              <span className="text-3xl">{si.icon}</span>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-bold">{si.name}</h3>
                <p className="text-sm text-muted-foreground">{si.description}</p>
              </div>
            </div>
            <div className="mt-auto flex items-center justify-between">
              <div className="flex items-center gap-1 text-coin font-bold text-sm">
                <Coins className="h-4 w-4" />{si.price}
              </div>
              <Button
                size="sm"
                disabled={state.coins < si.price}
                onClick={() => openModal(si.action, si.price)}
              >
                <Coins className="h-3 w-3 mr-1" />{si.price}
              </Button>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Modal */}
      <Dialog open={!!modal} onOpenChange={() => setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              {SOCIAL_ITEMS.find(s => s.action === modal)?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {modal !== 'freeze' && modal !== 'vault' && (
              <>
                <p className="text-sm text-muted-foreground">Select a friend:</p>
                {friends.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">You need friends to use this! Add some from the Friends page.</p>
                ) : (
                  <Select value={selectedFriend} onValueChange={setSelectedFriend}>
                    <SelectTrigger><SelectValue placeholder="Choose a friend..." /></SelectTrigger>
                    <SelectContent>
                      {friends.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.display_name || f.username}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </>
            )}
            {modal === 'callout' && (
              <Input
                placeholder="Your callout message (max 80 chars)"
                maxLength={80}
                value={calloutText}
                onChange={e => setCalloutText(e.target.value)}
              />
            )}
            {modal === 'freeze' && (
              <p className="text-sm text-muted-foreground">Your current rank will be frozen on the leaderboard for 24hrs. Other players won't see if you slip.</p>
            )}
            {modal === 'vault' && (
              <p className="text-sm text-muted-foreground">A 🔒 Vault will protect your coins from XP Tax and any theft mechanics for 48hrs.</p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setModal(null)}>Cancel</Button>
              <Button
                className="flex-1"
                disabled={loading || (modal !== 'freeze' && modal !== 'vault' && !selectedFriend) || friends.length === 0 && modal !== 'freeze' && modal !== 'vault'}
                onClick={() => execute(modal!, SOCIAL_ITEMS.find(s => s.action === modal)?.price || 0)}
              >
                {loading ? 'Sending...' : 'Confirm'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
