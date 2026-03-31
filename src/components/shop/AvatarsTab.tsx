import { useState } from 'react';
import { useGame } from '@/context/GameContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const cardVar = { hidden: { opacity: 0, y: 15, scale: 0.95 }, show: { opacity: 1, y: 0, scale: 1 } };

type AuraType = 'flame' | 'ice' | 'lightning' | 'villain' | 'none';

const RARE_TITLES = ['👁️ Watcher', '🐺 Lone Wolf', '💀 Untouchable', '⚡ Overachiever'];

// Aura preview CSS
function AuraPreview({ type, letter }: { type: AuraType | string; letter: string }) {
  const styles: Record<string, React.CSSProperties> = {
    flame:     { boxShadow: '0 0 0 3px #f97316, 0 0 12px 4px #f97316aa', animation: 'pulse 1.5s infinite' },
    ice:       { boxShadow: '0 0 0 3px #67e8f9, 0 0 12px 4px #67e8f9aa' },
    lightning: { boxShadow: '0 0 0 3px #fde047, 0 0 12px 6px #fde04799' },
    villain:   { boxShadow: '0 0 0 3px #ef4444, 0 0 16px 6px #ef444499', filter: 'contrast(1.1)' },
    ghost:     { filter: 'grayscale(1) opacity(0.5)' },
    none:      { boxShadow: '0 0 0 2px hsl(var(--border))' },
  };
  return (
    <div
      className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-display font-bold shrink-0"
      style={styles[type] || styles.none}
    >
      {letter}
    </div>
  );
}

interface AvatarItemDef {
  id: string; icon: string; name: string; description: string; price: number;
  auraKey?: AuraType; requiresRivalry?: boolean;
}

const AVATAR_ITEMS: AvatarItemDef[] = [
  { id: 'streak_crown',  icon: '👑', name: 'Streak Crown',   description: "Worn by whoever has the longest active streak in the group. Transfers automatically.",         price: 500 },
  { id: 'flame_aura',    icon: '🔥', name: 'Flame Aura',     description: 'Animated fire ring around your avatar. Persistent until replaced.',                            price: 400, auraKey: 'flame' },
  { id: 'ice_aura',      icon: '❄️', name: 'Ice Aura',       description: 'Cool icy glowing ring around your avatar. Persistent until replaced.',                         price: 400, auraKey: 'ice' },
  { id: 'lightning_frame',icon: '⚡',name: 'Lightning Frame', description: 'Electric animated border around your avatar. Persistent until replaced.',                      price: 350, auraKey: 'lightning' },
  { id: 'ghost_mode',    icon: '👻', name: 'Ghost Mode',     description: 'Your rank shows as ??? to everyone for 48hrs. Disappear from the radar.',                      price: 300 },
  { id: 'villain_arc',   icon: '😈', name: 'Villain Arc',    description: 'Dark cracked frame with red glow. Unlocks after buying any Rivalry item.',                     price: 450, auraKey: 'villain', requiresRivalry: true },
  { id: 'custom_title',  icon: '🏷️', name: 'Custom Title',   description: 'Set a short title shown under your name everywhere.',                                           price: 250 },
  { id: 'mystery_box',   icon: '🎁', name: 'Mystery Avatar Box', description: 'Random avatar item — could be common or ultra rare.',                                      price: 150 },
];

const PROFANITY = ['fuck', 'shit', 'bitch', 'ass', 'dick', 'cock', 'cunt', 'bastard', 'piss'];
function hasProfanity(text: string) {
  return PROFANITY.some(w => text.toLowerCase().includes(w));
}

