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
  },
  {
    type: 'function',
    function: {
      name: 'iframe_open',
      description: 'Open a URL in the preview iframe. Use this to inspect or navigate browser pages in the embedded preview, similar to a lightweight browser open action.',
      parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'], additionalProperties: false }
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

function toolCallsFromOpenAI(openAIToolCalls: OpenAIToolCall[]): ToolCall[] {
  return openAIToolCalls.map((call) => ({
    id: call.id,
    name: call.function.name,
    arguments: parseToolArguments(call.function.arguments)
  }));
}

export async function callOpenAICompatible(settings: LlmSettings, messages: ChatMessage[], signal?: AbortSignal) {
  if (!settings.apiKey) throw new Error('Missing API key. Open Settings and configure an OpenAI-compatible endpoint first.');

  const response = await fetch(`${settings.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    signal,
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
  const toolCalls = toolCallsFromOpenAI(openAIToolCalls);

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

export async function streamOpenAICompatible(
  settings: LlmSettings,
  messages: ChatMessage[],
  options: { signal?: AbortSignal; onToken?: (token: string) => void } = {}
) {
  if (!settings.apiKey) throw new Error('Missing API key. Open Settings and configure an OpenAI-compatible endpoint first.');

  const response = await fetch(`${settings.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    signal: options.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.2,
      stream: true
    })
  });

  if (!response.ok) throw new Error(await response.text());
  if (!response.body) return callOpenAICompatible(settings, messages, options.signal);

  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = '';
  let content = '';
  const toolCallParts = new Map<number, OpenAIToolCall>();

  const handlePayload = (payload: string) => {
    if (!payload || payload === '[DONE]') return;
    const json = JSON.parse(payload);
    const delta = json.choices?.[0]?.delta || {};
    if (delta.content) {
      content += delta.content;
      options.onToken?.(delta.content);
    }
    for (const part of delta.tool_calls || []) {
      const index = part.index ?? 0;
      const existing = toolCallParts.get(index) || { id: part.id || `tool-${index}`, type: 'function', function: { name: '', arguments: '' } };
      if (part.id) existing.id = part.id;
      if (part.function?.name) existing.function.name += part.function.name;
      if (part.function?.arguments) existing.function.arguments += part.function.arguments;
      toolCallParts.set(index, existing);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      handlePayload(trimmed.slice(5).trim());
    }
  }
  if (buffer.trim().startsWith('data:')) handlePayload(buffer.trim().slice(5).trim());

  const openAIToolCalls = [...toolCallParts.entries()].sort(([a], [b]) => a - b).map(([, call]) => call).filter((call) => call.function.name);
  return {
    content,
    assistantMessage: {
      role: 'assistant' as const,
      content: content || null,
      tool_calls: openAIToolCalls.length ? openAIToolCalls : undefined
    },
    toolCalls: toolCallsFromOpenAI(openAIToolCalls)
  };
}
