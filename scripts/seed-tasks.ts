// Seed sample tasks, labels, and projects for a given user.
// Idempotent: skips rows that already exist (matched by content + userId for tasks,
// name for labels, content for projects).
//
// Usage:
//   npm run seed -- pasqa@xvntr.my.id
//
import '@better/api/load-env'
import { eq, and, isNull } from 'drizzle-orm'
import { uuidv7 } from '@better/core/id'
import { between } from '@better/core/rank'
import { db } from '@better/api/db/client'
import { appUser } from '@better/api/db/schema/user'
import { node } from '@better/api/db/schema/node'
// Import label directly from source since it's not exported from @better/api
import { label } from '../apps/api/src/db/schema/label.ts'

const EMAIL = process.argv[2] ?? 'pasqa@xvntr.my.id'

const TODAY = new Date().toISOString().split('T')[0]
const TOMORROW = new Date(Date.now() + 86400000).toISOString().split('T')[0]
const YESTERDAY = new Date(Date.now() - 86400000).toISOString().split('T')[0]

async function main() {
  // 1. Find user
  const [user] = await db.select().from(appUser).where(eq(appUser.email, EMAIL)).limit(1)
  if (!user) {
    console.error(`No user found with email: ${EMAIL}`)
    process.exit(1)
  }
  console.log(`Seeding data for ${user.email} (${user.id})`)

  // 2. Get existing nodes/labels
  const existingNodes = await db.select().from(node).where(and(eq(node.userId, user.id), isNull(node.deletedAt)))
  const existingLabels = await db.select().from(label).where(and(eq(label.userId, user.id), isNull(label.deletedAt)))

  const inboxNode = existingNodes.find(n => n.isInbox)
  if (!inboxNode) {
    console.error('No inbox found for user. Run: npm run user -- add')
    process.exit(1)
  }

  // Helper: find or insert project
  async function findOrCreateProject(content: string, color: string): Promise<string> {
    const existing = existingNodes.find(n => n.kind === 'project' && n.content === content && !n.isInbox)
    if (existing) { console.log(`  project exists: ${content}`); return existing.id }
    const roots = existingNodes.filter(n => n.parentId === null)
    const lastRank = roots.length > 0 ? roots.reduce((a, b) => (a.rank > b.rank ? a : b)).rank : null
    const now = new Date()
    const id = uuidv7()
    await db.insert(node).values({
      id, userId: user.id, parentId: null, kind: 'project',
      rank: between(lastRank, null), content, color,
      isInbox: false, isFavorite: false, collapsed: false,
      createdAt: now, updatedAt: now,
    })
    existingNodes.push({ id, userId: user.id, parentId: null, kind: 'project', rank: between(lastRank, null), content, color, isInbox: false, isFavorite: false, collapsed: false, createdAt: now, updatedAt: now, deletedAt: null, note: null, dueDate: null, dueTime: null, durationMin: null, recurrence: null, priority: null, labelIds: [], completedAt: null, seq: 0n })
    console.log(`  created project: ${content}`)
    return id
  }

  // Helper: find or insert label
  async function findOrCreateLabel(name: string, color: string): Promise<string> {
    const existing = existingLabels.find(l => l.name === name)
    if (existing) { console.log(`  label exists: ${name}`); return existing.id }
    const lastRank = existingLabels.length > 0 ? existingLabels.reduce((a, b) => (a.rank > b.rank ? a : b)).rank : null
    const now = new Date()
    const id = uuidv7()
    await db.insert(label).values({
      id, userId: user.id, name, color, isFavorite: false,
      rank: between(lastRank, null), createdAt: now, updatedAt: now,
    })
    existingLabels.push({ id, userId: user.id, name, color, isFavorite: false, rank: between(lastRank, null), createdAt: now, updatedAt: now, deletedAt: null, seq: 0n })
    console.log(`  created label: ${name}`)
    return id
  }

  // Helper: insert task if not exists
  async function findOrCreateTask(opts: {
    content: string
    parentId: string
    priority?: 1 | 2 | 3 | null
    dueDate?: string | null
    labelIds?: string[]
    note?: string | null
  }) {
    const existing = existingNodes.find(n => n.kind === 'item' && n.content === opts.content && n.parentId === opts.parentId)
    if (existing) { console.log(`  task exists: ${opts.content}`); return }
    const siblings = existingNodes.filter(n => n.parentId === opts.parentId)
    const lastRank = siblings.length > 0 ? siblings.reduce((a, b) => (a.rank > b.rank ? a : b)).rank : null
    const now = new Date()
    const id = uuidv7()
    await db.insert(node).values({
      id, userId: user.id, parentId: opts.parentId, kind: 'item',
      rank: between(lastRank, null), content: opts.content,
      note: opts.note ?? null,
      priority: opts.priority ?? null,
      dueDate: opts.dueDate ?? null,
      labelIds: opts.labelIds ?? [],
      isInbox: false, isFavorite: false, collapsed: false,
      createdAt: now, updatedAt: now,
    })
    existingNodes.push({ id, userId: user.id, parentId: opts.parentId, kind: 'item', rank: between(lastRank, null), content: opts.content, note: opts.note ?? null, priority: opts.priority ?? null, dueDate: opts.dueDate ?? null, dueTime: null, durationMin: null, recurrence: null, labelIds: opts.labelIds ?? [], color: null, isInbox: false, isFavorite: false, collapsed: false, completedAt: null, createdAt: now, updatedAt: now, deletedAt: null, seq: 0n })
    console.log(`  created task: ${opts.content}`)
  }

  // 3. Create projects
  console.log('\n--- Projects ---')
  const workId = await findOrCreateProject('Work', '#dc4c3e')
  const personalId = await findOrCreateProject('Personal', '#058527')
  const shoppingId = await findOrCreateProject('Shopping', '#eb8909')
  const healthId = await findOrCreateProject('Health & Fitness', '#692ec2')

  // 4. Create labels
  console.log('\n--- Labels ---')
  const emailLabelId = await findOrCreateLabel('email', '#246fe0')
  const callLabelId = await findOrCreateLabel('call', '#eb8909')
  const importantLabelId = await findOrCreateLabel('important', '#dc4c3e')
  await findOrCreateLabel('waiting', '#999999')

  // 5. Create tasks
  console.log('\n--- Tasks ---')

  // Work tasks
  await findOrCreateTask({
    content: 'Review quarterly report and prepare summary',
    parentId: workId,
    priority: 1,
    dueDate: TODAY,
    labelIds: [importantLabelId],
    note: 'Go through Q3 numbers and create executive summary for team meeting',
  })
  await findOrCreateTask({
    content: 'Reply to client emails',
    parentId: workId,
    priority: 2,
    dueDate: TODAY,
    labelIds: [emailLabelId],
  })
  await findOrCreateTask({
    content: 'Prepare presentation for next sprint',
    parentId: workId,
    priority: 2,
    dueDate: TOMORROW,
  })
  await findOrCreateTask({
    content: 'Update project documentation',
    parentId: workId,
    priority: 3,
    dueDate: TOMORROW,
  })

  // Personal tasks
  await findOrCreateTask({
    content: 'Call dentist to schedule appointment',
    parentId: personalId,
    priority: 2,
    dueDate: TODAY,
    labelIds: [callLabelId],
  })
  await findOrCreateTask({
    content: 'Pay monthly bills',
    parentId: personalId,
    priority: 1,
    dueDate: YESTERDAY,
    labelIds: [importantLabelId],
  })

  // Shopping tasks
  await findOrCreateTask({
    content: 'Buy groceries for the week',
    parentId: shoppingId,
    priority: 3,
    dueDate: TODAY,
    note: 'Milk, eggs, bread, vegetables, fruits',
  })
  await findOrCreateTask({
    content: 'Order new desk lamp',
    parentId: shoppingId,
    priority: null,
  })

  // Health tasks
  await findOrCreateTask({
    content: 'Morning run - 5km',
    parentId: healthId,
    priority: null,
    dueDate: TODAY,
  })
  await findOrCreateTask({
    content: 'Schedule annual health checkup',
    parentId: healthId,
    priority: 2,
    dueDate: TOMORROW,
    labelIds: [callLabelId],
  })

  // Inbox tasks
  await findOrCreateTask({
    content: 'Read new book on productivity',
    parentId: inboxNode.id,
    priority: null,
  })

  console.log('\nSeed complete.')
  process.exit(0)
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
