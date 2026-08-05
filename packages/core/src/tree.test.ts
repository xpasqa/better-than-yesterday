import { describe, expect, it } from 'vitest'
import { between } from './rank.ts'
import { indent, move, outdent, wouldCreateCycle, type TreeNodeLike } from './tree.ts'

// Small fixture tree:
//
// root-a (rank a)
//   ├─ child-1 (rank a)
//   └─ child-2 (rank b)
// root-b (rank b)
//   └─ grandchild (rank a, child of child-2 conceptually — see below)
//
// Built incrementally with real `between()` output so ranks are realistic,
// not hand-typed strings that happen to compare correctly by accident.
function fixture(): TreeNodeLike[] {
  const rootA = { id: 'root-a', parentId: null, rank: between(null, null) }
  const rootB = { id: 'root-b', parentId: null, rank: between(rootA.rank, null) }
  const child1 = { id: 'child-1', parentId: 'root-a', rank: between(null, null) }
  const child2 = { id: 'child-2', parentId: 'root-a', rank: between(child1.rank, null) }
  const grandchild = { id: 'grandchild', parentId: 'child-2', rank: between(null, null) }
  return [rootA, rootB, child1, child2, grandchild]
}

describe('indent (Tab)', () => {
  it('is a no-op when there is no previous sibling', () => {
    const nodes = fixture()
    // child-1 is the first child of root-a — nothing to its left.
    expect(indent(nodes, 'child-1')).toBeNull()
  })

  it('is a no-op for the first root, which has no previous sibling either', () => {
    const nodes = fixture()
    expect(indent(nodes, 'root-a')).toBeNull()
  })

  it('becomes the previous sibling\'s last child', () => {
    const nodes = fixture()
    // child-2 follows child-1 under root-a; indenting makes it child-1's child.
    const result = indent(nodes, 'child-2')
    expect(result).not.toBeNull()
    expect(result!.parentId).toBe('child-1')
  })

  it('is appended after any existing children of the new parent', () => {
    const nodes = fixture()
    // root-b follows root-a; indenting root-b makes it root-a's child, after
    // root-a's existing children (child-1, child-2).
    const result = indent(nodes, 'root-b')!
    expect(result.parentId).toBe('root-a')
    expect(result.rank > nodes.find((n) => n.id === 'child-2')!.rank).toBe(true)
  })

  it('carries the whole subtree implicitly — descendants still point at the same parent id', () => {
    const nodes = fixture()
    const result = indent(nodes, 'child-2')!
    const moved = { ...nodes.find((n) => n.id === 'child-2')!, ...result }
    const next = nodes.map((n) => (n.id === 'child-2' ? moved : n))
    // grandchild's parentId ('child-2') never changes — it comes along for free.
    expect(next.find((n) => n.id === 'grandchild')!.parentId).toBe('child-2')
  })
})

describe('outdent (Shift+Tab)', () => {
  it('is a no-op when already at the top level', () => {
    const nodes = fixture()
    expect(outdent(nodes, 'root-a')).toBeNull()
  })

  it("becomes the parent's next sibling", () => {
    const nodes = fixture()
    // grandchild's parent is child-2, whose parent is root-a (top-level).
    const result = outdent(nodes, 'grandchild')!
    expect(result.parentId).toBe('root-a')
  })

  it('does not adopt siblings that followed its old parent', () => {
    const nodes = fixture()
    const result = outdent(nodes, 'grandchild')!
    // child-2 (grandchild's old parent) is root-a's LAST child, so
    // outdenting places grandchild after child-2, not before it, and it must
    // not end up ordered before child-1 either.
    const child2Rank = nodes.find((n) => n.id === 'child-2')!.rank
    expect(result.rank > child2Rank).toBe(true)
  })

  it('inserts before whatever followed the old parent among the grandparent\'s children', () => {
    // root-a has two children today; add a third root-level node after
    // root-a so outdenting root-a's child must land strictly before it.
    const nodes = fixture()
    const rootC = { id: 'root-c', parentId: null, rank: between(nodes.find((n) => n.id === 'root-b')!.rank, null) }
    nodes.push(rootC)
    const result = outdent(nodes, 'child-2')! // child-2's parent is root-a (top-level); root-b follows root-a
    expect(result.parentId).toBeNull()
    expect(result.rank > nodes.find((n) => n.id === 'root-a')!.rank).toBe(true)
    expect(result.rank < nodes.find((n) => n.id === 'root-b')!.rank).toBe(true)
  })
})

describe('wouldCreateCycle', () => {
  it('is false when moving to the root', () => {
    const nodes = fixture()
    expect(wouldCreateCycle(nodes, 'child-2', null)).toBe(false)
  })

  it('is true when a node is made its own parent', () => {
    const nodes = fixture()
    expect(wouldCreateCycle(nodes, 'child-2', 'child-2')).toBe(true)
  })

  it('is true when reparenting a node under its own descendant', () => {
    const nodes = fixture()
    // child-2 -> grandchild is an existing parent/child link; making
    // child-2 a child of grandchild would close the loop.
    expect(wouldCreateCycle(nodes, 'child-2', 'grandchild')).toBe(true)
  })

  it('is false for an unrelated target', () => {
    const nodes = fixture()
    expect(wouldCreateCycle(nodes, 'child-2', 'root-b')).toBe(false)
  })
})

describe('move', () => {
  it('rejects a move that would create a cycle', () => {
    const nodes = fixture()
    expect(() => move(nodes, 'child-2', 'grandchild', null)).toThrow()
  })

  it('reparents to root and appends when beforeId is null', () => {
    const nodes = fixture()
    const result = move(nodes, 'child-2', null, null)
    expect(result.parentId).toBeNull()
    const lastRoot = nodes.find((n) => n.id === 'root-b')!.rank
    expect(result.rank > lastRoot).toBe(true)
  })

  it('inserts immediately before the given sibling', () => {
    const nodes = fixture()
    // Move grandchild to be a root, positioned before root-b.
    const result = move(nodes, 'grandchild', null, 'root-b')
    expect(result.parentId).toBeNull()
    expect(result.rank > nodes.find((n) => n.id === 'root-a')!.rank).toBe(true)
    expect(result.rank < nodes.find((n) => n.id === 'root-b')!.rank).toBe(true)
  })

  it('excludes the node itself from its own sibling ordering (moving within the same parent)', () => {
    const nodes = fixture()
    // Move child-1 to be positioned right before child-2, within the same parent.
    const result = move(nodes, 'child-1', 'root-a', 'child-2')
    expect(result.parentId).toBe('root-a')
    expect(result.rank < nodes.find((n) => n.id === 'child-2')!.rank).toBe(true)
  })
})
