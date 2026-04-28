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
}

export interface TimetableEntry {
  id: string;
  subject: string;
  subjectColor: SubjectColor;
  day: number;
  startTime: string;
  endTime: string;
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
    | 'all_in';
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
}

type Action =
  | { type: 'ADD_TASK'; task: Task }
  | { type: 'TOGGLE_TASK'; taskId: string }
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
  | { type: 'LOAD_STATE'; state: Partial<GameState> };

const XP_PER_LEVEL = 100;
const XP_REWARDS: Record<Priority, number> = { easy: 10, medium: 25, hard: 50 };
const COIN_REWARDS: Record<Priority, number> = { easy: 5, medium: 15, hard: 30 };

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
  { id: 'xp_2x_mini', name: 'XP Spark', description: 'Double XP for the next task', icon: '✨', price: 40, category: 'powerup' },
  { id: 'xp_2x', name: '2x XP Boost', description: 'Double XP for the next 5 tasks', icon: '⚡', price: 150, category: 'powerup' },
  { id: 'coin_2x_mini', name: 'Coin Spark', description: 'Double coins for the next task', icon: '🪙', price: 40, category: 'powerup' },
  { id: 'coin_2x', name: '2x Coin Boost', description: 'Double coins for the next 5 tasks', icon: '💎', price: 150, category: 'powerup' },
  { id: 'streak_freeze', name: 'Streak Freeze', description: 'Protect your streak for 1 missed day', icon: '🛡️', price: 100, category: 'powerup' },
  { id: 'xp_mega', name: 'XP Mega Boost', description: 'Triple XP for the next 10 tasks!', icon: '🔮', price: 400, category: 'powerup' },
  { id: 'lucky_spin', name: 'Lucky Bonus', description: 'Instantly earn 50-200 bonus coins', icon: '🎰', price: 120, category: 'powerup' },
  { id: 'theme_midnight', name: 'Midnight', description: 'Deep dark theme with purple accents', icon: '🌙', price: 200, category: 'theme', oneTime: true },
  { id: 'theme_sakura', name: 'Sakura', description: 'Soft pink cherry blossom vibes', icon: '🌸', price: 200, category: 'theme', oneTime: true },
  { id: 'theme_ocean', name: 'Ocean', description: 'Cool blue deep-sea aesthetic', icon: '🌊', price: 200, category: 'theme', oneTime: true },
  { id: 'theme_neon', name: 'Neon Glow', description: 'Cyberpunk neon with electric colors', icon: '💜', price: 350, category: 'theme', oneTime: true },
  { id: 'theme_sunset', name: 'Sunset', description: 'Warm orange and coral gradient vibes', icon: '🌅', price: 250, category: 'theme', oneTime: true },
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

    case 'TOGGLE_TASK': {
      const task = state.tasks.find(t => t.id === action.taskId);
      if (!task) return state;
      const wasCompleted = task.completed;
      const newTasks = state.tasks.map(t =>
        t.id === action.taskId ? { ...t, completed: !t.completed } : t
      );

      if (!wasCompleted) {
        const hasXp3x = state.activeBoosts.some(b => b.type === 'xp_3x' && (b.remainingTasks ?? 0) > 0);
        const hasXp2x = state.activeBoosts.some(b => b.type === 'xp_2x' && (b.remainingTasks ?? 0) > 0);
        const hasCoin2x = state.activeBoosts.some(b => b.type === 'coin_2x' && (b.remainingTasks ?? 0) > 0);

        const xpMultiplier = hasXp3x ? 3 : hasXp2x ? 2 : 1;
        const coinMultiplier = hasCoin2x ? 2 : 1;

        const xpGain = XP_REWARDS[task.priority] * xpMultiplier;
        const coinGain = COIN_REWARDS[task.priority] * coinMultiplier;
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

      if (state.lastActiveDate === yesterdayStr) {
        newState = { ...state, streak: state.streak + 1, lastActiveDate: today };
      } else if (state.lastActiveDate !== today) {
        if (state.streakFreezes > 0 && state.streak > 0) {
          newState = { ...state, streakFreezes: state.streakFreezes - 1, lastActiveDate: today };
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
      } else if (item.id === 'coin_2x_mini') {
        updatedState.activeBoosts = [...updatedState.activeBoosts, { type: 'coin_2x', remainingTasks: 1 }];
      } else if (item.id === 'coin_2x') {
        updatedState.activeBoosts = [...updatedState.activeBoosts, { type: 'coin_2x', remainingTasks: 5 }];
      } else if (item.id === 'lucky_spin') {
        const bonus = Math.floor(Math.random() * 151) + 50;
        updatedState.coins = updatedState.coins + bonus;
      } else if (item.id === 'streak_freeze') {
        updatedState.streakFreezes = updatedState.streakFreezes + 1;
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
      // Remove any existing boost of the same type (aura swap, reapplying freeze, etc.)
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
      // Load game state
      const { data: gs } = await supabase.from('game_state').select('*').eq('user_id', user.id).single();
      // Load tasks
      const { data: tasks } = await supabase.from('tasks').select('*').eq('user_id', user.id);
      // Load timetable
      const { data: timetable } = await supabase.from('timetable_entries').select('*').eq('user_id', user.id);

      const loadedState: Partial<GameState> = {};

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
        }));
      }

      if (timetable) {
        loadedState.timetable = timetable.map(e => ({
          id: e.id,
          subject: e.subject,
          subjectColor: e.subject_color as SubjectColor,
          day: e.day,
          startTime: e.start_time,
          endTime: e.end_time,
        }));
      }

      loadedState.achievements = ACHIEVEMENTS;
      dispatch({ type: 'LOAD_STATE', state: loadedState });

      // Check streak after loading
      setTimeout(() => dispatch({ type: 'CHECK_STREAK' }), 100);
    };

    loadFromDb();
  }, [user]);

  // Sync state to DB with debounce
  const syncToDb = useCallback(async (currentState: GameState) => {
    if (!user || !currentState.loaded) return;

    // Sync game state
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

    // Sync tasks - delete all and re-insert (simple approach for now)
    const prevTasks = prevStateRef.current.tasks;
    const curTasks = currentState.tasks;

    // Check if tasks changed
    if (JSON.stringify(prevTasks) !== JSON.stringify(curTasks)) {
      // Find deleted tasks
      const deletedIds = prevTasks.filter(pt => !curTasks.find(ct => ct.id === pt.id)).map(t => t.id);
      if (deletedIds.length > 0) {
        await supabase.from('tasks').delete().in('id', deletedIds);
      }

      // Upsert current tasks
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
        }));
        await supabase.from('tasks').upsert(taskRows, { onConflict: 'id' });
      }
    }

    // Sync timetable
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
          day: e.day,
          start_time: e.startTime,
          end_time: e.endTime,
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

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [state, syncToDb, user]);

  // Apply theme and dark mode
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.activeTheme);
    document.documentElement.classList.toggle('dark', state.darkMode);
  }, [state.activeTheme, state.darkMode]);

  const xpInCurrentLevel = state.xp % XP_PER_LEVEL;
  const xpProgress = (xpInCurrentLevel / XP_PER_LEVEL) * 100;
  const xpToNextLevel = XP_PER_LEVEL - xpInCurrentLevel;

  return (
    <GameContext.Provider value={{ state, dispatch, xpProgress, xpToNextLevel }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
