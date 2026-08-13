// Agent file service — CRUD for agent_project, agent_file, agent_session.
// docs/feature/2.backend/3.agent/spec.md §4, §5
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { agentProject } from '../../db/schema/agent-project.ts'
import { agentFile } from '../../db/schema/agent-file.ts'
import { agentSession } from '../../db/schema/agent-session.ts'
import { uuidv7 } from '@better/core/id'

const MEMORY_LIMIT = {
  global: 4000,
  project: 8000,
  session: 8000,
} as const

// ── Project / memory ─────────────────────────────────────────────────────────

export async function getOrCreateGlobalProject(userId: string) {
  const [existing] = await db
    .select()
    .from(agentProject)
    .where(and(eq(agentProject.userId, userId), eq(agentProject.kind, 'global')))
    .limit(1)
  if (existing) return existing
  const now = new Date()
  const [created] = await db
    .insert(agentProject)
    .values({ id: uuidv7(), userId, nodeId: null, kind: 'global', memory: '', createdAt: now, updatedAt: now })
    .returning()
  return created!
}

export async function getOrCreateProjectMemory(userId: string, nodeId: string) {
  const [existing] = await db
    .select()
    .from(agentProject)
    .where(and(eq(agentProject.userId, userId), eq(agentProject.nodeId, nodeId)))
    .limit(1)
  if (existing) return existing
  const now = new Date()
  const [created] = await db
    .insert(agentProject)
    .values({ id: uuidv7(), userId, nodeId, kind: 'project', memory: '', createdAt: now, updatedAt: now })
    .returning()
  return created!
}

export async function updateMemory(projectId: string, kind: 'global' | 'project', content: string): Promise<void> {
  const limit = MEMORY_LIMIT[kind]
  if (content.length > limit) {
    throw new Error(`Memory exceeds ${limit} character limit — compact it first`)
  }
  await db
    .update(agentProject)
    .set({ memory: content, updatedAt: new Date() })
    .where(eq(agentProject.id, projectId))
}

// ── Session ───────────────────────────────────────────────────────────────────

export async function getOrCreateSession(userId: string, projectId: string) {
  // Find the most recent open session for this project
  const [existing] = await db
    .select()
    .from(agentSession)
    .where(
      and(eq(agentSession.userId, userId), eq(agentSession.projectId, projectId), isNull(agentSession.closedAt)),
    )
    .limit(1)
  if (existing) return existing
  const now = new Date()
  const [created] = await db
    .insert(agentSession)
    .values({ id: uuidv7(), userId, projectId, memory: '', history: '[]', createdAt: now, updatedAt: now })
    .returning()
  return created!
}

export async function updateSessionMemory(sessionId: string, content: string): Promise<void> {
  if (content.length > MEMORY_LIMIT.session) {
    throw new Error(`Session memory exceeds ${MEMORY_LIMIT.session} character limit — compact it first`)
  }
  await db
    .update(agentSession)
    .set({ memory: content, updatedAt: new Date() })
    .where(eq(agentSession.id, sessionId))
}

export async function appendSessionHistory(sessionId: string, messages: unknown[]): Promise<void> {
  const [row] = await db
    .select({ history: agentSession.history })
    .from(agentSession)
    .where(eq(agentSession.id, sessionId))
    .limit(1)
  if (!row) return
  const existing = JSON.parse(row.history) as unknown[]
  const next = [...existing, ...messages]
  await db
    .update(agentSession)
    .set({ history: JSON.stringify(next), updatedAt: new Date() })
    .where(eq(agentSession.id, sessionId))
}

export async function getSessionHistory(sessionId: string): Promise<unknown[]> {
  const [row] = await db
    .select({ history: agentSession.history })
    .from(agentSession)
    .where(eq(agentSession.id, sessionId))
    .limit(1)
  if (!row) return []
  return JSON.parse(row.history) as unknown[]
}

export async function closeSession(sessionId: string): Promise<void> {
  await db
    .update(agentSession)
    .set({ closedAt: new Date(), updatedAt: new Date() })
    .where(eq(agentSession.id, sessionId))
}

// ── Files ─────────────────────────────────────────────────────────────────────

export interface AgentFileRow {
  id: string
  path: string
  content: string
  createdAt: Date
  updatedAt: Date
}

export async function listFiles(projectId: string): Promise<AgentFileRow[]> {
  return db
    .select({
      id: agentFile.id,
      path: agentFile.path,
      content: agentFile.content,
      createdAt: agentFile.createdAt,
      updatedAt: agentFile.updatedAt,
    })
    .from(agentFile)
    .where(and(eq(agentFile.projectId, projectId), isNull(agentFile.deletedAt)))
    .orderBy(agentFile.createdAt)
}

export async function readFile(projectId: string, path: string): Promise<string | null> {
  const [row] = await db
    .select({ content: agentFile.content })
    .from(agentFile)
    .where(and(eq(agentFile.projectId, projectId), eq(agentFile.path, path), isNull(agentFile.deletedAt)))
    .limit(1)
  return row?.content ?? null
}

/**
 * Upsert by (project, path).
 *
 * Deliberately a read-then-write rather than ON CONFLICT: migration 0011
 * replaced the flat `(project_id, path)` unique index with three *partial*
 * scope-aware ones, and `ON CONFLICT (project_id, path)` matches none of them —
 * it fails with "no unique or exclusion constraint matching". That stayed
 * invisible for as long as the migration was unregistered and never ran; the
 * moment it did, every write_file would have failed.
 *
 * Blok G reworks these signatures around `scope`; until then this keeps the
 * behaviour correct under either index layout.
 */
export async function writeFile(userId: string, projectId: string, path: string, content: string): Promise<void> {
  const now = new Date()
  const [existing] = await db
    .select({ id: agentFile.id })
    .from(agentFile)
    .where(and(eq(agentFile.projectId, projectId), eq(agentFile.path, path)))
    .limit(1)

  if (existing) {
    await db
      .update(agentFile)
      .set({ content, updatedAt: now, deletedAt: null })
      .where(eq(agentFile.id, existing.id))
    return
  }

  await db
    .insert(agentFile)
    .values({ id: uuidv7(), userId, projectId, path, content, createdAt: now, updatedAt: now })
}

export async function appendFile(userId: string, projectId: string, path: string, content: string): Promise<void> {
  const existing = await readFile(projectId, path)
  const next = existing !== null ? existing + '\n' + content : content
  await writeFile(userId, projectId, path, next)
}

export async function deleteFile(projectId: string, path: string): Promise<void> {
  await db
    .update(agentFile)
    .set({ deletedAt: new Date() })
    .where(and(eq(agentFile.projectId, projectId), eq(agentFile.path, path)))
}
