import { sql } from 'drizzle-orm'
import { uuidv7 } from '@better/core/id'
import { between } from '@better/core/rank'
import { db } from '../src/db/client.ts'
import { appUser } from '../src/db/schema/user.ts'
import { node } from '../src/db/schema/node.ts'
import { hashPassword } from '../src/modules/auth/password.ts'

/** Wipes every table between tests — cheap at this size, and avoids any cross-test bleed. */
export async function resetDb(): Promise<void> {
  await db.execute(
    sql`truncate table mail_account, finance_transaction, finance_account, finance_category, storage_file, storage_folder, storage_area, agent_file, agent_session, agent_project, ai_settings, completion, tag, node, notification, push_subscription, reminder, app_user restart identity cascade`,
  )
}

/**
 * Creates a user with a seeded Inbox, mirroring what `scripts/user.ts add`
 * does — including lowercasing the email, since the login route queries by
 * a lowercased email and storing it verbatim here would silently produce a
 * user that can never log in whenever a test passes a mixed-case address.
 */
export async function createTestUser(email: string, password = 'testpassword123') {
  const normalizedEmail = email.toLowerCase()
  const passwordHash = await hashPassword(password)
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(appUser)
      .values({ id: uuidv7(), email: normalizedEmail, name: 'Test', passwordHash })
      .returning()
    if (!user) throw new Error('insert returned no row')
    const now = new Date()
    await tx.insert(node).values({
      id: uuidv7(),
      userId: user.id,
      parentId: null,
      kind: 'project',
      rank: between(null, null),
      content: 'Inbox',
      isInbox: true,
      createdAt: now,
      updatedAt: now,
    })
    return user
  })
}

/** Extracts the session cookie's value from a Set-Cookie header, for reuse on the next request. */
export function extractSessionCookie(response: Response): string {
  const setCookie = response.headers.get('set-cookie')
  if (!setCookie) throw new Error('No Set-Cookie header on response')
  const match = /better_session=([^;]+)/.exec(setCookie)
  if (!match) throw new Error(`No better_session cookie in: ${setCookie}`)
  return `better_session=${match[1]}`
}

// Test-only escape hatch: response bodies here are dynamic JSON asserted on
// by shape, not run through the real DTO types the app itself uses — one
// named cast point instead of every call site repeating its own.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TestJson = any

export async function readJson(res: Response): Promise<TestJson> {
  return res.json() as Promise<TestJson>
}

export function makeNodeDto(overrides: Record<string, unknown> & { id: string }) {
  const now = new Date().toISOString()
  return {
    parentId: null,
    kind: 'item',
    rank: 'a0',
    content: 'untitled',
    note: null,
    linkedTaskId: null,
    dueDate: null,
    dueTime: null,
    durationMin: null,
    recurrence: null,
    priority: null,
    tagIds: [],
    color: null,
    isFavorite: false,
    isInbox: false,
    isSomeday: false,
    collapsed: false,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  }
}

export function makeTagDto(overrides: Record<string, unknown> & { id: string }) {
  const now = new Date().toISOString()
  return {
    name: 'untitled',
    color: 'grey',
    isFavorite: false,
    rank: 'a0',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  }
}

export function makeCompletionDto(overrides: Record<string, unknown> & { id: string; nodeId: string }) {
  return {
    completedAt: new Date().toISOString(),
    occurredOn: null,
    ...overrides,
  }
}
