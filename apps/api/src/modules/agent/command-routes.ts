// POST /api/agent/command — Todo command bar endpoint (Blok I)
// docs/feature/35.agent-orchestrator/spec.md §4
//
// Perbedaan dari /chat:
// - Tool set: TASK_TOOLS saja (tidak ada FILE_TOOLS atau MEMORY_TOOLS)
// - Riwayat: tidak disimpan ke DB — klien membawa satu giliran terakhir
// - Konteks: tidak ada sesi, tidak ada memori global/sesi
// - Balasan: ringkas, satu giliran
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import { AppError } from '../../http/errors.ts'
import { TASK_TOOLS } from './tools.ts'
import { getApiKey, getAiSettings } from './settings-service.ts'
import OpenAI from 'openai'
import { accumulate, finalize } from '@better/core/tool-calls'
import type { ToolCallState } from '@better/core/tool-calls'
import { executeTool } from './tool-executor.ts'
import { serializeEvent } from '@better/core/sse'
import type { AgentEvent } from '@better/core/agent-events'
import type { SSEStreamingApi } from 'hono/streaming'
import type { ChatCompletionMessageParam, ChatCompletionChunk } from 'openai/resources/chat/completions'

/** Every event leaves through here, so the wire format is compiler-checked. */
async function send(stream: SSEStreamingApi, event: AgentEvent): Promise<void> {
  await stream.writeSSE(serializeEvent(event))
}

export const commandRoutes = new Hono()

const previousTurnSchema = z.object({
  user: z.string(),
  assistant: z.string(),
}).optional()

const commandInput = z.object({
  message: z.string().min(1).max(5000),
  nodeId: z.string().nullable().default(null),
  previousTurn: previousTurnSchema,
})

commandRoutes.post('/command', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => null)
  const parsed = commandInput.safeParse(body)
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 422, 'Invalid command input', parsed.error.flatten())
  }

  const { message, nodeId, previousTurn } = parsed.data

  return streamSSE(c, async (stream) => {
    try {
      const settings = await getAiSettings(userId)
      const apiKey = await getApiKey(userId)
      if (!apiKey) {
        await send(stream, { type: 'error', message: 'API key not configured. Go to Settings → Agent.' })
        return
      }

      const maxSteps = settings.maxSteps ?? 6
      const client = new OpenAI({ baseURL: settings.baseUrl, apiKey })

      // No memory loading — todo agent is stateless by design (spec v2)
      const now = new Date()
      const dateStr = now.toISOString().slice(0, 10)
      const systemPrompt = [
        `Today: ${dateStr}`,
        '',
        'You are a task assistant. You help manage todo items.',
        'Be concise. One short paragraph max in your final answer.',
        'Execute immediately — no confirmation needed.',
        `Max ${maxSteps} tool steps.`,
      ].join('\n')

      // Build messages — optionally include one previous turn for context
      const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
      ]
      if (previousTurn) {
        messages.push({ role: 'user', content: previousTurn.user })
        messages.push({ role: 'assistant', content: previousTurn.assistant })
      }
      messages.push({ role: 'user', content: message })

      // Fake projectId — tool-executor only needs userId + nodeId for task tools
      const projectId = 'command'
      const sessionId = 'command'

      let steps = 0
      while (steps < maxSteps) {
        steps++

        let streamResult: AsyncIterable<ChatCompletionChunk>
        try {
          streamResult = await client.chat.completions.create({
            model: settings.model,
            messages,
            tools: TASK_TOOLS,
            tool_choice: 'auto',
            stream: true,
          })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          await send(stream, { type: 'error', message: `AI request failed: ${msg}` })
          return
        }

        let currentContent = ''
        const toolCallState: ToolCallState = {}

        try {
          for await (const chunk of streamResult) {
            const delta = chunk.choices[0]?.delta
            if (delta?.content) {
              currentContent += delta.content
              await send(stream, { type: 'token', text: delta.content })
            }
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
          await send(stream, { type: 'error', message: `Stream error: ${msg}` })
          return
        }

        const toolCalls = finalize(toolCallState)
        const assistantContent = currentContent || null

        if (assistantContent === null && toolCalls.length === 0) break

        const assistantMsg: ChatCompletionMessageParam = toolCalls.length > 0
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

        messages.push(assistantMsg)

        if (toolCalls.length === 0) break

        // Execute tool calls and notify frontend
        for (const toolCall of toolCalls) {
          await send(stream, { type: 'tool', name: toolCall.name, status: 'start' })

          let resultText: string
          if (toolCall.argsError) {
            // Handed back to the model so it can correct itself (spec §5.1).
            resultText = `Error: ${toolCall.argsError}`
          } else {
            const result = await executeTool(
              toolCall.name,
              toolCall.args,
              { userId, projectId, sessionId, nodeId },
            )
            resultText = result.text
            // Ids come from the write site, not from parsing the reply text.
            if (!result.isError) {
              for (const id of result.effects.nodeIds) {
                await send(stream, { type: 'patch', nodeId: id })
              }
            }
          }

          await send(stream, { type: 'tool', name: toolCall.name, status: 'done' })

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: resultText,
          })
        }
      }
    } finally {
      await send(stream, { type: 'done' })
    }
  })
})
