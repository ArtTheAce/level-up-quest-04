import { LayoutDashboard, Calendar, CheckSquare, Target, Trophy, ShoppingBag, Users, Award, Settings, LogOut } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useGame } from '@/context/GameContext';
import { useAuth } from '@/context/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

const navItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Timetable', url: '/timetable', icon: Calendar },
  { title: 'Tasks', url: '/tasks', icon: CheckSquare },
  { title: 'Focus Mode', url: '/focus', icon: Target },
  { title: 'Achievements', url: '/achievements', icon: Trophy },
  { title: 'Shop', url: '/shop', icon: ShoppingBag },
  { title: 'Friends', url: '/friends', icon: Users },
  { title: 'Leaderboard', url: '/leaderboard', icon: Award },
  { title: 'Settings', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const { state: sidebarState } = useSidebar();
  const collapsed = sidebarState === 'collapsed';
  const { state: game, xpProgress } = useGame();
  const { profile, signOut } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className={`p-4 ${collapsed ? 'px-2' : ''}`}>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl xp-gradient flex items-center justify-center text-primary-foreground font-display font-bold text-lg shrink-0">
              Q
            </div>
            {!collapsed && (
              <span className="font-display font-bold text-xl text-foreground">Questify</span>
            )}
          </div>

          {!collapsed && (
            <>
              <div className="mb-2 p-3 rounded-xl bg-muted">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-display font-bold text-foreground truncate">
                    {profile?.display_name || profile?.username || 'Student'}
                  </span>
                  {game.equippedBadge && <span className="text-sm">{getBadgeEmoji(game.equippedBadge)}</span>}
                </div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-muted-foreground">Level {game.level}</span>
                  <span className="text-primary font-bold">{game.xp % 100}/{100} XP</span>
                </div>
                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full xp-gradient rounded-full transition-all duration-700"
                    style={{ width: `${xpProgress}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs">
                  <span className="flex items-center gap-1">🔥 {game.streak}</span>
                  <span className="flex items-center gap-1">🪙 {game.coins}</span>
                </div>
              </div>
            </>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className="hover:bg-muted/50"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                    >
                      <item.icon className="mr-2 h-5 w-5" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <button onClick={signOut} className="flex items-center w-full hover:bg-muted/50 text-destructive">
                    <LogOut className="mr-2 h-5 w-5" />
                    {!collapsed && <span>Log Out</span>}
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

function getBadgeEmoji(badgeId: string): string {
  const map: Record<string, string> = {
    badge_fire: '🔥', badge_diamond: '💎', badge_crown: '👑',
    badge_rocket: '🚀', badge_star: '🌟', badge_scholar: '📚',
    badge_centurion: '⚔️', badge_focus: '🧘',
  };
  return map[badgeId] || '🏅';
}
