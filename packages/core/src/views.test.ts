import { describe, expect, it } from 'vitest'
import { between } from './rank.ts'
import type { Node } from './node.ts'
import { anytime, completed, inbox, project, someday, subtreeDepthFirst, today, upcoming } from './views.ts'

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

const TODAY = '2026-08-05'

describe('today', () => {
  it('splits into an overdue block and a due-today block', () => {
    const nodes = [
      makeNode({ id: 'late', dueDate: '2026-08-01' }),
      makeNode({ id: 'now', dueDate: TODAY }),
      makeNode({ id: 'future', dueDate: '2026-08-06' }),
      makeNode({ id: 'undated' }),
    ]
    const result = today(nodes, TODAY)
    expect(result.overdue.map((n) => n.id)).toEqual(['late'])
    expect(result.today.map((n) => n.id)).toEqual(['now'])
  })

  it('excludes completed and deleted items', () => {
    const nodes = [
      makeNode({ id: 'done', dueDate: TODAY, completedAt: '2026-08-05T09:00:00Z' }),
      makeNode({ id: 'gone', dueDate: TODAY, deletedAt: '2026-08-05T09:00:00Z' }),
      makeNode({ id: 'live', dueDate: TODAY }),
    ]
    expect(today(nodes, TODAY).today.map((n) => n.id)).toEqual(['live'])
  })

  it('excludes sections and projects even when they carry a due date', () => {
    const nodes = [
      makeNode({ id: 'sec', kind: 'section', dueDate: TODAY }),
      makeNode({ id: 'proj', kind: 'project', dueDate: TODAY }),
      makeNode({ id: 'task', dueDate: TODAY }),
    ]
    expect(today(nodes, TODAY).today.map((n) => n.id)).toEqual(['task'])
  })

  it('sorts by due time first, undated-time last', () => {
    const nodes = [
      makeNode({ id: 'no-time', dueDate: TODAY }),
      makeNode({ id: 'afternoon', dueDate: TODAY, dueTime: '14:00' }),
      makeNode({ id: 'morning', dueDate: TODAY, dueTime: '09:00' }),
    ]
    expect(today(nodes, TODAY).today.map((n) => n.id)).toEqual(['morning', 'afternoon', 'no-time'])
  })

  it('breaks a due-time tie with priority, no-priority last', () => {
    const nodes = [
      makeNode({ id: 'p3', dueDate: TODAY, priority: 3 }),
      makeNode({ id: 'p1', dueDate: TODAY, priority: 1 }),
      makeNode({ id: 'none', dueDate: TODAY }),
    ]
    expect(today(nodes, TODAY).today.map((n) => n.id)).toEqual(['p1', 'p3', 'none'])
  })

  it('finds a due item at arbitrary depth, not just top level', () => {
    const project = makeNode({ id: 'proj', kind: 'project' })
    const section = makeNode({ id: 'sec', kind: 'section', parentId: 'proj' })
    const deep = makeNode({ id: 'deep', parentId: 'sec', dueDate: TODAY })
    expect(today([project, section, deep], TODAY).today.map((n) => n.id)).toEqual(['deep'])
  })
})

describe('upcoming', () => {
  it('only includes dates strictly after today — undated items are excluded', () => {
    const nodes = [
      makeNode({ id: 'today-item', dueDate: TODAY }),
      makeNode({ id: 'undated' }),
      makeNode({ id: 'soon', dueDate: '2026-08-06' }),
    ]
    const groups = upcoming(nodes, TODAY)
    expect(groups.map((g) => g.date)).toEqual(['2026-08-06'])
    expect(groups[0]!.items.map((n) => n.id)).toEqual(['soon'])
  })

  it('groups by date in chronological order', () => {
    const nodes = [
      makeNode({ id: 'later', dueDate: '2026-08-10' }),
      makeNode({ id: 'sooner', dueDate: '2026-08-06' }),
    ]
    expect(upcoming(nodes, TODAY).map((g) => g.date)).toEqual(['2026-08-06', '2026-08-10'])
  })
})

describe('subtreeDepthFirst', () => {
  it('returns descendants in depth-first, rank order', () => {
    const a = makeNode({ id: 'a', parentId: 'root' })
    const aChild = makeNode({ id: 'a-child', parentId: 'a' })
    const b = makeNode({ id: 'b', parentId: 'root' })
    const nodes = [a, aChild, b]
    expect(subtreeDepthFirst(nodes, 'root').map((n) => n.id)).toEqual(['a', 'a-child', 'b'])
  })

  it('returns an empty array for a childless root', () => {
    expect(subtreeDepthFirst([], 'root')).toEqual([])
  })
})

describe('project', () => {
  it('returns only active items anywhere in the subtree, not sections or projects', () => {
    // Creation order fixes rank order (each nextRank() call appends), and
    // rank order is what depth-first walks — so t1 (proj's direct child,
    // created first) is deliberately ranked before sec, which puts it
    // ahead of sec's own descendants in the result.
    const proj = makeNode({ id: 'proj', kind: 'project' })
    const task1 = makeNode({ id: 't1', parentId: 'proj' })
    const sec = makeNode({ id: 'sec', kind: 'section', parentId: 'proj' })
    const task2 = makeNode({ id: 't2', parentId: 'sec' })
    const done = makeNode({ id: 't3', parentId: 'sec', completedAt: '2026-08-01T00:00:00Z' })
    const result = project([proj, sec, task1, task2, done], 'proj')
    expect(result.map((n) => n.id)).toEqual(['t1', 't2'])
  })
})

