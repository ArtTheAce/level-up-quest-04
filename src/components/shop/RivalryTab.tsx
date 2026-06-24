import { useState } from 'react';
import { useGame } from '@/context/GameContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Coins, Swords, Shield, Trophy, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

// ─────────────────────────────────────────
// Static data
// ─────────────────────────────────────────

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const cardVar = { hidden: { opacity: 0, y: 15, scale: 0.95 }, show: { opacity: 1, y: 0, scale: 1 } };

const SUBJECTS = ['Maths', 'Physics', 'Chemistry', 'Biology', 'English', 'History', 'Geography', 'Economics', 'Computer Science', 'Psychology'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Brutal'] as const;
type Diff = typeof DIFFICULTIES[number];

const CURSE_TASKS: Record<string, Record<Diff, string>> = {
  Maths:              { Easy: 'Solve 10 quadratic equations', Medium: 'Complete a set of integration problems', Hard: 'Prove 3 theorems from scratch', Brutal: 'Solve a full past paper under timed conditions' },
  Physics:            { Easy: 'Answer 10 multiple choice questions', Medium: 'Solve 5 mechanics problems', Hard: 'Derive and explain 3 equations of motion from first principles', Brutal: 'Complete a full past paper under timed conditions' },
  Chemistry:          { Easy: 'Balance 10 chemical equations', Medium: 'Write up notes on organic reaction mechanisms', Hard: 'Complete a set of synthesis pathway problems', Brutal: 'Complete a full past paper under timed conditions' },
  Biology:            { Easy: 'Label 3 biology diagrams', Medium: 'Write a 250-word explanation of a biological process', Hard: 'Summarise an entire topic with diagrams and key terms', Brutal: 'Complete a full past paper under timed conditions' },
  English:            { Easy: 'Annotate a poem for literary devices', Medium: 'Write a 300-word argumentative paragraph on a given prompt', Hard: 'Write a full comparative essay plan and introduction', Brutal: 'Write a full timed essay response under exam conditions' },
  History:            { Easy: 'List 10 key dates for a topic', Medium: 'Write a 300-word PEEL paragraph on a historical event', Hard: 'Write a full essay plan covering 3 arguments', Brutal: 'Complete a full past paper under timed conditions' },
  Geography:          { Easy: 'Sketch and label a geographical diagram', Medium: 'Write a 300-word case study summary', Hard: 'Compare two contrasting case studies in a structured essay', Brutal: 'Complete a full past paper under timed conditions' },
  Economics:          { Easy: 'Draw and explain 3 economic diagrams', Medium: 'Write a 300-word evaluation of an economic policy', Hard: 'Analyse a real-world economic issue using 3 diagrams', Brutal: 'Write a full essay response to a past paper question under timed conditions' },
  'Computer Science': { Easy: 'Trace through 3 algorithm examples by hand', Medium: 'Write and test a function for a given problem', Hard: 'Implement a full data structure with documented code', Brutal: 'Complete a full past paper under timed conditions' },
  Psychology:         { Easy: 'List key studies for a topic with brief summaries', Medium: 'Write a 300-word evaluation of a psychology study', Hard: 'Write a full 16-mark essay plan with AO1, AO2, AO3', Brutal: 'Complete a full past paper under timed conditions' },
};

const XP_FOR_DIFF: Record<Diff, number> = { Easy: 50, Medium: 100, Hard: 200, Brutal: 400 };

interface RivalryItemDef {
  id: string;
  icon: string;
  name: string;
  description: string;
  price: number;
  action: string;
  badge?: string; // e.g. 'NEW' | 'HOT'
}

/** Core rivalry items — sabotage, defence, and wagers */
const RIVALRY_ITEMS: RivalryItemDef[] = [
  {
    id: 'task_curse', icon: '🪄', name: 'Task Curse',
    description: "Force an academic task onto a friend's list. They must complete it to earn XP.",
    price: 500, action: 'curse',
  },
  {
    id: 'xp_tax', icon: '💸', name: 'XP Tax',
    description: "Steal 5% of a friend's next XP earning. They'll see who stole it.",
    price: 450, action: 'xp_tax',
  },
  {
    id: 'rank_steal', icon: '👊', name: 'Rank Steal',
    description: "Slap a 'Dethroned 👊' badge on a friend's leaderboard entry for 24 hrs.",
    price: 400, action: 'rank_steal',
  },
  {
    id: 'silence', icon: '🔇', name: 'Silence',
    description: 'Mute a friend\'s celebration toasts for 24 hrs. They complete tasks in silence.',
    price: 200, action: 'silence',
  },
  {
    id: 'curse_block', icon: '🛡️', name: 'Curse Block',
    description: 'One-time shield. Automatically deflects the next Task Curse sent to you.',
    price: 350, action: 'curse_block',
  },
  {
    id: 'all_in', icon: '🎰', name: 'All-In',
    description: 'Bet coins on completing a specific task in time. Win = 2×. Fail = lose it all.',
    price: 0, action: 'all_in', badge: 'RISK',
  },
  {
    id: 'streak_battle', icon: '⚔️', name: 'Streak Battle',
    description: "Challenge a friend: whoever maintains their streak longest this week wins the wagered coins.",
    price: 0, action: 'streak_battle', badge: 'NEW',
  },
  {
    id: 'xp_wager', icon: '🏆', name: 'XP Wager',
    description: 'Both players stake coins. Complete more tasks than your rival in 48 hrs to win the pot.',
    price: 0, action: 'xp_wager', badge: 'NEW',
  },
];

// ─────────────────────────────────────────
// Component
// ─────────────────────────────────────────

type Friend = { id: string; username: string; display_name: string | null };

export function RivalryTab() {
  const { state, dispatch } = useGame();
  const { user } = useAuth();

  const [modal, setModal] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriend, setSelectedFriend] = useState('');
  const [subject, setSubject] = useState('Maths');
  const [difficulty, setDifficulty] = useState<Diff>('Medium');
  const [betAmount, setBetAmount] = useState('');
  const [betTaskId, setBetTaskId] = useState('');
  const [betHours, setBetHours] = useState('4');
  const [loading, setLoading] = useState(false);

  // FIX: action name stored in purchasedItems is the `action` field (e.g. 'curse'),
  // NOT the `id` field (e.g. 'task_curse'). Previously 'task_curse' was checked but
  // execute() stores 'curse'. This caused Villain Arc to never unlock from Task Curse.
  const hasRivalryPurchase = state.purchasedItems.some(id =>
    ['curse', 'xp_tax', 'rank_steal', 'silence', 'curse_block', 'all_in',
     'streak_battle', 'xp_wager'].includes(id)
  );

  const loadFriends = async () => {
    if (!user) return;
    const { data: fs } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);
    const ids = (fs || []).map(f => f.user_id === user.id ? f.friend_id : f.user_id);
    if (ids.length === 0) { setFriends([]); return; }
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, username, display_name')
      .in('user_id', ids);
    setFriends((profiles || []).map(p => ({ id: p.user_id, username: p.username, display_name: p.display_name })));
  };

  const openModal = async (action: string, price: number) => {
    // For fixed-price items, gate on coins
    if (price > 0 && state.coins < price) {
      toast.error('Not enough coins!', { description: 'Complete tasks to earn more.' });
      return;
    }
    await loadFriends();
    setSelectedFriend('');
    setSubject('Maths');
    setDifficulty('Medium');
    setBetAmount('');
    setBetTaskId('');
    setBetHours('4');
    setModal(action);
  };

  const sendNotification = async (toUserId: string, type: string, message: string, data?: any) => {
    await supabase.from('notifications').insert({
      user_id: toUserId, type, message, data: data || {}, read: false,
    });
  };

  const execute = async (action: string, price: number) => {
    setLoading(true);
    try {
      const senderRes = await supabase
        .from('profiles')
        .select('username, display_name')
        .eq('user_id', user?.id)
        .single();
      const name = senderRes.data?.display_name || senderRes.data?.username || 'Someone';

      // ── Task Curse ──────────────────────────────────────────────
      if (action === 'curse') {
        const taskText = CURSE_TASKS[subject]?.[difficulty] || 'Complete a subject-related academic task';
        const xp = XP_FOR_DIFF[difficulty];
        const priority = difficulty === 'Easy' ? 'easy' : difficulty === 'Medium' ? 'medium' : 'hard';

        const { data: blocked } = await supabase.rpc('consume_curse_block', {
          _target_user_id: selectedFriend,
        });
        if (blocked) {
          toast.error('🛡️ Curse blocked! Their Curse Block deflected it.');
          await sendNotification(selectedFriend, 'curse_blocked', `🛡️ You blocked a curse from ${name}!`, { fromName: name });
          dispatch({ type: 'ADD_COINS', amount: -price });
          dispatch({ type: 'ADD_PURCHASED_ITEM', itemId: action });
          setModal(null);
          return;
        }

        const { error: curseErr } = await supabase.rpc('cast_task_curse', {
          _target_user_id: selectedFriend,
          _title: `👻 CURSED (${subject} · ${difficulty}): ${taskText}`,
          _subject: subject,
          _priority: priority,
        });
        if (curseErr) { toast.error(`Curse failed: ${curseErr.message}`); return; }

        await sendNotification(selectedFriend, 'curse',
          `🪄 ${name} cursed you with a ${difficulty} ${subject} task! Complete it to earn ${xp} XP! 👻`,
          { subject, difficulty, xp, fromName: name },
        );
        toast.success(`Curse cast! 🪄 They've been cursed with a ${difficulty} ${subject} task.`);

      // ── XP Tax ──────────────────────────────────────────────────
      } else if (action === 'xp_tax') {
        await supabase.rpc('cast_effect', {
          _target_user_id: selectedFriend,
          _type: 'xp_tax_pending',
          _payload: { fromUserId: user?.id, fromName: name, percent: 5 },
          _expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
        await sendNotification(selectedFriend, 'xp_tax',
          `💸 ${name} placed an XP Tax on you! They'll steal 5% of your next XP earn.`,
          { fromUserId: user?.id, fromName: name },
        );
        toast.success('XP Tax placed! 💸 You\'ll steal their next 5%.');

      // ── Rank Steal ──────────────────────────────────────────────
      } else if (action === 'rank_steal') {
        await supabase.rpc('cast_effect', {
          _target_user_id: selectedFriend,
          _type: 'dethroned',
          _payload: { fromName: name },
          _expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
        await sendNotification(selectedFriend, 'rank_steal',
          `👊 ${name} dethroned you! A "Dethroned 👊" badge appears on your leaderboard entry for 24 hrs.`,
          { fromName: name },
        );
        toast.success('Dethroned! 👊');

      // ── Silence ─────────────────────────────────────────────────
      // FIX: silence now writes to active_effects so GameContext can read it on load
      // and suppress celebration toasts for the target user.
      } else if (action === 'silence') {
        await supabase.rpc('cast_effect', {
          _target_user_id: selectedFriend,
          _type: 'silence',
          _payload: { fromName: name },
          _expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
        await sendNotification(selectedFriend, 'silence',
          `🔇 ${name} silenced you! Your task completion toasts are muted for 24 hrs.`,
          { fromName: name },
        );
        toast.success('Silenced! 🔇 Their celebration toasts are muted for 24 hrs.');

      // ── Curse Block ──────────────────────────────────────────────
      } else if (action === 'curse_block') {
        if (user) {
          await supabase.from('active_effects').insert({
            user_id: user.id,
            source_user_id: user.id,
            type: 'curse_block',
            payload: {},
            expires_at: null,
          });
        }
        dispatch({ type: 'ADD_PURCHASED_ITEM', itemId: 'curse_block' });
        toast.success('Curse Block active! 🛡️ Next curse will be deflected.');
        setModal(null);
        return; // No coin deduction here; price is already 350 and deducted below

      // ── All-In ───────────────────────────────────────────────────
      } else if (action === 'all_in') {
        const bet = parseInt(betAmount);
        if (!bet || bet <= 0 || bet > state.coins) {
          toast.error('Enter a valid bet amount (must be > 0 and ≤ your coins).');
          return;
        }
        if (!betTaskId) { toast.error('Select a task to bet on.'); return; }
        const expiresAt = new Date(Date.now() + parseInt(betHours) * 60 * 60 * 1000).toISOString();
        dispatch({
          type: 'ADD_TIMED_BOOST',
          boost: { type: 'all_in', bet, taskId: betTaskId, expiresAt },
        });
        dispatch({ type: 'ADD_PURCHASED_ITEM', itemId: 'all_in' });
        dispatch({ type: 'ADD_COINS', amount: -bet }); // Stake the bet amount; no separate access fee
        toast.success(`🎰 All-In started! Complete the task in ${betHours} hr${betHours !== '1' ? 's' : ''} to win ${bet * 2} coins!`);
        setModal(null);
        return;

      // ── Streak Battle ────────────────────────────────────────────
      // NEW: Both players wager coins. Whoever keeps their streak going for the full
      // week wins. Implemented as a friendly notification + active_effect tracker.
      } else if (action === 'streak_battle') {
        const bet = parseInt(betAmount);
        if (!bet || bet <= 0 || bet > state.coins) {
          toast.error('Enter a valid wager amount.');
          return;
        }
        if (!selectedFriend) { toast.error('Choose a friend to challenge.'); return; }
        const endsAt = new Date();
        endsAt.setDate(endsAt.getDate() + (7 - endsAt.getDay())); // next Sunday midnight
        endsAt.setHours(23, 59, 59, 0);
        // Record the battle on both sides
        await supabase.from('active_effects').insert({
          user_id: user!.id,
          source_user_id: selectedFriend,
          type: 'streak_battle_sent',
          payload: { opponentId: selectedFriend, opponentName: '', stake: bet, endsAt: endsAt.toISOString() },
          expires_at: endsAt.toISOString(),
        });
        dispatch({ type: 'ADD_COINS', amount: -bet });
        dispatch({ type: 'ADD_PURCHASED_ITEM', itemId: 'streak_battle' });
        await sendNotification(selectedFriend, 'streak_battle',
          `⚔️ ${name} challenged you to a Streak Battle! Stake: ${bet} coins. Whoever breaks their streak first this week loses. Accept by completing at least one task today!`,
          { fromUserId: user?.id, fromName: name, stake: bet, endsAt: endsAt.toISOString() },
        );
        toast.success(`⚔️ Streak Battle sent! Wager: ${bet} coins. Keep your streak going all week!`);
        setModal(null);
        return;

      // ── XP Wager ─────────────────────────────────────────────────
      // NEW: Both players stake coins. In 48 hrs, whoever completed more tasks wins the pot.
      } else if (action === 'xp_wager') {
        const bet = parseInt(betAmount);
        if (!bet || bet <= 0 || bet > state.coins) {
          toast.error('Enter a valid wager amount.');
          return;
        }
        if (!selectedFriend) { toast.error('Choose a friend to challenge.'); return; }
        const endsAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
        // Snapshot current task count as baseline
        const { data: myGs } = await supabase
          .from('game_state')
          .select('total_tasks_completed')
          .eq('user_id', user!.id)
          .single();
        const baseline = myGs?.total_tasks_completed ?? 0;
        await supabase.from('active_effects').insert({
          user_id: user!.id,
          source_user_id: selectedFriend,
          type: 'xp_wager_active',
          payload: {
            opponentId: selectedFriend,
            stake: bet,
            endsAt,
            myBaseline: baseline,
          },
          expires_at: endsAt,
        });
        dispatch({ type: 'ADD_COINS', amount: -bet });
        dispatch({ type: 'ADD_PURCHASED_ITEM', itemId: 'xp_wager' });
        await sendNotification(selectedFriend, 'xp_wager',
          `🏆 ${name} challenged you to a 48-hr Task Race! Stake: ${bet} coins each. Whoever completes more tasks in 48 hrs wins the pot. Accept by completing a task now!`,
          { fromUserId: user?.id, fromName: name, stake: bet, endsAt },
        );
        toast.success(`🏆 XP Wager sent! ${bet} coins staked. Out-task your rival in 48 hrs!`);
        setModal(null);
        return;
      }

      // Deduct coins and record purchase for fixed-price items
      if (price > 0) {
        dispatch({ type: 'ADD_COINS', amount: -price });
      }
      dispatch({ type: 'ADD_PURCHASED_ITEM', itemId: action });
      setModal(null);

    } catch (err) {
      console.error('Rivalry action failed:', err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const activeTasks = state.tasks.filter(t => !t.completed);

  // Helper: is execute button disabled?
  const isExecuteDisabled = (action: string): boolean => {
    if (loading) return true;
    if (action === 'curse_block') return false;
    if (action === 'all_in') return !betTaskId || !betAmount || parseInt(betAmount) <= 0;
    if (action === 'streak_battle' || action === 'xp_wager') {
      return !selectedFriend || !betAmount || parseInt(betAmount) <= 0 || friends.length === 0;
    }
    return !selectedFriend || friends.length === 0;
  };

  return (
    <>
      <motion.div variants={container} initial="hidden" animate="show" className="grid sm:grid-cols-2 gap-4">
        {RIVALRY_ITEMS.map(ri => {
          const isFree = ri.price === 0;
          const canAfford = isFree || state.coins >= ri.price;
          return (
            <motion.div
              key={ri.id}
              variants={cardVar}
              whileHover={{ scale: 1.02 }}
              className="glass-card p-5 flex flex-col gap-3 hover:shadow-lg transition-shadow border border-red-500/20 relative"
            >
              {ri.badge && (
                <span className="absolute top-3 right-3 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500 text-white">
                  {ri.badge}
                </span>
              )}
              <div className="flex items-start gap-3">
                <span className="text-3xl">{ri.icon}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-bold">{ri.name}</h3>
                  <p className="text-sm text-muted-foreground">{ri.description}</p>
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between">
                <div className="flex items-center gap-1 text-sm font-bold">
                  {isFree ? (
                    <span className="text-muted-foreground text-xs">Set your wager</span>
                  ) : (
                    <>
                      <Coins className="h-4 w-4 text-coin" />
                      <span className="text-coin">{ri.price}</span>
                    </>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={canAfford ? 'default' : 'outline'}
                  disabled={!canAfford}
                  className={canAfford ? 'bg-red-600 hover:bg-red-700 border-0' : ''}
                  onClick={() => openModal(ri.action, ri.price)}
                >
                  {isFree ? (
                    <><Swords className="h-3 w-3 mr-1" /> Challenge</>
                  ) : (
                    <><Coins className="h-3 w-3 mr-1" />{ri.price}</>
                  )}
                </Button>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* ── How It Works panel ── */}
      <div className="glass-card p-4 space-y-2 border border-border/50">
        <h3 className="font-display font-bold text-sm flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" /> How Rivalry Works
        </h3>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li><strong>Task Curse</strong> — Forces a real academic task on a friend. They earn XP completing it.</li>
          <li><strong>XP Tax</strong> — Passively steals 5% of their next task's XP. Auto-applies, no interaction needed.</li>
          <li><strong>Streak Battle</strong> — Whoever breaks their streak first this week loses the wager.</li>
          <li><strong>XP Wager</strong> — Race to complete the most tasks in 48 hrs. Winner takes the pot.</li>
          <li><strong>All-In</strong> — Bet on yourself: complete a specific task in time and double your coins.</li>
          <li><strong>Curse Block</strong> — A one-time shield. Auto-deflects the next incoming Task Curse.</li>
          <li><strong>Silence</strong> — Mutes the target's celebration toasts for 24 hrs — they complete tasks quietly.</li>
        </ul>
      </div>

      {/* ── Modal ── */}
      <Dialog open={!!modal} onOpenChange={() => setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-red-500">
              {RIVALRY_ITEMS.find(r => r.action === modal)?.icon}{' '}
              {RIVALRY_ITEMS.find(r => r.action === modal)?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">

            {/* Friend picker */}
            {modal !== 'curse_block' && modal !== 'all_in' && (
              friends.length === 0
                ? <p className="text-sm text-muted-foreground italic">You need friends to use this! Add some from the Friends page.</p>
                : (
                  <Select value={selectedFriend} onValueChange={setSelectedFriend}>
                    <SelectTrigger><SelectValue placeholder="Choose a target…" /></SelectTrigger>
                    <SelectContent>
                      {friends.map(f => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.display_name || f.username} (@{f.username})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )
            )}

            {/* Task Curse: subject + difficulty */}
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
                      <SelectItem key={d} value={d}>{d} (+{XP_FOR_DIFF[d]} XP reward for them)</SelectItem>
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

            {/* All-In: task + amount + hours */}
            {modal === 'all_in' && (
              <>
                {activeTasks.length === 0
                  ? <p className="text-sm text-muted-foreground">You have no active tasks to bet on!</p>
                  : (
                    <Select value={betTaskId} onValueChange={setBetTaskId}>
                      <SelectTrigger><SelectValue placeholder="Choose a task to bet on…" /></SelectTrigger>
                      <SelectContent>
                        {activeTasks.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.title.slice(0, 55)}</SelectItem>
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
                    {['1','2','4','6','12','24'].map(h => (
                      <SelectItem key={h} value={h}>{h} hour{h !== '1' ? 's' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {betAmount && parseInt(betAmount) > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Win: <span className="text-green-500 font-bold">{parseInt(betAmount) * 2} coins</span>
                    {' '}· Fail: <span className="text-red-500 font-bold">-{betAmount} coins</span>
                  </p>
                )}
              </>
            )}

            {/* Streak Battle / XP Wager: wager amount */}
            {(modal === 'streak_battle' || modal === 'xp_wager') && (
              <>
                <Input
                  type="number"
                  placeholder={`Wager amount (you have ${state.coins} coins)`}
                  value={betAmount}
                  onChange={e => setBetAmount(e.target.value)}
                  min={1}
                  max={state.coins}
                />
                {betAmount && parseInt(betAmount) > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Winner takes: <span className="text-green-500 font-bold">{parseInt(betAmount) * 2} coins</span>
                    {' '}· Loser loses: <span className="text-red-500 font-bold">-{betAmount} coins</span>
                  </p>
                )}
                {modal === 'streak_battle' && (
                  <p className="text-xs text-muted-foreground bg-muted rounded p-2">
                    ⚔️ <strong>Streak Battle:</strong> Both players keep completing tasks daily. Whoever misses a day first loses their stake. Battle ends this Sunday at midnight.
                  </p>
                )}
                {modal === 'xp_wager' && (
                  <p className="text-xs text-muted-foreground bg-muted rounded p-2">
                    🏆 <strong>XP Wager:</strong> Whoever completes more tasks in the next 48 hours wins. Task count is snapshotted now as the baseline.
                  </p>
                )}
              </>
            )}

            {modal === 'curse_block' && (
              <p className="text-sm text-muted-foreground">
                A Curse Block will automatically deflect the next Task Curse sent to you. It is consumed on use. You can stack multiple blocks.
              </p>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setModal(null)}>Cancel</Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700"
                disabled={isExecuteDisabled(modal ?? '')}
                onClick={() => execute(modal!, RIVALRY_ITEMS.find(r => r.action === modal)?.price || 0)}
              >
                {loading ? 'Executing…' : 'Execute 🎯'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
