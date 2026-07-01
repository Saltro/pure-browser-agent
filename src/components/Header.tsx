import { Bot, Cpu } from 'lucide-react';
import { useWorkbenchStore } from '../stores/workbenchStore';
import { ThemeToggle } from './ThemeToggle';

export function Header() {
  const isBooted = useWorkbenchStore((state) => state.isBooted);
  const isBooting = useWorkbenchStore((state) => state.isBooting);
  return (
    <header className="header">
      <div className="brand"><Bot size={20} /> Pure Browser Agent</div>
      <div className="headerActions">
        <span className={isBooted ? 'status ok' : 'status'}><Cpu size={14} /> {isBooted ? 'Sandbox ready' : isBooting ? 'Connecting sandbox' : 'Sandbox offline'}</span>
        <ThemeToggle />
      </div>
    </header>
  );
}
