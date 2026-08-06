// Agent runner — assembles context, streams tokens via SSE, executes tools.
// docs/feature/2.backend/3.agent/spec.md §7, §8, §9
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


const MAX_STEPS = 6

interface RunAgentOptions {
  userId: string
  nodeId: string | null   // project node id — null for global context
  userMessage: string
  onToken: (token: string) => void
  onFileCreated: (path: string) => void
  onDone: () => void
  onError: (err: string) => void
}

export async function runAgent(opts: RunAgentOptions): Promise<void> {
  const { userId, nodeId, userMessage, onToken, onFileCreated, onDone, onError } = opts

  // 1. Load settings
  const settings = await getAiSettings(userId)
  const apiKey = await getApiKey(userId)
  if (!apiKey) {
    onError('API key not configured. Go to Settings → Agent to add your key.')
    return
  }

  const client = new OpenAI({ baseURL: settings.baseUrl, apiKey })

  // 2. Load memory — global + project + session
  const globalProject = await getOrCreateGlobalProject(userId)
  const projectMem = nodeId ? await getOrCreateProjectMemory(userId, nodeId) : null
  const projectId = projectMem?.id ?? globalProject.id
  const session = await getOrCreateSession(userId, projectId)

  // 3. Assemble system prompt
  const systemParts: string[] = [
    '# Global memory (AGENT.md)',
    globalProject.memory || '(empty)',
  ]
  if (projectMem) {
    systemParts.push('', '# Project memory (PROJECT.md)', projectMem.memory || '(empty)')
  }
  systemParts.push('', '# Session notes (SESSION.md)', session.memory || '(empty)')
  systemParts.push(
    '',
    '---',
    'You are a helpful AI assistant. You have access to file and task tools.',
    'Use plan-then-execute: think first, then act. Max 6 tool steps per turn.',
    'After completing work, update SESSION.md via compact_memory if it is getting long.',
  )
  const systemPrompt = systemParts.join('\n')

  // 4. Build message history
  const history = await getSessionHistory(session.id) as ChatCompletionMessageParam[]
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage },
  ]

  // Track new messages to persist after the turn
  const newMessages: ChatCompletionMessageParam[] = [{ role: 'user', content: userMessage }]

  // 5. Tool loop — max MAX_STEPS iterations
  let steps = 0
  let assistantContent = ''

  while (steps < MAX_STEPS) {
    steps++

    let stream: AsyncIterable<ChatCompletionChunk>
    try {
      stream = await client.chat.completions.create({
        model: settings.model,
        messages,
        tools: ALL_TOOLS,
        tool_choice: 'auto',
        stream: true,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      onError(`AI request failed: ${msg}`)
      return
    }

    // Stream tokens to client
    let currentContent = ''
    let finishReason = ''
    let assistantMessage: ChatCompletionMessageParam | null = null
    const toolCallsMap: Record<string, { id: string; name: string; args: string }> = {}

    try {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta
        const fr = chunk.choices[0]?.finish_reason
        if (fr) finishReason = fr

        if (delta?.content) {
          currentContent += delta.content
          onToken(delta.content)
        }

        // Accumulate tool_calls from streaming chunks
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0
            const key = String(idx)
            if (!toolCallsMap[key]) {
              toolCallsMap[key] = { id: tc.id ?? '', name: tc.function?.name ?? '', args: '' }
            }
            if (tc.id) toolCallsMap[key]!.id = tc.id
            if (tc.function?.name) toolCallsMap[key]!.name += tc.function.name
            if (tc.function?.arguments) toolCallsMap[key]!.args += tc.function.arguments
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
        onError('Rate limit reached. Wait a moment and try again.')
      } else {
        onError(`Stream error: ${msg}`)
      }
      return
    }

    // Accumulate text
    if (currentContent) assistantContent += currentContent

    // Build assistant message from accumulated stream
    const toolCalls = Object.values(toolCallsMap)
    if (toolCalls.length > 0) {
      assistantMessage = {
        role: 'assistant',
        content: currentContent || null,
        tool_calls: toolCalls.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.args },
        })),
      }
    } else {
      assistantMessage = { role: 'assistant', content: currentContent }
    }

    if (!assistantMessage) {
      onError('No response from AI')
      return
    }

    messages.push(assistantMessage as ChatCompletionMessageParam)
    newMessages.push(assistantMessage as ChatCompletionMessageParam)

    // If no tool calls, we're done
    if (finishReason !== 'tool_calls' || !assistantMessage.tool_calls?.length) {
      break
    }

    // Execute tool calls
    for (const toolCall of assistantMessage.tool_calls) {
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>
      } catch {
        // leave args empty
      }

      const toolResult = await executeTool(
        toolCall.function.name,
        args,
        { userId, projectId, sessionId: session.id, nodeId },
      )

      // Notify frontend if a file was written
      if (toolCall.function.name === 'write_file' && !toolResult.startsWith('Error')) {
        const path = (args.path as string | undefined) ?? ''
        if (path) onFileCreated(path)
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

  // 6. Persist new messages to session history
  await appendSessionHistory(session.id, newMessages)

  onDone()
}
