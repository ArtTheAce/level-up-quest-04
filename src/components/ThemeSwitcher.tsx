import { useGame } from '@/context/GameContext';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Palette, Check, Lock } from 'lucide-react';
import { SHOP_ITEMS } from '@/context/GameContext';
import type { ThemeId } from '@/context/GameContext';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

const THEME_META: { id: ThemeId; name: string; icon: string; swatch: string }[] = [
  { id: 'default',  name: 'Default',  icon: '✨', swatch: 'hsl(145 63% 42%)' },
  { id: 'midnight', name: 'Midnight', icon: '🌙', swatch: 'hsl(265 70% 58%)' },
  { id: 'sakura',   name: 'Sakura',   icon: '🌸', swatch: 'hsl(340 70% 60%)' },
  { id: 'ocean',    name: 'Ocean',    icon: '🌊', swatch: 'hsl(195 80% 50%)' },
  { id: 'neon',     name: 'Neon Glow',icon: '💜', swatch: 'hsl(280 100% 65%)' },
  { id: 'sunset',   name: 'Sunset',   icon: '🌅', swatch: 'hsl(15 85% 55%)' },
];

export function ThemeSwitcher() {
  const { state, dispatch } = useGame();

  const isOwned = (id: ThemeId) =>
    id === 'default' || state.purchasedItems.includes(`theme_${id}`);

  const previewOn = (id: ThemeId) =>
    document.documentElement.setAttribute('data-theme', id);
  const previewOff = () =>
    document.documentElement.setAttribute('data-theme', state.activeTheme);

  const equip = (id: ThemeId) => {
    if (!isOwned(id)) return;
    if (state.activeTheme === id) return;
    dispatch({ type: 'SET_THEME', themeId: id });
    const meta = THEME_META.find(t => t.id === id)!;
    toast.success(`${meta.name} theme equipped ${meta.icon}`);
  };

  const ownedCount = THEME_META.filter(t => isOwned(t.id)).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="p-1.5 rounded-md hover:bg-muted transition-colors"
        title="Switch theme"
        aria-label="Switch theme"
      >
        <Palette className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Themes</span>
          <span className="text-[10px] font-normal text-muted-foreground">
            {ownedCount}/{THEME_META.length} owned
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEME_META.map(t => {
          const owned = isOwned(t.id);
          const active = state.activeTheme === t.id;
          const price = SHOP_ITEMS.find(s => s.id === `theme_${t.id}`)?.price;
          return (
            <DropdownMenuItem
              key={t.id}
              disabled={!owned}
              onMouseEnter={() => owned && previewOn(t.id)}
              onMouseLeave={previewOff}
              onClick={() => equip(t.id)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <span
                className="h-4 w-4 rounded-full border border-border shrink-0"
                style={{ background: t.swatch }}
              />
              <span className="text-base">{t.icon}</span>
              <span className="flex-1 text-sm">{t.name}</span>
              {active ? (
                <Check className="h-4 w-4 text-primary" />
              ) : owned ? (
                <span className="text-[10px] text-muted-foreground">Equip</span>
              ) : (
                <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                  <Lock className="h-3 w-3" />{price}🪙
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/shop" className="text-xs text-muted-foreground cursor-pointer">
            Browse all themes in Shop →
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}