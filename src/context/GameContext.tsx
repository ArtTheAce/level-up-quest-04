import React, { createContext, useContext, useReducer, useEffect, ReactNode, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

// Types
export type Priority = 'easy' | 'medium' | 'hard';
export type SubjectColor = 'math' | 'physics' | 'chemistry' | 'english' | 'history' | 'art' | 'music' | 'other';
export type ThemeId = 'default' | 'midnight' | 'sakura' | 'ocean' | 'neon' | 'sunset';

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  priority: Priority;
  subject?: string;
  subjectColor?: SubjectColor;
  deadline?: string;
  createdAt: string;
  description?: string;
  tags?: string[];
}

export interface TimetableEntry {
  id: string;
  subject: string;
  subjectColor: SubjectColor;
  /** Legacy: a single weekday index (Mon=0..Sun=6). Kept for backward compat. */
  day: number;
  /** Weekdays this class repeats on (Mon=0..Sun=6). Source of truth for recurring. */
  days?: number[];
  startTime: string;
  endTime: string;
  teacher?: string;
  room?: string;
  /** If false, this class only appears on specificDate and is never recreated. */
  isRecurring: boolean;
  /** ISO date string (YYYY-MM-DD). Required when isRecurring=false. */
  specificDate?: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  price: number;
  category: 'powerup' | 'theme' | 'badge';
  oneTime?: boolean;
}

export interface ActiveBoost {
  type:
    | 'xp_2x'
    | 'coin_2x'
    | 'xp_3x'
    | 'leaderboard_freeze'
    | 'vault'
    | 'ghost_mode'
    | 'flame'
    | 'ice'
    | 'lightning'
    | 'villain'
    | 'all_in'
    | 'xp_daily'
    | 'focus_boost';
  remainingTasks?: number;
  expiresAt?: string;
  bet?: number;
  taskId?: string;
}

interface GameState {
  xp: number;
  level: number;
  coins: number;
  streak: number;
  lastActiveDate: string;
  tasks: Task[];
  timetable: TimetableEntry[];
  achievements: Achievement[];
  totalTasksCompleted: number;
  focusSessionsCompleted: number;
  purchasedItems: string[];
  activeBoosts: ActiveBoost[];
  streakFreezes: number;
  activeTheme: ThemeId;
  equippedBadge: string | null;
  earnedBadges: string[];
  darkMode: boolean;
  aiTokensUsed: number;
  activeAura: string | null;
  customTitle: string | null;
  loaded: boolean;
  isSilenced: boolean;
}

type Action =
  | { type: 'ADD_TASK'; task: Task }
  | { type: 'UPDATE_TASK'; task: Task }
  | { type: 'TOGGLE_TASK'; taskId: string }
  | { type: 'APPLY_TASK_TOGGLE'; taskId: string; completing: boolean; xpDelta: number; coinDelta: number }
  | { type: 'DELETE_TASK'; taskId: string }
  | { type: 'ADD_TIMETABLE_ENTRY'; entry: TimetableEntry }
  | { type: 'DELETE_TIMETABLE_ENTRY'; entryId: string }
  | { type: 'UPDATE_TIMETABLE_ENTRY'; entry: TimetableEntry }
  | { type: 'ADD_XP'; amount: number }
  | { type: 'ADD_COINS'; amount: number }
  | { type: 'CHECK_STREAK' }
  | { type: 'UNLOCK_ACHIEVEMENT'; achievementId: string }
  | { type: 'PURCHASE_ITEM'; item: ShopItem }
  | { type: 'ADD_PURCHASED_ITEM'; itemId: string }
  | { type: 'ADD_TIMED_BOOST'; boost: ActiveBoost }
  | { type: 'REMOVE_BOOST_TYPE'; boostType: ActiveBoost['type'] }
  | { type: 'SET_AVATAR_AURA'; aura: string | null }
  | { type: 'SET_CUSTOM_TITLE'; title: string | null }
  | { type: 'SET_THEME'; themeId: ThemeId }
  | { type: 'EQUIP_BADGE'; badgeId: string | null }
  | { type: 'ADD_FOCUS_SESSION' }
  | { type: 'SET_DARK_MODE'; enabled: boolean }
  | { type: 'ADD_AI_TOKENS'; amount: number }
  | { type: 'SET_SILENCED'; silenced: boolean }
  | { type: 'LOAD_STATE'; state: Partial<GameState> };

