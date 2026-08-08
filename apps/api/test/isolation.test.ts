// The most important test in this repository (infra spec §8): every phase
// that adds a table must add its own case here. Covers `node`, `tag`, and
// `completion` via /api/sync, the three synced entities wired up so far.
import { beforeEach, describe, expect, it } from 'vitest'
import { uuidv7 } from '@better/core/id'
import { createApp } from '../src/app.ts'
import { resetDb, createTestUser, extractSessionCookie, makeNodeDto, makeTagDto, makeCompletionDto, readJson } from './helpers.ts'

const app = createApp()

async function loginCookie(email: string, password = 'testpassword123'): Promise<string> {
  const res = await app.request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return extractSessionCookie(res)
}

async function sync(cookie: string, cursor: string, nodes: unknown[] = [], tags: unknown[] = [], completions: unknown[] = []) {
  const res = await app.request('/api/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ cursor, changes: { nodes, tags, completions } }),
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
    // B only ever sees their own seeded Inbox, nothing from A
    expect(bootB.body.changes.nodes).toHaveLength(1)
  })

  it("user B cannot overwrite user A's node even if the id is known", async () => {
    await createTestUser('nodeIsoA@example.com')
    await createTestUser('nodeIsoB@example.com')
    const cookieA = await loginCookie('nodeIsoA@example.com')
    const cookieB = await loginCookie('nodeIsoB@example.com')

    const bootA = await sync(cookieA, '0')
    const nodeIdA = bootA.body.changes.nodes[0].id
    const bootB = await sync(cookieB, '0')

    // B tries to overwrite A's node
    await sync(cookieB, bootB.body.cursor, [
      makeNodeDto({ id: nodeIdA, content: "B's overwrite attempt" }),
    ])

    const checkA = await sync(cookieA, '0')
    const nodeA = checkA.body.changes.nodes.find((n: { id: string }) => n.id === nodeIdA)
    expect(nodeA?.content).toBe('Inbox') // unchanged
  })

  it("user B's tags are never visible to user A", async () => {
    await createTestUser('tagIsoA@example.com')
    await createTestUser('tagIsoB@example.com')
    const cookieA = await loginCookie('tagIsoA@example.com')
    const cookieB = await loginCookie('tagIsoB@example.com')

    const bootB = await sync(cookieB, '0')
    const tagId = uuidv7()
    await sync(cookieB, bootB.body.cursor, [], [makeTagDto({ id: tagId, name: 'private-tag' })])

    const checkA = await sync(cookieA, '0')
    const found = checkA.body.changes.tags.find((t: { id: string }) => t.id === tagId)
    expect(found).toBeUndefined()
  })

  it("user B cannot overwrite user A's tag even if the id is known", async () => {
    await createTestUser('tagOverA@example.com')
    await createTestUser('tagOverB@example.com')
    const cookieA = await loginCookie('tagOverA@example.com')
    const cookieB = await loginCookie('tagOverB@example.com')

    const bootA = await sync(cookieA, '0')
    const tagId = uuidv7()
    await sync(cookieA, bootA.body.cursor, [], [makeTagDto({ id: tagId, name: 'original' })])

    const bootB = await sync(cookieB, '0')
    await sync(cookieB, bootB.body.cursor, [], [
      makeTagDto({ id: tagId, name: 'overwritten', updatedAt: new Date(Date.now() + 10000).toISOString() }),
    ])

    const checkA = await sync(cookieA, '0')
    const tag = checkA.body.changes.tags.find((t: { id: string }) => t.id === tagId)
    expect(tag?.name).toBe('original') // unchanged
  })

  it("user B's completions are never visible to user A", async () => {
    await createTestUser('compIsoA@example.com')
    await createTestUser('compIsoB@example.com')
    const cookieA = await loginCookie('compIsoA@example.com')
    const cookieB = await loginCookie('compIsoB@example.com')

    const bootB = await sync(cookieB, '0')
    const nodeIdB = bootB.body.changes.nodes[0].id
    const completionId = uuidv7()
    await sync(cookieB, bootB.body.cursor, [], [], [makeCompletionDto({ id: completionId, nodeId: nodeIdB })])

    const checkA = await sync(cookieA, '0')
    const found = checkA.body.changes.completions.find((c: { id: string }) => c.id === completionId)
    expect(found).toBeUndefined()
  })

  it('user B cannot inject a completion for a node owned by user A', async () => {
    await createTestUser('compInjectA@example.com')
    await createTestUser('compInjectB@example.com')
    const cookieA = await loginCookie('compInjectA@example.com')
    const cookieB = await loginCookie('compInjectB@example.com')

    const bootA = await sync(cookieA, '0')
    const nodeIdA = bootA.body.changes.nodes[0].id
    const bootB = await sync(cookieB, '0')

    const foreignId = uuidv7()
    const attempt = await sync(cookieB, bootB.body.cursor, [], [], [
      makeCompletionDto({ id: foreignId, nodeId: nodeIdA, occurredOn: '2026-08-03' }),
    ])
    expect(attempt.status).toBe(200)

    const checkB = await sync(cookieB, '0')
    expect(checkB.body.changes.completions.find((c: { id: string }) => c.id === foreignId)).toBeUndefined()

    const checkA = await sync(cookieA, '0')
    expect(checkA.body.changes.completions.find((c: { id: string }) => c.id === foreignId)).toBeUndefined()
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
