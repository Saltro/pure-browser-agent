import { Square, Send } from "lucide-react";
import { FormEvent, useRef, useState } from "react";
import { interruptAgentTurn, runAgentTurn } from "../lib/agent";
import { useWorkbenchStore } from "../stores/workbenchStore";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useToast } from "./ui/toast";

export function ChatBox() {
  const [hasText, setHasText] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  const running = useWorkbenchStore((state) => state.isAgentRunning);
  const addMessage = useWorkbenchStore((state) => state.addMessage);
  const { toast } = useToast();

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (composing.current) return;
    const value = inputRef.current?.value ?? "";
    if (!value.trim() || running) return;
    if (inputRef.current) inputRef.current.value = "";
    setHasText(false);
    try {
      await runAgentTurn(value);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("API key") || msg.includes("Missing")) {
        toast({
          title: "Configuration needed",
          description: msg,
          variant: "destructive",
        });
      } else {
        addMessage({ type: "assistant_message", content: msg });
      }
    }
  }

  function stop() {
    interruptAgentTurn();
  }

  return (
    <div className="composer">
      <form className="chatBox" onSubmit={submit}>
        <Input
          ref={inputRef}
          className="border-none focus-visible:ring-0"
          onInput={(e) => setHasText((e.target as HTMLInputElement).value.length > 0)}
          onCompositionStart={() => { composing.current = true; }}
          onCompositionEnd={() => {
            composing.current = false;
            const el = inputRef.current;
            if (el) setHasText(el.value.length > 0);
          }}
          placeholder="Ask the agent to edit files, run commands, open a URL, or explain the workspace..."
        />
        {running ? (
          <Button type="button" variant="destructive" onClick={stop}>
            <Square size={15} /> Stop
          </Button>
        ) : (
          <Button disabled={!hasText}>
            <Send size={15} /> Send
          </Button>
        )}
      </form>
    </div>
  );
}