const XP_PER_LEVEL = 100;
const XP_REWARDS: Record<Priority, number> = { easy: 10, medium: 25, hard: 50 };
const COIN_REWARDS: Record<Priority, number> = { easy: 5, medium: 15, hard: 30 };

// Exported so helpers (toggleTask) can replicate boost-aware reward math.
export function computeTaskReward(
  task: Task,
  activeBoosts: ActiveBoost[],
): { xp: number; coins: number } {
  const now = Date.now();
  const hasXp3x = activeBoosts.some(b => b.type === 'xp_3x' && (b.remainingTasks ?? 0) > 0);
  const hasXp2x = activeBoosts.some(b => b.type === 'xp_2x' && (b.remainingTasks ?? 0) > 0);
  const hasCoin2x = activeBoosts.some(b => b.type === 'coin_2x' && (b.remainingTasks ?? 0) > 0);
  // Daily XP boost: +50% XP for all tasks today (time-based)
  const hasDailyXp = activeBoosts.some(
    b => b.type === 'xp_daily' && b.expiresAt && new Date(b.expiresAt).getTime() > now
  );

  const xpMult = hasXp3x ? 3 : hasXp2x ? 2 : hasDailyXp ? 1.5 : 1;
  const coinMult = hasCoin2x ? 2 : 1;
  return {
    xp: Math.round(XP_REWARDS[task.priority] * xpMult),
    coins: COIN_REWARDS[task.priority] * coinMult,
  };
}

const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_task', title: 'First Steps', description: 'Complete your first task', icon: '🎯' },
  { id: 'streak_3', title: 'On Fire!', description: '3-day streak', icon: '🔥' },
  { id: 'streak_7', title: 'Unstoppable', description: '7-day streak', icon: '⚡' },
  { id: 'tasks_10', title: 'Task Master', description: 'Complete 10 tasks', icon: '🏆' },
  { id: 'tasks_50', title: 'Productivity Legend', description: 'Complete 50 tasks', icon: '👑' },
  { id: 'level_5', title: 'Rising Star', description: 'Reach level 5', icon: '⭐' },
  { id: 'level_10', title: 'Scholar', description: 'Reach level 10', icon: '📚' },
  { id: 'focus_complete', title: 'Laser Focus', description: 'Complete a focus session', icon: '🧠' },
  { id: 'first_purchase', title: 'Smart Shopper', description: 'Buy your first item', icon: '🛒' },
  { id: 'coin_hoarder', title: 'Coin Hoarder', description: 'Accumulate 500 coins', icon: '💰' },
];

export const SHOP_ITEMS: ShopItem[] = [
  // --- Power-Ups ---
  { id: 'xp_2x_mini', name: 'XP Spark', description: 'Double XP for the next task', icon: '✨', price: 40, category: 'powerup' },
  { id: 'xp_2x', name: '2x XP Boost', description: 'Double XP for the next 5 tasks', icon: '⚡', price: 150, category: 'powerup' },
  { id: 'xp_mega', name: 'XP Mega Boost', description: 'Triple XP for the next 10 tasks!', icon: '🔮', price: 400, category: 'powerup' },
  { id: 'xp_daily', name: 'Daily XP Surge', description: '+50% XP on every task for the next 24 hours', icon: '🌟', price: 300, category: 'powerup' },
  { id: 'coin_2x_mini', name: 'Coin Spark', description: 'Double coins for the next task', icon: '🪙', price: 40, category: 'powerup' },
  { id: 'coin_2x', name: '2x Coin Boost', description: 'Double coins for the next 5 tasks', icon: '💎', price: 150, category: 'powerup' },
  { id: 'streak_freeze', name: 'Streak Freeze', description: 'Protect your streak for 1 missed day', icon: '🛡️', price: 100, category: 'powerup' },
  { id: 'streak_shield', name: 'Streak Shield', description: 'Heavy protection — covers 2 consecutive missed days', icon: '🏰', price: 220, category: 'powerup' },
  { id: 'lucky_spin', name: 'Lucky Jackpot', description: 'Spin for 50–300 bonus coins — luck matters!', icon: '🎰', price: 120, category: 'powerup' },
  { id: 'focus_boost', name: 'Focus Boost', description: 'Your next focus session grants 2× XP on completion', icon: '🧠', price: 180, category: 'powerup' },
  // --- Themes ---
  { id: 'theme_midnight', name: 'Midnight', description: 'Deep dark purple with light mode variant', icon: '🌙', price: 200, category: 'theme', oneTime: true },
  { id: 'theme_sakura', name: 'Sakura', description: 'Cherry blossom pink — light and dark modes', icon: '🌸', price: 200, category: 'theme', oneTime: true },
  { id: 'theme_ocean', name: 'Ocean', description: 'Deep-sea blue — light and dark modes', icon: '🌊', price: 200, category: 'theme', oneTime: true },
  { id: 'theme_neon', name: 'Neon Glow', description: 'Cyberpunk electric — light and dark modes', icon: '💜', price: 350, category: 'theme', oneTime: true },
  { id: 'theme_sunset', name: 'Sunset', description: 'Warm orange coral — light and dark modes', icon: '🌅', price: 250, category: 'theme', oneTime: true },
];

