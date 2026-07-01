import { create } from 'zustand';
import type { ContextItem, FileNode, LlmSettings, TimelineEvent } from '../types/workbench';

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
    content: "import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport './style.css';\n\nfunction App() {\n  return <main><h1>Hello WebContainer Agent</h1><p>Edit me with the agent.</p></main>;\n}\n\ncreateRoot(document.getElementById('root')).render(<App />);\n"
  },
  {
    path: 'src/style.css',
    content: 'body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #111827; color: white; } main { padding: 48px; }'
  }
];

type TimelineDraft =
  | Omit<Extract<TimelineEvent, { type: 'user_message' }>, 'id' | 'createdAt'>
  | Omit<Extract<TimelineEvent, { type: 'assistant_message' }>, 'id' | 'createdAt'>
  | Omit<Extract<TimelineEvent, { type: 'tool_call' }>, 'id' | 'createdAt'>
  | Omit<Extract<TimelineEvent, { type: 'tool_result' }>, 'id' | 'createdAt'>
  | Omit<Extract<TimelineEvent, { type: 'approval_request' }>, 'id' | 'createdAt'>;

type Store = {
  files: FileNode[];
  activePath: string;
  contextItems: ContextItem[];
  timeline: TimelineEvent[];
  terminalOutput: string;
  previewUrl: string;
  isBooted: boolean;
  isAgentRunning: boolean;
  llm: LlmSettings;
  setBooted: (value: boolean) => void;
  setAgentRunning: (value: boolean) => void;
  setPreviewUrl: (url: string) => void;
  setActivePath: (path: string) => void;
  upsertFile: (path: string, content: string) => void;
  deleteFile: (path: string) => void;
  resetWorkspace: () => void;
  loadSnapshot: (snapshot: { files: FileNode[]; contextItems: ContextItem[] }) => void;
  appendTerminal: (chunk: string) => void;
  clearTerminal: () => void;
  addContext: (item: Omit<ContextItem, 'id' | 'createdAt'>) => void;
  removeContext: (contextId: string) => void;
  addTimeline: (event: TimelineDraft) => string;
  updateToolStatus: (eventId: string, status: 'pending' | 'running' | 'success' | 'error') => void;
  setLlm: (settings: LlmSettings) => void;
};

export const useWorkbenchStore = create<Store>((set) => ({
  files: starterFiles,
  activePath: 'src/main.jsx',
  contextItems: [],
  timeline: [
    { id: id(), type: 'assistant_message', content: 'Workspace ready. Boot WebContainer, then ask me to edit or run the demo app.', createdAt: now() }
  ],
  terminalOutput: '',
  previewUrl: '',
  isBooted: false,
  isAgentRunning: false,
  llm: {
    baseUrl: localStorage.getItem('llm.baseUrl') || 'https://api.openai.com/v1',
    model: localStorage.getItem('llm.model') || 'gpt-4o-mini',
    apiKey: localStorage.getItem('llm.apiKey') || ''
  },
  setBooted: (value) => set({ isBooted: value }),
  setAgentRunning: (value) => set({ isAgentRunning: value }),
  setPreviewUrl: (url) => set({ previewUrl: url }),
  setActivePath: (path) => set({ activePath: path }),
  upsertFile: (path, content) =>
    set((state) => {
      const exists = state.files.some((file) => file.path === path);
      return { files: exists ? state.files.map((file) => (file.path === path ? { path, content } : file)) : [...state.files, { path, content }] };
    }),
  deleteFile: (path) => set((state) => ({ files: state.files.filter((file) => file.path !== path), activePath: state.activePath === path ? state.files[0]?.path || '' : state.activePath })),
  resetWorkspace: () => set({ files: starterFiles, activePath: 'src/main.jsx', contextItems: [], terminalOutput: '', previewUrl: '' }),
  loadSnapshot: (snapshot) => set({ files: snapshot.files, contextItems: snapshot.contextItems, activePath: snapshot.files[0]?.path || '', terminalOutput: '', previewUrl: '' }),
  appendTerminal: (chunk) => set((state) => ({ terminalOutput: state.terminalOutput + chunk })),
  clearTerminal: () => set({ terminalOutput: '' }),
  addContext: (item) => set((state) => ({ contextItems: [{ ...item, id: id(), createdAt: now() }, ...state.contextItems] })),
  removeContext: (contextId) => set((state) => ({ contextItems: state.contextItems.filter((item) => item.id !== contextId) })),
  addTimeline: (event) => {
    const eventId = id();
    set((state) => ({ timeline: [...state.timeline, { ...event, id: eventId, createdAt: now() } as TimelineEvent] }));
    return eventId;
  },
  updateToolStatus: (eventId, status) =>
    set((state) => ({
      timeline: state.timeline.map((event) => (event.id === eventId && event.type === 'tool_call' ? { ...event, status } : event))
    })),
  setLlm: (settings) => {
    localStorage.setItem('llm.baseUrl', settings.baseUrl);
    localStorage.setItem('llm.model', settings.model);
    localStorage.setItem('llm.apiKey', settings.apiKey);
    set({ llm: settings });
  }
}));
