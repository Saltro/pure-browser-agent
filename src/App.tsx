import { useState } from 'react';
import { ChatBox } from './components/ChatBox';
import { ContextPanel } from './components/ContextPanel';
import { EditorPane } from './components/EditorPane';
import { FileExplorer } from './components/FileExplorer';
import { Header } from './components/Header';
import { PreviewPane } from './components/PreviewPane';
import { SettingsDialog } from './components/SettingsDialog';
import { TerminalPane } from './components/TerminalPane';
import { Timeline } from './components/Timeline';
import { bootWebContainer } from './lib/webcontainer';
import { useWorkbenchStore } from './stores/workbenchStore';

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const files = useWorkbenchStore((state) => state.files);
  const setBooted = useWorkbenchStore((state) => state.setBooted);
  const setPreviewUrl = useWorkbenchStore((state) => state.setPreviewUrl);
  const addTimeline = useWorkbenchStore((state) => state.addTimeline);
  const updateToolStatus = useWorkbenchStore((state) => state.updateToolStatus);
  const appendTerminal = useWorkbenchStore((state) => state.appendTerminal);

  async function boot() {
    const eventId = addTimeline({ type: 'tool_call', toolName: 'boot_webcontainer', input: { files: files.length }, status: 'running' });
    try {
      const wc = await bootWebContainer(files);
      wc.on('server-ready', (_port, url) => {
        setPreviewUrl(url);
        addTimeline({ type: 'tool_result', toolName: 'server-ready', output: { url } });
      });
      setBooted(true);
      updateToolStatus(eventId, 'success');
      appendTerminal('WebContainer booted. Try `npm install`, then `npm run dev`.\n');
      addTimeline({ type: 'assistant_message', content: 'WebContainer booted and files mounted.' });
    } catch (error) {
      updateToolStatus(eventId, 'error');
      addTimeline({ type: 'assistant_message', content: error instanceof Error ? error.message : String(error) });
    }
  }

  return (
    <div className="app">
      <Header onBoot={boot} onOpenSettings={() => setSettingsOpen(true)} />
      <main className="workspace">
        <FileExplorer />
        <div className="centerStack">
          <div className="topGrid">
            <Timeline />
            <EditorPane />
          </div>
          <ChatBox />
          <div className="bottomGrid">
            <TerminalPane />
            <PreviewPane />
          </div>
        </div>
        <ContextPanel />
      </main>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
