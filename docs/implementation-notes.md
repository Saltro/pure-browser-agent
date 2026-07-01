# Implementation Notes

## Current status

Pure Browser Agent is a runnable React MVP focused on browser-only agent execution inside a WebContainer sandbox.

## Implemented

### App shell

- Vite + React + TypeScript
- Polished responsive workbench UI
- Main conversation area with a message list and composer
- Right sidebar with tabs for editor, files, terminal, preview, and settings
- Light, dark, and system theme modes

### WebContainer runtime

- WebContainer boot via `@webcontainer/api`
- Automatic sandbox connection on page load
- Restored files are mounted into WebContainer
- Starter Vite/React workspace mounted into WebContainer
- File writes create parent directories
- Manual sync for the current file or all files
- Terminal command runner inside WebContainer
- Preview iframe listens to the WebContainer `server-ready` event

### Messages

- User message events
- Assistant message events
- Tool call events with `running`, `success`, and `error` states
- Tool result events
- Approval request events
- Auto-scroll to the latest message

### Agent loop

- OpenAI-compatible Chat Completions
- Sidebar settings for `baseURL`, `model`, and `apiKey`
- Correct OpenAI tool-call protocol:
  - assistant messages include `tool_calls`
  - tool result messages include `tool_call_id`
- Maximum of 8 tool-call steps per turn
- Tools:
  - `list_files`
  - `read_file`
  - `write_file`
  - `run_command`

### Safety and UX

- Command approval for risky command patterns:
  - `rm`
  - `mv`
  - `cp`
  - `chmod`
  - `chown`
  - `curl`
  - `wget`
  - `git`
  - publish commands
- Settings warning: API keys are stored locally in browser storage and are for local demos only
- Example prompt chips

### Persistence

- Zustand persist stores files, messages, terminal output, active tab, theme mode, and model settings
- No manual save/load buttons

## Run

```bash
cd /home/byteide/pure-browser-agent
pnpm dev
```

Then open:

```text
http://localhost:5173/
```

## Suggested demo flow

1. Open the app and wait for the sandbox to connect automatically.
2. Open **Settings** and configure an OpenAI-compatible endpoint.
3. Ask:

```text
Turn the starter page into a polished todo app, then run npm install and npm run dev.
```

4. Watch messages and tool calls.
5. Check the preview iframe when the dev server is ready.

## Known limitations

- No Workflow DAG yet.
- No Tavily or web search.
- No streaming LLM tokens yet.
- No zip import/export yet.
- WebContainer support depends on browser and cross-origin isolation support.
- Pure frontend key storage is for local demos, not public multi-user deployments.
