import { Play, Trash2 } from 'lucide-react';
import { FormEvent, useRef, useState } from 'react';
import { runContainerCommand, syncFilesToContainer } from '../lib/webcontainer';
import { useWorkbenchStore } from '../stores/workbenchStore';
import { Button } from './ui/button';
import { Input } from './ui/input';

export function TerminalPane() {
  const [command, setCommand] = useState('npm install');
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const outputRef = useRef<HTMLPreElement>(null);
  const files = useWorkbenchStore((state) => state.files);
  const terminalOutput = useWorkbenchStore((state) => state.terminalOutput);
  const appendTerminal = useWorkbenchStore((state) => state.appendTerminal);
  const clearTerminal = useWorkbenchStore((state) => state.clearTerminal);
  const addMessage = useWorkbenchStore((state) => state.addMessage);
  const updateToolStatus = useWorkbenchStore((state) => state.updateToolStatus);

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (history.length === 0) return;
      const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      setCommand(history[newIndex]);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (historyIndex === -1) return;
      const newIndex = historyIndex + 1;
      if (newIndex >= history.length) {
        setHistoryIndex(-1);
        setCommand('');
      } else {
        setHistoryIndex(newIndex);
        setCommand(history[newIndex]);
      }
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!command.trim() || running) return;
    const trimmed = command.trim();
    if (trimmed && history[history.length - 1] !== trimmed) {
      setHistory((h) => [...h, trimmed]);
    }
    setHistoryIndex(-1);
    setRunning(true);
    const toolCallId = `term-${Date.now()}`;
    const eventId = addMessage({ type: 'tool_call', toolCallId, toolName: 'run_command', input: { command }, status: 'running' });
    appendTerminal(`\n$ ${command}\n`);
    let output = '';
    try {
      await syncFilesToContainer(files);
      const exitCode = await runContainerCommand(command, (chunk) => {
        output += chunk;
        appendTerminal(chunk);
        requestAnimationFrame(() => {
          if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
        });
      });
      updateToolStatus(eventId, exitCode === 0 ? 'success' : 'error');
      addMessage({ type: 'tool_result', toolCallId, toolName: 'run_command', output: { command, exitCode, output: output.slice(-2000) } });
    } catch (error) {
      updateToolStatus(eventId, 'error');
      addMessage({ type: 'tool_result', toolCallId, toolName: 'run_command', output: { error: error instanceof Error ? error.message : String(error) } });
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="panel terminalPane">
      <div className="panelTitle">Terminal <Button variant="outline" size="icon" className="iconBtn" onClick={clearTerminal}><Trash2 size={14} /></Button></div>
      <pre ref={outputRef} className="terminalOutput">{terminalOutput || 'The WebContainer sandbox connects automatically. Run commands here.'}</pre>
      <form className="terminalInput" onSubmit={submit}>
        <Input value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={handleKeyDown} />
        <Button disabled={running}><Play size={14} /> {running ? 'Running' : 'Run'}</Button>
      </form>
    </section>
  );
}
