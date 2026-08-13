// Tool executor — maps tool_call names to writes through the same door as /sync.
// docs/feature/35.agent-orchestrator/spec.md §7 (Blok F)
//
// Two rules govern this file:
//
//   No direct db.insert/db.update on node, tag, completion or reminder. Every
//   write builds a DTO and goes through applyIncoming* — the same functions
//   /sync uses. That is what stamps seq: nextval('sync_seq'); skipping it was
//   bug #6, and the symptom was agent edits that never reached the UI.
//
//   No re-implementing rules that live in packages/core. "Today" comes from
//   views.ts, quick-add syntax from parse.ts, ordering from rank.ts and
//   tree.ts, repeats from recurrence.ts. An agent that disagrees with the UI
//   about what "today" means is worse than one that cannot answer.
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { tag } from '../../db/schema/tag.ts'
import { reminder } from '../../db/schema/reminder.ts'
import { uuidv7 } from '@better/core/id'
import { between } from '@better/core/rank'
import { move as treeMove } from '@better/core/tree'
import { parse } from '@better/core/parse'
import { search } from '@better/core/search'
import { nextOccurrence } from '@better/core/recurrence'
import * as views from '@better/core/views'
import type { Node } from '@better/core/node'
import { applyIncomingNodes, applyIncomingTags, applyIncomingCompletions, applyIncomingReminders } from '../sync/apply.ts'
import type { NodeDto, TagDto } from '../sync/dto.ts'
import { loadNodes } from '../todo/dto.ts'
import {
  listFiles, readFile, writeFile, appendFile, deleteFile,
  updateSessionMemory,
} from './file-service.ts'
import { renderWorkspaceMap } from './context-layers.ts'

interface ToolContext {
  userId: string
  projectId: string
  sessionId: string
  nodeId: string | null // null = global context (chat agent default)
  timezone?: string
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
  /** Rows as they were before the write, so the turn can be undone (§7.4). */
  undo: UndoEntry[]
}

