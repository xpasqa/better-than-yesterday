import { describe, expect, it } from 'vitest'
import { addDays, compareDates, dayOfWeek, localDate, todayInTimezone } from './date.ts'

describe('localDate', () => {
  it('renders a UTC instant in a timezone ahead of UTC, crossing midnight', () => {
    // 23:30 UTC on the 5th is 06:30 on the 6th in Jakarta (UTC+7).
    expect(localDate(new Date('2026-08-05T23:30:00Z'), 'Asia/Jakarta')).toBe('2026-08-06')
  })

  it('renders a UTC instant in a timezone behind UTC, same calendar day', () => {
    // 23:30 UTC is 19:30 the same day in New York (EDT, UTC-4 in August).
    expect(localDate(new Date('2026-08-05T23:30:00Z'), 'America/New_York')).toBe('2026-08-05')
  })

  it('handles a timezone ahead of UTC by more than 12 hours', () => {
    expect(localDate(new Date('2026-01-01T12:00:00Z'), 'Pacific/Kiritimati')).toBe('2026-01-02')
  })

  it('pads single-digit months and days', () => {
    expect(localDate(new Date('2026-01-05T00:00:00Z'), 'UTC')).toBe('2026-01-05')
  })

  it('is stable across a DST boundary (New York spring-forward, March 2026)', () => {
    // 2026-03-08 06:30 UTC is 01:30 EST; 2026-03-08 07:30 UTC is 03:30 EDT
    // (2 AM was skipped). Both must still report the same calendar date.
    expect(localDate(new Date('2026-03-08T06:30:00Z'), 'America/New_York')).toBe('2026-03-08')
    expect(localDate(new Date('2026-03-08T07:30:00Z'), 'America/New_York')).toBe('2026-03-08')
  })
})

describe('todayInTimezone', () => {
  it('is a thin wrapper over localDate with the current instant', () => {
    const now = new Date('2026-08-05T23:30:00Z')
    expect(todayInTimezone('Asia/Jakarta', now)).toBe(localDate(now, 'Asia/Jakarta'))
  })
})

describe('addDays', () => {
  it('adds within a month', () => {
    expect(addDays('2026-08-05', 3)).toBe('2026-08-08')
  })

  it('crosses a month boundary', () => {
    expect(addDays('2026-08-30', 3)).toBe('2026-09-02')
  })

  it('crosses a year boundary', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
  })

  it('crosses a leap-year February', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01') // 2027 is not a leap year
  })

  it('subtracts with a negative count', () => {
    expect(addDays('2026-08-05', -6)).toBe('2026-07-30')
  })

  it('is a no-op for zero', () => {
    expect(addDays('2026-08-05', 0)).toBe('2026-08-05')
  })
})

describe('dayOfWeek', () => {
  it('reports Sunday as 0', () => {
    expect(dayOfWeek('2026-08-09')).toBe(0) // a known Sunday
  })

  it('reports Saturday as 6', () => {
    expect(dayOfWeek('2026-08-08')).toBe(6)
  })

  it('reports Wednesday as 3', () => {
    expect(dayOfWeek('2026-08-05')).toBe(3)
  })
})

describe('compareDates', () => {
  it('orders two YYYY-MM-DD strings lexicographically, which is also chronologically', () => {
    expect(compareDates('2026-08-05', '2026-08-06')).toBeLessThan(0)
    expect(compareDates('2026-08-06', '2026-08-05')).toBeGreaterThan(0)
    expect(compareDates('2026-08-05', '2026-08-05')).toBe(0)
  })

  it('orders correctly across a year boundary despite the string length staying fixed', () => {
    expect(compareDates('2026-12-31', '2027-01-01')).toBeLessThan(0)
  })
})