export interface EarnableBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: string;
}

export const EARNABLE_BADGES: EarnableBadge[] = [
  { id: 'badge_fire', name: 'Fire Badge', description: 'Prove your consistency', icon: '🔥', requirement: '7-day streak' },
  { id: 'badge_diamond', name: 'Diamond Badge', description: 'The mark of excellence', icon: '💎', requirement: 'Complete 50 tasks' },
  { id: 'badge_crown', name: 'Crown Badge', description: 'Royalty status', icon: '👑', requirement: 'Reach level 15' },
  { id: 'badge_rocket', name: 'Rocket Badge', description: 'Soaring through tasks', icon: '🚀', requirement: 'Complete 25 tasks' },
  { id: 'badge_star', name: 'All-Star Badge', description: 'You shine brighter than the rest', icon: '🌟', requirement: '14-day streak' },
  { id: 'badge_scholar', name: 'Scholar Badge', description: 'Knowledge is power', icon: '📚', requirement: 'Reach level 10' },
  { id: 'badge_centurion', name: 'Centurion Badge', description: 'A hundred tasks conquered', icon: '⚔️', requirement: 'Complete 100 tasks' },
  { id: 'badge_focus', name: 'Zen Master Badge', description: 'Master of concentration', icon: '🧘', requirement: 'Complete 10 focus sessions' },
];

function getToday() {
  return new Date().toISOString().split('T')[0];
}

const initialState: GameState = {
  xp: 0,
  level: 1,
  coins: 0,
  streak: 0,
  lastActiveDate: '',
  tasks: [],
  timetable: [],
  achievements: ACHIEVEMENTS,
  totalTasksCompleted: 0,
  focusSessionsCompleted: 0,
  purchasedItems: [],
  activeBoosts: [],
  streakFreezes: 0,
  activeTheme: 'default',
  equippedBadge: null,
  earnedBadges: [],
  darkMode: false,
  aiTokensUsed: 0,
  activeAura: null,
  customTitle: null,
  loaded: false,
  isSilenced: false,
};

function checkAchievementsAndBadges(state: GameState): GameState {
  let updated = { ...state, achievements: [...state.achievements], earnedBadges: [...state.earnedBadges] };
  const unlock = (id: string) => {
    const idx = updated.achievements.findIndex(a => a.id === id);
    if (idx !== -1 && !updated.achievements[idx].unlockedAt) {
      updated.achievements[idx] = { ...updated.achievements[idx], unlockedAt: new Date().toISOString() };
    }
  };
  const earnBadge = (id: string) => {
    if (!updated.earnedBadges.includes(id)) updated.earnedBadges.push(id);
  };

  if (updated.totalTasksCompleted >= 1) unlock('first_task');
  if (updated.totalTasksCompleted >= 10) unlock('tasks_10');
  if (updated.totalTasksCompleted >= 50) unlock('tasks_50');
  if (updated.streak >= 3) unlock('streak_3');
  if (updated.streak >= 7) unlock('streak_7');
  if (updated.level >= 5) unlock('level_5');
  if (updated.level >= 10) unlock('level_10');
  if (updated.purchasedItems.length >= 1) unlock('first_purchase');
  if (updated.coins >= 500) unlock('coin_hoarder');

  if (updated.streak >= 7) earnBadge('badge_fire');
  if (updated.streak >= 14) earnBadge('badge_star');
  if (updated.totalTasksCompleted >= 25) earnBadge('badge_rocket');
  if (updated.totalTasksCompleted >= 50) earnBadge('badge_diamond');
  if (updated.totalTasksCompleted >= 100) earnBadge('badge_centurion');
  if (updated.level >= 10) earnBadge('badge_scholar');
  if (updated.level >= 15) earnBadge('badge_crown');
  if (updated.focusSessionsCompleted >= 10) earnBadge('badge_focus');

  return updated;
}

