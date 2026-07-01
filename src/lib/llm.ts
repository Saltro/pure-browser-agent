import type { LlmSettings, ToolCall } from '../types/workbench';

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: OpenAIToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

type OpenAIToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

export const tools = [
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List all files in the current WebContainer workspace.',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a file from the current workspace.',
      parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write a file to the current workspace. Creates parent directories when needed.',
      parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'], additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Run a command inside the WebContainer virtual shell. Use for npm install, npm run dev, npm test, node scripts, etc.',
      parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'], additionalProperties: false }
    }
  }
];

function parseToolArguments(raw: string) {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return { _raw: raw };
  }
}

export async function callOpenAICompatible(settings: LlmSettings, messages: ChatMessage[]) {
  if (!settings.apiKey) throw new Error('Missing API key. Open Settings and configure an OpenAI-compatible endpoint first.');

  const response = await fetch(`${settings.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.2
    })
  });

  if (!response.ok) throw new Error(await response.text());
  const json = await response.json();
  const message = json.choices?.[0]?.message ?? { role: 'assistant', content: '' };
  const openAIToolCalls: OpenAIToolCall[] = message.tool_calls || [];
  const toolCalls: ToolCall[] = openAIToolCalls.map((call) => ({
    id: call.id,
    name: call.function.name,
    arguments: parseToolArguments(call.function.arguments)
  }));

  return {
    content: message.content || '',
    assistantMessage: {
      role: 'assistant' as const,
      content: message.content || null,
      tool_calls: openAIToolCalls.length ? openAIToolCalls : undefined
    },
    toolCalls
  };
}
