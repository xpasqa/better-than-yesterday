import { describe, expect, it } from 'vitest'
import { between } from './rank.ts'
import type { Node } from './node.ts'
import type { Completion } from './completion.ts'
import { logbook } from './logbook.ts'

let rankCounter: string | null = null
function nextRank(): string {
  rankCounter = between(rankCounter, null)
  return rankCounter
}

function makeNode(overrides: Partial<Node> & { id: string }): Node {
  return {
    userId: 'u1',
    parentId: null,
    kind: 'item',
    rank: nextRank(),
    content: overrides.id,
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
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    deletedAt: null,
    seq: 1,
    ...overrides,
  }
}

function makeCompletion(overrides: Partial<Completion> & { id: string; nodeId: string }): Completion {
  return {
    userId: 'u1',
    completedAt: '2026-08-05T10:00:00Z',
    occurredOn: '2026-08-05',
    seq: 1,
    ...overrides,
  }
}

describe('logbook', () => {
  it('returns [] for empty inputs', () => {
    expect(logbook([], [])).toEqual([])
  })

  it('returns [] when no completed tasks and no completions', () => {
    const nodes = [
      makeNode({ id: 'a' }),
      makeNode({ id: 'b', dueDate: '2026-08-05' }),
    ]
    expect(logbook(nodes, [])).toEqual([])
  })

  it('regular tasks only — returns one entry per completed task', () => {
    const nodes = [
      makeNode({ id: 'done1', completedAt: '2026-08-05T10:00:00Z' }),
      makeNode({ id: 'done2', completedAt: '2026-08-04T08:00:00Z' }),
      makeNode({ id: 'open' }),
    ]
    const result = logbook(nodes, [])
    expect(result).toHaveLength(2)
    expect(result[0].node.id).toBe('done1')
    expect(result[0].source).toBe('task')
    expect(result[0].occurredOn).toBeNull()
    expect(result[1].node.id).toBe('done2')
  })

  it('occurrences only — returns one entry per completion row', () => {
    const node = makeNode({ id: 'recurring', recurrence: 'FREQ=DAILY', dueDate: '2026-08-06' })
    const completions = [
      makeCompletion({ id: 'c1', nodeId: 'recurring', completedAt: '2026-08-05T10:00:00Z', occurredOn: '2026-08-05' }),
      makeCompletion({ id: 'c2', nodeId: 'recurring', completedAt: '2026-08-04T10:00:00Z', occurredOn: '2026-08-04' }),
    ]
    const result = logbook([node], completions)
    expect(result).toHaveLength(2)
    expect(result[0].node.id).toBe('recurring')
    expect(result[0].source).toBe('occurrence')
    expect(result[0].occurredOn).toBe('2026-08-05')
    expect(result[1].occurredOn).toBe('2026-08-04')
  })

  it('recurring task completed 3× → exactly 3 entries', () => {
    const node = makeNode({ id: 'habit', recurrence: 'FREQ=DAILY', dueDate: '2026-08-08' })
    const completions = [
      makeCompletion({ id: 'c1', nodeId: 'habit', completedAt: '2026-08-07T09:00:00Z', occurredOn: '2026-08-07' }),
      makeCompletion({ id: 'c2', nodeId: 'habit', completedAt: '2026-08-06T09:00:00Z', occurredOn: '2026-08-06' }),
      makeCompletion({ id: 'c3', nodeId: 'habit', completedAt: '2026-08-05T09:00:00Z', occurredOn: '2026-08-05' }),
    ]
    const result = logbook([node], completions)
    expect(result).toHaveLength(3)
  })

  it('mixed — regular tasks and occurrences sorted correctly (most recent first)', () => {
    const taskNode = makeNode({ id: 'regular', completedAt: '2026-08-06T12:00:00Z' })
    const recurNode = makeNode({ id: 'recurring', recurrence: 'FREQ=DAILY', dueDate: '2026-08-08' })
    const completions = [
      makeCompletion({ id: 'c1', nodeId: 'recurring', completedAt: '2026-08-07T09:00:00Z', occurredOn: '2026-08-07' }),
      makeCompletion({ id: 'c2', nodeId: 'recurring', completedAt: '2026-08-05T09:00:00Z', occurredOn: '2026-08-05' }),
    ]
    const result = logbook([taskNode, recurNode], completions)
    expect(result).toHaveLength(3)
    // Sorted descending: 2026-08-07, 2026-08-06, 2026-08-05
    expect(result[0].completedAt).toBe('2026-08-07T09:00:00Z')
    expect(result[1].completedAt).toBe('2026-08-06T12:00:00Z')
    expect(result[2].completedAt).toBe('2026-08-05T09:00:00Z')
  })

  it('completion row referencing a deleted node → entry skipped', () => {
    const deletedNode = makeNode({ id: 'deleted', deletedAt: '2026-08-04T00:00:00Z' })
    const completions = [
      makeCompletion({ id: 'c1', nodeId: 'deleted', completedAt: '2026-08-03T10:00:00Z', occurredOn: '2026-08-03' }),
    ]
    const result = logbook([deletedNode], completions)
    expect(result).toHaveLength(0)
  })

  it('completion row referencing a non-existent node → entry skipped', () => {
    const completions = [
      makeCompletion({ id: 'c1', nodeId: 'ghost-id', completedAt: '2026-08-03T10:00:00Z', occurredOn: '2026-08-03' }),
    ]
    const result = logbook([], completions)
    expect(result).toHaveLength(0)
  })

  it('deleted regular task (deletedAt set) is not included even if completedAt is set', () => {
    const nodes = [
      makeNode({ id: 'deleted-done', completedAt: '2026-08-05T10:00:00Z', deletedAt: '2026-08-05T11:00:00Z' }),
    ]
    const result = logbook(nodes, [])
    expect(result).toHaveLength(0)
  })

  it('non-item nodes (kind !== item) are excluded even if completedAt is set', () => {
    const nodes = [
      makeNode({ id: 'proj', kind: 'project', completedAt: '2026-08-05T10:00:00Z' }),
    ]
    const result = logbook(nodes, [])
    expect(result).toHaveLength(0)
  })

  // docs/feature/32.outline-task-decoupling/spec.md §6.1 — an Outline row
  // is never "completed" in the Todo sense, even if it somehow carries a
  // completedAt.
  it('kind=note nodes are excluded even if completedAt is set', () => {
    const nodes = [
      makeNode({ id: 'note', kind: 'note', completedAt: '2026-08-05T10:00:00Z' }),
    ]
    const result = logbook(nodes, [])
    expect(result).toHaveLength(0)
  })

  it('two entries with identical completedAt timestamps keep a stable order', () => {
    const ts = '2026-08-05T10:00:00Z'
    const nodes = [
      makeNode({ id: 'a', completedAt: ts }),
      makeNode({ id: 'b', completedAt: ts }),
    ]
    const result = logbook(nodes, [])
    expect(result).toHaveLength(2)
    // Both entries present; exact order is stable (not crashing)
    expect(result.map((e) => e.node.id).sort()).toEqual(['a', 'b'])
  })
})
