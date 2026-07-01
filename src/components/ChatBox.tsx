import { Send, Sparkles } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { runAgentTurn } from '../lib/agent';
import { useWorkbenchStore } from '../stores/workbenchStore';

const examples = [
  'Turn the starter page into a polished todo app, then run npm install and npm run dev.',
  'Read the files and explain how this project works.',
  'Add a Counter component and use it from the main app.'
];

export function ChatBox() {
  const [input, setInput] = useState('');
  const running = useWorkbenchStore((state) => state.isAgentRunning);
  const setRunning = useWorkbenchStore((state) => state.setAgentRunning);
  const addTimeline = useWorkbenchStore((state) => state.addTimeline);

  async function submit(event?: FormEvent, override?: string) {
    event?.preventDefault();
    const value = override || input;
    if (!value.trim() || running) return;
    setInput('');
    setRunning(true);
    try {
      await runAgentTurn(value);
    } catch (error) {
      addTimeline({ type: 'assistant_message', content: error instanceof Error ? error.message : String(error) });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="chatArea">
      <div className="promptChips">
        {examples.map((example) => (
          <button key={example} type="button" className="chip" onClick={() => submit(undefined, example)} disabled={running}>
            <Sparkles size={13} /> {example}
          </button>
        ))}
      </div>
      <form className="chatBox" onSubmit={submit}>
        <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask the agent to edit files, run npm install, start dev server..." />
        <button disabled={running}>{running ? 'Running...' : <><Send size={15} /> Send</>}</button>
      </form>
    </div>
  );
}
