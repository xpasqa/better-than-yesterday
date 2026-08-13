// Tool executor — maps tool_call names to service calls.
// docs/feature/35.agent-orchestrator/spec.md §6 (Blok F)
//
// Bug #2 fix: agent writes now flow through applyIncomingNodes/applyIncomingTags
// which stamps seq: nextval('sync_seq'), so /sync picks them up and the UI
// updates without a full reload (was bug #6 in spec §1).
//
// Bug #2 (nodeId null): list_tasks and add_task required ctx.nodeId, but
// the chat agent defaults to global context where nodeId is null. These tools
// now work workspace-wide when nodeId is null — listing all user tasks instead
// of only children of a specific project.
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { node } from '../../db/schema/node.ts'
import { uuidv7 } from '@better/core/id'
import { between } from '@better/core/rank'
import { applyIncomingNodes } from '../sync/apply.ts'
import type { NodeDto } from '../sync/dto.ts'
import {
  listFiles, readFile, writeFile, appendFile, deleteFile,
  updateSessionMemory,
} from './file-service.ts'

interface ToolContext {
  userId: string
  projectId: string
  sessionId: string
  nodeId: string | null // null = global context (chat agent default)
}

/**
 * Side effects a tool produced, reported structurally rather than parsed back
 * out of the human-readable text.
 *
 * The previous shape returned a bare string, so callers recovered ids with
 * `toolResult.split(': ')[1]` and gated on hardcoded tool names — and one of
 * those name lists had drifted (`runner.ts` watched for `create_task` while
 * the tool was named `add_task`), so chat never emitted a single `patch` and
 * the UI never refreshed. Effects are collected at the write site now, where
 * the id is already in hand and cannot drift.
 */
export interface ToolEffects {
  /** Node ids created or modified — drives the `patch` event. */
  nodeIds: string[]
  /** File paths written — drives the `file` event. */
  files: string[]
}

export interface ToolResult {
  text: string
  isError: boolean
  effects: ToolEffects
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const effects: ToolEffects = { nodeIds: [], files: [] }
  const text = await runTool(name, args, ctx, effects)
  return { text, isError: text.startsWith('Error'), effects }
}

async function runTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
  effects: ToolEffects,
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
      effects.files.push(path)
      return `Written: ${path}`
    }
    case 'append_file': {
      const path = args.path as string
      const content = args.content as string
      if (!path?.endsWith('.md')) return 'Error: only .md files are supported'
      await appendFile(ctx.userId, ctx.projectId, path, content)
      effects.files.push(path)
      return `Appended to: ${path}`
    }
    case 'delete_file': {
      const path = args.path as string
      await deleteFile(ctx.projectId, path)
      effects.files.push(path)
      return `Deleted: ${path}`
    }

    // ── Task tools ───────────────────────────────────────────────────────────
    case 'list_tasks': {
      // Bug #2 fix: when nodeId is null, list all workspace tasks (not error)
      const where = ctx.nodeId
        ? and(
            eq(node.userId, ctx.userId),
            eq(node.parentId, ctx.nodeId),
            eq(node.kind, 'item'),
            isNull(node.completedAt),
            isNull(node.deletedAt),
          )
        : and(
            eq(node.userId, ctx.userId),
            eq(node.kind, 'item'),
            isNull(node.completedAt),
            isNull(node.deletedAt),
          )
      const tasks = await db
        .select({ id: node.id, content: node.content, dueDate: node.dueDate, priority: node.priority })
        .from(node)
        .where(where)
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
      const content = args.content as string
      if (!content) return 'Error: content is required'
      const now = new Date()
      const id = uuidv7()
      const parentId = ctx.nodeId ?? null

      // Place at end by using max rank among siblings
      const existing = parentId
        ? await db
            .select({ rank: node.rank })
            .from(node)
            .where(and(eq(node.parentId, parentId), eq(node.userId, ctx.userId)))
            .orderBy(node.rank)
        : await db
            .select({ rank: node.rank })
            .from(node)
            .where(and(eq(node.userId, ctx.userId), isNull(node.parentId), eq(node.kind, 'item')))
            .orderBy(node.rank)
      const lastRank = existing[existing.length - 1]?.rank ?? null

      // Use applyIncomingNodes so seq is stamped and /sync sees this write
      const dto: NodeDto = {
        id,
        parentId,
        kind: 'item',
        rank: between(lastRank, null),
        content,
        note: (args.note as string | undefined) ?? null,
        linkedTaskId: null,
        dueDate: (args.dueDate as string | undefined) ?? null,
        dueTime: null,
        durationMin: null,
        recurrence: null,
        priority: (args.priority as 1 | 2 | 3 | undefined) ?? null,
        tagIds: [],
        color: null,
        isFavorite: false,
        isInbox: false,
        isSomeday: false,
        collapsed: false,
        completedAt: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        deletedAt: null,
      }
      await applyIncomingNodes(ctx.userId, [dto])
      effects.nodeIds.push(id)
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

      const dto: NodeDto = {
        id,
        parentId,
        kind: 'item',
        rank: between(lastRank, null),
        content,
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
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        deletedAt: null,
      }
      await applyIncomingNodes(ctx.userId, [dto])
      effects.nodeIds.push(id)
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

      const now = new Date()
      // Build updated DTO from existing row, applying the patches
      const dto: NodeDto = {
        id: task.id,
        parentId: task.parentId,
        kind: task.kind,
        rank: task.rank,
        content: (args.content as string | undefined) ?? task.content,
        note: (args.note as string | undefined) ?? task.note,
        linkedTaskId: task.linkedTaskId,
        dueDate: (args.dueDate as string | undefined) ?? task.dueDate,
        dueTime: task.dueTime ? task.dueTime.slice(0, 5) : null,
        durationMin: task.durationMin,
        recurrence: task.recurrence,
        priority: args.priority !== undefined
          ? (args.priority as 1 | 2 | 3 | null)
          : (task.priority as 1 | 2 | 3 | null),
        tagIds: task.tagIds,
        color: task.color,
        isFavorite: task.isFavorite,
        isInbox: task.isInbox,
        isSomeday: task.isSomeday,
        collapsed: task.collapsed,
        completedAt: args.completedAt !== undefined
          ? (args.completedAt ? new Date(args.completedAt as string).toISOString() : null)
          : (task.completedAt?.toISOString() ?? null),
        createdAt: task.createdAt.toISOString(),
        updatedAt: now.toISOString(),
        deletedAt: task.deletedAt?.toISOString() ?? null,
      }
      await applyIncomingNodes(ctx.userId, [dto])
      effects.nodeIds.push(id)
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
