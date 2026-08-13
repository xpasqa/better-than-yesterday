// POST /api/agent/chat — SSE streaming chat endpoint
// docs/feature/35.agent-orchestrator/spec.md §3, §4 (Blok C + D)
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import { AppError } from '../../http/errors.ts'
import { runAgent } from './runner.ts'
import { serializeEvent } from '@better/core/sse'
import type { AgentEvent } from '@better/core/agent-events'
import type { SSEStreamingApi } from 'hono/streaming'

/** Every event leaves through here, so the wire format is compiler-checked. */
async function send(stream: SSEStreamingApi, event: AgentEvent): Promise<void> {
  await stream.writeSSE(serializeEvent(event))
}

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
        onToken: async (text) => { await send(stream, { type: 'token', text }) },
        onFileCreated: async (path) => { await send(stream, { type: 'file', path }) },
        onPatch: async (nodeId: string) => { await send(stream, { type: 'patch', nodeId }) },
        onNotice: async (text) => { await send(stream, { type: 'notice', text }) },
        onToolStart: async (name) => { await send(stream, { type: 'tool', name, status: 'start' }) },
        onToolEnd: async (name) => { await send(stream, { type: 'tool', name, status: 'done' }) },
        onError: async (message) => { await send(stream, { type: 'error', message }) },
        onDone: async () => {
          // Sent in the finally below so it also fires when runAgent throws.
        },
      })
    } finally {
      // done is always the last event (Blok C requirement)
      await send(stream, { type: 'done' })
    }
  })
})
