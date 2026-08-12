// GET /api/agent/sessions — the sidebar's Recent Chats source, and
// GET /api/agent/sessions/:id — full history for AgentView to render.
// docs/feature/34.sidebar-workspace/spec.md §4.1.
import { Hono } from 'hono'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { agentSession } from '../../db/schema/agent-session.ts'
import { AppError } from '../../http/errors.ts'

export const sessionRoutes = new Hono()

/**
 * agent_session has no title column on purpose — the first thing the user
 * said IS the title. Parsed per row, which is cheap at the sidebar's
 * limit=4; a stored title would be one more thing to keep in sync.
 */
export function deriveSessionTitle(history: string): string {
  try {
    const messages = JSON.parse(history) as Array<{ role?: string; content?: unknown }>
    const first = messages.find((m) => m.role === 'user' && typeof m.content === 'string' && m.content.trim() !== '')
    if (first) {
      const text = (first.content as string).trim().replace(/\s+/g, ' ')
      return text.length > 48 ? `${text.slice(0, 48)}…` : text
    }
  } catch {
    // malformed history — fall through to the fallback
  }
  return 'Percakapan baru'
}

/** History rows a human should see: plain user/assistant text. Tool calls, tool results, and array-content rows are plumbing. */
function visibleMessages(history: string): Array<{ role: 'user' | 'assistant'; content: string }> {
  try {
    const messages = JSON.parse(history) as Array<{ role?: string; content?: unknown }>
    return messages
      .filter((m): m is { role: 'user' | 'assistant'; content: string } =>
        (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content !== '')
      .map((m) => ({ role: m.role, content: m.content }))
  } catch {
    return []
  }
}

sessionRoutes.get('/sessions', async (c) => {
  const userId = c.get('userId' as never) as string
  if (!userId) throw new AppError('UNAUTHORIZED', 401, 'Unauthorized')

  const rawLimit = Number(c.req.query('limit') ?? '4')
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 20) : 4

  const rows = await db
    .select({ id: agentSession.id, history: agentSession.history, updatedAt: agentSession.updatedAt })
    .from(agentSession)
    .where(eq(agentSession.userId, userId))
    .orderBy(desc(agentSession.updatedAt))
    .limit(limit)

  return c.json({
    sessions: rows.map((r) => ({
      id: r.id,
      title: deriveSessionTitle(r.history),
      updatedAt: r.updatedAt.toISOString(),
    })),
  })
})

sessionRoutes.get('/sessions/:id', async (c) => {
  const userId = c.get('userId' as never) as string
  if (!userId) throw new AppError('UNAUTHORIZED', 401, 'Unauthorized')

  const id = c.req.param('id')
  // Ownership is part of the WHERE, not an afterthought — a foreign id 404s
  // identically to a missing one, leaking nothing.
  const [row] = await db
    .select()
    .from(agentSession)
    .where(and(eq(agentSession.id, id), eq(agentSession.userId, userId)))
    .limit(1)
  if (!row) throw new AppError('NOT_FOUND', 404, 'Session not found')

  return c.json({
    id: row.id,
    title: deriveSessionTitle(row.history),
    closedAt: row.closedAt?.toISOString() ?? null,
    messages: visibleMessages(row.history),
  })
})
