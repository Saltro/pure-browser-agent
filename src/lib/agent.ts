import { streamOpenAICompatible, type ChatMessage } from './llm';
import { readContainerFile, runContainerCommand, syncFilesToContainer, writeContainerFile } from './webcontainer';
import { useWorkbenchStore } from '../stores/workbenchStore';
import type { AppMessage, ToolCall } from '../types/workbench';

const baseSystemPrompt = `You are an agent running inside Pure Browser Agent, a browser-only WebContainer workbench.
You can inspect and edit files and run commands only inside the WebContainer virtual environment.
You can also use iframe_open to open a URL in the embedded preview iframe when the user asks to inspect or navigate a browser page.
Prefer small steps. Use tools when you need workspace state.
When you change code, use write_file. When you need to verify, use run_command.
Final answers should be concise and include what changed and how it was verified.`

let activeAbortController: AbortController | null = null

let pendingTurnState: {
  messages: ChatMessage[]
  step: number
  toolCall: ToolCall
  eventId: string
} | null = null

export function interruptAgentTurn() {
  activeAbortController?.abort()
}

function shouldConfirmCommand(command: string) {
  return /(^|\s)(rm|mv|cp|chmod|chown|curl|wget|git|npm\s+publish|pnpm\s+publish|yarn\s+npm\s+publish)\b/.test(command)
}

function truncateOutput(text: string, maxChars = 4000): string {
  if (text.length <= maxChars) return text
  const head = Math.floor(maxChars * 0.6)
  const tail = maxChars - head - 60
  return `${text.slice(0, head)}\n\n... (${text.length - head - tail} chars truncated) ...\n\n${text.slice(-tail)}`
}

function buildSystemPrompt(filePaths: string[]): string {
  return `${baseSystemPrompt}\n\nCurrent workspace files:\n${filePaths.map((p) => `- ${p}`).join('\n')}`
}

const INTERNAL_TOOLS = new Set(['boot_webcontainer', 'server-ready', 'sync_file', 'sync_workspace'])

function buildMessagesFromHistory(messages: AppMessage[], newUserInput: string, filePaths: string[]): ChatMessage[] {
  const result: ChatMessage[] = [{ role: 'system', content: buildSystemPrompt(filePaths) }]

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]

    if (msg.type === 'user_message') {
      result.push({ role: 'user', content: msg.content })
      continue
    }

    if (msg.type === 'assistant_message' && !msg.streaming) {
      const toolCalls: { id: string; type: 'function'; function: { name: string; arguments: string } }[] = []
      let j = i + 1
      while (j < messages.length) {
        const next = messages[j]
        if (next.type !== 'tool_call') break
        if (!INTERNAL_TOOLS.has(next.toolName)) {
          toolCalls.push({ id: next.toolCallId, type: 'function', function: { name: next.toolName, arguments: JSON.stringify(next.input) } })
        }
        j++
      }

      if (toolCalls.length > 0) {
        result.push({ role: 'assistant', content: msg.content || null, tool_calls: toolCalls })
        for (const tc of toolCalls) {
          const resultMsg = messages.find((m) => m.type === 'tool_result' && m.toolCallId === tc.id)
          if (resultMsg?.type === 'tool_result') {
            result.push({ role: 'tool', tool_call_id: tc.id, content: truncateOutput(JSON.stringify(resultMsg.output), 6000) })
          }
        }
        i = j - 1
      } else {
        result.push({ role: 'assistant', content: msg.content })
      }
      continue
    }
  }

  result.push({ role: 'user', content: newUserInput })
  return result
}

async function executeTool(call: ToolCall, signal: AbortSignal) {
  const store = useWorkbenchStore.getState()
  switch (call.name) {
    case 'list_files':
      return store.files.map((file) => file.path)
    case 'read_file': {
      const path = String(call.arguments.path || '')
      const local = store.files.find((file) => file.path === path)
      return { path, content: local?.content ?? (await readContainerFile(path)) }
    }
    case 'write_file': {
      const path = String(call.arguments.path || '')
      const content = String(call.arguments.content || '')
      await writeContainerFile(path, content)
      store.upsertFile(path, content)
      store.setActivePath(path)
      store.setActiveTab('workspace')
      return { path, bytes: content.length }
    }
    case 'run_command': {
      const command = String(call.arguments.command || '')
      await syncFilesToContainer(useWorkbenchStore.getState().files)
      store.setActiveTab('terminal')
      store.appendTerminal(`\n$ ${command}\n`)
      let output = ''
      const exitCode = await runContainerCommand(
        command,
        (chunk) => {
          output += chunk
          store.appendTerminal(chunk)
        },
        signal
      )
      return { command, exitCode, output: truncateOutput(output) }
    }
    case 'iframe_open': {
      const url = String(call.arguments.url || '')
      if (!url) throw new Error('iframe_open requires a url')
      store.setIframeUrl(url)
      store.setActiveTab('preview')
      return { url, opened: true }
    }
    default:
      throw new Error(`Unknown tool: ${call.name}`)
  }
}

