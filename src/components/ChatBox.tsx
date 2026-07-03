import { Square, Send } from "lucide-react";
import { FormEvent, useState } from "react";
import { interruptAgentTurn, runAgentTurn } from "../lib/agent";
import { useWorkbenchStore } from "../stores/workbenchStore";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useToast } from "./ui/toast";

export function ChatBox() {
  const [input, setInput] = useState("");
  const running = useWorkbenchStore((state) => state.isAgentRunning);
  const addMessage = useWorkbenchStore((state) => state.addMessage);
  const { toast } = useToast();

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const value = input;
    if (!value.trim() || running) return;
    setInput("");
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
          value={input}
          className="border-none focus-visible:ring-0"
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask the agent to edit files, run commands, open a URL, or explain the workspace..."
        />
        {running ? (
          <Button type="button" variant="destructive" onClick={stop}>
            <Square size={15} /> Stop
          </Button>
        ) : (
          <Button disabled={!input.trim()}>
            <Send size={15} /> Send
          </Button>
        )}
      </form>
    </div>
  );
}
