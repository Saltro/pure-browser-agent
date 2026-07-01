# Pure Browser Agent Proposal

## One-line positioning

Pure Browser Agent is a browser-only agent workbench. It lets an agent read files, edit code, run commands, and preview an app entirely inside a WebContainer sandbox.

## Product choices

- Pure browser demo, no backend proxy.
- OpenAI-compatible API configured in the page.
- Main UI is a message list, not a named timeline.
- Workspace utilities live in a right sidebar with tabs.
- No pinning system.
- No manual save/load buttons.
- Local state is persisted automatically with Zustand persist.
- WebContainer connects automatically on page load and mounts restored files.
- Workflow DAGs are deferred.
- Tavily and web search are not included in the first version.

## Layout

```text
┌────────────────────────────────────────────────────────────────────┐
│ Pure Browser Agent                         theme + sandbox status  │
├──────────────────────────────────────────────┬─────────────────────┤
│                                              │ Tabs                │
│ Message list                                 │ Editor              │
│ - user messages                              │ Files               │
│ - assistant messages                         │ Terminal            │
│ - tool calls                                 │ Preview             │
│ - tool results                               │ Settings            │
│                                              │                     │
│ Composer                                     │ Active tab content  │
└──────────────────────────────────────────────┴─────────────────────┘
```

## Core tools

| Tool | Description |
|---|---|
| `list_files` | List files in the virtual workspace |
| `read_file` | Read a workspace file |
| `write_file` | Write a workspace file and sync it into WebContainer |
| `run_command` | Run a command in the WebContainer shell |

## Persistence

The following state is stored locally and restored automatically:

- virtual workspace files
- message history
- terminal output
- active sidebar tab
- theme mode
- OpenAI-compatible model settings

## Safety

Risky commands require confirmation before running in the sandbox. Examples include destructive file commands, network download commands, git commands, and publish commands.

## Future work

- Streaming model responses
- Better command lifecycle controls
- Zip import/export
- GitHub import
- More polished demo templates
- Optional Workflow DAGs after the message-list experience feels good
