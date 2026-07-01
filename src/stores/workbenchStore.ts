import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppMessage, FileNode, LlmSettings, ThemeMode } from '../types/workbench';

const now = () => Date.now();
const id = () => crypto.randomUUID();

const starterFiles: FileNode[] = [
  {
    path: 'package.json',
    content: JSON.stringify(
      {
        scripts: { dev: 'vite --host 0.0.0.0', build: 'vite build' },
        dependencies: { '@vitejs/plugin-react': 'latest', vite: 'latest', react: 'latest', 'react-dom': 'latest' },
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

type MessageDraft =
  | Omit<Extract<AppMessage, { type: 'user_message' }>, 'id' | 'createdAt'>
  | Omit<Extract<AppMessage, { type: 'assistant_message' }>, 'id' | 'createdAt'>
  | Omit<Extract<AppMessage, { type: 'tool_call' }>, 'id' | 'createdAt'>
  | Omit<Extract<AppMessage, { type: 'tool_result' }>, 'id' | 'createdAt'>
  | Omit<Extract<AppMessage, { type: 'approval_request' }>, 'id' | 'createdAt'>;

type Store = {
  files: FileNode[];
  activePath: string;
  messages: AppMessage[];
  terminalOutput: string;
  previewUrl: string;
  isBooted: boolean;
  isBooting: boolean;
  isAgentRunning: boolean;
  activeTab: 'files' | 'editor' | 'terminal' | 'preview' | 'settings';
  isSidebarCollapsed: boolean;
  themeMode: ThemeMode;
  llm: LlmSettings;
  setBooted: (value: boolean) => void;
  setBooting: (value: boolean) => void;
  setAgentRunning: (value: boolean) => void;
  setPreviewUrl: (url: string) => void;
  setActiveTab: (tab: Store['activeTab']) => void;
  setSidebarCollapsed: (value: boolean) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setActivePath: (path: string) => void;
  upsertFile: (path: string, content: string) => void;
  deleteFile: (path: string) => void;
  resetWorkspace: () => void;
  appendTerminal: (chunk: string) => void;
  clearTerminal: () => void;
  addMessage: (event: MessageDraft) => string;
  updateToolStatus: (eventId: string, status: 'pending' | 'running' | 'success' | 'error') => void;
  setLlm: (settings: LlmSettings) => void;
};

export const useWorkbenchStore = create<Store>()(
  persist(
    (set) => ({
      files: starterFiles,
      activePath: 'src/main.jsx',
      messages: [
        {
          id: id(),
          type: 'assistant_message',
          content: 'Welcome to Pure Browser Agent. Ask me to inspect, edit, or run the sandbox project.',
          createdAt: now()
        }
      ],
      terminalOutput: '',
      previewUrl: '',
      isBooted: false,
      isBooting: false,
      isAgentRunning: false,
      activeTab: 'editor',
      isSidebarCollapsed: false,
      themeMode: 'system',
      llm: {
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        apiKey: ''
      },
      setBooted: (value) => set({ isBooted: value }),
      setBooting: (value) => set({ isBooting: value }),
      setAgentRunning: (value) => set({ isAgentRunning: value }),
      setPreviewUrl: (url) => set({ previewUrl: url }),
      setActiveTab: (tab) => set({ activeTab: tab, isSidebarCollapsed: false }),
      setSidebarCollapsed: (value) => set({ isSidebarCollapsed: value }),
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
      resetWorkspace: () => set({ files: starterFiles, activePath: 'src/main.jsx', terminalOutput: '', previewUrl: '' }),
      appendTerminal: (chunk) => set((state) => ({ terminalOutput: state.terminalOutput + chunk })),
      clearTerminal: () => set({ terminalOutput: '' }),
      addMessage: (event) => {
        const eventId = id();
        set((state) => ({ messages: [...state.messages, { ...event, id: eventId, createdAt: now() } as AppMessage] }));
        return eventId;
      },
      updateToolStatus: (eventId, status) =>
        set((state) => ({
          messages: state.messages.map((event) => (event.id === eventId && event.type === 'tool_call' ? { ...event, status } : event))
        })),
      setLlm: (settings) => set({ llm: settings })
    }),
    {
      name: 'pure-browser-agent-state',
      partialize: (state) => ({
        files: state.files,
        activePath: state.activePath,
        messages: state.messages,
        terminalOutput: state.terminalOutput,
        activeTab: state.activeTab,
        isSidebarCollapsed: state.isSidebarCollapsed,
        themeMode: state.themeMode,
        llm: state.llm
      })
    }
  )
);