export function AvatarsTab() {
  const { state, dispatch } = useGame();
  const { user } = useAuth();
  const [modal, setModal] = useState<string | null>(null);
  const [titleInput, setTitleInput] = useState('');
  const [revealItem, setRevealItem] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [loading, setLoading] = useState(false);

  const hasRivalryPurchase = ['task_curse', 'xp_tax', 'rank_steal', 'silence', 'curse_block', 'all_in',
    'curse', 'xp_tax', 'rank_steal', 'silence', 'curse_block', 'all_in'].some(id => state.purchasedItems.includes(id));

  const activeAura: string = (state as any).activeAura || 'none';
  const activeTitle: string = (state as any).customTitle || '';

  const saveAura = async (aura: AuraType) => {
    if (!user) return;
    await supabase.from('game_state').update({ active_boosts: state.activeBoosts as any } as any).eq('user_id', user.id);
    // We store aura in the purchased_items list as a signal + dispatch
    dispatch({ type: 'SET_AVATAR_AURA', aura } as any);
  };

  const execute = async (itemId: string) => {
    const def = AVATAR_ITEMS.find(a => a.id === itemId);
    if (!def) return;

    if (state.coins < def.price) { toast.error('Not enough coins!'); return; }

    if (def.requiresRivalry && !hasRivalryPurchase) {
      toast.error('Unlock requires a Rivalry purchase first!');
      return;
    }

    setLoading(true);

    if (itemId === 'mystery_box') {
      // Spin animation then reveal
      setSpinning(true);
      setModal('mystery_reveal');
      await new Promise(r => setTimeout(r, 2000));
      setSpinning(false);
      // Roll random item
      const pool = ['flame_aura', 'ice_aura', 'lightning_frame', 'ghost_mode', ...RARE_TITLES];
      const rolled = pool[Math.floor(Math.random() * pool.length)];
      const alreadyOwned = state.purchasedItems.includes(rolled);
      if (alreadyOwned) {
        dispatch({ type: 'ADD_COINS', amount: -def.price + 50 }); // refund 50
        setRevealItem('refund');
        toast('Already owned — 50 coins refunded 💰');
      } else {
        dispatch({ type: 'ADD_COINS', amount: -def.price });
        setRevealItem(rolled);
        if (RARE_TITLES.includes(rolled)) {
          // Apply as title
          dispatch({ type: 'SET_CUSTOM_TITLE', title: rolled } as any);
          await supabase.from('profiles').update({ display_name: rolled }).eq('user_id', user?.id || '');
        } else {
          dispatch({ type: 'PURCHASE_ITEM', item: { id: rolled, name: rolled, description: '', icon: '', price: 0, category: 'powerup', oneTime: true } as any });
        }
        toast.success(`You got: ${rolled}! 🎉`);
      }
      setLoading(false);
      return;
    }

    if (itemId === 'custom_title') {
      setModal('custom_title');
      setLoading(false);
      return;
    }

    if (itemId === 'ghost_mode') {
      dispatch({ type: 'ADD_COINS', amount: -def.price });
      await supabase.from('game_state').update({
        active_boosts: [...(state.activeBoosts as any), {
          type: 'ghost_mode',
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        }] as any,
      }).eq('user_id', user?.id || '');
      toast.success('👻 Ghost Mode active for 48hrs! Your rank shows as ??? to everyone.');
      setLoading(false);
      return;
    }

    if (itemId === 'streak_crown') {
      dispatch({ type: 'ADD_COINS', amount: -def.price });
      dispatch({ type: 'PURCHASE_ITEM', item: { id: 'streak_crown', name: 'Streak Crown', description: '', icon: '👑', price: 0, category: 'powerup', oneTime: true } as any });
      toast.success('👑 Streak Crown purchased! It will appear above the player with the longest streak in your group.');
      setLoading(false);
      return;
    }

    // Aura items
    if (def.auraKey) {
      dispatch({ type: 'ADD_COINS', amount: -def.price });
      dispatch({ type: 'PURCHASE_ITEM', item: { id: itemId, name: def.name, description: '', icon: def.icon, price: 0, category: 'powerup', oneTime: true } as any });
      // Store active aura in supabase
      const currentBoosts = state.activeBoosts as any[];
      const filteredBoosts = currentBoosts.filter((b: any) => !['flame_aura','ice_aura','lightning_frame','villain_arc'].includes(b.type));
      await supabase.from('game_state').update({
        active_boosts: [...filteredBoosts, { type: def.auraKey }] as any,
      }).eq('user_id', user?.id || '');
      toast.success(`${def.icon} ${def.name} applied to your avatar!`);
    }

    setLoading(false);
  };

  const saveTitle = async () => {
    if (!titleInput.trim()) { toast.error('Enter a title!'); return; }
    if (hasProfanity(titleInput)) { toast.error('That title contains inappropriate language.'); return; }
    if (titleInput.length > 20) { toast.error('Title must be 20 characters or fewer.'); return; }
    setLoading(true);
    dispatch({ type: 'ADD_COINS', amount: -250 });
    await supabase.from('profiles').update({ display_name: titleInput.trim() }).eq('user_id', user?.id || '');
    toast.success(`🏷️ Title set to "${titleInput}"!`);
    setModal(null);
    setTitleInput('');
    setLoading(false);
  };

  const getMysteryLabel = (item: string | null) => {
    if (!item) return '';
    if (item === 'refund') return '💰 Already owned — 50 coins refunded!';
    if (item === 'flame_aura') return '🔥 Flame Aura';
    if (item === 'ice_aura') return '❄️ Ice Aura';
    if (item === 'lightning_frame') return '⚡ Lightning Frame';
    if (item === 'ghost_mode') return '👻 Ghost Mode';
    return item; // rare title
  };

  return (
    <>
      <motion.div variants={container} initial="hidden" animate="show" className="grid sm:grid-cols-2 gap-4">
        {AVATAR_ITEMS.map(ai => {
          const locked = ai.requiresRivalry && !hasRivalryPurchase;
          const owned = state.purchasedItems.includes(ai.id);

          return (
            <motion.div
              key={ai.id}
              variants={cardVar}
              whileHover={{ scale: locked ? 1 : 1.02 }}
              className={`glass-card p-5 flex flex-col gap-3 transition-shadow relative ${locked ? 'opacity-60' : 'hover:shadow-lg'}`}
            >
              {locked && (
                <div className="absolute top-3 right-3 group cursor-default">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <div className="absolute right-0 top-5 bg-popover border border-border rounded-lg px-3 py-1.5 text-xs w-48 opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg pointer-events-none">
                    Buy any Rivalry item to unlock
                  </div>
                </div>
              )}

              {/* Avatar preview */}
              <div className="flex items-start gap-3">
                <AuraPreview
                  type={ai.auraKey || (ai.id === 'ghost_mode' ? 'ghost' : 'none')}
                  letter="Q"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-bold flex items-center gap-2">
                    {ai.icon} {ai.name}
                    {owned && ai.id !== 'mystery_box' && ai.id !== 'custom_title' && ai.id !== 'streak_crown' && (
                      <span className="text-xs text-primary font-medium">✓ Owned</span>
                    )}
                  </h3>
                  <p className="text-sm text-muted-foreground">{ai.description}</p>
                </div>
              </div>

              <div className="mt-auto flex items-center justify-between">
                <div className="flex items-center gap-1 text-coin font-bold text-sm">
                  <Coins className="h-4 w-4" />{ai.price}
                </div>
                <Button
                  size="sm"
                  disabled={locked || loading || state.coins < ai.price}
                  variant={state.coins < ai.price || locked ? 'outline' : 'default'}
                  onClick={() => execute(ai.id)}
                >
                  {locked ? <><Lock className="h-3 w-3 mr-1" />Locked</> : <><Coins className="h-3 w-3 mr-1" />{ai.price}</>}
                </Button>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Custom Title Modal */}
      <Dialog open={modal === 'custom_title'} onOpenChange={() => setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">🏷️ Set Your Custom Title</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">This title will appear under your name on your profile and the leaderboard.</p>
            <Input
              placeholder="e.g. Unbothered, On a Mission, Dangerous…"
              maxLength={20}
              value={titleInput}
              onChange={e => setTitleInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveTitle()}
            />
            <p className="text-xs text-muted-foreground">{titleInput.length}/20 characters</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setModal(null)}>Cancel</Button>
              <Button className="flex-1" onClick={saveTitle} disabled={loading || !titleInput.trim()}>
                {loading ? 'Saving...' : 'Set Title (250 🪙)'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mystery Box Reveal Modal */}
      <Dialog open={modal === 'mystery_reveal'} onOpenChange={() => { setModal(null); setRevealItem(null); }}>
        <DialogContent className="text-center">
          <DialogHeader>
            <DialogTitle className="font-display text-center">🎁 Mystery Avatar Box</DialogTitle>
          </DialogHeader>
          <div className="py-8 flex flex-col items-center gap-4">
            <AnimatePresence mode="wait">
              {spinning ? (
                <motion.div
                  key="spinning"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.4, ease: 'linear' }}
                  className="text-6xl"
                >
                  🎁
                </motion.div>
              ) : (
                <motion.div
                  key="revealed"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                  className="text-6xl"
                >
                  {revealItem === 'refund' ? '💰' :
                   revealItem === 'flame_aura' ? '🔥' :
                   revealItem === 'ice_aura' ? '❄️' :
                   revealItem === 'lightning_frame' ? '⚡' :
                   revealItem === 'ghost_mode' ? '👻' : '✨'}
                </motion.div>
              )}
            </AnimatePresence>
            {!spinning && revealItem && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-display font-bold text-xl"
              >
                {getMysteryLabel(revealItem)}
              </motion.p>
            )}
            {spinning && <p className="text-muted-foreground">Opening your box…</p>}
          </div>
          {!spinning && (
            <Button onClick={() => { setModal(null); setRevealItem(null); }}>
              Nice! 🎉
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
