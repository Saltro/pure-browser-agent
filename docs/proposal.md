# Pure Browser Agent Proposal

## 0. One-line positioning

Pure Browser Agent is a **pure-browser Agent Timeline workbench**. Users coordinate context in a visual browser UI while an agent edits files, runs commands, and starts development servers inside a WebContainer-powered virtual Node.js environment.

It does not control the host machine shell directly. Instead, it provides a safe, resettable, inspectable browser sandbox that feels like a local development environment.

---

## 1. Why WebContainers

Compared with Electron, Tauri, or a local daemon, WebContainers provide a useful middle ground:

| Approach | Capability | Limitation | Fit |
|---|---|---|---|
| Plain web app | Safe, zero install, easy to share | Cannot run a real host shell | High |
| WebContainers | Run Node.js, npm, and dev servers in the browser | Sandbox only, not the host machine | Very high |
| Local daemon | Can control the real machine | Requires installation and a stronger security model | Later |
| Electron / Tauri | Strong local capabilities | Requires desktop distribution | Later |

The first version should validate the core experience: **frontend context orchestration + virtual shell + observable agent loop** without taking on host-machine permissions.

---

## 2. Product goals

### 2.1 What users can do

Users should be able to open the app and:

1. Create or load a WebContainer workspace.
2. Browse files, edit code, and run terminal commands in the browser.
3. Chat with an agent that can operate inside the WebContainer:
   - list files
   - read files
   - write files
   - install npm packages
   - run tests
   - start a dev server
   - analyze terminal output
4. Pin explicit context: files, command output, error logs, and notes.
5. Inspect every agent tool call in an Agent Timeline.
6. Configure an OpenAI-compatible LLM endpoint and API key in the page.

### 2.2 Non-goals for the MVP

The MVP will not include:

- Direct host filesystem access.
- Direct host shell execution.
- Desktop application control.
- Multi-user collaboration.
- Full IDE parity.
- Workflow DAG execution.
- Web search or Tavily integration.

---

## 3. Architecture

```text
Browser App / React
  ├─ Chat UI
  ├─ Context Panel
  ├─ Agent Timeline
  ├─ File Explorer
  ├─ Monaco Editor
  ├─ Terminal UI
  └─ Preview iframe

WebContainer Runtime
  ├─ Virtual FS
  ├─ Node.js process
  ├─ npm install
  ├─ shell command execution
  └─ dev server preview

Agent Orchestrator, browser-side
  ├─ prompt builder
  ├─ context selector
  ├─ tool registry
  ├─ tool call executor
  └─ observation summarizer

LLM Provider
  └─ OpenAI-compatible API, configured in browser settings
```

The MVP runs entirely in the browser and does not include a backend proxy. The user configures `baseURL`, `model`, and `apiKey` in the settings panel. Settings are stored locally in the browser.

---

## 4. Core module design

### 4.1 Workspace

A workspace is the top-level state container:

```ts
type Workspace = {
  id: string;
  name: string;
  files: FileNode[];
  pinnedContext: ContextItem[];
  sessions: AgentSession[];
  terminalHistory: TerminalRecord[];
};
```

MVP persistence uses IndexedDB via Dexie.

Future extensions may support:

- zip import
- zip export
- GitHub repository initialization
- shareable snapshots

### 4.2 Context Panel

Context is not an invisible concatenated prompt. It is a visible list of context items the user can inspect and manage:

```ts
type ContextItem =
  | { type: 'file'; path: string; content: string; pinned: boolean }
  | { type: 'terminal'; command: string; output: string; pinned: boolean }
  | { type: 'error'; source: string; message: string; stack?: string; pinned: boolean }
  | { type: 'note'; title: string; content: string; pinned: boolean };
```

The UI should separate:

- current goal
- pinned context
- automatically relevant context
- recent tool observations
- disposable history

### 4.3 Tool Registry

The agent does not manipulate UI components directly. It calls tools that operate on the workspace and WebContainer runtime:

