import { describe, expect, it } from 'vitest'
import { between } from './rank.ts'
import type { Node } from './node.ts'
import { matches, search, tokenize } from './search.ts'

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

// ─── tokenize ────────────────────────────────────────────────────────────────

describe('tokenize', () => {
  it('empty string → []', () => {
    expect(tokenize('')).toEqual([])
  })

  it('whitespace-only → []', () => {
    expect(tokenize('   ')).toEqual([])
    expect(tokenize('\t\n')).toEqual([])
  })

  it('single word → lowercased', () => {
    expect(tokenize('Hello')).toEqual(['hello'])
  })

  it('multiple words → lowercased array, no empties', () => {
    expect(tokenize('Buy Milk  Today')).toEqual(['buy', 'milk', 'today'])
  })

  it('already lowercase is unchanged', () => {
    expect(tokenize('buy milk')).toEqual(['buy', 'milk'])
  })
})

// ─── matches ─────────────────────────────────────────────────────────────────

describe('matches', () => {
  it('empty token list → false', () => {
    const n = makeNode({ id: 'a', content: 'Buy milk' })
    expect(matches(n, [])).toBe(false)
  })

  it('token found in title → true', () => {
    const n = makeNode({ id: 'b', content: 'Buy milk today' })
    expect(matches(n, ['milk'])).toBe(true)
  })

  it('token found only in note → true', () => {
    const n = makeNode({ id: 'c', content: 'Shopping', note: 'get milk' })
    expect(matches(n, ['milk'])).toBe(true)
  })

  it('token not found anywhere → false', () => {
    const n = makeNode({ id: 'd', content: 'Buy apples' })
    expect(matches(n, ['milk'])).toBe(false)
  })

  it('note: null does not throw', () => {
    const n = makeNode({ id: 'e', content: 'Task without note', note: null })
    expect(() => matches(n, ['task'])).not.toThrow()
    expect(matches(n, ['task'])).toBe(true)
  })

  it('ALL tokens must match (multi-token AND)', () => {
    const n = makeNode({ id: 'f', content: 'Buy milk at market' })
    expect(matches(n, ['buy', 'milk'])).toBe(true)
    expect(matches(n, ['buy', 'eggs'])).toBe(false)
  })

  it('token order in query does not matter', () => {
    const n = makeNode({ id: 'g', content: 'beli susu di pasar' })
    expect(matches(n, ['susu', 'beli'])).toBe(true)
  })

  it('case-insensitive: uppercase query against lowercase content', () => {
    const n = makeNode({ id: 'h', content: 'buy milk' })
    expect(matches(n, ['MILK'.toLowerCase()])).toBe(true)
  })

  it('case-insensitive: lowercase query against uppercase content', () => {
    const n = makeNode({ id: 'i', content: 'BUY MILK' })
    expect(matches(n, ['milk'])).toBe(true)
  })
})

// ─── search ──────────────────────────────────────────────────────────────────

