export type FileNode = {
  path: string;
  content: string;
};

export type AppMessage =
  | { id: string; type: 'user_message'; content: string; createdAt: number }
  | { id: string; type: 'assistant_message'; content: string; createdAt: number; streaming?: boolean }
  | {
      id: string;
      type: 'tool_call';
      toolCallId: string;
      toolName: string;
      input: unknown;
      status: 'pending' | 'running' | 'success' | 'error';
      createdAt: number;
    }
  | { id: string; type: 'tool_result'; toolCallId: string; toolName: string; output: unknown; createdAt: number }
  | { id: string; type: 'approval_request'; reason: string; command?: string; createdAt: number };

export type ConversationSession = {
  id: string;
  title: string;
  messages: AppMessage[];
  createdAt: number;
  updatedAt: number;
};

export type LlmSettings = {
  baseUrl: string;
  model: string;
  apiKey: string;
};

export type ThemeMode = 'light' | 'dark' | 'system';

export type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};
