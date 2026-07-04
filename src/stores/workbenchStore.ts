import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createIndexedDbStorage } from '../lib/indexedDbStorage';
import type {
  AgentQuestionAnswer,
  AppMessage,
  ConversationSession,
  FileNode,
  LlmSettings,
  SubagentSession,
  SubagentStatus,
  ThemeMode
} from '../types/workbench';

const now = () => Date.now();
const id = () => crypto.randomUUID();

const starterFiles: FileNode[] = [
  {
    path: 'package.json',
    content: JSON.stringify(
      {
        scripts: { dev: 'vite --host 0.0.0.0', build: 'vite build' },
        dependencies: { '@vitejs/plugin-react': '^6.0.3', vite: '^8.1.2', react: '^19.2.7', 'react-dom': '^19.2.7' },
        devDependencies: {}
      },
      null,
      2
    )
  },
  {
    path: 'index.html',
    content: '<div id="root"></div><script type="module" src="/src/main.jsx"></script>'
  },
  {
    path: 'src/main.jsx',
    content: "import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport './style.css';\n\nfunction App() {\n  return <main><h1>Hello Pure Browser Agent</h1><p>Edit me with the agent.</p></main>;\n}\n\ncreateRoot(document.getElementById('root')).render(<App />);\n"
  },
  {
    path: 'src/style.css',
    content: 'body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #111827; color: white; } main { padding: 48px; }'
  }
];

function welcomeMessage(): AppMessage {
  return {
    id: id(),
    type: 'assistant_message',
    content: 'Welcome to Pure Browser Agent. Ask me to inspect, edit, or run the sandbox project.',
    createdAt: now()
  };
}

function createSession(title = 'New session'): ConversationSession {
  const timestamp = now();
  return { id: id(), title, messages: [welcomeMessage()], createdAt: timestamp, updatedAt: timestamp };
}

const initialSession = createSession('Session 1');

type MessageDraft =
  | Omit<Extract<AppMessage, { type: 'user_message' }>, 'id' | 'createdAt'>
  | Omit<Extract<AppMessage, { type: 'assistant_message' }>, 'id' | 'createdAt'>
  | Omit<Extract<AppMessage, { type: 'tool_call' }>, 'id' | 'createdAt'>
  | Omit<Extract<AppMessage, { type: 'tool_result' }>, 'id' | 'createdAt'>
  | Omit<Extract<AppMessage, { type: 'approval_request' }>, 'id' | 'createdAt'>
  | Omit<Extract<AppMessage, { type: 'question_request' }>, 'id' | 'createdAt'>
  | Omit<Extract<AppMessage, { type: 'question_answer' }>, 'id' | 'createdAt'>
  | Omit<Extract<AppMessage, { type: 'subagent_trace' }>, 'id' | 'createdAt'>;

type Store = {
  files: FileNode[];
  activePath: string;
  sessions: ConversationSession[];
  subagentSessions: Record<string, SubagentSession>;
  activeSessionId: string;
  terminalOutput: string;
  previewUrl: string;
  iframeUrl: string;
  isBooted: boolean;
  isBooting: boolean;
  isAgentRunning: boolean;
  pendingApproval: { command: string; toolCallId: string } | null;
  activeTab: 'workspace' | 'terminal' | 'preview';
  isSidebarCollapsed: boolean;
  sidebarWidth: number;
  isSessionSidebarCollapsed: boolean;
  themeMode: ThemeMode;
  llm: LlmSettings;
  getActiveSession: () => ConversationSession;
  setBooted: (value: boolean) => void;
  setBooting: (value: boolean) => void;
  setAgentRunning: (value: boolean) => void;
  setPendingApproval: (approval: Store['pendingApproval']) => void;
  setPreviewUrl: (url: string) => void;
  setIframeUrl: (url: string) => void;
  setActiveTab: (tab: Store['activeTab']) => void;
  setSidebarCollapsed: (value: boolean) => void;
  setSidebarWidth: (value: number) => void;
  setSessionSidebarCollapsed: (value: boolean) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setActivePath: (path: string) => void;
  upsertFile: (path: string, content: string) => void;
  deleteFile: (path: string) => void;
  resetWorkspace: () => void;
  appendTerminal: (chunk: string) => void;
  clearTerminal: () => void;
  addMessage: (event: MessageDraft) => string;
  addSessionMessage: (sessionId: string, event: MessageDraft) => string;
  addSubagentMessage: (sessionId: string, event: MessageDraft) => string;
  updateMessage: (eventId: string, patch: Partial<AppMessage>) => void;
  updateSessionMessage: (sessionId: string, eventId: string, patch: Partial<AppMessage>) => void;
  updateSubagentMessage: (sessionId: string, eventId: string, patch: Partial<AppMessage>) => void;
  appendAssistantMessage: (eventId: string, chunk: string) => void;
  appendSessionAssistantMessage: (sessionId: string, eventId: string, chunk: string) => void;
  appendSubagentAssistantMessage: (sessionId: string, eventId: string, chunk: string) => void;
  updateToolStatus: (eventId: string, status: 'pending' | 'running' | 'success' | 'error') => void;
  updateSessionToolStatus: (sessionId: string, eventId: string, status: 'pending' | 'running' | 'success' | 'error') => void;
  updateSubagentToolStatus: (sessionId: string, eventId: string, status: 'pending' | 'running' | 'success' | 'error') => void;
  answerQuestion: (toolCallId: string, answers: AgentQuestionAnswer[]) => void;
  createSubagentSession: (parentSessionId: string, title: string, allowedTools: string[]) => string;
  updateSubagentSession: (sessionId: string, patch: Partial<Pick<SubagentSession, 'title' | 'status' | 'allowedTools'>>) => void;
  upsertSubagentTrace: (mainSessionId: string, trace: { toolCallId: string; subagentSessionId: string; title: string; status: SubagentStatus; finalAnswer?: string }) => string;
  syncSubagentTrace: (mainSessionId: string, subagentSessionId: string, patch?: { status?: SubagentStatus; finalAnswer?: string }) => void;
  createSession: () => string;
  setActiveSession: (sessionId: string) => void;
  renameSession: (sessionId: string, title: string) => void;
  deleteSession: (sessionId: string) => void;
  setLlm: (settings: LlmSettings) => void;
};

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\[[0-9;]*[GKH]/g, '').replace(/\r/g, '');
}