describe('search', () => {
  it('empty query → []', () => {
    const nodes = [makeNode({ id: 'a', content: 'Buy milk' })]
    expect(search(nodes, '')).toEqual([])
  })

  it('whitespace-only query → []', () => {
    const nodes = [makeNode({ id: 'a', content: 'Buy milk' })]
    expect(search(nodes, '   ')).toEqual([])
  })

  it('single token — match in title', () => {
    const nodes = [
      makeNode({ id: 'a', content: 'Buy milk' }),
      makeNode({ id: 'b', content: 'Buy eggs' }),
    ]
    expect(search(nodes, 'milk').map((n) => n.id)).toEqual(['a'])
  })

  it('single token — match in note only', () => {
    const nodes = [makeNode({ id: 'a', content: 'Shopping', note: 'get milk' })]
    expect(search(nodes, 'milk').map((n) => n.id)).toEqual(['a'])
  })

  it('single token — no match', () => {
    const nodes = [makeNode({ id: 'a', content: 'Buy eggs' })]
    expect(search(nodes, 'milk')).toEqual([])
  })

  it('multi-token reversed order still matches', () => {
    const nodes = [makeNode({ id: 'a', content: 'beli susu di pasar' })]
    expect(search(nodes, 'susu beli').map((n) => n.id)).toEqual(['a'])
  })

  it('multi-token with one missing token → not included', () => {
    const nodes = [makeNode({ id: 'a', content: 'Buy milk' })]
    expect(search(nodes, 'milk eggs')).toEqual([])
  })

  it('case-insensitive: uppercase query matches lowercase content', () => {
    const nodes = [makeNode({ id: 'a', content: 'buy milk today' })]
    expect(search(nodes, 'MILK').map((n) => n.id)).toEqual(['a'])
  })

  it('case-insensitive: lowercase query matches uppercase content', () => {
    const nodes = [makeNode({ id: 'a', content: 'BUY MILK' })]
    expect(search(nodes, 'milk').map((n) => n.id)).toEqual(['a'])
  })

  it('completed task is included in results', () => {
    const nodes = [
      makeNode({ id: 'done', content: 'Buy milk', completedAt: '2026-08-01T09:00:00Z' }),
    ]
    expect(search(nodes, 'milk').map((n) => n.id)).toEqual(['done'])
  })

  it('deleted task is never included', () => {
    const nodes = [
      makeNode({ id: 'gone', content: 'Buy milk', deletedAt: '2026-08-01T09:00:00Z' }),
    ]
    expect(search(nodes, 'milk')).toEqual([])
  })

  it('kind=project is excluded', () => {
    const nodes = [makeNode({ id: 'proj', kind: 'project', content: 'Buy milk project' })]
    expect(search(nodes, 'milk')).toEqual([])
  })

  it('kind=section is excluded', () => {
    const nodes = [makeNode({ id: 'sec', kind: 'section', content: 'Buy milk section' })]
    expect(search(nodes, 'milk')).toEqual([])
  })

  it('node with note:null does not throw', () => {
    const nodes = [makeNode({ id: 'a', content: 'Buy milk', note: null })]
    expect(() => search(nodes, 'milk')).not.toThrow()
    expect(search(nodes, 'milk').map((n) => n.id)).toEqual(['a'])
  })

  // ─── Scoring and ordering ───────────────────────────────────────────────

  it('score 0 (all tokens in title) ranks above score 1 (some in title)', () => {
    // nodeA: both tokens in title → score 0
    // nodeB: one token in title, one only in note → score 1
    const nodeA = makeNode({ id: 'all-title', content: 'buy milk' })
    const nodeB = makeNode({ id: 'split', content: 'buy groceries', note: 'remember milk' })
    expect(search([nodeB, nodeA], 'buy milk').map((n) => n.id)).toEqual(['all-title', 'split'])
  })

  it('score 1 (some in title) ranks above score 2 (none in title)', () => {
    // nodeA: one token in title → score 1
    // nodeB: no tokens in title, both in note → score 2
    const nodeA = makeNode({ id: 'some-title', content: 'buy things', note: 'milk' })
    const nodeB = makeNode({ id: 'note-only', content: 'errand', note: 'buy milk' })
    expect(search([nodeB, nodeA], 'buy milk').map((n) => n.id)).toEqual(['some-title', 'note-only'])
  })

  it('tiebreak: earlier dueDate comes first within same score', () => {
    const nodeA = makeNode({ id: 'later', content: 'buy milk', dueDate: '2026-08-10' })
    const nodeB = makeNode({ id: 'earlier', content: 'buy milk', dueDate: '2026-08-05' })
    expect(search([nodeA, nodeB], 'milk').map((n) => n.id)).toEqual(['earlier', 'later'])
  })

  it('tiebreak: null dueDate is sorted last (sentinel 9999-99-99)', () => {
    const nodeA = makeNode({ id: 'no-date', content: 'buy milk', dueDate: null })
    const nodeB = makeNode({ id: 'dated', content: 'buy milk', dueDate: '2026-12-31' })
    expect(search([nodeA, nodeB], 'milk').map((n) => n.id)).toEqual(['dated', 'no-date'])
  })

  it('tiebreak: rank is the final tiebreak when score and date are equal', () => {
    // Lower rank string sorts first
    const nodeA = makeNode({ id: 'first', content: 'buy milk' })
    const nodeB = makeNode({ id: 'second', content: 'buy milk' })
    // nextRank() ensures nodeA.rank < nodeB.rank (fractional indexing ascending)
    expect(search([nodeB, nodeA], 'milk').map((n) => n.id)).toEqual(['first', 'second'])
  })
})
