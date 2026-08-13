// Agent runner — assembles context, streams tokens via SSE, executes tools.
// docs/feature/35.agent-orchestrator/spec.md §4 (Blok D)
//
// Bugs fixed:
// #3 — only executed tools when finish_reason === 'tool_calls'; gateways often
//      send 'stop' or null. Fix: check toolCalls.length instead.
// #4 — name was appended on every chunk: "write_filewrite_file". Fix: use
//      accumulate() from core/tool-calls.ts which always SETs, never appends.
// riwayat hilang — appendSessionHistory was after early returns, so failed
//      turns were lost. Fix: try/finally guarantees persistence.
import OpenAI from 'openai'
import type { ChatCompletionMessageParam, ChatCompletionChunk } from 'openai/resources/chat/completions'
import { ALL_TOOLS } from './tools.ts'
import { executeTool } from './tool-executor.ts'
import {
  getOrCreateGlobalProject,
  getOrCreateProjectMemory,
  getOrCreateSession,
  appendSessionHistory,
  getSessionHistory,
} from './file-service.ts'
import { getApiKey, getAiSettings } from './settings-service.ts'
import { accumulate, finalize } from '@better/core/tool-calls'
import type { ToolCallState } from '@better/core/tool-calls'

export interface RunAgentOptions {
  userId: string
  nodeId: string | null   // project node id — null for global context
  userMessage: string
  /** Tools to expose. Defaults to ALL_TOOLS when omitted. */
  tools?: typeof ALL_TOOLS
  /** Called with each streamed token. */
  onToken: (token: string) => void | Promise<void>
  /** Called when a file is written by the agent. */
  onFileCreated: (path: string) => void | Promise<void>
  /** Called when a node is written (for /sync patch events). */
  onPatch?: (nodeId: string) => void | Promise<void>
  /** Called once when the turn completes (always, even after errors). */
  onDone: () => void | Promise<void>
  /** Called on non-fatal errors before onDone. */
  onError: (err: string) => void | Promise<void>
}

export async function runAgent(opts: RunAgentOptions): Promise<void> {
  const { userId, nodeId, userMessage, onToken, onFileCreated, onPatch, onDone, onError } = opts

  // 1. Load settings
  const settings = await getAiSettings(userId)
  const apiKey = await getApiKey(userId)
  if (!apiKey) {
    await onError('API key not configured. Go to Settings → Agent to add your key.')
    await onDone()
    return
  }

  const maxSteps = settings.maxSteps ?? 6
  const client = new OpenAI({ baseURL: settings.baseUrl, apiKey })
  const toolSet = opts.tools ?? ALL_TOOLS

  // 2. Load memory — global + project (two-tier, spec v2)
  const globalProject = await getOrCreateGlobalProject(userId)
  const projectMem = nodeId ? await getOrCreateProjectMemory(userId, nodeId) : null
  const projectId = projectMem?.id ?? globalProject.id
  const session = await getOrCreateSession(userId, projectId)

  // 3. Assemble system prompt (two-tier memory: global + session)
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10)
  const systemParts: string[] = [
    `Today: ${dateStr}`,
    '',
    '# Global memory (AGENT.md)',
    globalProject.memory || '(empty)',
    '',
    '# Session notes (SESSION.md)',
    session.memory || '(empty)',
    '',
    '---',
    'You are a helpful AI assistant. You have access to file and task tools.',
    'Use plan-then-execute: think first, then act.',
    `Max ${maxSteps} tool steps per turn.`,
    'After completing work, update SESSION.md via compact_memory if it is getting long.',
  ]
  const systemPrompt = systemParts.join('\n')

  // 4. Build message history
  const history = await getSessionHistory(session.id) as ChatCompletionMessageParam[]
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage },
  ]

  // Track new messages — persisted in finally so they're never lost
  const newMessages: ChatCompletionMessageParam[] = [{ role: 'user', content: userMessage }]

  try {
    // 5. Tool loop — max maxSteps iterations
    let steps = 0

    while (steps < maxSteps) {
      steps++

      let stream: AsyncIterable<ChatCompletionChunk>
      try {
        stream = await client.chat.completions.create({
          model: settings.model,
          messages,
          tools: toolSet,
          tool_choice: 'auto',
          stream: true,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        await onError(`AI request failed: ${msg}`)
        return
      }

      let currentContent = ''
      const toolCallState: ToolCallState = {}

      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta

          if (delta?.content) {
            currentContent += delta.content
            await onToken(delta.content)
          }

          // Accumulate tool_calls using pure helper (fixes bug #4)
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              accumulate(toolCallState, {
                index: tc.index,
                id: tc.id ?? undefined,
                function: tc.function
                  ? { name: tc.function.name ?? undefined, arguments: tc.function.arguments ?? undefined }
                  : undefined,
              })
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
          await onError('Rate limit reached. Wait a moment and try again.')
        } else {
          await onError(`Stream error: ${msg}`)
        }
        return
      }

      const toolCalls = finalize(toolCallState)

      // Normalize assistant message: content '' → null for Claude gateway compat
      const assistantContent = currentContent || null

      // Skip messages with neither content nor tool calls (empty delta frames)
      if (assistantContent === null && toolCalls.length === 0) {
        break
      }

      const assistantMessage: ChatCompletionMessageParam = toolCalls.length > 0
        ? {
            role: 'assistant',
            content: assistantContent,
            tool_calls: toolCalls.map(tc => ({
              id: tc.id,
              type: 'function' as const,
              function: { name: tc.name, arguments: JSON.stringify(tc.args) },
            })),
          }
        : { role: 'assistant', content: assistantContent ?? '' }

      messages.push(assistantMessage)
      newMessages.push(assistantMessage)

      // Bug #3 fix: check tool call presence, not finish_reason
      if (toolCalls.length === 0) break

      // Execute tool calls
      for (const toolCall of toolCalls) {
        // Invalid JSON was already handled by finalize() — args is {} on failure
        const rawArgs = JSON.stringify(toolCall.args)
        const argsValid = toolCall.args && Object.keys(toolCall.args).length > 0
          || rawArgs === '{}'  // empty object is valid

        // Return parse errors back to the model (spec §4)
        let toolResult: string
        if (!argsValid && rawArgs !== '{}') {
          toolResult = `Error: invalid JSON arguments for ${toolCall.name}`
        } else {
          toolResult = await executeTool(
            toolCall.name,
            toolCall.args,
            { userId, projectId, sessionId: session.id, nodeId },
          )
        }

        // Notify frontend of side effects
        if (toolCall.name === 'write_file' && !toolResult.startsWith('Error')) {
          const path = (toolCall.args.path as string | undefined) ?? ''
          if (path) await onFileCreated(path)
        }
        if (
          (toolCall.name === 'create_task' || toolCall.name === 'update_task') &&
          !toolResult.startsWith('Error') && onPatch
        ) {
          const id = (toolCall.args.id as string | undefined) ?? toolResult.split(': ')[1] ?? ''
          if (id) await onPatch(id)
        }

        const toolMessage: ChatCompletionMessageParam = {
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult,
        }
        messages.push(toolMessage)
        newMessages.push(toolMessage)
      }
    }
  } finally {
    // 6. Persist new messages — always, even after errors (fixes lost history bug)
    if (newMessages.length > 1) {
      await appendSessionHistory(session.id, newMessages)
    }
    await onDone()
  }
}
