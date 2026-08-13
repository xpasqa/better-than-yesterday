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
import type { ChatCompletionMessageParam, ChatCompletionChunk } from 'openai/resources/chat/completions'

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
        await stream.writeSSE({ event: 'error', data: 'API key not configured. Go to Settings → Agent.' })
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
          await stream.writeSSE({ event: 'error', data: `AI request failed: ${msg}` })
          return
        }

        let currentContent = ''
        const toolCallState: ToolCallState = {}

        try {
          for await (const chunk of streamResult) {
            const delta = chunk.choices[0]?.delta
            if (delta?.content) {
              currentContent += delta.content
              await stream.writeSSE({ event: 'token', data: delta.content })
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
          await stream.writeSSE({ event: 'error', data: `Stream error: ${msg}` })
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
          await stream.writeSSE({
            event: 'tool',
            data: JSON.stringify({ name: toolCall.name, status: 'start' }),
          })

          const toolResult = await executeTool(
            toolCall.name,
            toolCall.args,
            { userId, projectId, sessionId, nodeId },
          )

          await stream.writeSSE({
            event: 'tool',
            data: JSON.stringify({ name: toolCall.name, status: 'done' }),
          })

          // Notify UI to refresh via sync patch
          if (
            (toolCall.name === 'add_task' || toolCall.name === 'update_task' || toolCall.name === 'add_subtask') &&
            !toolResult.startsWith('Error')
          ) {
            const id = toolResult.split(': ')[1] ?? ''
            if (id) {
              await stream.writeSSE({ event: 'patch', data: JSON.stringify({ nodeId: id }) })
            }
          }

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolResult,
          })
        }
      }
    } finally {
      await stream.writeSSE({ event: 'done', data: '' })
    }
  })
})
