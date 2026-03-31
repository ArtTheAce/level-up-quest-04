import { useState } from 'react';
import { useGame } from '@/context/GameContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Coins, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const cardVar = { hidden: { opacity: 0, y: 15, scale: 0.95 }, show: { opacity: 1, y: 0, scale: 1 } };

const SUBJECTS = ['Maths', 'Physics', 'Chemistry', 'Biology', 'English', 'History', 'Geography', 'Economics', 'Computer Science', 'Psychology'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Brutal'] as const;
type Diff = typeof DIFFICULTIES[number];

const CURSE_TASKS: Record<string, Record<Diff, string>> = {
  Maths:            { Easy: 'Solve 10 quadratic equations', Medium: 'Complete a set of integration problems', Hard: 'Prove 3 theorems from scratch', Brutal: 'Solve a full past paper under timed conditions' },
  Physics:          { Easy: 'Answer 10 multiple choice questions', Medium: 'Solve 5 mechanics problems', Hard: 'Derive and explain 3 equations of motion from first principles', Brutal: 'Complete a full past paper under timed conditions' },
  Chemistry:        { Easy: 'Balance 10 chemical equations', Medium: 'Write up notes on organic reaction mechanisms', Hard: 'Complete a set of synthesis pathway problems', Brutal: 'Complete a full past paper under timed conditions' },
  Biology:          { Easy: 'Label 3 biology diagrams', Medium: 'Write a 250-word explanation of a biological process', Hard: 'Summarise an entire topic with diagrams and key terms', Brutal: 'Complete a full past paper under timed conditions' },
  English:          { Easy: 'Annotate a poem for literary devices', Medium: 'Write a 300-word argumentative paragraph on a given prompt', Hard: 'Write a full comparative essay plan and introduction', Brutal: 'Write a full timed essay response under exam conditions' },
  History:          { Easy: 'List 10 key dates for a topic', Medium: 'Write a 300-word PEEL paragraph on a historical event', Hard: 'Write a full essay plan covering 3 arguments', Brutal: 'Complete a full past paper under timed conditions' },
  Geography:        { Easy: 'Sketch and label a geographical diagram', Medium: 'Write a 300-word case study summary', Hard: 'Compare two contrasting case studies in a structured essay', Brutal: 'Complete a full past paper under timed conditions' },
  Economics:        { Easy: 'Draw and explain 3 economic diagrams', Medium: 'Write a 300-word evaluation of an economic policy', Hard: 'Analyse a real-world economic issue using 3 diagrams', Brutal: 'Write a full essay response to a past paper question under timed conditions' },
  'Computer Science': { Easy: 'Trace through 3 algorithm examples by hand', Medium: 'Write and test a function for a given problem', Hard: 'Implement a full data structure with documented code', Brutal: 'Complete a full past paper under timed conditions' },
  Psychology:       { Easy: 'List key studies for a topic with brief summaries', Medium: 'Write a 300-word evaluation of a psychology study', Hard: 'Write a full 16-mark essay plan with AO1, AO2, AO3', Brutal: 'Complete a full past paper under timed conditions' },
};

const XP_FOR_DIFF: Record<Diff, number> = { Easy: 50, Medium: 100, Hard: 200, Brutal: 400 };

interface RivalryItemDef {
  id: string; icon: string; name: string; description: string; price: number; action: string;
}

const RIVALRY_ITEMS: RivalryItemDef[] = [
  { id: 'task_curse',  icon: '🪄', name: 'Task Curse',   description: "Force a subject-specific academic task onto a friend's list. They must complete it.",          price: 500, action: 'curse' },
  { id: 'xp_tax',     icon: '💸', name: 'XP Tax',       description: "Steal 5% of a friend's next XP earning. They'll know it was you.",                            price: 450, action: 'xp_tax' },
  { id: 'rank_steal', icon: '👊', name: 'Rank Steal',   description: "Force a 'Dethroned 👊' badge onto a friend's leaderboard entry for 24hrs.",                   price: 400, action: 'rank_steal' },
  { id: 'silence',    icon: '🔇', name: 'Silence',      description: "Cut off a friend's celebration notifications for 24hrs.",                                      price: 200, action: 'silence' },
  { id: 'curse_block',icon: '🛡️', name: 'Curse Block',  description: 'One-time shield against any incoming Task Curse.',                                             price: 350, action: 'curse_block' },
  { id: 'all_in',     icon: '🎰', name: 'All-In',       description: 'Bet your coins on completing a task in time. Win = 2x. Fail = lose it all.',                   price: 600, action: 'all_in' },
];

export function RivalryTab() {
  const { state, dispatch } = useGame();
  const { user } = useAuth();
  const [modal, setModal] = useState<string | null>(null);
  const [friends, setFriends] = useState<{ id: string; username: string; display_name: string | null }[]>([]);
  const [selectedFriend, setSelectedFriend] = useState('');
  const [subject, setSubject] = useState('Maths');
  const [difficulty, setDifficulty] = useState<Diff>('Medium');
  const [betAmount, setBetAmount] = useState('');
  const [betTaskId, setBetTaskId] = useState('');
  const [betHours, setBetHours] = useState('4');
  const [loading, setLoading] = useState(false);

  const hasRivalryPurchase = state.purchasedItems.some(id =>
    ['task_curse', 'xp_tax', 'rank_steal', 'silence', 'curse_block', 'all_in'].includes(id)
  );

  const openModal = async (action: string, price: number) => {
    if (state.coins < price) { toast.error('Not enough coins!'); return; }
    if (user) {
      const { data: fs } = await supabase.from('friendships').select('user_id, friend_id').or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);
      const ids = (fs || []).map(f => f.user_id === user.id ? f.friend_id : f.user_id);
      if (ids.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, username, display_name').in('user_id', ids);
        setFriends((profiles || []).map(p => ({ id: p.user_id, username: p.username, display_name: p.display_name })));
      }
    }
    setSelectedFriend(''); setSubject('Maths'); setDifficulty('Medium'); setBetAmount(''); setBetTaskId(''); setBetHours('4');
    setModal(action);
  };

  const sendNotification = async (toUserId: string, type: string, message: string, data?: any) => {
    await supabase.from('notifications').insert({ user_id: toUserId, type, message, data: data || {}, read: false });
  };

  const execute = async (action: string, price: number) => {
    setLoading(true);
    try {
      const senderRes = await supabase.from('profiles').select('username, display_name').eq('user_id', user?.id).single();
      const name = senderRes.data?.display_name || senderRes.data?.username || 'Someone';

      if (action === 'curse') {
        const taskText = CURSE_TASKS[subject]?.[difficulty] || 'Complete a subject-related academic task';
        const xp = XP_FOR_DIFF[difficulty];
        // Insert cursed task into target's tasks
        await supabase.from('tasks').insert({
          user_id: selectedFriend,
          title: `👻 CURSED (${subject} · ${difficulty}): ${taskText}`,
          completed: false,
          priority: difficulty === 'Easy' ? 'easy' : difficulty === 'Medium' ? 'medium' : 'hard',
          subject,
          subject_color: 'other',
          deadline: null,
          created_at: new Date().toISOString(),
        });
        await sendNotification(selectedFriend, 'curse', `🪄 ${name} cursed you with a ${difficulty} ${subject} task! Complete it to earn ${xp} XP! 👻`, {
          subject, difficulty, xp, fromName: name,
        });
        toast.success(`Curse cast! 🪄 They've been given a ${difficulty} ${subject} task.`);
      } else if (action === 'xp_tax') {
        await sendNotification(selectedFriend, 'xp_tax', `💸 ${name} placed an XP Tax on you! They'll steal 5% of your next XP earn.`, {
          fromUserId: user?.id, fromName: name,
        });
        toast.success(`XP Tax placed on them! 💸 You'll steal their next 5%.`);
      } else if (action === 'rank_steal') {
        await sendNotification(selectedFriend, 'rank_steal', `👊 ${name} dethroned you! A "Dethroned 👊" badge will appear on your leaderboard entry for 24hrs.`, {
          fromName: name, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
        toast.success(`Dethroned them! 👊`);
      } else if (action === 'silence') {
        await sendNotification(selectedFriend, 'silence', `🔇 ${name} silenced you! Your celebration notifications are muted for 24hrs.`, {
          fromName: name, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
        toast.success(`Silenced! 🔇 They won't hear any celebrations for 24hrs.`);
      } else if (action === 'curse_block') {
        // Mark curse_block as purchased (acts as inventory item)
        dispatch({ type: 'ADD_COINS', amount: 0 }); // trigger state update
        toast.success('Curse Block active! 🛡️ Next curse sent to you will be deflected.');
      } else if (action === 'all_in') {
        const bet = parseInt(betAmount);
        if (!bet || bet <= 0 || bet > state.coins) { toast.error('Enter a valid bet amount.'); setLoading(false); return; }
        if (!betTaskId) { toast.error('Select a task to bet on.'); setLoading(false); return; }
        const expiresAt = new Date(Date.now() + parseInt(betHours) * 60 * 60 * 1000).toISOString();
        await supabase.from('game_state').update({
          active_boosts: [...(state.activeBoosts as any), {
            type: 'all_in',
            bet, taskId: betTaskId, expiresAt,
          }] as any,
        }).eq('user_id', user?.id);
        dispatch({ type: 'ADD_COINS', amount: -bet });
        toast.success(`🎰 All-In started! Complete your task in ${betHours}hrs to win ${bet * 2} coins!`);
        setModal(null);
        setLoading(false);
        return;
      }

      dispatch({ type: 'ADD_COINS', amount: -price });
      // Mark as purchased so Villain Arc can unlock
      if (!state.purchasedItems.includes(action)) {
        dispatch({ type: 'PURCHASE_ITEM', item: { id: action, name: action, description: '', icon: '', price: 0, category: 'powerup' } as any });
      }
      setModal(null);
    } catch { toast.error('Something went wrong'); }
    setLoading(false);
  };

  const activeTasks = state.tasks.filter(t => !t.completed);

  return (
    <>
      <motion.div variants={container} initial="hidden" animate="show" className="grid sm:grid-cols-2 gap-4">
        {RIVALRY_ITEMS.map(ri => {
          const isVillainArcCheck = ri.id === 'curse_block'; // just example; Villain Arc is in Avatars
          return (
            <motion.div
              key={ri.id}
              variants={cardVar}
              whileHover={{ scale: 1.02 }}
              className="glass-card p-5 flex flex-col gap-3 hover:shadow-lg transition-shadow border border-red-500/20"
            >
              <div className="flex items-start gap-3">
                <span className="text-3xl">{ri.icon}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-bold">{ri.name}</h3>
                  <p className="text-sm text-muted-foreground">{ri.description}</p>
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between">
                <div className="flex items-center gap-1 text-coin font-bold text-sm">
                  <Coins className="h-4 w-4" />{ri.price}
                </div>
                <Button
                  size="sm"
                  variant={state.coins < ri.price ? 'outline' : 'default'}
                  disabled={state.coins < ri.price}
                  className={state.coins >= ri.price ? 'bg-red-600 hover:bg-red-700 border-0' : ''}
                  onClick={() => openModal(ri.action, ri.price)}
                >
                  <Coins className="h-3 w-3 mr-1" />{ri.price}
                </Button>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      <Dialog open={!!modal} onOpenChange={() => setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-red-500">
              {RIVALRY_ITEMS.find(r => r.action === modal)?.icon} {RIVALRY_ITEMS.find(r => r.action === modal)?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Friend picker for actions that target someone */}
            {modal !== 'curse_block' && modal !== 'all_in' && (
              <>
                {friends.length === 0
                  ? <p className="text-sm text-muted-foreground italic">You need friends to use this! Add some from the Friends page.</p>
                  : (
                    <Select value={selectedFriend} onValueChange={setSelectedFriend}>
                      <SelectTrigger><SelectValue placeholder="Choose a target..." /></SelectTrigger>
                      <SelectContent>
                        {friends.map(f => (
                          <SelectItem key={f.id} value={f.id}>{f.display_name || f.username}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )
                }
              </>
            )}

            {/* Task Curse extras */}
            {modal === 'curse' && (
              <>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={difficulty} onValueChange={v => setDifficulty(v as Diff)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIFFICULTIES.map(d => (
                      <SelectItem key={d} value={d}>{d} (+{XP_FOR_DIFF[d]} XP for them)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {subject && difficulty && (
                  <div className="bg-muted rounded-lg p-3 text-sm">
                    <p className="text-muted-foreground text-xs mb-1">Task that will be assigned:</p>
                    <p className="font-medium">👻 {CURSE_TASKS[subject]?.[difficulty]}</p>
                  </div>
                )}
              </>
            )}

            {/* All-In extras */}
            {modal === 'all_in' && (
              <>
                {activeTasks.length === 0
                  ? <p className="text-sm text-muted-foreground">You have no active tasks to bet on!</p>
                  : (
                    <Select value={betTaskId} onValueChange={setBetTaskId}>
                      <SelectTrigger><SelectValue placeholder="Choose a task to bet on..." /></SelectTrigger>
                      <SelectContent>
                        {activeTasks.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.title.slice(0, 50)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )
                }
                <Input
                  type="number"
                  placeholder={`Bet amount (you have ${state.coins} coins)`}
                  value={betAmount}
                  onChange={e => setBetAmount(e.target.value)}
                  min={1}
                  max={state.coins}
                />
                <Select value={betHours} onValueChange={setBetHours}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['1','2','4','6','12','24'].map(h => <SelectItem key={h} value={h}>{h} hour{h !== '1' ? 's' : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
                {betAmount && <p className="text-sm text-muted-foreground">Win: <span className="text-green-500 font-bold">{parseInt(betAmount) * 2} coins</span> · Lose: <span className="text-red-500 font-bold">-{betAmount} coins</span></p>}
              </>
            )}

            {modal === 'curse_block' && (
              <p className="text-sm text-muted-foreground">A Curse Block will automatically deflect the next Task Curse sent your way. It is consumed on use.</p>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setModal(null)}>Cancel</Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700"
                disabled={loading || (modal !== 'curse_block' && modal !== 'all_in' && !selectedFriend && friends.length > 0)}
                onClick={() => execute(modal!, RIVALRY_ITEMS.find(r => r.action === modal)?.price || 0)}
              >
                {loading ? 'Executing...' : 'Execute 🎯'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
