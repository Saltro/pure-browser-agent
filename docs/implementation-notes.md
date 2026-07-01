# Implementation Notes

## Current status

Pure Browser Agent is a runnable React MVP focused on Agent Timeline + WebContainer execution.

## Implemented

### App shell

- Vite + React + TypeScript
- Dark workbench UI
- Three-column layout:
  - left: file explorer
  - center: agent timeline, editor, chat, terminal, preview
  - right: context panel

### WebContainer runtime

- WebContainer boot via `@webcontainer/api`
- Starter Vite/React workspace mounted into WebContainer
- File writes create parent directories
- Manual sync for the current file or all files
- Terminal command runner inside WebContainer
- Preview iframe listens to the WebContainer `server-ready` event

### Agent Timeline

- User message events
- Assistant message events
- Tool call events with `running`, `success`, and `error` states
- Tool result events
- Approval request events
- Auto-scroll to the latest event
- Tool result pinning to context

### Agent loop

- OpenAI-compatible Chat Completions
- Page settings for `baseURL`, `model`, and `apiKey`
- Correct OpenAI tool-call protocol:
  - assistant messages include `tool_calls`
  - tool result messages include `tool_call_id`
- Maximum of 8 tool-call steps per turn
- Tools:
  - `list_files`
  - `read_file`
  - `write_file`
  - `run_command`
  - `pin_context`

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
- Settings warning: API keys are stored in browser localStorage and are for local demos only
- Example prompt chips
- Terminal output can be pinned to context
- File and tool-result pinning

### Persistence

- Dexie / IndexedDB workspace save and load
- Saves files and context items

## Verified

```bash
npm install
npm run build
```

Build passes.

Browser smoke test with agent-browser:

- page opens at `http://localhost:5173/`
- UI renders
- WebContainer boots after clicking **Boot WebContainer**
- `node --version` runs inside WebContainer and returns output
- screenshot captured during smoke testing

## Run

```bash
cd /home/byteide/pure-browser-agent
npm run dev
```

Then open:

```text
http://localhost:5173/
```

## Suggested demo flow

1. Click **Boot WebContainer**.
2. Click **Settings** and configure an OpenAI-compatible endpoint.
3. Ask:

```text
Turn the starter page into a polished todo app, then run npm install and npm run dev.
```

4. Watch the timeline and tool calls.
5. Check the preview iframe when the dev server is ready.

## Known limitations

- No Workflow DAG yet.
- No Tavily or web search.
- No streaming LLM tokens yet.
- No zip import/export yet.
- WebContainer support depends on browser and cross-origin isolation support.
- Pure frontend key storage is for local demos, not public multi-user deployments.
