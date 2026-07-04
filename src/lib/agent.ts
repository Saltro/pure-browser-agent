import { streamOpenAICompatible, type ChatMessage } from './llm';
import { readContainerFile, runContainerCommand, syncFilesToContainer, writeContainerFile } from './webcontainer';
import { useWorkbenchStore } from '../stores/workbenchStore';
import type { AgentQuestion, AgentQuestionAnswer, AppMessage, SubagentSession, ToolCall } from '../types/workbench';

const baseSystemPrompt = `You are an agent running inside Pure Browser Agent, a browser-only WebContainer workbench.
You can inspect and edit files and run commands only inside the WebContainer virtual environment.
You can also use iframe_open to open a URL in the embedded preview iframe when the user asks to inspect or navigate a browser page.
Prefer small steps. Use tools when you need workspace state.
When you change code, use write_file. When you need to verify, use run_command.
Final answers should be concise and include what changed and how it was verified.`

let activeAbortController: AbortController | null = null

type AgentKind = 'main' | 'subagent'

let pendingTurnState: {
  kind: AgentKind
  sessionId: string
  parentSessionId?: string
  allowedTools?: string[]
  messages: ChatMessage[]
  step: number
  toolCall: ToolCall
  eventId: string
  pendingType: 'approval' | 'question'
} | null = null

const DEFAULT_TOOLS = ['list_files', 'read_file', 'write_file', 'run_command', 'iframe_open', 'ask_question', 'subagent_call']
const SUBAGENT_DEFAULT_TOOLS = DEFAULT_TOOLS.filter((tool) => tool !== 'subagent_call')

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

function buildSystemPrompt(filePaths: string[], kind: AgentKind): string {
  const subagentNote =
    kind === 'subagent'
      ? '\n\nYou are running as a subagent. Work independently on the delegated prompt. The workspace filesystem is shared with the main agent. Return a concise final answer for the main agent.'
      : ''
  return `${baseSystemPrompt}${subagentNote}\n\nCurrent workspace files:\n${filePaths.map((p) => `- ${p}`).join('\n')}`
}

const INTERNAL_TOOLS = new Set(['boot_webcontainer', 'server-ready', 'sync_file', 'sync_workspace'])

