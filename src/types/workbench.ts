export type FileNode = {
  path: string;
  content: string;
};

export type QuestionKind = 'single' | 'multiple' | 'text';

export type AgentQuestionOption = {
  id: string;
  label: string;
  description?: string;
};

export type AgentQuestion = {
  id: string;
  title: string;
  description?: string;
  kind: QuestionKind;
  options?: AgentQuestionOption[];
  allowCustom?: boolean;
};

export type AgentQuestionAnswer = {
  questionId: string;
  selectedOptionIds?: string[];
  customText?: string;
};

export type SubagentStatus = 'running' | 'completed' | 'error' | 'interrupted';

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
  | { id: string; type: 'approval_request'; reason: string; command?: string; createdAt: number }
  | {
      id: string;
      type: 'question_request';
      toolCallId: string;
      questions: AgentQuestion[];
      status: 'pending' | 'answered' | 'cancelled';
      source?: { kind: 'main' | 'subagent'; sessionId: string; title?: string };
      createdAt: number;
    }
  | { id: string; type: 'question_answer'; toolCallId: string; answers: AgentQuestionAnswer[]; createdAt: number }
  | {
      id: string;
      type: 'subagent_trace';
      toolCallId: string;
      subagentSessionId: string;
      title: string;
      status: SubagentStatus;
      messages: AppMessage[];
      finalAnswer?: string;
      createdAt: number;
    };

export type ConversationSession = {
  id: string;
  title: string;
  messages: AppMessage[];
  createdAt: number;
  updatedAt: number;
};

export type SubagentSession = {
  id: string;
  parentSessionId: string;
  title: string;
  messages: AppMessage[];
  createdAt: number;
  updatedAt: number;
  status: SubagentStatus;
  allowedTools: string[];
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
