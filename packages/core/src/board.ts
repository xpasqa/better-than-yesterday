import type { Node } from './node.ts'

export interface BoardColumn {
  section: Node | null
  items: Node[]
}

function byRank(a: Node, b: Node): number {
  return a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0
}

/** Live (non-deleted, non-completed) items whose parent is `parentId`. */
function liveItemsOf(nodes: Node[], parentId: string): Node[] {
  return nodes
    .filter(
      (n) =>
        n.parentId === parentId &&
        n.kind === 'item' &&
        n.deletedAt === null &&
        n.completedAt === null,
    )
    .sort(byRank)
}

/**
 * Groups a project's live items into columns, one per section.
 * Items not in any section land in an implicit first column (section: null).
 * The implicit column is omitted when empty.
 * Returns [] for an unknown/missing project.
 */
export function board(nodes: Node[], projectId: string): BoardColumn[] {
  const project = nodes.find((n) => n.id === projectId && n.kind === 'project')
  if (!project) return []

  const columns: BoardColumn[] = []

  // The implicit column is omitted when empty — a board that always opens
  // with a blank nameless column is noise.
  const loose = liveItemsOf(nodes, projectId)
  if (loose.length > 0) columns.push({ section: null, items: loose })

  const sections = nodes
    .filter((n) => n.parentId === projectId && n.kind === 'section' && n.deletedAt === null)
    .sort(byRank)

  for (const section of sections) {
    columns.push({ section, items: liveItemsOf(nodes, section.id) })
  }

  return columns
}