async function runAgentSteps(messages: ChatMessage[], startStep: number, signal: AbortSignal): Promise<string> {
  const store = useWorkbenchStore.getState()
  for (let step = startStep; step < 8; step++) {
    signal.throwIfAborted()
    const assistantMessageId = store.addMessage({ type: 'assistant_message', content: '', streaming: true })
    const response = await streamOpenAICompatible(useWorkbenchStore.getState().llm, messages, {
      signal,
      onToken: (token) => store.appendAssistantMessage(assistantMessageId, token)
    })
    store.updateMessage(assistantMessageId, { streaming: false })

    if (!response.toolCalls.length) {
      if (!response.content) store.updateMessage(assistantMessageId, { content: 'Done.' })
      return response.content || 'Done.'
    }

    if (!response.content) store.updateMessage(assistantMessageId, { content: `Calling ${response.toolCalls.map((c) => c.name).join(', ')}...` })
    messages.push(response.assistantMessage)

    for (const toolCall of response.toolCalls) {
      signal.throwIfAborted()

      if (toolCall.name === 'run_command' && shouldConfirmCommand(String(toolCall.arguments.command || ''))) {
        const command = String(toolCall.arguments.command || '')
        const eventId = store.addMessage({ type: 'tool_call', toolCallId: toolCall.id, toolName: toolCall.name, input: toolCall.arguments, status: 'running' })
        store.addMessage({ type: 'approval_request', reason: 'Command requires approval before running in WebContainer.', command })
        store.setPendingApproval({ command, toolCallId: toolCall.id })
        pendingTurnState = { messages, step, toolCall, eventId }
        store.setAgentRunning(false)
        const err = new Error('APPROVAL_REQUIRED')
        err.name = 'ApprovalRequired'
        throw err
      }

      const eventId = store.addMessage({ type: 'tool_call', toolCallId: toolCall.id, toolName: toolCall.name, input: toolCall.arguments, status: 'running' })
      try {
        const result = await executeTool(toolCall, signal)
        store.updateToolStatus(eventId, 'success')
        store.addMessage({ type: 'tool_result', toolCallId: toolCall.id, toolName: toolCall.name, output: result })
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: truncateOutput(JSON.stringify(result), 6000) })
      } catch (error) {
        store.updateToolStatus(eventId, 'error')
        const message = error instanceof Error ? error.message : String(error)
        store.addMessage({ type: 'tool_result', toolCallId: toolCall.id, toolName: toolCall.name, output: { error: message } })
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ error: message }) })
        if (error instanceof DOMException && error.name === 'AbortError') throw error
      }
    }
  }
  const final = 'Reached max agent steps. Please continue if you want me to keep going.'
  store.addMessage({ type: 'assistant_message', content: final })
  return final
}

export async function runAgentTurn(userInput: string) {
  interruptAgentTurn()
  const abortController = new AbortController()
  activeAbortController = abortController
  const signal = abortController.signal
  const store = useWorkbenchStore.getState()
  store.setAgentRunning(true)
  pendingTurnState = null
  store.setPendingApproval(null)

  const session = store.getActiveSession()
  const filePaths = store.files.map((file) => file.path)
  const messages = buildMessagesFromHistory(session.messages, userInput, filePaths)

  store.addMessage({ type: 'user_message', content: userInput })

  try {
    return await runAgentSteps(messages, 0, signal)
  } catch (error) {
    if (error instanceof Error && error.name === 'ApprovalRequired') {
      return 'Awaiting approval...'
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      store.addMessage({ type: 'assistant_message', content: 'Interrupted.' })
      return 'Interrupted.'
    }
    throw error
  } finally {
    if (!pendingTurnState && activeAbortController === abortController) {
      activeAbortController = null
    }
  }
}

export async function approveAndContinue() {
  if (!pendingTurnState) return
  const { messages, step, toolCall, eventId } = pendingTurnState
  const store = useWorkbenchStore.getState()
  store.setPendingApproval(null)
  store.setAgentRunning(true)

  const abortController = new AbortController()
  activeAbortController = abortController
  const signal = abortController.signal

  try {
    const result = await executeTool(toolCall, signal)
    store.updateToolStatus(eventId, 'success')
    store.addMessage({ type: 'tool_result', toolCallId: toolCall.id, toolName: toolCall.name, output: result })
    messages.push({ role: 'tool', tool_call_id: toolCall.id, content: truncateOutput(JSON.stringify(result), 6000) })
    pendingTurnState = null
    await runAgentSteps(messages, step, signal)
  } catch (error) {
    if (error instanceof Error && error.name === 'ApprovalRequired') return
    if (error instanceof DOMException && error.name === 'AbortError') {
      store.addMessage({ type: 'assistant_message', content: 'Interrupted.' })
    } else {
      store.addMessage({ type: 'assistant_message', content: error instanceof Error ? error.message : String(error) })
    }
    pendingTurnState = null
  } finally {
    store.setAgentRunning(false)
    if (activeAbortController === abortController) activeAbortController = null
  }
}

export async function denyAndContinue() {
  if (!pendingTurnState) return
  const { messages, step, toolCall, eventId } = pendingTurnState
  const store = useWorkbenchStore.getState()
  store.setPendingApproval(null)
  store.setAgentRunning(true)

  const abortController = new AbortController()
  activeAbortController = abortController
  const signal = abortController.signal

  store.updateToolStatus(eventId, 'error')
  const result = { command: String(toolCall.arguments.command || ''), skipped: true, reason: 'User denied command approval.' }
  store.addMessage({ type: 'tool_result', toolCallId: toolCall.id, toolName: toolCall.name, output: result })
  messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) })
  pendingTurnState = null

  try {
    await runAgentSteps(messages, step, signal)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      store.addMessage({ type: 'assistant_message', content: 'Interrupted.' })
    }
  } finally {
    store.setAgentRunning(false)
    if (activeAbortController === abortController) activeAbortController = null
  }
}
