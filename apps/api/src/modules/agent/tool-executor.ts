// Tool executor — maps tool_call names to service calls.
// docs/feature/2.backend/3.agent/spec.md §6
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { node } from '../../db/schema/node.ts'
import { uuidv7 } from '@better/core/id'
import { between } from '@better/core/rank'
import {
  listFiles, readFile, writeFile, appendFile, deleteFile,
  updateSessionMemory,
} from './file-service.ts'

interface ToolContext {
  userId: string
  projectId: string
  sessionId: string
  nodeId: string | null // for task tools
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<string> {
  switch (name) {
    // ── File tools ──────────────────────────────────────────────────────────
    case 'list_files': {
      const files = await listFiles(ctx.projectId)
      if (files.length === 0) return 'No files yet.'
      return files.map(f => `- ${f.path}`).join('\n')
    }
    case 'read_file': {
      const path = args.path as string
      if (!path?.endsWith('.md')) return 'Error: only .md files are supported'
      const content = await readFile(ctx.projectId, path)
      if (content === null) return `Error: file not found: ${path}`
      return content
    }
    case 'write_file': {
      const path = args.path as string
      const content = args.content as string
      if (!path?.endsWith('.md')) return 'Error: only .md files are supported'
      if (typeof content !== 'string') return 'Error: content must be a string'
      await writeFile(ctx.userId, ctx.projectId, path, content)
      return `Written: ${path}`
    }
    case 'append_file': {
      const path = args.path as string
      const content = args.content as string
      if (!path?.endsWith('.md')) return 'Error: only .md files are supported'
      await appendFile(ctx.userId, ctx.projectId, path, content)
      return `Appended to: ${path}`
    }
    case 'delete_file': {
      const path = args.path as string
      await deleteFile(ctx.projectId, path)
      return `Deleted: ${path}`
    }

    // ── Task tools ───────────────────────────────────────────────────────────
    case 'list_tasks': {
      if (!ctx.nodeId) return 'Error: no project context for task tools'
      const tasks = await db
        .select({ id: node.id, content: node.content, dueDate: node.dueDate, priority: node.priority })
        .from(node)
        .where(
          and(
            eq(node.userId, ctx.userId),
            eq(node.parentId, ctx.nodeId),
            eq(node.kind, 'item'),
            isNull(node.completedAt),
            isNull(node.deletedAt),
          ),
        )
        .orderBy(node.rank)
        .limit(50)
      if (tasks.length === 0) return 'No open tasks.'
      return tasks
        .map(t => `- [${t.id}] ${t.content}${t.dueDate ? ` (due: ${t.dueDate})` : ''}${t.priority ? ` p${t.priority}` : ''}`)
        .join('\n')
    }
    case 'get_task': {
      const id = args.id as string
      const [task] = await db
        .select()
        .from(node)
        .where(and(eq(node.id, id), eq(node.userId, ctx.userId)))
        .limit(1)
      if (!task) return `Error: task not found: ${id}`
      const subtasks = await db
        .select({ id: node.id, content: node.content, completedAt: node.completedAt })
        .from(node)
        .where(and(eq(node.parentId, id), eq(node.userId, ctx.userId), isNull(node.deletedAt)))
        .orderBy(node.rank)
      const subtaskLines = subtasks.map(s => `  - [${s.id}] ${s.content}${s.completedAt ? ' ✓' : ''}`).join('\n')
      return [
        `id: ${task.id}`,
        `content: ${task.content}`,
        `note: ${task.note ?? '—'}`,
        `due: ${task.dueDate ?? '—'}`,
        `priority: ${task.priority ?? '—'}`,
        `completed: ${task.completedAt ?? '—'}`,
        subtasks.length > 0 ? `subtasks:\n${subtaskLines}` : 'subtasks: none',
      ].join('\n')
    }
    case 'add_task': {
      if (!ctx.nodeId) return 'Error: no project context for task tools'
      const content = args.content as string
      if (!content) return 'Error: content is required'
      const now = new Date()
      const id = uuidv7()
      // Place at end of project by using max rank
      const existing = await db
        .select({ rank: node.rank })
        .from(node)
        .where(and(eq(node.parentId, ctx.nodeId), eq(node.userId, ctx.userId)))
        .orderBy(node.rank)
      const lastRank = existing[existing.length - 1]?.rank ?? null
      await db.insert(node).values({
        id,
        userId: ctx.userId,
        parentId: ctx.nodeId,
        kind: 'item',
        rank: between(lastRank, null),
        content,
        note: (args.note as string | undefined) ?? null,
        dueDate: (args.dueDate as string | undefined) ?? null,
        priority: (args.priority as number | undefined) ?? null,
        createdAt: now,
        updatedAt: now,
      })
      return `Task created: ${id}`
    }
    case 'add_subtask': {
      const parentId = args.parentId as string
      const content = args.content as string
      if (!parentId || !content) return 'Error: parentId and content are required'
      const [parent] = await db
        .select({ id: node.id })
        .from(node)
        .where(and(eq(node.id, parentId), eq(node.userId, ctx.userId)))
        .limit(1)
      if (!parent) return `Error: parent task not found: ${parentId}`
      const now = new Date()
      const id = uuidv7()
      const existing = await db
        .select({ rank: node.rank })
        .from(node)
        .where(and(eq(node.parentId, parentId), eq(node.userId, ctx.userId)))
        .orderBy(node.rank)
      const lastRank = existing[existing.length - 1]?.rank ?? null
      await db.insert(node).values({
        id,
        userId: ctx.userId,
        parentId,
        kind: 'item',
        rank: between(lastRank, null),
        content,
        createdAt: now,
        updatedAt: now,
      })
      return `Subtask created: ${id}`
    }
    case 'update_task': {
      const id = args.id as string
      if (!id) return 'Error: id is required'
      const [task] = await db
        .select()
        .from(node)
        .where(and(eq(node.id, id), eq(node.userId, ctx.userId)))
        .limit(1)
      if (!task) return `Error: task not found: ${id}`
      const updates: Record<string, unknown> = { updatedAt: new Date() }
      if (args.content !== undefined) updates.content = args.content
      if (args.note !== undefined) updates.note = args.note
      if (args.dueDate !== undefined) updates.dueDate = args.dueDate
      if (args.priority !== undefined) updates.priority = args.priority
      if (args.completedAt !== undefined) updates.completedAt = args.completedAt ? new Date(args.completedAt as string) : null
      await db.update(node).set(updates).where(eq(node.id, id))
      return `Task updated: ${id}`
    }

    // ── Memory tool ──────────────────────────────────────────────────────────
    case 'compact_memory': {
      const content = args.content as string
      if (!content) return 'Error: content is required'
      await updateSessionMemory(ctx.sessionId, content)
      return 'SESSION.md updated.'
    }

    default:
      return `Error: unknown tool: ${name}`
  }
}
