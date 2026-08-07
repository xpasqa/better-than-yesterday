// The most important test in this repository (infra spec §8): every phase
// that adds a table must add its own case here. Covers `node`, `label`, and
// `completion` via /api/sync, the three synced entities wired up so far.
import { beforeEach, describe, expect, it } from 'vitest'
import { uuidv7 } from '@better/core/id'
import { createApp } from '../src/app.ts'
import { resetDb, createTestUser, extractSessionCookie, makeNodeDto, makeLabelDto, makeCompletionDto, readJson } from './helpers.ts'

const app = createApp()

async function loginCookie(email: string, password = 'testpassword123'): Promise<string> {
  const res = await app.request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return extractSessionCookie(res)
}

async function sync(cookie: string, cursor: string, nodes: unknown[] = [], labels: unknown[] = [], completions: unknown[] = []) {
  const res = await app.request('/api/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ cursor, changes: { nodes, labels, completions } }),
  })
  return { status: res.status, body: await readJson(res) }
}

beforeEach(async () => {
  await resetDb()
})

describe('cross-user isolation', () => {
  it("/auth/me never returns another user's identity", async () => {
    const userA = await createTestUser('isoA@example.com')
    await createTestUser('isoB@example.com')
    const cookieA = await loginCookie('isoA@example.com')
    const res = await app.request('/auth/me', { headers: { cookie: cookieA } })
    const body = await readJson(res)
    expect(body.user.id).toBe(userA.id)
    expect(body.user.email).toBe('isoa@example.com') // stored (and compared) lowercase
  })

  it("user B's sync bootstrap never includes user A's nodes", async () => {
    await createTestUser('a@example.com')
    await createTestUser('b@example.com')
    const cookieA = await loginCookie('a@example.com')
    const cookieB = await loginCookie('b@example.com')

    const bootA = await sync(cookieA, '0')
    await sync(cookieA, bootA.body.cursor, [makeNodeDto({ id: uuidv7(), content: "A's private task" })])

    const bootB = await sync(cookieB, '0')
    const contents = bootB.body.changes.nodes.map((n: { content: string }) => n.content)
    expect(contents).not.toContain("A's private task")
    // B only ever sees their own seeded Inbox, nothing from A.
    expect(bootB.body.changes.nodes).toHaveLength(1)
    expect(bootB.body.changes.nodes[0].content).toBe('Inbox')
  })

  it('a later sync by B still never surfaces a node created by A, even past the cursor A advanced', async () => {
    await createTestUser('a2@example.com')
    await createTestUser('b2@example.com')
    const cookieA = await loginCookie('a2@example.com')
    const cookieB = await loginCookie('b2@example.com')

    const bootA = await sync(cookieA, '0')
    const afterWrite = await sync(cookieA, bootA.body.cursor, [makeNodeDto({ id: uuidv7() })])

    // B requests everything past A's own post-write cursor value — since
    // cursors are per-instance, not per-user, this is exactly the case
    // where a user_id filter, not just a cursor filter, has to hold.
    const laterB = await sync(cookieB, afterWrite.body.cursor)
    expect(laterB.body.changes.nodes).toEqual([])
  })

  it("user B cannot overwrite user A's node by reusing its id", async () => {
    await createTestUser('victim@example.com')
    await createTestUser('attacker@example.com')
    const cookieA = await loginCookie('victim@example.com')
    const cookieB = await loginCookie('attacker@example.com')

    const bootA = await sync(cookieA, '0')
    const sharedId = uuidv7()
    await sync(cookieA, bootA.body.cursor, [makeNodeDto({ id: sharedId, content: "victim's task" })])

    // Attacker guesses/reuses the same id and tries to overwrite it.
    const hijack = await sync(cookieB, '0', [
      makeNodeDto({ id: sharedId, content: 'HIJACKED', updatedAt: new Date().toISOString() }),
    ])
    expect(hijack.status).toBe(200) // silently ignored, not an error that reveals the row exists
    expect(hijack.body.changes.nodes.find((n: { id: string }) => n.id === sharedId)).toBeUndefined()

    // The victim's row is untouched, verified from the victim's own session.
    const checkA = await sync(cookieA, '0')
    const row = checkA.body.changes.nodes.find((n: { id: string }) => n.id === sharedId)
    expect(row.content).toBe("victim's task")
  })

  it("user B's sync bootstrap never includes user A's labels", async () => {
    await createTestUser('labelA@example.com')
    await createTestUser('labelB@example.com')
    const cookieA = await loginCookie('labelA@example.com')
    const cookieB = await loginCookie('labelB@example.com')

    await sync(cookieA, '0', [], [makeLabelDto({ id: uuidv7(), name: "A's-secret-label" })])

    const bootB = await sync(cookieB, '0')
    expect(bootB.body.changes.labels).toEqual([])
  })

  it("user B cannot overwrite user A's label by reusing its id", async () => {
    await createTestUser('label-victim@example.com')
    await createTestUser('label-attacker@example.com')
    const cookieA = await loginCookie('label-victim@example.com')
    const cookieB = await loginCookie('label-attacker@example.com')

    const sharedId = uuidv7()
    await sync(cookieA, '0', [], [makeLabelDto({ id: sharedId, name: 'asli' })])

    const hijack = await sync(cookieB, '0', [], [
      makeLabelDto({ id: sharedId, name: 'hijacked', updatedAt: new Date().toISOString() }),
    ])
    expect(hijack.status).toBe(200)
    expect(hijack.body.changes.labels.find((l: { id: string }) => l.id === sharedId)).toBeUndefined()

    const checkA = await sync(cookieA, '0')
    const row = checkA.body.changes.labels.find((l: { id: string }) => l.id === sharedId)
    expect(row.name).toBe('asli')
  })

  it("user B's sync bootstrap never includes user A's completions", async () => {
    await createTestUser('completionA@example.com')
    await createTestUser('completionB@example.com')
    const cookieA = await loginCookie('completionA@example.com')
    const cookieB = await loginCookie('completionB@example.com')

    const bootA = await sync(cookieA, '0')
    const nodeIdA = bootA.body.changes.nodes[0].id
    await sync(cookieA, bootA.body.cursor, [], [], [makeCompletionDto({ id: uuidv7(), nodeId: nodeIdA })])

    const bootB = await sync(cookieB, '0')
    expect(bootB.body.changes.completions).toEqual([])
  })

  it("user B cannot claim user A's completion by reusing its id", async () => {
    await createTestUser('completion-victim@example.com')
    await createTestUser('completion-attacker@example.com')
    const cookieA = await loginCookie('completion-victim@example.com')
    const cookieB = await loginCookie('completion-attacker@example.com')

    const bootA = await sync(cookieA, '0')
    const nodeIdA = bootA.body.changes.nodes[0].id
    const sharedId = uuidv7()
    await sync(cookieA, bootA.body.cursor, [], [], [
      makeCompletionDto({ id: sharedId, nodeId: nodeIdA, occurredOn: '2026-08-01' }),
    ])

    const bootB = await sync(cookieB, '0')
    const nodeIdB = bootB.body.changes.nodes[0].id
    const hijack = await sync(cookieB, bootB.body.cursor, [], [], [
      makeCompletionDto({ id: sharedId, nodeId: nodeIdB, occurredOn: '2026-08-02' }),
    ])
    expect(hijack.status).toBe(200)

    const checkA = await sync(cookieA, '0')
    const row = checkA.body.changes.completions.find((c: { id: string }) => c.id === sharedId)
    expect(row.nodeId).toBe(nodeIdA)
    expect(row.occurredOn).toBe('2026-08-01')

    const checkB = await sync(cookieB, '0')
    expect(checkB.body.changes.completions).toEqual([])
  })

  it('a session for one user never authorizes as a different userId', async () => {
    await createTestUser('real1@example.com')
    const cookie = await loginCookie('real1@example.com')
    // Tamper: flip one character in the payload segment of the cookie.
    const [, cookiePair] = /better_session=([^;]+)/.exec(cookie) ?? []
    const tampered = cookiePair!.slice(0, -2) + (cookiePair!.at(-2) === 'a' ? 'b' : 'a') + cookiePair!.slice(-1)
    const res = await app.request('/auth/me', { headers: { cookie: `better_session=${tampered}` } })
    expect(res.status).toBe(401)
  })
})
