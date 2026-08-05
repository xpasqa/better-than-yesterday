import { describe, expect, it } from 'vitest'
import { between, rebalance } from './rank.ts'

describe('between', () => {
  it('produces a key for the very first row', () => {
    expect(typeof between(null, null)).toBe('string')
  })

  it('appends after an existing key when there is nothing to its right', () => {
    const a = between(null, null)
    const appended = between(a, null)
    expect(appended > a).toBe(true)
  })

  it('prepends before an existing key when there is nothing to its left', () => {
    const b = between(null, null)
    const prepended = between(null, b)
    expect(prepended < b).toBe(true)
  })

  it('inserts strictly between two existing keys', () => {
    const a = between(null, null)
    const c = between(a, null)
    const b = between(a, c)
    expect(a < b).toBe(true)
    expect(b < c).toBe(true)
  })

  it('rejects an inverted range', () => {
    const a = between(null, null)
    const c = between(a, null)
    expect(() => between(c, a)).toThrow()
  })

  it('breaks a tie by appending after, when both neighbors are the same key', () => {
    // Two sibling rows that ended up with an identical rank — a bug
    // elsewhere, or two offline devices assigning the same value — must not
    // crash the insert. We cannot know true intent from equal keys, so the
    // new row goes right after them.
    const a = between(null, null)
    const inserted = between(a, a)
    expect(inserted > a).toBe(true)
  })

  it('stays correctly ordered across 200 repeated inserts at the same midpoint', () => {
    // Every new key is squeezed between the same left neighbor and the
    // previous insert — the worst case for key growth, and exactly what
    // `rebalance` exists to recover from.
    let left = between(null, null)
    const right = between(left, null)
    let current = right
    const inserted: string[] = []
    for (let i = 0; i < 200; i++) {
      current = between(left, current)
      inserted.push(current)
    }
    // Each new key sits strictly between the fixed left bound and the
    // previous insert, so the sequence is strictly decreasing.
    for (let i = 1; i < inserted.length; i++) {
      expect(inserted[i]! < inserted[i - 1]!).toBe(true)
      expect(inserted[i]! > left).toBe(true)
    }
    // The key length grew — this is the condition that should trigger a
    // rebalance in the layer above rank.ts, not a bug in rank.ts itself.
    expect(inserted.at(-1)!.length).toBeGreaterThan(left.length + 5)
  })

  it('keeps key length short for 500 sequential appends (the well-behaved case)', () => {
    let last: string | null = null
    for (let i = 0; i < 500; i++) {
      last = between(last, null)
    }
    // Appending never bisects, so length should stay small regardless of count.
    expect(last!.length).toBeLessThan(6)
  })
})

describe('rebalance', () => {
  it('returns as many keys as requested', () => {
    expect(rebalance(5)).toHaveLength(5)
  })

  it('returns keys in strictly increasing order', () => {
    const keys = rebalance(50)
    for (let i = 1; i < keys.length; i++) {
      expect(keys[i]! > keys[i - 1]!).toBe(true)
    }
  })

  it('returns short, evenly-sized keys even for a large sibling count', () => {
    const keys = rebalance(500)
    const maxLength = Math.max(...keys.map((k) => k.length))
    expect(maxLength).toBeLessThan(6)
  })

  it('returns an empty array for zero items without error', () => {
    expect(rebalance(0)).toEqual([])
  })

  it('rejects a negative count', () => {
    expect(() => rebalance(-1)).toThrow()
  })
})
