import { streamOpenAICompatible, type ChatMessage } from './llm';
import { readContainerFile, runContainerCommand, syncFilesToContainer, writeContainerFile } from './webcontainer';
import { useWorkbenchStore } from '../stores/workbenchStore';
import type { ToolCall } from '../types/workbench';

const systemPrompt = `You are an agent running inside Pure Browser Agent, a browser-only WebContainer workbench.
You can inspect and edit files and run commands only inside the WebContainer virtual environment.
You can also use iframe_open to open a URL in the embedded preview iframe when the user asks to inspect or navigate a browser page.
Prefer small steps. Use tools when you need workspace state.
When you change code, use write_file. When you need to verify, use run_command.
Final answers should be concise and include what changed and how it was verified.`;

let activeAbortController: AbortController | null = null;

export function interruptAgentTurn() {
  activeAbortController?.abort();
}

function shouldConfirmCommand(command: string) {
  return /(^|\s)(rm|mv|cp|chmod|chown|curl|wget|git|npm\s+publish|pnpm\s+publish|yarn\s+npm\s+publish)\b/.test(command);
}

async function executeTool(call: ToolCall, signal: AbortSignal) {
  const store = useWorkbenchStore.getState();
  switch (call.name) {
    case 'list_files':
      return store.files.map((file) => file.path);
    case 'read_file': {
      const path = String(call.arguments.path || '');
      const local = store.files.find((file) => file.path === path);
      return { path, content: local?.content ?? (await readContainerFile(path)) };
    }
    case 'write_file': {
      const path = String(call.arguments.path || '');
      const content = String(call.arguments.content || '');
      await writeContainerFile(path, content);
      store.upsertFile(path, content);
      store.setActivePath(path);
      store.setActiveTab('editor');
      return { path, bytes: content.length };
    }
    case 'run_command': {
      const command = String(call.arguments.command || '');
      if (shouldConfirmCommand(command)) {
        store.addMessage({ type: 'approval_request', reason: 'Command requires approval before running in WebContainer.', command });
        const ok = window.confirm(`Allow agent to run this command in WebContainer?\n\n${command}`);
        if (!ok) return { command, skipped: true, reason: 'User denied command approval.' };
      }

      await syncFilesToContainer(useWorkbenchStore.getState().files);
      store.setActiveTab('terminal');
      store.appendTerminal(`\n$ ${command}\n`);
      let output = '';
      const exitCode = await runContainerCommand(
        command,
        (chunk) => {
          output += chunk;
          store.appendTerminal(chunk);
        },
        signal
      );
      return { command, exitCode, output: output.slice(-4000) };
    }
    case 'iframe_open': {
      const url = String(call.arguments.url || '');
      if (!url) throw new Error('iframe_open requires a url');
      store.setIframeUrl(url);
      store.setActiveTab('preview');
      return { url, opened: true };
    }
    default:
      throw new Error(`Unknown tool: ${call.name}`);
  }
}

function activeMessagesForPrompt() {
  const store = useWorkbenchStore.getState();
  return store.getActiveSession().messages;
}

export async function runAgentTurn(userInput: string) {
  interruptAgentTurn();
  const abortController = new AbortController();
  activeAbortController = abortController;
  const signal = abortController.signal;
  const store = useWorkbenchStore.getState();
  store.addMessage({ type: 'user_message', content: userInput });

  const fileList = store.files.map((file) => file.path).join('\n');
  const recentMessages = activeMessagesForPrompt()
    .slice(-12)
    .map((message) => `${message.type}: ${'content' in message ? message.content : JSON.stringify(message)}`)
    .join('\n');

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Workspace files:\n${fileList}\n\nRecent messages:\n${recentMessages || '(none)'}\n\nUser request:\n${userInput}`
    }
  ];

  try {
    for (let step = 0; step < 8; step++) {
      signal.throwIfAborted();
      const assistantMessageId = store.addMessage({ type: 'assistant_message', content: '', streaming: true });
      const response = await streamOpenAICompatible(useWorkbenchStore.getState().llm, messages, {
        signal,
        onToken: (token) => store.appendAssistantMessage(assistantMessageId, token)
      });
      store.updateMessage(assistantMessageId, { streaming: false });

      if (!response.toolCalls.length) {
        if (!response.content) store.updateMessage(assistantMessageId, { content: 'Done.' });
        return response.content || 'Done.';
      }

      if (!response.content) store.updateMessage(assistantMessageId, { content: `Calling ${response.toolCalls.map((call) => call.name).join(', ')}...` });
      messages.push(response.assistantMessage);

      for (const toolCall of response.toolCalls) {
        signal.throwIfAborted();
        const eventId = store.addMessage({ type: 'tool_call', toolName: toolCall.name, input: toolCall.arguments, status: 'running' });
        try {
          const result = await executeTool(toolCall, signal);
          store.updateToolStatus(eventId, 'success');
          store.addMessage({ type: 'tool_result', toolName: toolCall.name, output: result });
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result).slice(0, 6000) });
        } catch (error) {
          store.updateToolStatus(eventId, 'error');
          const message = error instanceof Error ? error.message : String(error);
          store.addMessage({ type: 'tool_result', toolName: toolCall.name, output: { error: message } });
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ error: message }) });
          if (error instanceof DOMException && error.name === 'AbortError') throw error;
        }
      }
    }

    const final = 'Reached max agent steps. Please continue if you want me to keep going.';
    store.addMessage({ type: 'assistant_message', content: final });
    return final;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      store.addMessage({ type: 'assistant_message', content: 'Interrupted.' });
      return 'Interrupted.';
    }
    throw error;
  } finally {
    if (activeAbortController === abortController) activeAbortController = null;
  }
}