function buildMessagesFromHistory(messages: AppMessage[], newUserInput: string, filePaths: string[], kind: AgentKind): ChatMessage[] {
  const result: ChatMessage[] = [{ role: 'system', content: buildSystemPrompt(filePaths, kind) }]

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

function normalizeQuestions(raw: unknown): AgentQuestion[] {
  const questions = Array.isArray(raw) ? raw : []
  return questions.slice(0, 5).map((question, index) => {
    const record = question && typeof question === 'object' ? (question as Record<string, unknown>) : {}
    const kind = record.kind === 'multiple' || record.kind === 'text' ? record.kind : 'single'
    const options = Array.isArray(record.options)
      ? record.options.slice(0, 8).map((option, optionIndex) => {
          const item = option && typeof option === 'object' ? (option as Record<string, unknown>) : {}
          return {
            id: String(item.id || `option-${optionIndex + 1}`),
            label: String(item.label || `Option ${optionIndex + 1}`),
            description: item.description ? String(item.description) : undefined
          }
        })
      : undefined
    return {
      id: String(record.id || `question-${index + 1}`),
      title: String(record.title || `Question ${index + 1}`),
      description: record.description ? String(record.description) : undefined,
      kind,
      options,
      allowCustom: true
    }
  })
}

function sessionMessages(kind: AgentKind, sessionId: string) {
  const state = useWorkbenchStore.getState()
  if (kind === 'subagent') return state.subagentSessions[sessionId]?.messages ?? []
  return state.sessions.find((session) => session.id === sessionId)?.messages ?? []
}

function addRunMessage(kind: AgentKind, sessionId: string, event: Parameters<typeof useWorkbenchStore.getState> extends never ? never : any) {
  const store = useWorkbenchStore.getState()
  return kind === 'subagent' ? store.addSubagentMessage(sessionId, event) : store.addSessionMessage(sessionId, event)
}

function updateRunMessage(kind: AgentKind, sessionId: string, eventId: string, patch: Partial<AppMessage>) {
  const store = useWorkbenchStore.getState()
  return kind === 'subagent' ? store.updateSubagentMessage(sessionId, eventId, patch) : store.updateSessionMessage(sessionId, eventId, patch)
}

function appendRunAssistantMessage(kind: AgentKind, sessionId: string, eventId: string, token: string) {
  const store = useWorkbenchStore.getState()
  return kind === 'subagent' ? store.appendSubagentAssistantMessage(sessionId, eventId, token) : store.appendSessionAssistantMessage(sessionId, eventId, token)
}

function updateRunToolStatus(kind: AgentKind, sessionId: string, eventId: string, status: 'pending' | 'running' | 'success' | 'error') {
  const store = useWorkbenchStore.getState()
  return kind === 'subagent' ? store.updateSubagentToolStatus(sessionId, eventId, status) : store.updateSessionToolStatus(sessionId, eventId, status)
}

async function executeTool(call: ToolCall, signal: AbortSignal, ctx: { kind: AgentKind; sessionId: string; parentSessionId?: string; allowedTools?: string[] }) {
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
    case 'subagent_call': {
      if (ctx.kind === 'subagent') {
        return { skipped: true, reason: 'Nested subagent calls are disabled in this version.' }
      }
      const prompt = String(call.arguments.prompt || '').trim()
      if (!prompt) throw new Error('subagent_call requires a prompt')
      const requestedTools = Array.isArray(call.arguments.tools) ? call.arguments.tools.map(String) : SUBAGENT_DEFAULT_TOOLS
      const allowedTools = requestedTools.filter((tool) => SUBAGENT_DEFAULT_TOOLS.includes(tool))
      const title = `Subagent ${prompt.slice(0, 36) || 'task'}`
      const existingId = typeof call.arguments.subagentSessionId === 'string' ? call.arguments.subagentSessionId : ''
      const existing = existingId ? store.subagentSessions[existingId] : undefined
      const subagentSessionId = existing ? existing.id : store.createSubagentSession(ctx.sessionId, title, allowedTools)
      store.updateSubagentSession(subagentSessionId, { status: 'running', allowedTools, title: existing?.title || title })
      store.upsertSubagentTrace(ctx.sessionId, { toolCallId: call.id, subagentSessionId, title: existing?.title || title, status: 'running' })
      const finalAnswer = await runSubagentTurn({ sessionId: subagentSessionId, parentSessionId: ctx.sessionId, prompt, allowedTools, signal })
      store.updateSubagentSession(subagentSessionId, { status: 'completed' })
      store.syncSubagentTrace(ctx.sessionId, subagentSessionId, { status: 'completed', finalAnswer })
      return { subagentSessionId, finalAnswer, status: 'completed' }
    }
    default:
      throw new Error(`Unknown tool: ${call.name}`)
  }
}

