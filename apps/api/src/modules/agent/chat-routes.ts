// POST /api/agent/chat — SSE streaming chat endpoint
// docs/feature/35.agent-orchestrator/spec.md §3, §4 (Blok C + D)
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
    // done is always sent — even after error — so the client can release
    // isStreaming regardless of what happened (Blok C spec §3).
    try {
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
        onPatch: async (nodeId: string) => {
          await stream.writeSSE({ event: 'patch', data: JSON.stringify({ nodeId }) })
        },
        onError: async (err) => {
          await stream.writeSSE({ event: 'error', data: err })
        },
        onDone: async () => {
          // onDone is called in runner's finally block — we send done here
          // but the stream closes naturally after this handler returns
        },
      })
    } finally {
      // done is always the last event (Blok C requirement)
      await stream.writeSSE({ event: 'done', data: '' })
    }
  })
})
