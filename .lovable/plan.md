## Questify Overhaul Plan

This is a large, multi-system request. Below is the proposed implementation plan, grouped into phases. Approving will execute all phases; you can also tell me to drop or reorder any phase.

### Phase 1 — Core XP & Anti-Exploit Foundation (highest priority)
- Add `task_completions` table (task_id, user_id, xp_granted, coins_granted, completed_at) to log every completion.
- Refactor `GameContext` so every XP/coin change goes through one `applyReward({xp, coins, source, taskId?})` reducer that:
  - Updates state, animates XP bar, persists to DB in one transaction.
  - On task uncomplete, looks up the latest `task_completions` row and reverses exactly those XP/coins (allowing temporary negative coins).
- Fix Dashboard XP bar to subscribe to live state and animate on change (Framer Motion spring).
- Recalculate level on every XP change (up or down).

### Phase 2 — Daily Quests Refresh
- Add `daily_quests` table (user_id, generated_at, quests jsonb, expires_at).
- On dashboard mount: if expired or missing, generate 4 randomized quests from a pool (study time, overdue, subject-specific, XP target, before-5PM, etc.).
- Add countdown timer to next refresh.
- Reward XP + coins through the central system on completion.

### Phase 3 — Timetable Hours Fix
- Change Timetable week/day grid to render 5:00 AM → 12:00 AM (midnight).
- Default scroll to 7:00–9:00 AM on mount.
- Update task/class placement math accordingly.

### Phase 4 — Active Effects System (backend)
- Add `active_effects` table (user_id, type, source_user_id, payload jsonb, expires_at) — single source of truth for: vault, freeze, silence, ghost, bounty, duel, tax-pending, curse-block (inventory), auras, custom_title.
- Realtime subscription so effects appear/expire live.
- Dashboard "Active Effects" panel listing all current effects with countdown + who triggered them.

### Phase 5 — Shop Wiring (make every item actually work)
- **Themes**: persist `active_theme` (already exists), wire equip button to swap CSS variables app-wide; show Equipped/Owned/Locked.
- **Power-ups**: audit each, route through active_effects + central reward system.
- **Social**: Taunt (full-screen dismissible banner via notification), Callout (pinned banner on UserProfile for 24h), Freeze (snapshots rank in active_effects, leaderboard reads frozen value for others), Bounty (creates effect tied to a task, on expiry coin transfer + popup), Duel (duel_sessions table, live scoreboard, winner takes pot), Vault (blocks XP tax & coin theft).
- **Rivalry**: Task Curse (already wired — add cursed styling + curse-block consumption), XP Tax (intercepts next reward in central system), Rank Steal (DETHRONED badge effect 24h), Silence (suppresses celebrations on target client), Curse Block (passive inventory item), All-In (dramatic modal, 50/50 random outcome).
- **Avatars**: Streak Crown (computed live from leaderboard), Flame/Ice/Lightning auras (CSS animations on Avatar component everywhere), Ghost Mode (replaces rank with ??? for others), Villain Arc (locked until any rivalry purchase), Custom Title (profanity filter, 20 chars), Mystery Box (animated reveal + dup refund).

### Phase 6 — Polish
- Purchase animations, coin deduction count-down, confetti on rare unlocks.
- Glowing active-effect indicators, locked styling.
- Dramatic activation popups for incoming effects (taunt, bounty, dethroned, etc.).

### Technical Notes
- New tables: `task_completions`, `daily_quests`, `active_effects`, `duel_sessions`, `pinned_callouts`.
- All tables get RLS: users can read effects targeting them and effects they cast; can insert effects via SECURITY DEFINER RPCs (`cast_effect`, `consume_curse_block`, `apply_xp_tax`, `resolve_duel`).
- Realtime enabled on `active_effects`, `notifications`, `duel_sessions`.
- Central reward function lives client-side in GameContext but every mutation writes a `reward_transactions` row for reversal.

### Scope Check
This is roughly 15–25 file edits + 4–5 migrations. I'll proceed phase-by-phase and report after each phase so you can test before I move on.

**Approve to proceed, or tell me which phases to skip / reorder.**