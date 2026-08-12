// agent-sessions.ts — API client for the agent session list & detail
// endpoints (34.sidebar-workspace/spec.md §4). Same conventions as mail.ts:
// credentials: 'include', typed errors thrown on non-ok.

export interface RecentSession {
  id: string
  title: string
  updatedAt: string
}

export interface SessionDetail {
  id: string
  title: string
  closedAt: string | null
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
}

async function ensureOk(res: Response): Promise<void> {
  if (res.ok) return
  let message = `HTTP ${res.status}`
  try {
    const body = await res.json() as { message?: string }
    if (body.message) message = body.message
  } catch {
    // non-JSON error body — keep the status-based message
  }
  throw new Error(message)
}

export async function fetchRecentSessions(limit = 4): Promise<RecentSession[]> {
  const res = await fetch(`/api/agent/sessions?limit=${limit}`, { credentials: 'include' })
  await ensureOk(res)
  const body = await res.json() as { sessions: RecentSession[] }
  return body.sessions
}

export async function fetchSession(id: string): Promise<SessionDetail> {
  const res = await fetch(`/api/agent/sessions/${id}`, { credentials: 'include' })
  await ensureOk(res)
  return await res.json() as SessionDetail
}
