// Thin fetch wrapper for /auth/*. The session cookie is httpOnly, so this
// code never sees or stores it directly — the browser attaches it
// automatically to same-origin requests via `credentials: 'include'`.
export interface AuthUser {
  id: string
  email: string
  name: string
  timezone?: string
}

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

export async function fetchMe(): Promise<AuthUser | null> {
  const res = await fetch('/auth/me', { credentials: 'include' })
  if (res.status === 401) return null
  if (!res.ok) throw new Error(`GET /auth/me failed: ${res.status}`)
  const body = (await parseJson(res)) as { user: AuthUser }
  return body.user
}

export async function login(email: string, password: string): Promise<{ ok: true; user: AuthUser } | { ok: false; message: string }> {
  const res = await fetch('/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const body = (await parseJson(res)) as { user?: AuthUser; error?: { message: string } }
  if (!res.ok) return { ok: false, message: body.error?.message ?? 'Login failed' }
  return { ok: true, user: body.user! }
}

export async function logout(): Promise<void> {
  await fetch('/auth/logout', { method: 'POST', credentials: 'include' })
}

export async function updateMe(prefs: { timezone?: string }): Promise<AuthUser> {
  const res = await fetch('/api/me', {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(prefs),
  })
  if (!res.ok) {
    const body = (await parseJson(res)) as { error?: string }
    throw new Error(body.error ?? `PATCH /api/me failed: ${res.status}`)
  }
  const body = (await parseJson(res)) as { user: AuthUser }
  return body.user
}
