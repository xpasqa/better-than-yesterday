import { describe, expect, it } from 'vitest'
import { uuidv7 } from './id.ts'

const UUID_V7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('uuidv7', () => {
  it('returns a well-formed UUID', () => {
    expect(uuidv7()).toMatch(UUID_V7_RE)
  })

  it('sets the version nibble to 7', () => {
    const id = uuidv7()
    expect(id[14]).toBe('7')
  })

  it('sets the RFC 4122 variant bits (8, 9, a, or b)', () => {
    const id = uuidv7()
    expect(['8', '9', 'a', 'b']).toContain(id[19])
  })

  it('never returns the same id twice across many calls', () => {
    const ids = new Set(Array.from({ length: 10_000 }, () => uuidv7()))
    expect(ids.size).toBe(10_000)
  })

  it('is lexicographically monotonic even when generated in the same millisecond', () => {
    const ids = Array.from({ length: 5_000 }, () => uuidv7())
    const sorted = [...ids].sort()
    expect(ids).toEqual(sorted)
  })

  it('encodes a timestamp that increases across a real time gap', async () => {
    const first = uuidv7()
    await new Promise((resolve) => setTimeout(resolve, 5))
    const second = uuidv7()
    expect(first < second).toBe(true)
  })
})
