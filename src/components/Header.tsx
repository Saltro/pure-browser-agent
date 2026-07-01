import { Bot, Cpu, Settings } from 'lucide-react';
import { useWorkbenchStore } from '../stores/workbenchStore';
import { WorkspaceActions } from './WorkspaceActions';

export function Header({ onBoot, onOpenSettings }: { onBoot: () => void; onOpenSettings: () => void }) {
  const isBooted = useWorkbenchStore((state) => state.isBooted);
  return (
    <header className="header">
      <div className="brand"><Bot size={20} /> Agent Sandbox Studio</div>
      <div className="headerActions">
        <span className={isBooted ? 'status ok' : 'status'}><Cpu size={14} /> {isBooted ? 'WebContainer booted' : 'Not booted'}</span>
        <WorkspaceActions />
        <button onClick={onBoot}>{isBooted ? 'Remount files' : 'Boot WebContainer'}</button>
        <button className="ghost" onClick={onOpenSettings}><Settings size={16} /> Settings</button>
      </div>
    </header>
  );
}
