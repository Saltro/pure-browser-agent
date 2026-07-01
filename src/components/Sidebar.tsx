import { Code2, Eye, FileCode, Settings, TerminalSquare } from 'lucide-react';
import { EditorPane } from './EditorPane';
import { FileExplorer } from './FileExplorer';
import { PreviewPane } from './PreviewPane';
import { SettingsPanel } from './SettingsPanel';
import { TerminalPane } from './TerminalPane';
import { useWorkbenchStore } from '../stores/workbenchStore';

const tabs = [
  { id: 'editor' as const, label: 'Editor', icon: Code2 },
  { id: 'files' as const, label: 'Files', icon: FileCode },
  { id: 'terminal' as const, label: 'Terminal', icon: TerminalSquare },
  { id: 'preview' as const, label: 'Preview', icon: Eye },
  { id: 'settings' as const, label: 'Settings', icon: Settings }
];

export function Sidebar() {
  const activeTab = useWorkbenchStore((state) => state.activeTab);
  const setActiveTab = useWorkbenchStore((state) => state.setActiveTab);

  return (
    <aside className="sidebar">
      <nav className="tabBar" aria-label="Workspace tabs">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} className={activeTab === id ? 'tab active' : 'tab'} onClick={() => setActiveTab(id)}>
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>
      <div className="tabBody">
        {activeTab === 'files' && <FileExplorer />}
        {activeTab === 'editor' && <EditorPane />}
        {activeTab === 'terminal' && <TerminalPane />}
        {activeTab === 'preview' && <PreviewPane />}
        {activeTab === 'settings' && <SettingsPanel />}
      </div>
    </aside>
  );
}