function gameReducer(state: GameState, action: Action): GameState {
  let newState: GameState;

  switch (action.type) {
    case 'LOAD_STATE':
      newState = { ...state, ...action.state, loaded: true };
      break;

    case 'ADD_TASK':
      newState = { ...state, tasks: [...state.tasks, action.task] };
      break;

    case 'UPDATE_TASK':
      newState = {
        ...state,
        tasks: state.tasks.map(t => t.id === action.task.id ? { ...t, ...action.task } : t),
      };
      break;

    case 'TOGGLE_TASK': {
      const task = state.tasks.find(t => t.id === action.taskId);
      if (!task) return state;
      const wasCompleted = task.completed;
      const newTasks = state.tasks.map(t =>
        t.id === action.taskId ? { ...t, completed: !t.completed } : t
      );

      if (!wasCompleted) {
        const { xp: xpGain, coins: coinGain } = computeTaskReward(task, state.activeBoosts);
        const newXp = state.xp + xpGain;
        const newLevel = Math.floor(newXp / XP_PER_LEVEL) + 1;

        const taskConsumingTypes: ActiveBoost['type'][] = ['xp_2x', 'xp_3x', 'coin_2x'];
        const newBoosts = state.activeBoosts
          .map(b =>
            taskConsumingTypes.includes(b.type) && typeof b.remainingTasks === 'number'
              ? { ...b, remainingTasks: b.remainingTasks - 1 }
              : b,
          )
          .filter(b =>
            taskConsumingTypes.includes(b.type) ? (b.remainingTasks ?? 0) > 0 : true,
          );

        newState = {
          ...state,
          tasks: newTasks,
          xp: newXp,
          level: newLevel,
          coins: state.coins + coinGain,
          totalTasksCompleted: state.totalTasksCompleted + 1,
          lastActiveDate: getToday(),
          activeBoosts: newBoosts,
        };
      } else {
        newState = { ...state, tasks: newTasks };
      }
      break;
    }

    case 'APPLY_TASK_TOGGLE': {
      const task = state.tasks.find(t => t.id === action.taskId);
      if (!task) return state;
      const newTasks = state.tasks.map(t =>
        t.id === action.taskId ? { ...t, completed: action.completing } : t
      );
      const newXp = Math.max(0, state.xp + action.xpDelta);
      const newLevel = Math.max(1, Math.floor(newXp / XP_PER_LEVEL) + 1);
      const newCoins = state.coins + action.coinDelta;
      let newBoosts = state.activeBoosts;
      if (action.completing) {
        const consume: ActiveBoost['type'][] = ['xp_2x', 'xp_3x', 'coin_2x'];
        newBoosts = state.activeBoosts
          .map(b => consume.includes(b.type) && typeof b.remainingTasks === 'number'
            ? { ...b, remainingTasks: b.remainingTasks - 1 } : b)
          .filter(b => consume.includes(b.type) ? (b.remainingTasks ?? 0) > 0 : true);
      }
      newState = {
        ...state,
        tasks: newTasks,
        xp: newXp,
        level: newLevel,
        coins: newCoins,
        totalTasksCompleted: Math.max(0, state.totalTasksCompleted + (action.completing ? 1 : -1)),
        lastActiveDate: action.completing ? getToday() : state.lastActiveDate,
        activeBoosts: newBoosts,
      };
      break;
    }

    case 'DELETE_TASK':
      newState = { ...state, tasks: state.tasks.filter(t => t.id !== action.taskId) };
      break;

    case 'ADD_TIMETABLE_ENTRY':
      newState = { ...state, timetable: [...state.timetable, action.entry] };
      break;

    case 'DELETE_TIMETABLE_ENTRY':
      newState = { ...state, timetable: state.timetable.filter(e => e.id !== action.entryId) };
      break;

    case 'UPDATE_TIMETABLE_ENTRY':
      newState = {
        ...state,
        timetable: state.timetable.map(e => e.id === action.entry.id ? action.entry : e),
      };
      break;

    case 'ADD_XP': {
      const newXp = state.xp + action.amount;
      newState = { ...state, xp: newXp, level: Math.floor(newXp / XP_PER_LEVEL) + 1 };
      break;
    }

    case 'ADD_COINS':
      newState = { ...state, coins: state.coins + action.amount };
      break;

    case 'CHECK_STREAK': {
      const today = getToday();
      if (state.lastActiveDate === today) return state;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const dayBeforeYesterday = new Date();
      dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
      const dayBeforeYesterdayStr = dayBeforeYesterday.toISOString().split('T')[0];

      if (state.lastActiveDate === yesterdayStr) {
        newState = { ...state, streak: state.streak + 1, lastActiveDate: today };
      } else if (state.lastActiveDate !== today) {
        const hasShield = state.activeBoosts.some(
          b => b.type === 'leaderboard_freeze' && b.expiresAt && new Date(b.expiresAt).getTime() > Date.now()
        );
        // Streak Shield covers 2 days — check if last active was 2 days ago
        const shieldCovers2Days = state.activeBoosts.some(
          b => b.type === 'leaderboard_freeze' && b.expiresAt && new Date(b.expiresAt).getTime() > Date.now()
        );
        if (state.streakFreezes > 0 && state.streak > 0) {
          // Standard freeze: covers 1 missed day
          if (state.lastActiveDate === dayBeforeYesterdayStr) {
            // Two days missed — only shield (2-day) can handle this
            const shieldBoost = state.activeBoosts.find(b => b.type === 'leaderboard_freeze');
            if (shieldBoost) {
              newState = { ...state, lastActiveDate: today };
            } else {
              newState = { ...state, streak: 1, lastActiveDate: today };
            }
          } else {
            newState = { ...state, streakFreezes: state.streakFreezes - 1, lastActiveDate: today };
          }
        } else {
          newState = { ...state, streak: 1, lastActiveDate: today };
        }
      } else {
        return state;
      }
      break;
    }

    case 'UNLOCK_ACHIEVEMENT': {
      newState = {
        ...state,
        achievements: state.achievements.map(a =>
          a.id === action.achievementId && !a.unlockedAt
            ? { ...a, unlockedAt: new Date().toISOString() }
            : a
        ),
      };
      break;
    }

    case 'PURCHASE_ITEM': {
      const { item } = action;
      if (state.coins < item.price) return state;
      if (item.oneTime && state.purchasedItems.includes(item.id)) return state;

      let updatedState: GameState = {
        ...state,
        coins: state.coins - item.price,
        purchasedItems: item.oneTime ? [...state.purchasedItems, item.id] : state.purchasedItems,
      };

      if (item.id === 'xp_2x_mini') {
        updatedState.activeBoosts = [...updatedState.activeBoosts, { type: 'xp_2x', remainingTasks: 1 }];
      } else if (item.id === 'xp_2x') {
        updatedState.activeBoosts = [...updatedState.activeBoosts, { type: 'xp_2x', remainingTasks: 5 }];
      } else if (item.id === 'xp_mega') {
        updatedState.activeBoosts = [...updatedState.activeBoosts, { type: 'xp_3x', remainingTasks: 10 }];
      } else if (item.id === 'xp_daily') {
        // +50% XP on all tasks for 24 hours — time-based
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const filtered = updatedState.activeBoosts.filter(b => b.type !== 'xp_daily');
        updatedState.activeBoosts = [...filtered, { type: 'xp_daily', expiresAt: expires }];
      } else if (item.id === 'coin_2x_mini') {
        updatedState.activeBoosts = [...updatedState.activeBoosts, { type: 'coin_2x', remainingTasks: 1 }];
      } else if (item.id === 'coin_2x') {
        updatedState.activeBoosts = [...updatedState.activeBoosts, { type: 'coin_2x', remainingTasks: 5 }];
      } else if (item.id === 'lucky_spin') {
        // Weighted: 60% small (50-100), 30% medium (101-200), 10% large (201-300)
        const roll = Math.random();
        let bonus: number;
        if (roll < 0.6) bonus = Math.floor(Math.random() * 51) + 50;
        else if (roll < 0.9) bonus = Math.floor(Math.random() * 100) + 101;
        else bonus = Math.floor(Math.random() * 100) + 201;
        updatedState.coins = updatedState.coins + bonus;
      } else if (item.id === 'streak_freeze') {
        updatedState.streakFreezes = updatedState.streakFreezes + 1;
      } else if (item.id === 'streak_shield') {
        // Shield gives 2 streak-freeze charges
        updatedState.streakFreezes = updatedState.streakFreezes + 2;
      } else if (item.id === 'focus_boost') {
        const filtered = updatedState.activeBoosts.filter(b => b.type !== 'focus_boost');
        updatedState.activeBoosts = [...filtered, { type: 'focus_boost', remainingTasks: 1 }];
      } else if (item.id.startsWith('theme_')) {
        updatedState.activeTheme = item.id.replace('theme_', '') as ThemeId;
      }

      newState = updatedState;
      break;
    }

    case 'ADD_PURCHASED_ITEM': {
      if (state.purchasedItems.includes(action.itemId)) {
        newState = state;
      } else {
        newState = { ...state, purchasedItems: [...state.purchasedItems, action.itemId] };
      }
      break;
    }

    case 'ADD_TIMED_BOOST': {
      const filtered = state.activeBoosts.filter(b => b.type !== action.boost.type);
      newState = { ...state, activeBoosts: [...filtered, action.boost] };
      break;
    }

    case 'REMOVE_BOOST_TYPE': {
      newState = {
        ...state,
        activeBoosts: state.activeBoosts.filter(b => b.type !== action.boostType),
      };
      break;
    }

    case 'SET_AVATAR_AURA':
      newState = { ...state, activeAura: action.aura };
      break;

    case 'SET_CUSTOM_TITLE':
      newState = { ...state, customTitle: action.title };
      break;

    case 'SET_THEME':
      newState = { ...state, activeTheme: action.themeId };
      break;

    case 'EQUIP_BADGE':
      newState = { ...state, equippedBadge: action.badgeId };
      break;

    case 'ADD_FOCUS_SESSION':
      newState = { ...state, focusSessionsCompleted: state.focusSessionsCompleted + 1 };
      break;

    case 'SET_DARK_MODE':
      newState = { ...state, darkMode: action.enabled };
      break;

    case 'ADD_AI_TOKENS':
      newState = { ...state, aiTokensUsed: state.aiTokensUsed + action.amount };
      break;

    case 'SET_SILENCED':
      newState = { ...state, isSilenced: action.silenced };
      break;

    default:
      return state;
  }

  return checkAchievementsAndBadges(newState);
}

