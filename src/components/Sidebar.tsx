import { Code2, Eye, FileCode, PanelRightClose, PanelRightOpen, Settings, TerminalSquare } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useWorkbenchStore } from '../stores/workbenchStore';
import EditorPane from './EditorPane';
import { FileExplorer } from './FileExplorer';
import { PreviewPane } from './PreviewPane';
import { SettingsPanel } from './SettingsPanel';
import { TerminalPane } from './TerminalPane';
import { Button } from './ui/button';

const tabs = [
  { id: 'editor' as const, label: 'Editor', icon: Code2 },
  { id: 'files' as const, label: 'Files', icon: FileCode },
  { id: 'terminal' as const, label: 'Terminal', icon: TerminalSquare },
  { id: 'preview' as const, label: 'Preview', icon: Eye },
  { id: 'settings' as const, label: 'Settings', icon: Settings }
];

export function Sidebar() {
  const activeTab = useWorkbenchStore((state) => state.activeTab);
  const isCollapsed = useWorkbenchStore((state) => state.isSidebarCollapsed);
  const sidebarWidth = useWorkbenchStore((state) => state.sidebarWidth);
  const setActiveTab = useWorkbenchStore((state) => state.setActiveTab);
  const setCollapsed = useWorkbenchStore((state) => state.setSidebarCollapsed);
  const setSidebarWidth = useWorkbenchStore((state) => state.setSidebarWidth);
  const [resizing, setResizing] = useState(false);

  const startResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizing(true);
  }, []);

  useEffect(() => {
    if (!resizing) return;
    const handleMove = (event: PointerEvent) => {
      const viewportWidth = window.innerWidth;
      setSidebarWidth(viewportWidth - event.clientX);
    };
    const stopResize = () => setResizing(false);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', stopResize, { once: true });
    window.addEventListener('pointercancel', stopResize, { once: true });
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', stopResize);
      window.removeEventListener('pointercancel', stopResize);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizing, setSidebarWidth]);

  return (
    <aside className={isCollapsed ? 'sidebar collapsed' : resizing ? 'sidebar resizing' : 'sidebar'} style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}>
      {!isCollapsed && <div className="sidebarResizeHandle" role="separator" aria-orientation="vertical" aria-label="Resize workspace sidebar" onPointerDown={startResize} />}
      <nav className="tabBar" aria-label="Workspace tabs">
        <Button variant="ghost" size={isCollapsed ? 'icon' : 'sm'} className="tab collapseButton" onClick={() => setCollapsed(!isCollapsed)} title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {isCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
          {!isCollapsed && 'Hide'}
        </Button>
        {tabs.map(({ id, label, icon: Icon }) => (
          <Button key={id} variant="ghost" size={isCollapsed ? 'icon' : 'sm'} className={activeTab === id ? 'tab active' : 'tab'} onClick={() => setActiveTab(id)} title={label}>
            <Icon size={15} />
            {!isCollapsed && label}
          </Button>
        ))}
      </nav>
      {!isCollapsed && (
        <div className="tabBody">
          {activeTab === 'files' && <FileExplorer />}
          {activeTab === 'editor' && <EditorPane />}
          {activeTab === 'terminal' && <TerminalPane />}
          {activeTab === 'preview' && <PreviewPane />}
          {activeTab === 'settings' && <SettingsPanel />}
        </div>
      )}
    </aside>
  );
}
