# Pure Browser Agent

Pure Browser Agent is a pure-browser React MVP for an agent-centric coding environment powered by WebContainers.

The product focus is simple: a main message list plus a right sidebar for the virtual workspace. Users can see agent messages, tool calls, command results, files, terminal output, preview, and model settings without installing a local daemon or running a backend.

## Features

- React + Vite + TypeScript app shell
- WebContainer boot and virtual filesystem mount
- Automatic WebContainer connection on page load
- Starter Vite/React workspace inside WebContainer
- Main message list for user messages, assistant messages, tool calls, and tool results
- Right sidebar tabs:
  - editor
  - files
  - terminal
  - preview
  - settings
- Monaco editor
- Terminal command runner inside WebContainer
- Preview iframe via WebContainer `server-ready`
- OpenAI-compatible settings: `baseURL / model / API key`
- Automatic local persistence with Zustand persist
- Light, dark, and system theme modes
- Basic command approval for risky command patterns
- Basic agent loop with tools:
  - `list_files`
  - `read_file`
  - `write_file`
  - `run_command`

## Run

```bash
pnpm install
pnpm dev
```

Open the Vite URL in a browser that supports WebContainers.

WebContainers require cross-origin isolation, so `vite.config.ts` sets:

- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Opener-Policy: same-origin`

## Demo flow

1. Open the app. The WebContainer sandbox connects automatically.
2. Open **Settings** and configure an OpenAI-compatible endpoint.
3. Try this prompt:

```text
Turn the starter page into a polished todo app, then run npm install and npm run dev.
```

4. Watch the message list, terminal output, file changes, and preview iframe.

## Notes

This project intentionally does not implement Workflow DAGs yet. The first version focuses on making browser-only agent execution visible, inspectable, and useful.

The LLM key is stored locally in browser storage for demo convenience. Do not deploy this directly as a public multi-user app with user keys.
