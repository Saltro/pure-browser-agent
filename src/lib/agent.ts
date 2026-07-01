import { callOpenAICompatible, type ChatMessage } from './llm';
import { readContainerFile, runContainerCommand, syncFilesToContainer, writeContainerFile } from './webcontainer';
import { useWorkbenchStore } from '../stores/workbenchStore';
import type { ToolCall } from '../types/workbench';

const systemPrompt = `You are an agent running inside Pure Browser Agent, a browser-only WebContainer workbench.
You can inspect and edit files and run commands only inside the WebContainer virtual environment.
Prefer small steps. Use tools when you need workspace state.
When you change code, use write_file. When you need to verify, use run_command.
Final answers should be concise and include what changed and how it was verified.`;

function shouldConfirmCommand(command: string) {
  return /(^|\s)(rm|mv|cp|chmod|chown|curl|wget|git|npm\s+publish|pnpm\s+publish|yarn\s+npm\s+publish)\b/.test(command);
}

async function executeTool(call: ToolCall) {
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
      const exitCode = await runContainerCommand(command, (chunk) => {
        output += chunk;
        store.appendTerminal(chunk);
      });
      return { command, exitCode, output: output.slice(-4000) };
    }
    default:
      throw new Error(`Unknown tool: ${call.name}`);
  }
}

export async function runAgentTurn(userInput: string) {
  const store = useWorkbenchStore.getState();
  store.addMessage({ type: 'user_message', content: userInput });

  const fileList = store.files.map((file) => file.path).join('\n');
  const recentMessages = store.messages
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

  for (let step = 0; step < 8; step++) {
    const response = await callOpenAICompatible(useWorkbenchStore.getState().llm, messages);

    if (!response.toolCalls.length) {
      const content = response.content || 'Done.';
      store.addMessage({ type: 'assistant_message', content });
      return content;
    }

    messages.push(response.assistantMessage);
    if (response.content) store.addMessage({ type: 'assistant_message', content: response.content });

    for (const toolCall of response.toolCalls) {
      const eventId = store.addMessage({ type: 'tool_call', toolName: toolCall.name, input: toolCall.arguments, status: 'running' });
      try {
        const result = await executeTool(toolCall);
        store.updateToolStatus(eventId, 'success');
        store.addMessage({ type: 'tool_result', toolName: toolCall.name, output: result });
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result).slice(0, 6000) });
      } catch (error) {
        store.updateToolStatus(eventId, 'error');
        const message = error instanceof Error ? error.message : String(error);
        store.addMessage({ type: 'tool_result', toolName: toolCall.name, output: { error: message } });
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ error: message }) });
      }
    }
  }

  const final = 'Reached max agent steps. Please continue if you want me to keep going.';
  store.addMessage({ type: 'assistant_message', content: final });
  return final;
}
