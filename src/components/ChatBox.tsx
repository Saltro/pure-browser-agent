import { Square, Send } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { interruptAgentTurn, runAgentTurn } from '../lib/agent';
import { useWorkbenchStore } from '../stores/workbenchStore';
import { Button } from './ui/button';
import { Input } from './ui/input';

export function ChatBox() {
  const [input, setInput] = useState('');
  const running = useWorkbenchStore((state) => state.isAgentRunning);
  const setRunning = useWorkbenchStore((state) => state.setAgentRunning);
  const addMessage = useWorkbenchStore((state) => state.addMessage);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const value = input;
    if (!value.trim() || running) return;
    setInput('');
    setRunning(true);
    try {
      await runAgentTurn(value);
    } catch (error) {
      addMessage({ type: 'assistant_message', content: error instanceof Error ? error.message : String(error) });
    } finally {
      setRunning(false);
    }
  }

  function stop() {
    interruptAgentTurn();
    setRunning(false);
  }

  return (
    <div className="composer">
      <form className="chatBox" onSubmit={submit}>
        <Input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask the agent to edit files, run commands, open a URL, or explain the workspace..." />
        {running ? (
          <Button type="button" variant="destructive" onClick={stop}><Square size={15} /> Stop</Button>
        ) : (
          <Button disabled={!input.trim()}><Send size={15} /> Send</Button>
        )}
      </form>
    </div>
  );
}