```ts
type ToolDefinition<Input, Output> = {
  name: string;
  description: string;
  inputSchema: unknown;
  execute(input: Input, ctx: ToolContext): Promise<Output>;
};
```

MVP tools:

| Tool | Description |
|---|---|
| `list_files` | List workspace files |
| `read_file` | Read a file |
| `write_file` | Write a file |
| `run_command` | Execute a command in the WebContainer shell |
| `pin_context` | Add useful content to the context panel |

Possible later tools:

| Tool | Description |
|---|---|
| `delete_file` | Delete a file with confirmation |
| `install_package` | Higher-level npm install wrapper |
| `start_dev_server` | Start a dev server and return the preview URL |
| `search_in_files` | Search the workspace |

### 4.4 Terminal

The terminal is not the host terminal. It runs commands inside the WebContainer sandbox:

```text
npm install
npm run dev
npm test
node scripts/foo.js
```

Implementation details:

- Every command creates a terminal record.
- Output streams into the UI.
- Command completion creates an observation.
- Non-zero exit codes are highlighted and can be pinned.

### 4.5 Agent Timeline

The UI is centered on the Agent Timeline rather than a traditional IDE.

Each timeline item is an expandable event:

```ts
type TimelineEvent =
  | { type: 'user_message'; content: string; createdAt: number }
  | { type: 'assistant_message'; content: string; createdAt: number }
  | { type: 'tool_call'; toolName: string; input: unknown; status: 'pending' | 'running' | 'success' | 'error'; createdAt: number }
  | { type: 'tool_result'; toolName: string; output: unknown; createdAt: number }
  | { type: 'approval_request'; reason: string; command?: string; createdAt: number };
```

The timeline should make it clear:

- what the agent is doing now
- what each tool call received as input
- what each tool call returned
- which actions require approval
- which observations can be pinned to context
- where a failed run can be resumed

### 4.6 Agent Loop

The MVP uses a simple tool-calling loop:

```text
user message
  ↓
build prompt with pinned context + workspace summary
  ↓
LLM returns assistant message or tool call
  ↓
execute tool
  ↓
append observation
  ↓
continue until final answer
```

Pseudo-code:

```ts
async function runAgentTurn(input: string) {
  const messages = buildMessages(input, workspace, contextPanel);

  for (let i = 0; i < maxSteps; i++) {
    const response = await llm.chat({ messages, tools });

    if (response.type === 'final') {
      return response.message;
    }

    if (response.type === 'tool_call') {
      const result = await executeTool(response.toolCall);
      timeline.add(response.toolCall, result);
      messages.push(toObservationMessage(result));
    }
  }

  return 'Reached the maximum number of steps. Please confirm whether to continue.';
}
```

---

## 5. UI sketch

```text
┌────────────────────────────────────────────────────────────────────┐
│ Header: Pure Browser Agent                                      │
├───────────────┬───────────────────────────────┬────────────────────┤
│ File Explorer │ Agent Timeline / Chat / Plan   │ Context Panel      │
│               │                               │                    │
│ package.json  │ User: fix the failing test     │ Goal               │
│ src/App.tsx   │                               │ - fix test failure │
│ src/main.tsx  │ Agent: running npm test        │                    │
│               │                               │ Pinned             │
│               │ Tool: run_command npm test    │ - src/App.tsx      │
│               │ Output: failed ...            │ - test output      │
│               │                               │                    │
├───────────────┴───────────────────────────────┴────────────────────┤
│ Terminal + Preview                                                 │
└────────────────────────────────────────────────────────────────────┘
```

The MVP should stay lightweight. A custom CSS layout is enough for the prototype.

---

## 6. Tech stack

### Frontend

- Vite
- React
- TypeScript
- CSS
- Zustand for state
- IndexedDB / Dexie for workspace persistence
- Monaco Editor for code editing
- WebContainer API for the runtime
- Lucide React for icons

