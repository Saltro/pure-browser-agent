import { useEffect } from 'react';
import { ChatBox } from './components/ChatBox';
import { Header } from './components/Header';
import { MessageList } from './components/MessageList';
import { Sidebar } from './components/Sidebar';
import { bootWebContainer } from './lib/webcontainer';
import { useWorkbenchStore } from './stores/workbenchStore';

export default function App() {
  const files = useWorkbenchStore((state) => state.files);
  const themeMode = useWorkbenchStore((state) => state.themeMode);
  const setBooted = useWorkbenchStore((state) => state.setBooted);
  const setBooting = useWorkbenchStore((state) => state.setBooting);
  const setPreviewUrl = useWorkbenchStore((state) => state.setPreviewUrl);
  const addMessage = useWorkbenchStore((state) => state.addMessage);
  const appendTerminal = useWorkbenchStore((state) => state.appendTerminal);

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

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      setBooting(true);
      const eventId = addMessage({ type: 'tool_call', toolName: 'boot_webcontainer', input: { files: files.length }, status: 'running' });
      try {
        const wc = await bootWebContainer(files);
        if (cancelled) return;
        wc.on('server-ready', (_port, url) => {
          setPreviewUrl(url);
          addMessage({ type: 'tool_result', toolName: 'server-ready', output: { url } });
        });
        setBooted(true);
        appendTerminal('WebContainer sandbox connected. Try `npm install`, then `npm run dev`.\n');
        useWorkbenchStore.getState().updateToolStatus(eventId, 'success');
      } catch (error) {
        useWorkbenchStore.getState().updateToolStatus(eventId, 'error');
        addMessage({ type: 'assistant_message', content: error instanceof Error ? error.message : String(error) });
      } finally {
        setBooting(false);
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="app">
      <Header />
      <main className="workspace">
        <section className="conversation">
          <MessageList />
          <ChatBox />
        </section>
        <Sidebar />
      </main>
    </div>
  );
}
