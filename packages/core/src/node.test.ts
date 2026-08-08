import { describe, expect, it } from 'vitest'
import { sanitizeNode, type Node } from './node.ts'

function makeNode(overrides: Partial<Node>): Node {
  return {
    id: '1',
    userId: '',
    parentId: null,
    kind: 'item',
    rank: 'a0',
    content: 'test',
    note: null,
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
    createdAt: '2026-08-05T00:00:00.000Z',
    updatedAt: '2026-08-05T00:00:00.000Z',
    deletedAt: null,
    seq: 0,
    ...overrides,
  }
}

describe('sanitizeNode', () => {
  it('clears recurrence and dueTime when dueDate is null', () => {
    const node = makeNode({ dueDate: null, dueTime: '09:00', recurrence: 'FREQ=DAILY' })
    expect(sanitizeNode(node)).toMatchObject({ dueDate: null, dueTime: null, recurrence: null })
  })

  it('leaves a node with a dueDate untouched, recurrence and dueTime included', () => {
    const node = makeNode({ dueDate: '2026-08-05', dueTime: '09:00', recurrence: 'FREQ=DAILY' })
    expect(sanitizeNode(node)).toEqual(node)
  })

  it('leaves a node with a dueDate but no recurrence/dueTime untouched', () => {
    const node = makeNode({ dueDate: '2026-08-05' })
    expect(sanitizeNode(node)).toEqual(node)
  })

  it('is a no-op on a node that already has no dueDate/dueTime/recurrence', () => {
    const node = makeNode({})
    expect(sanitizeNode(node)).toEqual(node)
  })
})
