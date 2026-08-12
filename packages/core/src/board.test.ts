import { describe, expect, it } from 'vitest'
import { board } from './board.ts'
import type { Node } from './node.ts'

// Minimal factory — only the fields board() actually reads.
function n(over: Partial<Node> & Pick<Node, 'id' | 'kind'>): Node {
  return {
    parentId: null, rank: 'm', content: over.id, note: null, linkedTaskId: null, dueDate: null,
    dueTime: null, durationMin: null, recurrence: null, priority: null,
    tagIds: [], color: null, isFavorite: false, isInbox: false,
    isSomeday: false, collapsed: false, completedAt: null, deletedAt: null, userId: 'u',
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    seq: 0, ...over,
  } as Node
}

const P = n({ id: 'p', kind: 'project' })

describe('board', () => {
  it('returns [] for an unknown project', () => {
    expect(board([P], 'nope')).toEqual([])
  })

  it('puts section-less items in an implicit first column', () => {
    const a = n({ id: 'a', kind: 'item', parentId: 'p', rank: 'a' })
    const cols = board([P, a], 'p')
    expect(cols).toHaveLength(1)
    expect(cols[0]!.section).toBeNull()
    expect(cols[0]!.items.map(i => i.id)).toEqual(['a'])
  })

  it('hides the implicit column when every item has a section', () => {
    const s = n({ id: 's', kind: 'section', parentId: 'p', rank: 'm' })
    const a = n({ id: 'a', kind: 'item', parentId: 's', rank: 'a' })
    const cols = board([P, s, a], 'p')
    expect(cols).toHaveLength(1)
    expect(cols[0]!.section!.id).toBe('s')
  })

  it('orders sections by rank, implicit column always first', () => {
    const s1 = n({ id: 's1', kind: 'section', parentId: 'p', rank: 'z' })
    const s2 = n({ id: 's2', kind: 'section', parentId: 'p', rank: 'b' })
    const loose = n({ id: 'loose', kind: 'item', parentId: 'p', rank: 'a' })
    const cols = board([P, s1, s2, loose], 'p')
    expect(cols.map(c => c.section?.id ?? null)).toEqual([null, 's2', 's1'])
  })

  it('orders items within a column by rank', () => {
    const s = n({ id: 's', kind: 'section', parentId: 'p', rank: 'm' })
    const b = n({ id: 'b', kind: 'item', parentId: 's', rank: 'z' })
    const a = n({ id: 'a', kind: 'item', parentId: 's', rank: 'a' })
    expect(board([P, s, b, a], 'p')[0]!.items.map(i => i.id)).toEqual(['a', 'b'])
  })

  it('keeps an empty section as a visible column', () => {
    const s = n({ id: 's', kind: 'section', parentId: 'p', rank: 'm' })
    const cols = board([P, s], 'p')
    expect(cols).toHaveLength(1)
    expect(cols[0]!.section!.id).toBe('s')
    expect(cols[0]!.items).toHaveLength(0)
  })

  it('excludes soft-deleted items', () => {
    const s = n({ id: 's', kind: 'section', parentId: 'p', rank: 'm' })
    const a = n({ id: 'a', kind: 'item', parentId: 's', rank: 'a', deletedAt: '2026-01-02T00:00:00Z' })
    const cols = board([P, s, a], 'p')
    expect(cols[0]!.items).toHaveLength(0)
  })

  it('excludes soft-deleted sections', () => {
    const s = n({ id: 's', kind: 'section', parentId: 'p', rank: 'm', deletedAt: '2026-01-02T00:00:00Z' })
    const a = n({ id: 'a', kind: 'item', parentId: 's', rank: 'a' })
    const cols = board([P, s, a], 'p')
    expect(cols).toHaveLength(0)
  })

  it('excludes completed items', () => {
    const a = n({ id: 'a', kind: 'item', parentId: 'p', rank: 'a', completedAt: '2026-01-02T00:00:00Z' })
    const cols = board([P, a], 'p')
    expect(cols).toHaveLength(0)
  })

  // docs/feature/32.outline-task-decoupling/spec.md §6.1 — an Outline row
  // parented under a project is a note, never a board card.
  it('excludes kind=note nodes', () => {
    const note = n({ id: 'note', kind: 'note', parentId: 'p', rank: 'a' })
    const cols = board([P, note], 'p')
    expect(cols).toHaveLength(0)
  })
})
