// Context layers shared by both agents — docs/feature/35.agent-orchestrator/spec.md §6, §7.2
//
// The workspace map is what makes the project memory tier unnecessary (§8.2):
// the agent sees where every project stands from the tasks themselves, so it
// never has to keep a hand-written summary in sync with reality.
import type { ContextLayer } from '@better/core/context'
import type { Node } from '@better/core/node'
import { today as todayView } from '@better/core/views'
import { loadNodes } from '../todo/dto.ts'
import { listFiles } from './file-service.ts'

/** Highest priority wins and is never cut; see the table in spec §6. */
export const LAYER_PRIORITY = {
  system: 100,
  global: 95,
  session: 85,
  workspace: 80,
  manifest: 70,
  today: 60,
  history: 50,
  /** The message just sent. Pinned, and lowest so it renders last. */
  now: 10,
} as const

function openItems(nodes: Node[], parentId: string): Node[] {
  return nodes.filter(n =>
    n.parentId === parentId && n.kind === 'item' && !n.completedAt && !n.deletedAt,
  )
}

/**
 * Area → Project → Section with open/overdue counts. Names, ids, counts —
 * never task contents, so the map stays cheap however large the tree grows.
 */
export function renderWorkspaceMap(nodes: Node[], todayStr: string): string {
  const alive = nodes.filter(n => !n.deletedAt)
  const lines: string[] = ['Workspace:']

  const inbox = alive.find(n => n.kind === 'project' && n.isInbox)
  if (inbox) lines.push(`  Inbox  (${openItems(alive, inbox.id).length} terbuka)`)

  const renderProject = (p: Node, indent: string) => {
    const items = openItems(alive, p.id)
    const overdue = items.filter(i => i.dueDate !== null && i.dueDate < todayStr).length
    const bits = [`${items.length} terbuka`]
    if (overdue > 0) bits.push(`${overdue} overdue`)
    lines.push(`${indent}${p.content}  [${p.id}]  ${bits.join(' · ')}`)
    for (const s of alive.filter(n => n.kind === 'section' && n.parentId === p.id)) {
      lines.push(`${indent}  Section: ${s.content}  [${s.id}]`)
    }
  }

  for (const area of alive.filter(n => n.kind === 'area')) {
    lines.push(`  Area: ${area.content}  [${area.id}]`)
    for (const p of alive.filter(n => n.kind === 'project' && n.parentId === area.id && !n.isInbox)) {
      renderProject(p, '    ')
    }
  }

  // Projects that sit outside any area still belong on the map.
  const loose = alive.filter(n => n.kind === 'project' && !n.isInbox && n.parentId === null)
  for (const p of loose) renderProject(p, '  ')

  const someday = alive.filter(n => n.kind === 'item' && n.isSomeday && !n.completedAt).length
  if (someday > 0) lines.push(`  Someday  (${someday})`)

  return lines.length === 1 ? 'Workspace: (kosong)' : lines.join('\n')
}

/** Overdue + due today, capped so one bad week cannot eat the budget. */
export function renderToday(nodes: Node[], todayStr: string, limit = 30): string {
  const { overdue, today } = todayView(nodes, todayStr)
  const rows = [...overdue, ...today]
  if (rows.length === 0) return 'Today: tidak ada yang jatuh tempo.'

  const shown = rows.slice(0, limit)
  const lines = shown.map(t => {
    const late = t.dueDate! < todayStr ? ' (overdue)' : ''
    const at = t.dueTime ? ` ${t.dueTime}` : ''
    const dur = t.durationMin ? ` ${t.durationMin}m` : ''
    return `  - [${t.id}] ${t.content}${at}${dur}${late}`
  })
  if (rows.length > shown.length) lines.push(`  … dan ${rows.length - shown.length} lagi`)
  return ['Today:', ...lines].join('\n')
}

function systemLayer(id: string, priority: number, content: string): ContextLayer {
  return { id, priority, messages: [{ role: 'system', content }] }
}

export interface WorkspaceContext {
  workspace: ContextLayer
  today: ContextLayer
}

/** One DB read serves both layers — they are two views of the same tree. */
export async function buildWorkspaceContext(userId: string, todayStr: string): Promise<WorkspaceContext> {
  const nodes = await loadNodes(userId)
  return {
    workspace: systemLayer('workspace', LAYER_PRIORITY.workspace, renderWorkspaceMap(nodes, todayStr)),
    today: systemLayer('today', LAYER_PRIORITY.today, renderToday(nodes, todayStr)),
  }
}

/** Names, sizes, modified dates. Never contents — that is what read_file is for. */
export async function buildManifestLayer(projectId: string): Promise<ContextLayer> {
  const files = await listFiles(projectId)
  const body = files.length === 0
    ? 'Dokumen: belum ada.'
    : [
        'Dokumen (panggil read_file untuk membuka):',
        ...files.map(f => {
          const kb = (f.content.length / 1024).toFixed(1)
          const when = f.updatedAt.toISOString().slice(0, 10)
          return `  ${f.path}  ${kb} KB  ${when}`
        }),
      ].join('\n')
  return systemLayer('manifest', LAYER_PRIORITY.manifest, body)
}
