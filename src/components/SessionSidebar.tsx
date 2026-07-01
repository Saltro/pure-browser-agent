import { MessageSquare, PanelLeftClose, PanelLeftOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { useWorkbenchStore } from '../stores/workbenchStore';
import { Button } from './ui/button';

export function SessionSidebar() {
  const sessions = useWorkbenchStore((state) => state.sessions);
  const activeSessionId = useWorkbenchStore((state) => state.activeSessionId);
  const isCollapsed = useWorkbenchStore((state) => state.isSessionSidebarCollapsed);
  const setCollapsed = useWorkbenchStore((state) => state.setSessionSidebarCollapsed);
  const createSession = useWorkbenchStore((state) => state.createSession);
  const setActiveSession = useWorkbenchStore((state) => state.setActiveSession);
  const renameSession = useWorkbenchStore((state) => state.renameSession);
  const deleteSession = useWorkbenchStore((state) => state.deleteSession);

  function rename(id: string, currentTitle: string) {
    const next = prompt('Rename session', currentTitle)?.trim();
    if (next) renameSession(id, next);
  }

  return (
    <aside className={isCollapsed ? 'sessionSidebar collapsed' : 'sessionSidebar'}>
      <div className="sessionHeader">
        <Button variant="ghost" size="icon" onClick={() => setCollapsed(!isCollapsed)} title={isCollapsed ? 'Expand sessions' : 'Collapse sessions'}>
          {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </Button>
        {!isCollapsed && <Button variant="outline" size="sm" onClick={createSession}><Plus size={14} /> New</Button>}
      </div>
      <div className="sessionList">
        {sessions.map((session) => (
          <div key={session.id} className={session.id === activeSessionId ? 'sessionRow active' : 'sessionRow'}>
            <Button variant="ghost" className="sessionButton" onClick={() => setActiveSession(session.id)} title={session.title}>
              <MessageSquare size={15} />
              {!isCollapsed && <span>{session.title}</span>}
            </Button>
            {!isCollapsed && (
              <span className="sessionActions">
                <Button variant="ghost" size="icon" className="sessionIcon" onClick={() => rename(session.id, session.title)} title="Rename"><Pencil size={13} /></Button>
                <Button variant="ghost" size="icon" className="sessionIcon danger" onClick={() => confirm(`Delete ${session.title}?`) && deleteSession(session.id)} title="Delete"><Trash2 size={13} /></Button>
              </span>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
