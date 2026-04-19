import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { useGame } from '@/context/GameContext';
import { NotificationBell } from '@/components/NotificationBell';

export function AppLayout({ children }: { children: ReactNode }) {
  const { state, dispatch } = useGame();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border px-4">
            <SidebarTrigger />
            <div className="flex items-center gap-3">
              <button
                onClick={() => dispatch({ type: 'SET_DARK_MODE', enabled: !state.darkMode })}
                className="text-xl hover:scale-110 transition-transform"
                title={state.darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {state.darkMode ? '☀️' : '🌙'}
              </button>
              <NotificationBell />
              <div className="flex items-center gap-1 text-sm font-medium">
                <span className="text-lg">🔥</span>
                <span className="text-streak font-bold">{state.streak}</span>
              </div>
              <div className="flex items-center gap-1 text-sm font-medium">
                <span className="text-lg">🪙</span>
                <span className="text-coin font-bold">{state.coins}</span>
              </div>
              <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-muted text-sm font-bold">
                <span className="text-level">Lv.{state.level}</span>
              </div>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
