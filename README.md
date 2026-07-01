# Pure Browser Agent

Pure Browser Agent is a pure-browser React MVP for an agent-centric coding environment powered by WebContainers.

The product focus is **Agent Timeline first, IDE second**: users can see every agent message, tool call, command result, and pinned context item while the agent edits and runs code inside a browser sandbox.

## Features

- React + Vite + TypeScript app shell
- WebContainer boot and virtual filesystem mount
- Starter Vite/React workspace inside WebContainer
- File explorer
- Monaco editor
- Agent Timeline
- Context panel with pinning
- Terminal command runner inside WebContainer
- Preview iframe via WebContainer `server-ready`
- OpenAI-compatible settings page: `baseURL / model / API key`
- IndexedDB workspace save/load via Dexie
- Basic command approval for risky command patterns
- Basic agent loop with tools:
  - `list_files`
  - `read_file`
  - `write_file`
  - `run_command`
  - `pin_context`

## Run

```bash
npm install
npm run dev
```

Open the Vite URL in a browser that supports WebContainers.

WebContainers require cross-origin isolation, so `vite.config.ts` sets:

- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Opener-Policy: same-origin`

## Demo flow

1. Click **Boot WebContainer**.
2. Open **Settings** and configure an OpenAI-compatible endpoint.
3. Try this prompt:

```text
Turn the starter page into a polished todo app, then run npm install and npm run dev.
```

4. Watch the Agent Timeline, terminal output, file changes, context panel, and preview iframe.

## Notes

This project intentionally does not implement Workflow DAGs yet. The first version focuses on making the agent execution timeline visible, inspectable, and useful.

The LLM key is stored in browser localStorage for local demo convenience. Do not deploy this directly as a public multi-user app with user keys.
