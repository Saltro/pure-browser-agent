import { Monitor, Moon, Sun } from 'lucide-react';
import { useWorkbenchStore } from '../stores/workbenchStore';
import type { ThemeMode } from '../types/workbench';
import { Button } from './ui/button';

const modes: Array<{ mode: ThemeMode; label: string; icon: typeof Sun }> = [
  { mode: 'light', label: 'Light', icon: Sun },
  { mode: 'dark', label: 'Dark', icon: Moon },
  { mode: 'system', label: 'System', icon: Monitor }
];

export function ThemeToggle() {
  const themeMode = useWorkbenchStore((state) => state.themeMode);
  const setThemeMode = useWorkbenchStore((state) => state.setThemeMode);

  return (
    <div className="themeToggle" aria-label="Theme">
      {modes.map(({ mode, label, icon: Icon }) => (
        <Button key={mode} type="button" variant="ghost" size="sm" className={themeMode === mode ? 'segmented active' : 'segmented'} onClick={() => setThemeMode(mode)} title={label}>
          <Icon size={14} />
          <span>{label}</span>
        </Button>
      ))}
    </div>
  );
}
