// POST /api/agent/chat — SSE streaming chat endpoint
// docs/feature/2.backend/3.agent/spec.md §7, §8, §9
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import { AppError } from '../../http/errors.ts'
import { runAgent } from './runner.ts'

export const chatRoutes = new Hono()

const chatInput = z.object({
  message: z.string().min(1).max(10000),
  nodeId: z.string().nullable().default(null), // project node id — null = global
  sessionId: z.string().optional(),            // optional existing session id
})

chatRoutes.post('/chat', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => null)
  const parsed = chatInput.safeParse(body)
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 422, 'Invalid chat input', parsed.error.flatten())
  }

  const { message, nodeId } = parsed.data

  return streamSSE(c, async (stream) => {
    await runAgent({
      userId,
      nodeId,
      userMessage: message,
      onToken: async (token) => {
        await stream.writeSSE({ event: 'token', data: token })
      },
      onFileCreated: async (path) => {
        await stream.writeSSE({ event: 'file', data: JSON.stringify({ path }) })
      },
      onDone: async () => {
        await stream.writeSSE({ event: 'done', data: '' })
      },
      onError: async (err) => {
        await stream.writeSSE({ event: 'error', data: err })
      },
    })
  })
})
