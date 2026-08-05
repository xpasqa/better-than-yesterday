import { beforeEach, describe, expect, it } from 'vitest'
import { isRateLimited, recordAttempt, resetRateLimit } from './rate-limit.ts'

beforeEach(() => {
  resetRateLimit()
})

describe('rate limit', () => {
  it('allows the first 5 attempts', () => {
    const now = Date.now()
    for (let i = 0; i < 5; i++) {
      expect(isRateLimited('a@example.com', '1.1.1.1', now)).toBe(false)
      recordAttempt('a@example.com', '1.1.1.1', now)
    }
  })

  it('blocks the 6th attempt within the window', () => {
    const now = Date.now()
    for (let i = 0; i < 5; i++) recordAttempt('a@example.com', '1.1.1.1', now)
    expect(isRateLimited('a@example.com', '1.1.1.1', now)).toBe(true)
  })

  it('is scoped per email+IP — a different IP is not limited', () => {
    const now = Date.now()
    for (let i = 0; i < 5; i++) recordAttempt('a@example.com', '1.1.1.1', now)
    expect(isRateLimited('a@example.com', '2.2.2.2', now)).toBe(false)
  })

  it('is scoped per email+IP — a different email at the same IP is not limited', () => {
    const now = Date.now()
    for (let i = 0; i < 5; i++) recordAttempt('a@example.com', '1.1.1.1', now)
    expect(isRateLimited('b@example.com', '1.1.1.1', now)).toBe(false)
  })

  it('is case-insensitive on email', () => {
    const now = Date.now()
    for (let i = 0; i < 5; i++) recordAttempt('A@Example.com', '1.1.1.1', now)
    expect(isRateLimited('a@example.com', '1.1.1.1', now)).toBe(true)
  })

  it('forgets attempts once the 15-minute window has passed', () => {
    const now = Date.now()
    for (let i = 0; i < 5; i++) recordAttempt('a@example.com', '1.1.1.1', now)
    const SIXTEEN_MINUTES = 16 * 60 * 1000
    expect(isRateLimited('a@example.com', '1.1.1.1', now + SIXTEEN_MINUTES)).toBe(false)
  })
})