async function runAgentSteps(
  run: { kind: AgentKind; sessionId: string; parentSessionId?: string; allowedTools?: string[] },
  messages: ChatMessage[],
  startStep: number,
  signal: AbortSignal
): Promise<string> {
  const store = useWorkbenchStore.getState()
  for (let step = startStep; step < 8; step++) {
    signal.throwIfAborted()
    const assistantMessageId = addRunMessage(run.kind, run.sessionId, { type: 'assistant_message', content: '', streaming: true })
    const response = await streamOpenAICompatible(useWorkbenchStore.getState().llm, messages, {
      signal,
      allowedTools: run.allowedTools,
      onToken: (token) => appendRunAssistantMessage(run.kind, run.sessionId, assistantMessageId, token)
    })
    updateRunMessage(run.kind, run.sessionId, assistantMessageId, { streaming: false })

    if (!response.toolCalls.length) {
      if (!response.content) updateRunMessage(run.kind, run.sessionId, assistantMessageId, { content: 'Done.' })
      return response.content || 'Done.'
    }

    if (!response.content) updateRunMessage(run.kind, run.sessionId, assistantMessageId, { content: `Calling ${response.toolCalls.map((c) => c.name).join(', ')}...` })
    messages.push(response.assistantMessage)

    for (const toolCall of response.toolCalls) {
      signal.throwIfAborted()

      if (toolCall.name === 'run_command' && shouldConfirmCommand(String(toolCall.arguments.command || ''))) {
        const command = String(toolCall.arguments.command || '')
        const eventId = addRunMessage(run.kind, run.sessionId, { type: 'tool_call', toolCallId: toolCall.id, toolName: toolCall.name, input: toolCall.arguments, status: 'running' })
        addRunMessage(run.kind, run.sessionId, { type: 'approval_request', reason: 'Command requires approval before running in WebContainer.', command })
        store.setPendingApproval({ command, toolCallId: toolCall.id })
        pendingTurnState = { ...run, messages, step, toolCall, eventId, pendingType: 'approval' }
        store.setAgentRunning(false)
        const err = new Error('APPROVAL_REQUIRED')
        err.name = 'ApprovalRequired'
        throw err
      }

      if (toolCall.name === 'ask_question') {
        const questions = normalizeQuestions(toolCall.arguments.questions)
        const eventId = addRunMessage(run.kind, run.sessionId, { type: 'tool_call', toolCallId: toolCall.id, toolName: toolCall.name, input: toolCall.arguments, status: 'running' })
        addRunMessage(run.kind, run.sessionId, {
          type: 'question_request',
          toolCallId: toolCall.id,
          questions,
          status: 'pending',
          source: { kind: run.kind, sessionId: run.sessionId, title: run.kind === 'subagent' ? useWorkbenchStore.getState().subagentSessions[run.sessionId]?.title : undefined }
        })
        pendingTurnState = { ...run, messages, step, toolCall, eventId, pendingType: 'question' }
        store.setAgentRunning(false)
        const err = new Error('QUESTION_REQUIRED')
        err.name = 'QuestionRequired'
        throw err
      }

      if (run.allowedTools?.length && !run.allowedTools.includes(toolCall.name)) {
        const eventId = addRunMessage(run.kind, run.sessionId, { type: 'tool_call', toolCallId: toolCall.id, toolName: toolCall.name, input: toolCall.arguments, status: 'error' })
        const result = { error: `Tool "${toolCall.name}" is not available in this agent.` }
        addRunMessage(run.kind, run.sessionId, { type: 'tool_result', toolCallId: toolCall.id, toolName: toolCall.name, output: result })
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) })
        updateRunToolStatus(run.kind, run.sessionId, eventId, 'error')
        continue
      }

      const eventId = addRunMessage(run.kind, run.sessionId, { type: 'tool_call', toolCallId: toolCall.id, toolName: toolCall.name, input: toolCall.arguments, status: 'running' })
      try {
        const result = await executeTool(toolCall, signal, run)
        updateRunToolStatus(run.kind, run.sessionId, eventId, 'success')
        addRunMessage(run.kind, run.sessionId, { type: 'tool_result', toolCallId: toolCall.id, toolName: toolCall.name, output: result })
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: truncateOutput(JSON.stringify(result), 6000) })
      } catch (error) {
        updateRunToolStatus(run.kind, run.sessionId, eventId, 'error')
        const message = error instanceof Error ? error.message : String(error)
        addRunMessage(run.kind, run.sessionId, { type: 'tool_result', toolCallId: toolCall.id, toolName: toolCall.name, output: { error: message } })
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ error: message }) })
        if (error instanceof DOMException && error.name === 'AbortError') throw error
      }
    }
  }
  const final = 'Reached max agent steps. Please continue if you want me to keep going.'
  addRunMessage(run.kind, run.sessionId, { type: 'assistant_message', content: final })
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
  const messages = buildMessagesFromHistory(session.messages, userInput, filePaths, 'main')

  store.addSessionMessage(session.id, { type: 'user_message', content: userInput })

  try {
    return await runAgentSteps({ kind: 'main', sessionId: session.id, allowedTools: DEFAULT_TOOLS }, messages, 0, signal)
  } catch (error) {
    if (error instanceof Error && (error.name === 'ApprovalRequired' || error.name === 'QuestionRequired')) {
      return error.name === 'QuestionRequired' ? 'Awaiting answer...' : 'Awaiting approval...'
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      store.addSessionMessage(session.id, { type: 'assistant_message', content: 'Interrupted.' })
      return 'Interrupted.'
    }
    throw error
  } finally {
    if (!pendingTurnState && activeAbortController === abortController) {
      activeAbortController = null
    }
  }
}

async function runSubagentTurn({
  sessionId,
  parentSessionId,
  prompt,
  allowedTools,
  signal
}: {
  sessionId: string
  parentSessionId: string
  prompt: string
  allowedTools: string[]
  signal: AbortSignal
}) {
  const store = useWorkbenchStore.getState()
  const session = store.subagentSessions[sessionId]
  if (!session) throw new Error(`Unknown subagent session: ${sessionId}`)
  const filePaths = store.files.map((file) => file.path)
  const messages = buildMessagesFromHistory(session.messages, prompt, filePaths, 'subagent')
  store.addSubagentMessage(sessionId, { type: 'user_message', content: prompt })
  const final = await runAgentSteps({ kind: 'subagent', sessionId, parentSessionId, allowedTools }, messages, 0, signal)
  store.syncSubagentTrace(parentSessionId, sessionId, { status: 'running' })
  return final
}

