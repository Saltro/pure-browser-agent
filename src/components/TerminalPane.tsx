import { Play, Trash2 } from 'lucide-react';
import { FormEvent, useRef, useState } from 'react';
import { runContainerCommand, syncFilesToContainer } from '../lib/webcontainer';
import { useWorkbenchStore } from '../stores/workbenchStore';

export function TerminalPane() {
  const [command, setCommand] = useState('npm install');
  const [running, setRunning] = useState(false);
  const outputRef = useRef<HTMLPreElement>(null);
  const files = useWorkbenchStore((state) => state.files);
  const terminalOutput = useWorkbenchStore((state) => state.terminalOutput);
  const appendTerminal = useWorkbenchStore((state) => state.appendTerminal);
  const clearTerminal = useWorkbenchStore((state) => state.clearTerminal);
  const addContext = useWorkbenchStore((state) => state.addContext);
  const addTimeline = useWorkbenchStore((state) => state.addTimeline);
  const updateToolStatus = useWorkbenchStore((state) => state.updateToolStatus);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!command.trim() || running) return;
    setRunning(true);
    const eventId = addTimeline({ type: 'tool_call', toolName: 'run_command', input: { command }, status: 'running' });
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
      addContext({ type: exitCode === 0 ? 'terminal' : 'error', title: `$ ${command}`, content: output || `exit ${exitCode}` });
      addTimeline({ type: 'tool_result', toolName: 'run_command', output: { command, exitCode } });
    } catch (error) {
      updateToolStatus(eventId, 'error');
      addTimeline({ type: 'tool_result', toolName: 'run_command', output: { error: error instanceof Error ? error.message : String(error) } });
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="panel terminalPane">
      <div className="panelTitle">Terminal <button className="iconBtn" onClick={clearTerminal}><Trash2 size={14} /></button></div>
      <pre ref={outputRef} className="terminalOutput">{terminalOutput || 'Boot WebContainer, then run commands here.'}</pre>
      <form className="terminalInput" onSubmit={submit}>
        <input value={command} onChange={(event) => setCommand(event.target.value)} />
        <button disabled={running}><Play size={14} /> {running ? 'Running' : 'Run'}</button>
      </form>
    </section>
  );
}