export type UndoEntry =
  | { kind: 'node'; before: NodeDto | null; id: string }
  | { kind: 'file'; path: string; before: string | null }

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
  const effects: ToolEffects = { nodeIds: [], files: [], undo: [] }
  try {
    const text = await runTool(name, args, ctx, effects)
    return { text, isError: text.startsWith('Error'), effects }
  } catch (err) {
    // Tool failures go back to the model so it can explain or retry (§11);
    // the full error is the server's problem, not the model's.
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[agent] tool ${name} failed:`, err)
    return { text: `Error: ${msg}`, isError: true, effects }
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined)
const int = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

/** core Node → the DTO shape applyIncomingNodes expects. */
function nodeToDto(n: Node): NodeDto {
  return {
    id: n.id, parentId: n.parentId, kind: n.kind, rank: n.rank,
    content: n.content, note: n.note, linkedTaskId: n.linkedTaskId,
    dueDate: n.dueDate, dueTime: n.dueTime, durationMin: n.durationMin,
    recurrence: n.recurrence, priority: n.priority, tagIds: n.tagIds,
    color: n.color, isFavorite: n.isFavorite, isInbox: n.isInbox,
    isSomeday: n.isSomeday, collapsed: n.collapsed,
    completedAt: n.completedAt, createdAt: n.createdAt,
    updatedAt: n.updatedAt, deletedAt: n.deletedAt,
  }
}

/** Every node write funnels through here so seq, undo and patch stay in step. */
async function writeNode(userId: string, dto: NodeDto, before: Node | null, effects: ToolEffects): Promise<void> {
  await applyIncomingNodes(userId, [dto])
  effects.nodeIds.push(dto.id)
  effects.undo.push({ kind: 'node', id: dto.id, before: before ? nodeToDto(before) : null })
}

function find(nodes: Node[], id: string): Node | undefined {
  return nodes.find(n => n.id === id)
}

function lastRankUnder(nodes: Node[], parentId: string | null): string {
  const siblings = nodes.filter(n => n.parentId === parentId).sort((a, b) => (a.rank < b.rank ? -1 : 1))
  return between(siblings.at(-1)?.rank ?? null, null)
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function renderTask(t: Node): string {
  const bits: string[] = []
  if (t.dueDate) bits.push(`due ${t.dueDate}${t.dueTime ? ` ${t.dueTime}` : ''}`)
  if (t.durationMin) bits.push(`${t.durationMin}m`)
  if (t.priority) bits.push(`p${t.priority}`)
  if (t.recurrence) bits.push(`repeats: ${t.recurrence}`)
  if (t.completedAt) bits.push('done')
  return `- [${t.id}] ${t.content}${bits.length ? `  (${bits.join(', ')})` : ''}`
}

function renderList(rows: Node[], limit: number): string {
  if (rows.length === 0) return 'Tidak ada task yang cocok.'
  const shown = rows.slice(0, limit)
  const out = shown.map(renderTask)
  if (rows.length > shown.length) out.push(`… dan ${rows.length - shown.length} lagi`)
  return out.join('\n')
}

/** Resolve tag names to ids, creating any that do not exist yet. */
async function resolveTags(userId: string, names: string[]): Promise<string[]> {
  if (names.length === 0) return []
  const existing = await db.select().from(tag).where(and(eq(tag.userId, userId), isNull(tag.deletedAt)))
  const byName = new Map(existing.map(t => [t.name.toLowerCase(), t.id]))
  const ids: string[] = []
  const created: TagDto[] = []
  const now = new Date().toISOString()

  for (const raw of names) {
    const name = raw.replace(/^@/, '')
    const hit = byName.get(name.toLowerCase())
    if (hit) { ids.push(hit); continue }
    const id = uuidv7()
    created.push({
      id, name, color: 'grey', isFavorite: false,
      rank: between(null, null), createdAt: now, updatedAt: now, deletedAt: null,
    })
    byName.set(name.toLowerCase(), id)
    ids.push(id)
  }
  if (created.length > 0) await applyIncomingTags(userId, created)
  return ids
}

// ── executor ──────────────────────────────────────────────────────────────────

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
      if (files.length === 0) return 'Belum ada dokumen.'
      return files.map(f => `- ${f.path}  (${(f.content.length / 1024).toFixed(1)} KB)`).join('\n')
    }
    case 'read_file': {
      const path = str(args.path)
      if (!path?.endsWith('.md')) return 'Error: hanya berkas .md yang didukung'
      const content = await readFile(ctx.projectId, path)
      if (content === null) return `Error: berkas tidak ditemukan: ${path}`
      return content
    }
    case 'write_file': {
      const path = str(args.path)
      const content = args.content
      if (!path?.endsWith('.md')) return 'Error: hanya berkas .md yang didukung'
      if (typeof content !== 'string') return 'Error: content harus string'
      const before = await readFile(ctx.projectId, path)
      await writeFile(ctx.userId, ctx.projectId, path, content)
      effects.files.push(path)
      effects.undo.push({ kind: 'file', path, before })
      return `Ditulis: ${path}`
    }
    case 'append_file': {
      const path = str(args.path)
      const content = args.content
      if (!path?.endsWith('.md')) return 'Error: hanya berkas .md yang didukung'
      if (typeof content !== 'string') return 'Error: content harus string'
      const before = await readFile(ctx.projectId, path)
      await appendFile(ctx.userId, ctx.projectId, path, content)
      effects.files.push(path)
      effects.undo.push({ kind: 'file', path, before })
      return `Ditambahkan ke: ${path}`
    }
    case 'delete_file': {
      const path = str(args.path)
      if (!path) return 'Error: path wajib'
      const before = await readFile(ctx.projectId, path)
      if (before === null) return `Error: berkas tidak ditemukan: ${path}`
      await deleteFile(ctx.projectId, path)
      effects.files.push(path)
      effects.undo.push({ kind: 'file', path, before })
      return `Dihapus: ${path} (bisa di-undo)`
    }

    // ── Workspace ───────────────────────────────────────────────────────────
    case 'list_workspace': {
      const nodes = await loadNodes(ctx.userId)
      return renderWorkspaceMap(nodes, todayStr())
    }

    case 'list_tasks': {
      const nodes = await loadNodes(ctx.userId)
      const view = str(args.view) ?? 'today'
      const includeCompleted = args.includeCompleted === true
      const limit = Math.min(int(args.limit) ?? 50, 100)
      const day = todayStr()

      let rows: Node[]
      switch (view) {
        case 'today': {
          const { overdue, today } = views.today(nodes, day, includeCompleted)
          rows = [...overdue, ...today]
          break
        }
        case 'upcoming':
          rows = views.upcoming(nodes, day, includeCompleted).flatMap(g => g.items)
          break
        case 'anytime':  rows = views.anytime(nodes, day, includeCompleted); break
        case 'someday':  rows = views.someday(nodes, includeCompleted); break
        case 'inbox':    rows = views.inbox(nodes, includeCompleted); break
        case 'logbook':  rows = views.completed(nodes); break
        case 'project': {
          const projectId = str(args.projectId)
          if (!projectId) return "Error: view='project' butuh projectId"
          if (!find(nodes, projectId)) return `Error: project tidak ditemukan: ${projectId}`
          rows = views.project(nodes, projectId, includeCompleted)
          break
        }
        default:
          return `Error: view tidak dikenal: ${view}`
      }

      const tagName = str(args.tag)
      if (tagName) {
        const ids = await resolveTags(ctx.userId, [tagName])
        rows = rows.filter(r => ids.some(id => r.tagIds.includes(id)))
      }
      return renderList(rows, limit)
    }

    case 'search_tasks': {
      const query = str(args.query)
      if (!query) return 'Error: query wajib'
      const nodes = await loadNodes(ctx.userId)
      return renderList(search(nodes, query), Math.min(int(args.limit) ?? 25, 50))
    }

    case 'get_task': {
      const id = str(args.taskId)
      if (!id) return 'Error: taskId wajib'
      const nodes = await loadNodes(ctx.userId)
      const task = find(nodes, id)
      if (!task) return `Error: task tidak ditemukan: ${id}`

      const subtasks = nodes.filter(n => n.parentId === id)
      const tags = task.tagIds.length > 0
        ? await db.select().from(tag).where(and(eq(tag.userId, ctx.userId), isNull(tag.deletedAt)))
        : []
      const reminders = await db
        .select()
        .from(reminder)
        .where(and(eq(reminder.nodeId, id), eq(reminder.userId, ctx.userId), isNull(reminder.deletedAt)))

      return [
        renderTask(task),
        `note: ${task.note ?? '—'}`,
        `project: ${task.parentId ?? '—'}`,
        `tags: ${task.tagIds.map(t => tags.find(x => x.id === t)?.name ?? t).join(', ') || '—'}`,
        `reminders: ${reminders.map(r => r.remindAt?.toISOString() ?? `${r.offsetMin}m sebelum`).join(', ') || '—'}`,
        subtasks.length > 0 ? `subtasks:\n${subtasks.map(s => `  ${renderTask(s)}`).join('\n')}` : 'subtasks: —',
      ].join('\n')
    }

    case 'create_task': {
      const text = str(args.text)
      if (!text) return 'Error: text wajib'
      const nodes = await loadNodes(ctx.userId)

      // Same quick-add parser the UI uses, so "besok jam 9 #kerja @urgent"
      // behaves identically wherever it is typed.
      const parsed = parse(text, { now: new Date(), timezone: ctx.timezone ?? 'UTC' })

      let parentId = str(args.parentId) ?? str(args.projectId) ?? ctx.nodeId ?? null
      if (parsed.projectQuery && !str(args.projectId) && !str(args.parentId)) {
        const q = parsed.projectQuery.toLowerCase()
        const hit = nodes.find(n => n.kind === 'project' && n.content.toLowerCase().includes(q))
        if (hit) parentId = hit.id
      }
      if (parentId && !find(nodes, parentId)) return `Error: induk tidak ditemukan: ${parentId}`

      const tagNames = (Array.isArray(args.tags) ? args.tags as string[] : parsed.tagNames)
      const tagIds = await resolveTags(ctx.userId, tagNames)

      // Explicit arguments win over anything the parser guessed.
      const dueDate = str(args.dueDate) ?? parsed.dueDate
      const dueTime = str(args.dueTime) ?? parsed.dueTime
      const recurrence = str(args.recurrence) ?? parsed.recurrence
      if (dueTime && !dueDate) return 'Error: dueTime butuh dueDate'
      if (recurrence && !dueDate) return 'Error: recurrence butuh dueDate'

      const now = new Date().toISOString()
      const dto: NodeDto = {
        id: uuidv7(), parentId, kind: 'item', rank: lastRankUnder(nodes, parentId),
        content: parsed.content || text, note: str(args.note) ?? null, linkedTaskId: null,
        dueDate, dueTime, durationMin: int(args.durationMin) ?? parsed.durationMin,
        recurrence, priority: (int(args.priority) as 1 | 2 | 3 | undefined) ?? parsed.priority,
        tagIds, color: null, isFavorite: false, isInbox: false, isSomeday: false,
        collapsed: false, completedAt: null, createdAt: now, updatedAt: now, deletedAt: null,
      }
      await writeNode(ctx.userId, dto, null, effects)
      return `Task dibuat: ${dto.id} — ${dto.content}`
    }

    case 'update_task': {
      const id = str(args.taskId)
      if (!id) return 'Error: taskId wajib'
      const nodes = await loadNodes(ctx.userId)
      const task = find(nodes, id)
      if (!task) return `Error: task tidak ditemukan: ${id}`

      const next: Node = { ...task }
      if ('content' in args && str(args.content)) next.content = str(args.content)!
      if ('note' in args) next.note = str(args.note) ?? null
      if ('dueDate' in args) next.dueDate = str(args.dueDate) ?? null
      if ('dueTime' in args) next.dueTime = str(args.dueTime) ?? null
      if ('durationMin' in args) next.durationMin = int(args.durationMin) ?? null
      if ('priority' in args) next.priority = (int(args.priority) as 1 | 2 | 3 | undefined) ?? null
      if ('recurrence' in args) next.recurrence = str(args.recurrence) ?? null
      if ('tags' in args && Array.isArray(args.tags)) {
        next.tagIds = await resolveTags(ctx.userId, args.tags as string[])
      }
      if (str(args.projectId)) {
        const target = str(args.projectId)!
        if (!find(nodes, target)) return `Error: project tidak ditemukan: ${target}`
        next.parentId = target
      }

      // Mirrors the DB check constraints, so the model gets a usable message
      // instead of a raw Postgres error.
      if (next.dueTime && !next.dueDate) return 'Error: dueTime butuh dueDate'
      if (next.recurrence && !next.dueDate) return 'Error: recurrence butuh dueDate'

      next.updatedAt = new Date().toISOString()
      await writeNode(ctx.userId, nodeToDto(next), task, effects)
      return `Task diperbarui: ${id} — ${next.content}`
    }

    case 'complete_task': {
      const id = str(args.taskId)
      if (!id) return 'Error: taskId wajib'
      const nodes = await loadNodes(ctx.userId)
      const task = find(nodes, id)
      if (!task) return `Error: task tidak ditemukan: ${id}`
      const now = new Date()

      if (args.undo === true) {
        const next: Node = { ...task, completedAt: null, updatedAt: now.toISOString() }
        await writeNode(ctx.userId, nodeToDto(next), task, effects)
        return `Task dibuka lagi: ${id}`
      }

      // A repeating task never closes — its due date advances instead, and the
      // occurrence is recorded separately. Doing this through update_task would
      // silently kill the repeat, which is why this is its own tool.
      if (task.recurrence && task.dueDate) {
        const nextDate = nextOccurrence(task.recurrence, task.dueDate)
        await applyIncomingCompletions(ctx.userId, [{
          id: uuidv7(), nodeId: id, completedAt: now.toISOString(), occurredOn: task.dueDate,
        }])
        const next: Node = { ...task, dueDate: nextDate, updatedAt: now.toISOString() }
        await writeNode(ctx.userId, nodeToDto(next), task, effects)
        return `Kemunculan ${task.dueDate} selesai; berikutnya ${nextDate}.`
      }

      await applyIncomingCompletions(ctx.userId, [{
        id: uuidv7(), nodeId: id, completedAt: now.toISOString(), occurredOn: task.dueDate,
      }])
      const next: Node = { ...task, completedAt: now.toISOString(), updatedAt: now.toISOString() }
      await writeNode(ctx.userId, nodeToDto(next), task, effects)
      return `Task selesai: ${id} — ${task.content}`
    }

    case 'delete_task': {
      const id = str(args.taskId)
      if (!id) return 'Error: taskId wajib'
      const nodes = await loadNodes(ctx.userId)
      const task = find(nodes, id)
      if (!task) return `Error: task tidak ditemukan: ${id}`
      const next: Node = { ...task, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      await writeNode(ctx.userId, nodeToDto(next), task, effects)
      return `Dihapus: ${id} — ${task.content} (bisa di-undo)`
    }

    case 'move_task': {
      const id = str(args.taskId)
      if (!id) return 'Error: taskId wajib'
      const nodes = await loadNodes(ctx.userId)
      const task = find(nodes, id)
      if (!task) return `Error: task tidak ditemukan: ${id}`

      const parentId = 'parentId' in args ? (str(args.parentId) ?? null) : task.parentId
      if (parentId && !find(nodes, parentId)) return `Error: induk tidak ditemukan: ${parentId}`
      const beforeId = str(args.beforeTaskId) ?? null
      if (beforeId && !find(nodes, beforeId)) return `Error: saudara tidak ditemukan: ${beforeId}`

      // tree.move refuses a move that would make a node its own ancestor.
      let placed: { parentId: string | null; rank: string }
      try {
        placed = treeMove(nodes, id, parentId, beforeId)
      } catch {
        return 'Error: pemindahan itu membuat task jadi turunan dirinya sendiri'
      }

      const next: Node = { ...task, ...placed, updatedAt: new Date().toISOString() }
      await writeNode(ctx.userId, nodeToDto(next), task, effects)
      return `Dipindahkan: ${id} → induk ${placed.parentId ?? 'akar'}`
    }

    case 'manage_project': {
      const action = str(args.action)
      const nodes = await loadNodes(ctx.userId)
      const now = new Date().toISOString()

      if (action === 'create') {
        const name = str(args.name)
        if (!name) return 'Error: name wajib untuk create'
        const areaId = str(args.areaId) ?? null
        if (areaId && !find(nodes, areaId)) return `Error: area tidak ditemukan: ${areaId}`
        const dto: NodeDto = {
          id: uuidv7(), parentId: areaId, kind: 'project', rank: lastRankUnder(nodes, areaId),
          content: name, note: null, linkedTaskId: null, dueDate: null, dueTime: null,
          durationMin: null, recurrence: null, priority: null, tagIds: [],
          color: str(args.color) ?? null, isFavorite: false, isInbox: false, isSomeday: false,
          collapsed: false, completedAt: null, createdAt: now, updatedAt: now, deletedAt: null,
        }
        await writeNode(ctx.userId, dto, null, effects)
        return `Project dibuat: ${dto.id} — ${name}`
      }

      const projectId = str(args.projectId)
      if (!projectId) return `Error: projectId wajib untuk ${action}`
      const project = find(nodes, projectId)
      if (!project || project.kind !== 'project') return `Error: project tidak ditemukan: ${projectId}`
      if (project.isInbox) return 'Error: Inbox tidak bisa diubah'

      const next: Node = { ...project, updatedAt: now }
      switch (action) {
        case 'rename': {
          const name = str(args.name)
          if (!name) return 'Error: name wajib untuk rename'
          next.content = name
          if (str(args.color)) next.color = str(args.color)!
          break
        }
        case 'move': {
          const areaId = str(args.areaId) ?? null
          if (areaId && !find(nodes, areaId)) return `Error: area tidak ditemukan: ${areaId}`
          next.parentId = areaId
          next.rank = lastRankUnder(nodes, areaId)
          break
        }
        case 'archive': next.isSomeday = true; break
        case 'delete':  next.deletedAt = now; break
        default: return `Error: action tidak dikenal: ${action}`
      }
      await writeNode(ctx.userId, nodeToDto(next), project, effects)
      return `Project ${action}: ${projectId} — ${next.content}`
    }

    case 'manage_section': {
      const action = str(args.action)
      const projectId = str(args.projectId)
      if (!projectId) return 'Error: projectId wajib'
      const nodes = await loadNodes(ctx.userId)
      if (!find(nodes, projectId)) return `Error: project tidak ditemukan: ${projectId}`
      const now = new Date().toISOString()

      if (action === 'create') {
        const name = str(args.name)
        if (!name) return 'Error: name wajib untuk create'
        const dto: NodeDto = {
          id: uuidv7(), parentId: projectId, kind: 'section', rank: lastRankUnder(nodes, projectId),
          content: name, note: null, linkedTaskId: null, dueDate: null, dueTime: null,
          durationMin: null, recurrence: null, priority: null, tagIds: [], color: null,
          isFavorite: false, isInbox: false, isSomeday: false, collapsed: false,
          completedAt: null, createdAt: now, updatedAt: now, deletedAt: null,
        }
        await writeNode(ctx.userId, dto, null, effects)
        return `Section dibuat: ${dto.id} — ${name}`
      }

      const sectionId = str(args.sectionId)
      if (!sectionId) return `Error: sectionId wajib untuk ${action}`
      const section = find(nodes, sectionId)
      if (!section || section.kind !== 'section') return `Error: section tidak ditemukan: ${sectionId}`

      if (action === 'rename') {
        const name = str(args.name)
        if (!name) return 'Error: name wajib untuk rename'
        await writeNode(ctx.userId, nodeToDto({ ...section, content: name, updatedAt: now }), section, effects)
        return `Section diganti nama: ${sectionId} — ${name}`
      }
      if (action === 'delete') {
        // Children are re-parented to the project rather than orphaned (§7.3).
        const children = nodes.filter(n => n.parentId === sectionId)
        for (const child of children) {
          await writeNode(
            ctx.userId,
            nodeToDto({ ...child, parentId: projectId, rank: lastRankUnder(nodes, projectId), updatedAt: now }),
            child, effects,
          )
        }
        await writeNode(ctx.userId, nodeToDto({ ...section, deletedAt: now, updatedAt: now }), section, effects)
        return `Section dihapus: ${sectionId}; ${children.length} task dipindah ke project.`
      }
      return `Error: action tidak dikenal: ${action}`
    }

    case 'manage_tag': {
      const action = str(args.action)
      const now = new Date().toISOString()
      const rows = await db.select().from(tag).where(and(eq(tag.userId, ctx.userId), isNull(tag.deletedAt)))

      if (action === 'create') {
        const name = str(args.name)
        if (!name) return 'Error: name wajib untuk create'
        if (rows.some(t => t.name.toLowerCase() === name.toLowerCase())) return `Error: tag sudah ada: ${name}`
        const dto: TagDto = {
          id: uuidv7(), name, color: str(args.color) ?? 'grey', isFavorite: false,
          rank: between(rows.at(-1)?.rank ?? null, null), createdAt: now, updatedAt: now, deletedAt: null,
        }
        await applyIncomingTags(ctx.userId, [dto])
        return `Tag dibuat: ${dto.id} — ${name}`
      }

      const tagId = str(args.tagId)
      if (!tagId) return `Error: tagId wajib untuk ${action}`
      const row = rows.find(t => t.id === tagId)
      if (!row) return `Error: tag tidak ditemukan: ${tagId}`

      const base: TagDto = {
        id: row.id, name: row.name, color: row.color, isFavorite: row.isFavorite,
        rank: row.rank, createdAt: row.createdAt.toISOString(), updatedAt: now, deletedAt: null,
      }
      if (action === 'rename') {
        const name = str(args.name)
        if (!name) return 'Error: name wajib untuk rename'
        // Renaming touches one row; tasks reference the id, so nothing else moves.
        await applyIncomingTags(ctx.userId, [{ ...base, name, color: str(args.color) ?? row.color }])
        return `Tag diganti nama: ${tagId} — ${name}`
      }
      if (action === 'delete') {
        await applyIncomingTags(ctx.userId, [{ ...base, deletedAt: now }])
        return `Tag dihapus: ${tagId} — ${row.name}`
      }
      return `Error: action tidak dikenal: ${action}`
    }

    case 'set_reminder': {
      const taskId = str(args.taskId)
      if (!taskId) return 'Error: taskId wajib'
      const nodes = await loadNodes(ctx.userId)
      const task = find(nodes, taskId)
      if (!task) return `Error: task tidak ditemukan: ${taskId}`
      const now = new Date().toISOString()

      const existing = await db
        .select()
        .from(reminder)
        .where(and(eq(reminder.nodeId, taskId), eq(reminder.userId, ctx.userId), isNull(reminder.deletedAt)))

      if (args.remove === true) {
        if (existing.length === 0) return 'Tidak ada reminder untuk dihapus.'
        await applyIncomingReminders(ctx.userId, existing.map(r => ({
          id: r.id, nodeId: r.nodeId, kind: r.kind, remindAt: r.remindAt?.toISOString() ?? null,
          offsetMin: r.offsetMin, fireAt: r.fireAt.toISOString(),
          createdAt: r.createdAt.toISOString(), updatedAt: now, deletedAt: now,
        })))
        return `${existing.length} reminder dihapus dari ${taskId}.`
      }

      const kind = str(args.kind) ?? 'absolute'
      let fireAt: string
      let remindAt: string | null = null
      let offsetMin: number | null = null

      if (kind === 'absolute') {
        remindAt = str(args.remindAt) ?? null
        if (!remindAt) return "Error: kind='absolute' butuh remindAt"
        const when = new Date(remindAt)
        if (Number.isNaN(when.getTime())) return `Error: remindAt bukan tanggal valid: ${remindAt}`
        fireAt = when.toISOString()
      } else if (kind === 'relative') {
        offsetMin = int(args.offsetMin) ?? null
        if (offsetMin === null) return "Error: kind='relative' butuh offsetMin"
        if (!task.dueDate) return 'Error: reminder relatif butuh task yang punya due date'
        const base = new Date(`${task.dueDate}T${task.dueTime ?? '09:00'}:00Z`)
        fireAt = new Date(base.getTime() - offsetMin * 60_000).toISOString()
      } else {
        return `Error: kind tidak dikenal: ${kind}`
      }

      await applyIncomingReminders(ctx.userId, [{
        id: uuidv7(), nodeId: taskId, kind: kind as 'absolute' | 'relative',
        remindAt, offsetMin, fireAt, createdAt: now, updatedAt: now, deletedAt: null,
      }])
      return `Reminder dipasang untuk ${taskId} pada ${fireAt}.`
    }

    // ── Memory ──────────────────────────────────────────────────────────────
    case 'compact_memory': {
      const content = args.content
      if (typeof content !== 'string' || content === '') return 'Error: content wajib'
      await updateSessionMemory(ctx.sessionId, content)
      return 'SESSION.md diperbarui.'
    }

    default:
      return `Error: tool tidak dikenal: ${name}`
  }
}
