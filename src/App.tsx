import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { ChatBox } from './components/ChatBox';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MessageList } from './components/MessageList';
import { Sidebar } from './components/Sidebar';
import { SessionSidebar } from './components/SessionSidebar';
import { bootWebContainer } from './lib/webcontainer';
import { useWorkbenchStore } from './stores/workbenchStore';
import { Button } from './components/ui/button';

export default function App() {
  const files = useWorkbenchStore((state) => state.files);
  const themeMode = useWorkbenchStore((state) => state.themeMode);
  const isSidebarCollapsed = useWorkbenchStore((state) => state.isSidebarCollapsed);
  const setBooted = useWorkbenchStore((state) => state.setBooted);
  const setBooting = useWorkbenchStore((state) => state.setBooting);
  const setPreviewUrl = useWorkbenchStore((state) => state.setPreviewUrl);
  const addMessage = useWorkbenchStore((state) => state.addMessage);
  const appendTerminal = useWorkbenchStore((state) => state.appendTerminal);

  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const resolved = themeMode === 'system' ? (systemDark.matches ? 'dark' : 'light') : themeMode;
      root.dataset.theme = resolved;
    };
    applyTheme();
    systemDark.addEventListener('change', applyTheme);
    return () => systemDark.removeEventListener('change', applyTheme);
  }, [themeMode]);

  const doBoot = useCallback(async () => {
    setBootError(null);
    setBooting(true);
    const eventId = addMessage({ type: 'tool_call', toolCallId: 'boot', toolName: 'boot_webcontainer', input: { files: files.length }, status: 'running' });
    try {
      const wc = await bootWebContainer(files);
      wc.on('server-ready', (_port, url) => {
        setPreviewUrl(url);
        addMessage({ type: 'tool_result', toolCallId: 'boot', toolName: 'server-ready', output: { url } });
      });
      setBooted(true);
      appendTerminal('WebContainer sandbox connected. Try `npm install`, then `npm run dev`.\n');
      useWorkbenchStore.getState().updateToolStatus(eventId, 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setBootError(msg);
      useWorkbenchStore.getState().updateToolStatus(eventId, 'error');
      addMessage({ type: 'assistant_message', content: msg });
    } finally {
      setBooting(false);
    }
  }, [files, addMessage, appendTerminal, setBooted, setBooting, setPreviewUrl]);

  useEffect(() => {
    let cancelled = false;
    doBoot().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="app">
      {bootError && (
        <div className="bootErrorBanner">
          <AlertTriangle size={16} />
          <span>WebContainer boot failed: {bootError}</span>
          <Button variant="outline" size="sm" className="small" onClick={doBoot}>
            <RefreshCw size={14} /> Retry
          </Button>
        </div>
      )}
      <main className={isSidebarCollapsed ? 'workspace sidebarCollapsed' : 'workspace'}>
        <SessionSidebar />
        <section className="conversation">
          <ErrorBoundary>
            <MessageList />
          </ErrorBoundary>
          <ChatBox />
        </section>
        <ErrorBoundary>
          <Sidebar />
        </ErrorBoundary>
      </main>
    </div>
  );
}