### Agent

- OpenAI-compatible Chat Completions
- Page settings for `baseURL`, `model`, and `apiKey`
- JSON-schema tool calling

### Tests

- TypeScript build check
- Browser smoke tests
- Playwright or agent-browser later

---

## 7. MVP milestones

### Milestone 1: WebContainer foundation

Goal: the page boots a WebContainer and loads a starter Vite project.

Deliverables:

- React app shell
- WebContainer boot
- initial file tree
- read/write files
- run `npm install`
- run `npm run dev`
- preview iframe

### Milestone 2: Terminal and editing

Goal: users can edit and run code like a small browser IDE.

Deliverables:

- file explorer
- Monaco editor
- terminal output view
- command runner
- terminal output records

### Milestone 3: Agent tool loop

Goal: the agent can read/write files and run commands through tools.

Deliverables:

- tool registry
- LLM settings
- chat panel
- `list_files`, `read_file`, `write_file`, `run_command`, `pin_context`
- tool timeline
- max step limit

### Milestone 4: Context orchestration

Goal: move from chat bot to visible context workbench.

Deliverables:

- Context Panel
- pin/unpin files and terminal output
- workspace summary
- prompt builder
- observation summarizer

### Milestone 5: Timeline polish

Goal: make the Agent Timeline pleasant to use.

Deliverables:

- risky tool-call confirmation
- timeline event collapse/expand
- pin timeline events to context
- resume from failed events
- example task templates:
  - create a React component
  - fix a test
  - add an npm package
  - explain and fix an error

---

## 8. Risks and limitations

### 8.1 WebContainer limitations

- Requires a supported browser environment.
- The filesystem is virtual, not the host filesystem.
- Process, network, and system-call capabilities are sandboxed.
- Package compatibility is not identical to a real Linux machine.
- Large projects may be slow.

### 8.2 LLM key security

Pure frontend LLM calls can expose API keys if deployed carelessly.

For the MVP, local user-provided keys are acceptable with a clear warning. The first version does not include a backend proxy. The app should state that browser-stored keys are for personal local demos, not public multi-user deployments.

### 8.3 Agent safety

Even inside a WebContainer, some actions should require confirmation:

- deleting many files
- rewriting important configuration
- installing unknown packages
- making network requests
- running long commands

The MVP should provide command preview plus allow/deny confirmation for risky commands.

---

## 9. Project structure

```text
pure-browser-agent/
  package.json
  index.html
  vite.config.ts
  tsconfig.json
  src/
    main.tsx
    App.tsx
    styles.css
    components/
      ChatBox.tsx
      ContextPanel.tsx
      EditorPane.tsx
      FileExplorer.tsx
      Header.tsx
      PreviewPane.tsx
      SettingsDialog.tsx
      TerminalPane.tsx
      Timeline.tsx
      WorkspaceActions.tsx
    lib/
      agent.ts
      llm.ts
      storage.ts
      webcontainer.ts
    stores/
      workbenchStore.ts
    types/
      workbench.ts
  docs/
    proposal.md
    implementation-notes.md
```

---

## 10. First demo scenario

The user opens the page and selects this example task:

> Create a Todo App and run it.

The agent should:

1. call `write_file` for the app code
2. call `write_file` for styles
3. call `run_command` for `npm install`
4. call `run_command` for `npm run dev`
5. return the preview URL
6. pin key files and command output to context

The user should see:

- files created or edited in the left panel
- the timeline of agent actions in the center
- live terminal output at the bottom
- context items on the right
- the running app in the preview iframe

---

## 11. Confirmed product choices

1. First version is a **pure browser demo** with no backend proxy.
2. LLM integration uses an **OpenAI-compatible API**, configured in the page.
3. UI is centered on **Agent Timeline**. IDE features support the timeline rather than dominate it.
4. First version does **not** include Tavily or web search.
5. Workflow DAGs are deferred to a later phase.