function touchSession(session: ConversationSession, messages: AppMessage[]) {
  return { ...session, messages, updatedAt: now() };
}

function touchSubagentSession(session: SubagentSession, messages: AppMessage[]) {
  return { ...session, messages, updatedAt: now() };
}

function withPatchedMessage(messages: AppMessage[], eventId: string, patch: Partial<AppMessage>) {
  return messages.map((event) => (event.id === eventId ? ({ ...event, ...patch } as AppMessage) : event));
}

function withAssistantChunk(messages: AppMessage[], eventId: string, chunk: string) {
  return messages.map((event) => (event.id === eventId && event.type === 'assistant_message' ? { ...event, content: event.content + chunk } : event));
}

function withToolStatus(messages: AppMessage[], eventId: string, status: 'pending' | 'running' | 'success' | 'error') {
  return messages.map((event) => (event.id === eventId && event.type === 'tool_call' ? { ...event, status } : event));
}

export const useWorkbenchStore = create<Store>()(
  persist(
    (set, get) => ({
      files: starterFiles,
      activePath: 'src/main.jsx',
      sessions: [initialSession],
      subagentSessions: {},
      activeSessionId: initialSession.id,
      terminalOutput: '',
      previewUrl: '',
      iframeUrl: '',
      isBooted: false,
      isBooting: false,
      isAgentRunning: false,
      pendingApproval: null,
      activeTab: 'workspace',
      isSidebarCollapsed: false,
      sidebarWidth: 520,
      isSessionSidebarCollapsed: false,
      themeMode: 'system',
      llm: {
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        apiKey: ''
      },
      getActiveSession: () => {
        const state = get();
        return state.sessions.find((session) => session.id === state.activeSessionId) || state.sessions[0];
      },
      setBooted: (value) => set({ isBooted: value }),
      setBooting: (value) => set({ isBooting: value }),
      setAgentRunning: (value) => set({ isAgentRunning: value }),
      setPendingApproval: (approval) => set({ pendingApproval: approval }),
      setPreviewUrl: (url) => set({ previewUrl: url }),
      setIframeUrl: (url) => set({ iframeUrl: url, previewUrl: url }),
      setActiveTab: (tab) => set({ activeTab: tab, isSidebarCollapsed: false }),
      setSidebarCollapsed: (value) => set({ isSidebarCollapsed: value }),
      setSidebarWidth: (value) => set({ sidebarWidth: Math.min(720, Math.max(320, value)) }),
      setSessionSidebarCollapsed: (value) => set({ isSessionSidebarCollapsed: value }),
      setThemeMode: (mode) => set({ themeMode: mode }),
      setActivePath: (path) => set({ activePath: path }),
      upsertFile: (path, content) =>
        set((state) => {
          const exists = state.files.some((file) => file.path === path);
          return {
            files: exists ? state.files.map((file) => (file.path === path ? { path, content } : file)) : [...state.files, { path, content }]
          };
        }),
      deleteFile: (path) =>
        set((state) => {
          const files = state.files.filter((file) => file.path !== path);
          return { files, activePath: state.activePath === path ? files[0]?.path || '' : state.activePath };
        }),
      resetWorkspace: () => set({ files: starterFiles, activePath: 'src/main.jsx', terminalOutput: '', previewUrl: '', iframeUrl: '' }),
      appendTerminal: (chunk) =>
        set((state) => {
          let output = state.terminalOutput + stripAnsi(chunk)
          const lines = output.split('\n')
          if (lines.length > 2000) {
            output = lines.slice(-2000).join('\n')
          }
          if (output.length > 50000) {
            output = output.slice(-50000)
          }
          return { terminalOutput: output }
        }),
      clearTerminal: () => set({ terminalOutput: '' }),
      addMessage: (event) => {
        return get().addSessionMessage(get().activeSessionId, event);
      },
      addSessionMessage: (sessionId, event) => {
        const eventId = id();
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId ? touchSession(session, [...session.messages, { ...event, id: eventId, createdAt: now() } as AppMessage]) : session
          )
        }));
        return eventId;
      },
      addSubagentMessage: (sessionId, event) => {
        const eventId = id();
        set((state) => {
          const session = state.subagentSessions[sessionId];
          if (!session) return {};
          return {
            subagentSessions: {
              ...state.subagentSessions,
              [sessionId]: touchSubagentSession(session, [...session.messages, { ...event, id: eventId, createdAt: now() } as AppMessage])
            }
          };
        });
        return eventId;
      },
      updateMessage: (eventId, patch) =>
        get().updateSessionMessage(get().activeSessionId, eventId, patch),
      updateSessionMessage: (sessionId, eventId, patch) =>
        set((state) => ({
          sessions: state.sessions.map((session) => (session.id === sessionId ? touchSession(session, withPatchedMessage(session.messages, eventId, patch)) : session))
        })),
      updateSubagentMessage: (sessionId, eventId, patch) =>
        set((state) => {
          const session = state.subagentSessions[sessionId];
          if (!session) return {};
          return {
            subagentSessions: {
              ...state.subagentSessions,
              [sessionId]: touchSubagentSession(session, withPatchedMessage(session.messages, eventId, patch))
            }
          };
        }),
      appendAssistantMessage: (eventId, chunk) =>
        get().appendSessionAssistantMessage(get().activeSessionId, eventId, chunk),
      appendSessionAssistantMessage: (sessionId, eventId, chunk) =>
        set((state) => ({
          sessions: state.sessions.map((session) => (session.id === sessionId ? touchSession(session, withAssistantChunk(session.messages, eventId, chunk)) : session))
        })),
      appendSubagentAssistantMessage: (sessionId, eventId, chunk) =>
        set((state) => {
          const session = state.subagentSessions[sessionId];
          if (!session) return {};
          return {
            subagentSessions: {
              ...state.subagentSessions,
              [sessionId]: touchSubagentSession(session, withAssistantChunk(session.messages, eventId, chunk))
            }
          };
        }),
      updateToolStatus: (eventId, status) =>
        get().updateSessionToolStatus(get().activeSessionId, eventId, status),
      updateSessionToolStatus: (sessionId, eventId, status) =>
        set((state) => ({
          sessions: state.sessions.map((session) => (session.id === sessionId ? touchSession(session, withToolStatus(session.messages, eventId, status)) : session))
        })),
      updateSubagentToolStatus: (sessionId, eventId, status) =>
        set((state) => {
          const session = state.subagentSessions[sessionId];
          if (!session) return {};
          return {
            subagentSessions: {
              ...state.subagentSessions,
              [sessionId]: touchSubagentSession(session, withToolStatus(session.messages, eventId, status))
            }
          };
        }),
      answerQuestion: (toolCallId, answers) => {
        set((state) => {
          const answerMessage = { id: id(), type: 'question_answer', toolCallId, answers, createdAt: now() } as AppMessage;
          const answerMessages = (messages: AppMessage[]) => [
            ...messages.map((event): AppMessage => (event.type === 'question_request' && event.toolCallId === toolCallId ? { ...event, status: 'answered' } : event)),
            answerMessage
          ];
          return {
            sessions: state.sessions.map((session) =>
              session.messages.some((event) => event.type === 'question_request' && event.toolCallId === toolCallId)
                ? touchSession(session, answerMessages(session.messages))
                : session
            ),
            subagentSessions: Object.fromEntries(
              Object.entries(state.subagentSessions).map(([sessionId, session]) => [
                sessionId,
                session.messages.some((event) => event.type === 'question_request' && event.toolCallId === toolCallId)
                  ? touchSubagentSession(session, answerMessages(session.messages))
                  : session
              ])
            )
          };
        });
      },
      createSubagentSession: (parentSessionId, title, allowedTools) => {
        const sessionId = id();
        const timestamp = now();
        set((state) => ({
          subagentSessions: {
            ...state.subagentSessions,
            [sessionId]: { id: sessionId, parentSessionId, title, messages: [], createdAt: timestamp, updatedAt: timestamp, status: 'running', allowedTools }
          }
        }));
        return sessionId;
      },
      updateSubagentSession: (sessionId, patch) =>
        set((state) => {
          const session = state.subagentSessions[sessionId];
          if (!session) return {};
          return {
            subagentSessions: {
              ...state.subagentSessions,
              [sessionId]: { ...session, ...patch, updatedAt: now() }
            }
          };
        }),
      upsertSubagentTrace: (mainSessionId, trace) => {
        let traceId = '';
        set((state) => {
          const subagent = state.subagentSessions[trace.subagentSessionId];
          const messages = subagent?.messages ?? [];
          return {
            sessions: state.sessions.map((session) => {
              if (session.id !== mainSessionId) return session;
              const existing = session.messages.find(
                (event) => event.type === 'subagent_trace' && event.subagentSessionId === trace.subagentSessionId && event.toolCallId === trace.toolCallId
              );
              if (existing?.type === 'subagent_trace') {
                traceId = existing.id;
                return touchSession(
                  session,
                  session.messages.map((event) =>
                    event.id === existing.id ? { ...existing, ...trace, messages, finalAnswer: trace.finalAnswer ?? existing.finalAnswer } : event
                  )
                );
              }
              traceId = id();
              return touchSession(session, [
                ...session.messages,
                { id: traceId, type: 'subagent_trace', ...trace, messages, createdAt: now() } as AppMessage
              ]);
            })
          };
        });
        return traceId;
      },
      syncSubagentTrace: (mainSessionId, subagentSessionId, patch = {}) =>
        set((state) => {
          const subagent = state.subagentSessions[subagentSessionId];
          if (!subagent) return {};
          return {
            sessions: state.sessions.map((session) =>
              session.id === mainSessionId
                ? touchSession(
                    session,
                    session.messages.map((event) =>
                      event.type === 'subagent_trace' && event.subagentSessionId === subagentSessionId
                        ? { ...event, messages: subagent.messages, status: patch.status ?? subagent.status, finalAnswer: patch.finalAnswer ?? event.finalAnswer }
                        : event
                    )
                  )
                : session
            )
          };
        }),
      createSession: () => {
        const session = createSession(`Session ${get().sessions.length + 1}`);
        set((state) => ({ sessions: [session, ...state.sessions], activeSessionId: session.id }));
        return session.id;
      },
      setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),
      renameSession: (sessionId, title) =>
        set((state) => ({ sessions: state.sessions.map((session) => (session.id === sessionId ? { ...session, title, updatedAt: now() } : session)) })),
      deleteSession: (sessionId) =>
        set((state) => {
          const remaining = state.sessions.filter((session) => session.id !== sessionId);
          const sessions = remaining.length ? remaining : [createSession('Session 1')];
          return { sessions, activeSessionId: state.activeSessionId === sessionId ? sessions[0].id : state.activeSessionId };
        }),
      setLlm: (settings) => set({ llm: settings })
    }),
    {
      name: 'pure-browser-agent-state',
      storage: createJSONStorage(() => createIndexedDbStorage('pure-browser-agent-db')),
      version: 2,
      partialize: (state) => ({
        files: state.files,
        activePath: state.activePath,
        sessions: state.sessions,
        subagentSessions: state.subagentSessions,
        activeSessionId: state.activeSessionId,
        terminalOutput: state.terminalOutput,
        iframeUrl: state.iframeUrl,
        activeTab: state.activeTab,
        isSidebarCollapsed: state.isSidebarCollapsed,
        sidebarWidth: state.sidebarWidth,
        isSessionSidebarCollapsed: state.isSessionSidebarCollapsed,
        themeMode: state.themeMode,
        llm: state.llm
      }),
      migrate: (persisted) => {
        const state = persisted as Partial<Store> & { messages?: AppMessage[] };
        if (!state.sessions) {
          const session = createSession('Session 1');
          session.messages = state.messages?.length ? state.messages : [welcomeMessage()];
          return { ...state, sessions: [session], activeSessionId: session.id } as Store;
        }
        return state as Store;
      }
    }
  )
);