describe('inbox', () => {
  it('finds the flagged inbox project and returns its active items', () => {
    const proj = makeNode({ id: 'inbox-1', kind: 'project', isInbox: true })
    const task = makeNode({ id: 't1', parentId: 'inbox-1' })
    expect(inbox([proj, task]).map((n) => n.id)).toEqual(['t1'])
  })

  it('returns an empty list when no inbox is flagged yet', () => {
    expect(inbox([makeNode({ id: 'orphan' })])).toEqual([])
  })
})

describe('today (isSomeday exclusion)', () => {
  it('excludes isSomeday tasks even when dueDate <= today', () => {
    const nodes = [
      makeNode({ id: 'normal', dueDate: TODAY }),
      makeNode({ id: 'sd-today', dueDate: TODAY, isSomeday: true }),
      makeNode({ id: 'sd-overdue', dueDate: '2026-08-01', isSomeday: true }),
    ]
    const result = today(nodes, TODAY)
    expect(result.today.map((n) => n.id)).toEqual(['normal'])
    expect(result.overdue.map((n) => n.id)).toEqual([])
  })
})

describe('upcoming (isSomeday exclusion)', () => {
  it('excludes isSomeday tasks even when dueDate is in the future', () => {
    const nodes = [
      makeNode({ id: 'normal', dueDate: '2026-08-06' }),
      makeNode({ id: 'sd-future', dueDate: '2026-08-06', isSomeday: true }),
    ]
    const groups = upcoming(nodes, TODAY)
    expect(groups.length).toBe(1)
    expect(groups[0]!.items.map((n) => n.id)).toEqual(['normal'])
  })
})

describe('anytime', () => {
  it('includes undated active tasks', () => {
    const nodes = [makeNode({ id: 'undated' })]
    expect(anytime(nodes, TODAY).map((n) => n.id)).toEqual(['undated'])
  })

  it('includes tasks with dueDate <= today', () => {
    const nodes = [
      makeNode({ id: 'today', dueDate: TODAY }),
      makeNode({ id: 'overdue', dueDate: '2026-08-01' }),
    ]
    expect(anytime(nodes, TODAY).map((n) => n.id)).toEqual(['overdue', 'today'])
  })

  it('excludes tasks with dueDate > today (future)', () => {
    const nodes = [
      makeNode({ id: 'undated' }),
      makeNode({ id: 'future', dueDate: '2026-08-06' }),
    ]
    expect(anytime(nodes, TODAY).map((n) => n.id)).toEqual(['undated'])
  })

  it('excludes isSomeday tasks', () => {
    const nodes = [
      makeNode({ id: 'normal' }),
      makeNode({ id: 'sd', isSomeday: true }),
      makeNode({ id: 'sd-dated', dueDate: TODAY, isSomeday: true }),
    ]
    expect(anytime(nodes, TODAY).map((n) => n.id)).toEqual(['normal'])
  })

  it('excludes completed and deleted tasks', () => {
    const nodes = [
      makeNode({ id: 'open' }),
      makeNode({ id: 'done', completedAt: '2026-08-05T09:00:00Z' }),
      makeNode({ id: 'gone', deletedAt: '2026-08-05T09:00:00Z' }),
    ]
    expect(anytime(nodes, TODAY).map((n) => n.id)).toEqual(['open'])
  })

  it('sorts dated items (ascending) before undated, then by priority, then by rank', () => {
    const nodes = [
      makeNode({ id: 'undated-p1', priority: 1 }),
      makeNode({ id: 'undated-none' }),
      makeNode({ id: 'dated-early', dueDate: '2026-08-01' }),
      makeNode({ id: 'dated-today', dueDate: TODAY }),
    ]
    expect(anytime(nodes, TODAY).map((n) => n.id)).toEqual([
      'dated-early',
      'dated-today',
      'undated-p1',
      'undated-none',
    ])
  })
})

describe('someday', () => {
  it('returns only isSomeday tasks', () => {
    const nodes = [
      makeNode({ id: 'normal' }),
      makeNode({ id: 'sd', isSomeday: true }),
    ]
    expect(someday(nodes).map((n) => n.id)).toEqual(['sd'])
  })

  it('excludes completed and deleted isSomeday tasks', () => {
    const nodes = [
      makeNode({ id: 'active', isSomeday: true }),
      makeNode({ id: 'done', isSomeday: true, completedAt: '2026-08-05T09:00:00Z' }),
      makeNode({ id: 'gone', isSomeday: true, deletedAt: '2026-08-05T09:00:00Z' }),
    ]
    expect(someday(nodes).map((n) => n.id)).toEqual(['active'])
  })

  it('returns empty list when no someday tasks exist', () => {
    const nodes = [makeNode({ id: 'normal' })]
    expect(someday(nodes)).toEqual([])
  })

  it('sorts by dueDate ascending (undated last), then priority, then rank', () => {
    const nodes = [
      makeNode({ id: 'sd-undated', isSomeday: true }),
      makeNode({ id: 'sd-dated', dueDate: '2026-08-10', isSomeday: true }),
    ]
    expect(someday(nodes).map((n) => n.id)).toEqual(['sd-dated', 'sd-undated'])
  })
})

describe('completed', () => {
  it('returns only completed items, most recently completed first', () => {
    const nodes = [
      makeNode({ id: 'first', completedAt: '2026-08-01T00:00:00Z' }),
      makeNode({ id: 'last', completedAt: '2026-08-04T00:00:00Z' }),
      makeNode({ id: 'open' }),
    ]
    expect(completed(nodes).map((n) => n.id)).toEqual(['last', 'first'])
  })
})