export async function approveAndContinue() {
  if (!pendingTurnState) return
  const { messages, step, toolCall, eventId, kind, sessionId, parentSessionId, allowedTools } = pendingTurnState
  const run = { kind, sessionId, parentSessionId, allowedTools }
  const store = useWorkbenchStore.getState()
  store.setPendingApproval(null)
  store.setAgentRunning(true)

  const abortController = new AbortController()
  activeAbortController = abortController
  const signal = abortController.signal

  try {
    const result = await executeTool(toolCall, signal, run)
    updateRunToolStatus(kind, sessionId, eventId, 'success')
    addRunMessage(kind, sessionId, { type: 'tool_result', toolCallId: toolCall.id, toolName: toolCall.name, output: result })
    messages.push({ role: 'tool', tool_call_id: toolCall.id, content: truncateOutput(JSON.stringify(result), 6000) })
    pendingTurnState = null
    await runAgentSteps(run, messages, step, signal)
  } catch (error) {
    if (error instanceof Error && (error.name === 'ApprovalRequired' || error.name === 'QuestionRequired')) return
    if (error instanceof DOMException && error.name === 'AbortError') {
      addRunMessage(kind, sessionId, { type: 'assistant_message', content: 'Interrupted.' })
    } else {
      addRunMessage(kind, sessionId, { type: 'assistant_message', content: error instanceof Error ? error.message : String(error) })
    }
    pendingTurnState = null
  } finally {
    store.setAgentRunning(false)
    if (activeAbortController === abortController) activeAbortController = null
  }
}

export async function denyAndContinue() {
  if (!pendingTurnState) return
  const { messages, step, toolCall, eventId, kind, sessionId, parentSessionId, allowedTools } = pendingTurnState
  const run = { kind, sessionId, parentSessionId, allowedTools }
  const store = useWorkbenchStore.getState()
  store.setPendingApproval(null)
  store.setAgentRunning(true)

  const abortController = new AbortController()
  activeAbortController = abortController
  const signal = abortController.signal

  updateRunToolStatus(kind, sessionId, eventId, 'error')
  const result = { command: String(toolCall.arguments.command || ''), skipped: true, reason: 'User denied command approval.' }
  addRunMessage(kind, sessionId, { type: 'tool_result', toolCallId: toolCall.id, toolName: toolCall.name, output: result })
  messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) })
  pendingTurnState = null

  try {
    await runAgentSteps(run, messages, step, signal)
  } catch (error) {
    if (error instanceof Error && (error.name === 'ApprovalRequired' || error.name === 'QuestionRequired')) {
      return
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      addRunMessage(kind, sessionId, { type: 'assistant_message', content: 'Interrupted.' })
    }
  } finally {
    store.setAgentRunning(false)
    if (activeAbortController === abortController) activeAbortController = null
  }
}

export async function answerQuestionRequest(toolCallId: string, answers: AgentQuestionAnswer[]) {
  if (!pendingTurnState || pendingTurnState.toolCall.id !== toolCallId || pendingTurnState.pendingType !== 'question') return
  const { messages, step, toolCall, eventId, kind, sessionId, parentSessionId, allowedTools } = pendingTurnState
  const run = { kind, sessionId, parentSessionId, allowedTools }
  const store = useWorkbenchStore.getState()
  store.answerQuestion(toolCallId, answers)
  store.setAgentRunning(true)

  const abortController = new AbortController()
  activeAbortController = abortController
  const signal = abortController.signal
  const result = { answers }

  updateRunToolStatus(kind, sessionId, eventId, 'success')
  addRunMessage(kind, sessionId, { type: 'tool_result', toolCallId: toolCall.id, toolName: toolCall.name, output: result })
  messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) })
  pendingTurnState = null

  try {
    await runAgentSteps(run, messages, step, signal)
  } catch (error) {
    if (error instanceof Error && (error.name === 'ApprovalRequired' || error.name === 'QuestionRequired')) return
    if (error instanceof DOMException && error.name === 'AbortError') {
      addRunMessage(kind, sessionId, { type: 'assistant_message', content: 'Interrupted.' })
    } else {
      addRunMessage(kind, sessionId, { type: 'assistant_message', content: error instanceof Error ? error.message : String(error) })
    }
  } finally {
    store.setAgentRunning(false)
    if (activeAbortController === abortController) activeAbortController = null
  }
}
