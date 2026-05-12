import { useState } from 'react';
import { useGame, SHOP_ITEMS, EARNABLE_BADGES, type ShopItem, type ThemeId } from '@/context/GameContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, ShoppingBag, Zap, Palette, Award, Check, ShieldCheck, Lock, Users, Swords, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { SocialTab } from '@/components/shop/SocialTab';
import { RivalryTab } from '@/components/shop/RivalryTab';
import { AvatarsTab } from '@/components/shop/AvatarsTab';

const CATEGORIES = [
  { id: 'powerup' as const,  label: 'Power-Ups', icon: Zap },
  { id: 'theme' as const,    label: 'Themes',    icon: Palette },
  { id: 'badges' as const,   label: 'Badges',    icon: Award },
  { id: 'social' as const,   label: 'Social',    icon: Users },
  { id: 'rivalry' as const,  label: 'Rivalry',   icon: Swords },
  { id: 'avatars' as const,  label: 'Avatars',   icon: Sparkles },
];

type Category = typeof CATEGORIES[number]['id'];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 15, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1 },
};

export default function Shop() {
  const { state, dispatch } = useGame();
  const [activeCategory, setActiveCategory] = useState<Category>('powerup');

  const filteredItems = SHOP_ITEMS.filter(i => i.category === activeCategory);

  const isPurchased = (itemId: string) => state.purchasedItems.includes(itemId);
  const isEquippedTheme = (itemId: string) => {
    const themeId = itemId.replace('theme_', '') as ThemeId;
    return state.activeTheme === themeId;
  };
  const isEquippedBadge = (badgeId: string) => state.equippedBadge === badgeId;
  const isBadgeEarned = (badgeId: string) => state.earnedBadges.includes(badgeId);

  const handlePurchase = (shopItem: ShopItem) => {
    // Ownership check FIRST — owned items must never re-trigger a coin check.
    if (shopItem.oneTime && isPurchased(shopItem.id)) {
      if (shopItem.category === 'theme') {
        const themeId = shopItem.id.replace('theme_', '') as ThemeId;
        if (isEquippedTheme(shopItem.id)) return;
        dispatch({ type: 'SET_THEME', themeId });
        toast.success(`${shopItem.name} theme equipped! ${shopItem.icon}`);
      }
      return;
    }
    if (state.coins < shopItem.price) {
      toast.error('Not enough coins!', { description: 'Complete more tasks to earn coins.' });
      return;
    }
    dispatch({ type: 'PURCHASE_ITEM', item: shopItem });
    if (shopItem.category === 'powerup') {
      toast.success(`${shopItem.name} activated! ${shopItem.icon}`, { description: shopItem.description });
    } else {
      toast.success(`${shopItem.name} unlocked! ${shopItem.icon}`);
    }
  };

  const getButtonState = (shopItem: ShopItem) => {
    if (shopItem.oneTime && isPurchased(shopItem.id)) {
      if (shopItem.category === 'theme') {
        return isEquippedTheme(shopItem.id)
          ? { label: 'Active',  variant: 'secondary' as const, disabled: true }
          : { label: 'Equip',   variant: 'outline'   as const, disabled: false };
      }
      return { label: 'Owned', variant: 'secondary' as const, disabled: true };
    }
    return {
      label: `${shopItem.price}`,
      variant: state.coins >= shopItem.price ? ('default' as const) : ('outline' as const),
      disabled: state.coins < shopItem.price,
    };
  };

  const activeBoosts = state.activeBoosts.filter(b => b.remainingTasks > 0);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-2">
            <ShoppingBag className="h-8 w-8 text-primary" /> Shop
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Spend coins on power-ups & themes. Earn badges through milestones!</p>
        </div>
        <div className="glass-card px-4 py-2 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg coin-gradient flex items-center justify-center">
            <Coins className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-xl">{state.coins}</span>
        </div>
      </div>

      {/* Active Boosts Banner */}
      <AnimatePresence>
        {activeBoosts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card p-4 border-primary/30 bg-primary/5"
          >
            <h3 className="font-display font-bold text-sm mb-2 flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> Active Boosts
            </h3>
            <div className="flex gap-3 flex-wrap">
              {activeBoosts.map((boost, i) => (
                <div key={`${boost.type}-${i}`} className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 text-sm">
                  <span>{boost.type === 'xp_3x' ? '🔮' : boost.type === 'xp_2x' ? '⚡' : '💎'}</span>
                  <span className="font-medium">{boost.type === 'xp_3x' ? '3x XP' : boost.type === 'xp_2x' ? '2x XP' : '2x Coins'}</span>
                  <span className="text-muted-foreground">· {boost.remainingTasks} tasks left</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {state.streakFreezes > 0 && (
        <div className="glass-card p-3 flex items-center gap-3 text-sm">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="font-medium">Streak Freezes: {state.streakFreezes}</span>
          <span className="text-muted-foreground">— Your streak is protected!</span>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeCategory === cat.id
                ? 'bg-primary text-primary-foreground shadow-md'
                : cat.id === 'rivalry'
                ? 'bg-muted text-muted-foreground hover:bg-red-500/10 hover:text-red-500'
                : 'bg-muted text-muted-foreground hover:bg-secondary'
            }`}
          >
            <cat.icon className="h-4 w-4" />
            {cat.label}
          </button>
        ))}
      </div>

      {/* Social Tab */}
      {activeCategory === 'social' && <SocialTab />}

      {/* Rivalry Tab */}
      {activeCategory === 'rivalry' && <RivalryTab />}

      {/* Avatars Tab */}
      {activeCategory === 'avatars' && <AvatarsTab />}

      {/* Badges */}
      {activeCategory === 'badges' && (
        <motion.div key="badges" variants={container} initial="hidden" animate="show" className="space-y-4">
          <p className="text-sm text-muted-foreground">Badges are earned by hitting milestones — not bought. Keep grinding! 💪</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {EARNABLE_BADGES.map(badge => {
              const earned = isBadgeEarned(badge.id);
              const equipped = isEquippedBadge(badge.id);
              return (
                <motion.div
                  key={badge.id}
                  variants={item}
                  whileHover={{ scale: 1.02 }}
                  className={`glass-card p-5 flex flex-col gap-3 relative overflow-hidden transition-shadow ${earned ? 'ring-1 ring-primary/20' : 'opacity-60'}`}
                >
                  {earned && <div className="absolute top-3 right-3"><Check className="h-5 w-5 text-primary" /></div>}
                  {!earned && <div className="absolute top-3 right-3"><Lock className="h-4 w-4 text-muted-foreground" /></div>}
                  <div className="flex items-start gap-3">
                    <span className={`text-3xl ${!earned ? 'grayscale' : ''}`}>{badge.icon}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-bold">{badge.name}</h3>
                      <p className="text-sm text-muted-foreground">{badge.description}</p>
                    </div>
                  </div>
                  <div className="mt-auto flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium">
                      {earned ? '✅ Earned' : `🎯 ${badge.requirement}`}
                    </span>
                    {earned && (
                      <Button
                        size="sm"
                        variant={equipped ? 'secondary' : 'outline'}
                        onClick={() => {
                          const newBadge = equipped ? null : badge.id;
                          dispatch({ type: 'EQUIP_BADGE', badgeId: newBadge });
                          toast.success(newBadge ? `${badge.name} equipped!` : 'Badge unequipped');
                        }}
                      >
                        {equipped ? 'Unequip' : 'Equip'}
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Power-Ups & Themes */}
      {(activeCategory === 'powerup' || activeCategory === 'theme') && (
        <motion.div
          key={activeCategory}
          variants={container}
          initial="hidden"
          animate="show"
          className="grid sm:grid-cols-2 gap-4"
        >
          {activeCategory === 'theme' && (() => {
            const isDefaultActive = state.activeTheme === 'default';
            return (
              <motion.div
                key="theme_default"
                variants={item}
                whileHover={{ scale: 1.02 }}
                className={`glass-card p-5 flex flex-col gap-3 relative overflow-hidden transition-shadow ${isDefaultActive ? 'ring-2 ring-primary' : 'ring-1 ring-primary/20'}`}
              >
                {isDefaultActive && <div className="absolute top-3 right-3"><Check className="h-5 w-5 text-primary" /></div>}
                <div className="flex items-start gap-3">
                  <span className="text-3xl">✨</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold">Default</h3>
                    <p className="text-sm text-muted-foreground">The classic Questify look</p>
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-xs text-primary font-medium">Free</span>
                  <Button
                    size="sm"
                    variant={isDefaultActive ? 'secondary' : 'outline'}
                    disabled={isDefaultActive}
                    onClick={() => {
                      dispatch({ type: 'SET_THEME', themeId: 'default' });
                      toast.success('Default theme activated! ✨');
                    }}
                    className="ml-auto"
                  >
                    {isDefaultActive ? 'Active' : 'Equip'}
                  </Button>
                </div>
              </motion.div>
            );
          })()}
          {filteredItems.map(shopItem => {
            const btnState = getButtonState(shopItem);
            const owned = shopItem.oneTime && isPurchased(shopItem.id);
            const themeActive = activeCategory === 'theme' && owned && isEquippedTheme(shopItem.id);
            return (
              <motion.div
                key={shopItem.id}
                variants={item}
                whileHover={{ scale: 1.02 }}
                className={`glass-card p-5 flex flex-col gap-3 relative overflow-hidden transition-shadow ${themeActive ? 'ring-2 ring-primary' : owned ? 'ring-1 ring-primary/20' : 'hover:shadow-lg'}`}
              >
                {owned && <div className="absolute top-3 right-3"><Check className="h-5 w-5 text-primary" /></div>}
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{shopItem.icon}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold">{shopItem.name}</h3>
                    <p className="text-sm text-muted-foreground">{shopItem.description}</p>
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between">
                  {!owned && (
                    <div className="flex items-center gap-1 text-coin font-bold text-sm">
                      <Coins className="h-4 w-4" />
                      {shopItem.price}
                    </div>
                  )}
                  {owned && <span className="text-xs text-primary font-medium">{themeActive ? 'Equipped' : 'Owned'}</span>}
                  <Button
                    size="sm"
                    variant={btnState.variant}
                    disabled={btnState.disabled}
                    onClick={() => handlePurchase(shopItem)}
                    className="ml-auto"
                  >
                    {!owned && <Coins className="h-3 w-3 mr-1" />}
                    {btnState.label}
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