const GameContext = createContext<{
  state: GameState;
  dispatch: React.Dispatch<Action>;
  xpProgress: number;
  xpToNextLevel: number;
  toggleTask: (taskId: string) => Promise<void>;
} | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const prevStateRef = useRef<GameState>(initialState);

  // Load state from DB when user logs in
  useEffect(() => {
    if (!user) {
      dispatch({ type: 'LOAD_STATE', state: initialState });
      return;
    }

    const loadFromDb = async () => {
      const { data: gs } = await supabase.from('game_state').select('*').eq('user_id', user.id).single();
      const { data: tasks } = await supabase.from('tasks').select('*').eq('user_id', user.id);
      const { data: timetable } = await supabase.from('timetable_entries').select('*').eq('user_id', user.id);
      const { data: prof } = await supabase
        .from('profiles')
        .select('custom_title, active_aura')
        .eq('user_id', user.id)
        .single();

      // Check if user is currently silenced
      const { data: silenceEffects } = await supabase
        .from('active_effects')
        .select('id, expires_at')
        .eq('user_id', user.id)
        .eq('type', 'silence')
        .eq('consumed', false);
      const nowMs = Date.now();
      const isSilenced = (silenceEffects || []).some(
        e => !e.expires_at || new Date(e.expires_at).getTime() > nowMs
      );

      const loadedState: Partial<GameState> = { isSilenced };

      if (gs) {
        loadedState.xp = gs.xp;
        loadedState.level = gs.level;
        loadedState.coins = gs.coins;
        loadedState.streak = gs.streak;
        loadedState.lastActiveDate = gs.last_active_date;
        loadedState.totalTasksCompleted = gs.total_tasks_completed;
        loadedState.focusSessionsCompleted = gs.focus_sessions_completed;
        loadedState.purchasedItems = gs.purchased_items || [];
        loadedState.activeBoosts = (gs.active_boosts as any) || [];
        loadedState.streakFreezes = gs.streak_freezes;
        loadedState.activeTheme = (gs.active_theme || 'default') as ThemeId;
        loadedState.equippedBadge = gs.equipped_badge;
        loadedState.earnedBadges = gs.earned_badges || [];
        loadedState.darkMode = (gs as any).dark_mode ?? false;
        loadedState.aiTokensUsed = (gs as any).ai_tokens_used ?? 0;
      }

      if (tasks) {
        loadedState.tasks = tasks.map(t => ({
          id: t.id,
          title: t.title,
          completed: t.completed,
          priority: t.priority as Priority,
          subject: t.subject || undefined,
          subjectColor: (t.subject_color || undefined) as SubjectColor | undefined,
          deadline: t.deadline || undefined,
          createdAt: t.created_at,
          description: (t as any).description || undefined,
          tags: ((t as any).tags as string[] | null) || [],
        }));
      }

      if (timetable) {
        loadedState.timetable = timetable.map(e => {
          const days = ((e as any).days as number[] | null) || [];
          const isRecurring = (e as any).is_recurring !== false; // default true for existing
          return {
            id: e.id,
            subject: e.subject,
            subjectColor: e.subject_color as SubjectColor,
            day: e.day,
            days: days.length > 0 ? days : (typeof e.day === 'number' ? [e.day] : []),
            startTime: e.start_time,
            endTime: e.end_time,
            teacher: (e as any).teacher || undefined,
            room: (e as any).room || undefined,
            isRecurring,
            specificDate: (e as any).specific_date || undefined,
          };
        });
      }

      loadedState.achievements = ACHIEVEMENTS;
      if (prof) {
        loadedState.customTitle = (prof as any).custom_title ?? null;
        loadedState.activeAura = (prof as any).active_aura ?? null;
      }
      dispatch({ type: 'LOAD_STATE', state: loadedState });
      setTimeout(() => dispatch({ type: 'CHECK_STREAK' }), 100);
    };

    loadFromDb();
  }, [user]);

  // Sync state to DB with debounce
  const syncToDb = useCallback(async (currentState: GameState) => {
    if (!user || !currentState.loaded) return;

    await supabase.from('game_state').update({
      xp: currentState.xp,
      level: currentState.level,
      coins: currentState.coins,
      streak: currentState.streak,
      last_active_date: currentState.lastActiveDate,
      total_tasks_completed: currentState.totalTasksCompleted,
      focus_sessions_completed: currentState.focusSessionsCompleted,
      purchased_items: currentState.purchasedItems,
      active_boosts: currentState.activeBoosts as any,
      streak_freezes: currentState.streakFreezes,
      active_theme: currentState.activeTheme,
      equipped_badge: currentState.equippedBadge,
      earned_badges: currentState.earnedBadges,
      dark_mode: currentState.darkMode,
      ai_tokens_used: currentState.aiTokensUsed,
    } as any).eq('user_id', user.id);

    const prevTasks = prevStateRef.current.tasks;
    const curTasks = currentState.tasks;

    if (JSON.stringify(prevTasks) !== JSON.stringify(curTasks)) {
      const deletedIds = prevTasks.filter(pt => !curTasks.find(ct => ct.id === pt.id)).map(t => t.id);
      if (deletedIds.length > 0) {
        await supabase.from('tasks').delete().in('id', deletedIds);
      }
      if (curTasks.length > 0) {
        const taskRows = curTasks.map(t => ({
          id: t.id,
          user_id: user.id,
          title: t.title,
          completed: t.completed,
          priority: t.priority,
          subject: t.subject || null,
          subject_color: t.subjectColor || null,
          deadline: t.deadline || null,
          created_at: t.createdAt,
          description: t.description || null,
          tags: t.tags || [],
        }));
        await supabase.from('tasks').upsert(taskRows, { onConflict: 'id' });
      }
    }

    const prevTimetable = prevStateRef.current.timetable;
    const curTimetable = currentState.timetable;

    if (JSON.stringify(prevTimetable) !== JSON.stringify(curTimetable)) {
      const deletedIds = prevTimetable.filter(pe => !curTimetable.find(ce => ce.id === pe.id)).map(e => e.id);
      if (deletedIds.length > 0) {
        await supabase.from('timetable_entries').delete().in('id', deletedIds);
      }
      if (curTimetable.length > 0) {
        const rows = curTimetable.map(e => ({
          id: e.id,
          user_id: user.id,
          subject: e.subject,
          subject_color: e.subjectColor,
          day: e.isRecurring
            ? (e.days && e.days.length > 0 ? e.days[0] : e.day)
            : (e.specificDate ? new Date(e.specificDate).getDay() : e.day),
          days: e.isRecurring
            ? (e.days && e.days.length > 0 ? e.days : [e.day])
            : [],
          start_time: e.startTime,
          end_time: e.endTime,
          teacher: e.teacher || null,
          room: e.room || null,
          is_recurring: e.isRecurring,
          specific_date: e.specificDate || null,
        }));
        await supabase.from('timetable_entries').upsert(rows, { onConflict: 'id' });
      }
    }

    prevStateRef.current = currentState;
  }, [user]);

  useEffect(() => {
    if (!state.loaded || !user) return;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => syncToDb(state), 500);
    return () => { if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current); };
  }, [state, syncToDb, user]);

  // Apply theme and dark mode
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.activeTheme);
    document.documentElement.classList.toggle('dark', state.darkMode);
  }, [state.activeTheme, state.darkMode]);

  const xpInCurrentLevel = state.xp % XP_PER_LEVEL;
  const xpProgress = (xpInCurrentLevel / XP_PER_LEVEL) * 100;
  const xpToNextLevel = XP_PER_LEVEL - xpInCurrentLevel;

  const toggleTask = useCallback(async (taskId: string) => {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task || !user) return;
    const completing = !task.completed;
    if (completing) {
      let { xp, coins } = computeTaskReward(task, state.activeBoosts);

      // --- XP Tax interception ---
      try {
        const { data: taxes } = await supabase
          .from('active_effects')
          .select('id, source_user_id, payload')
          .eq('user_id', user.id)
          .eq('type', 'xp_tax_pending')
          .eq('consumed', false)
          .order('created_at', { ascending: true })
          .limit(1);
        const tax = taxes?.[0];
        if (tax && xp > 0) {
          const pct = (tax.payload as any)?.percent ?? 5;
          const stolen = Math.max(1, Math.floor((xp * pct) / 100));
          xp = xp - stolen;
          await supabase.from('active_effects').update({ consumed: true }).eq('id', tax.id);
          if (tax.source_user_id) {
            const { data: atkr } = await supabase
              .from('game_state').select('xp').eq('user_id', tax.source_user_id).single();
            if (atkr) {
              const newAtkXp = (atkr.xp || 0) + stolen;
              await supabase.from('game_state').update({
                xp: newAtkXp, level: Math.floor(newAtkXp / XP_PER_LEVEL) + 1,
              }).eq('user_id', tax.source_user_id);
            }
            await supabase.from('notifications').insert({
              user_id: tax.source_user_id, type: 'xp_tax',
              message: `💸 Your XP Tax just paid out — you stole ${stolen} XP!`,
              data: { stolen },
            });
          }
        }
      } catch (e) { console.error('XP Tax interception failed', e); }

      // --- All-In resolution ---
      const allIn = state.activeBoosts.find(
        b => b.type === 'all_in' && b.taskId === taskId &&
             (!b.expiresAt || new Date(b.expiresAt).getTime() > Date.now())
      );
      if (allIn?.bet) {
        coins += allIn.bet * 2;
        dispatch({ type: 'REMOVE_BOOST_TYPE', boostType: 'all_in' });
      }

      dispatch({ type: 'APPLY_TASK_TOGGLE', taskId, completing: true, xpDelta: xp, coinDelta: coins });
      await supabase.from('task_completions').insert({
        task_id: taskId, user_id: user.id, xp_granted: xp, coins_granted: coins,
      });
    } else {
      const { data: completions } = await supabase
        .from('task_completions')
        .select('id, xp_granted, coins_granted')
        .eq('task_id', taskId)
        .eq('user_id', user.id)
        .eq('reversed', false)
        .order('completed_at', { ascending: false })
        .limit(1);
      const last = completions?.[0];
      const xpDelta = last ? -last.xp_granted : 0;
      const coinDelta = last ? -last.coins_granted : 0;
      dispatch({ type: 'APPLY_TASK_TOGGLE', taskId, completing: false, xpDelta, coinDelta });
      if (last) {
        await supabase.from('task_completions')
          .update({ reversed: true, reversed_at: new Date().toISOString() })
          .eq('id', last.id);
      }
    }
  }, [state.tasks, state.activeBoosts, user]);

  return (
    <GameContext.Provider value={{ state, dispatch, xpProgress, xpToNextLevel, toggleTask }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
