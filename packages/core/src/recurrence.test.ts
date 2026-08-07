import { describe, expect, it } from 'vitest'
import { findRecurrenceCandidates } from './recurrence.ts'

function values(input: string): string[] {
  return findRecurrenceCandidates(input).map((c) => c.value)
}

describe('findRecurrenceCandidates — the eight spec.md §8 patterns', () => {
  it('parses "setiap hari" / "every day" as FREQ=DAILY', () => {
    expect(values('siram tanaman setiap hari')).toEqual(['FREQ=DAILY'])
    expect(values('water the plants every day')).toEqual(['FREQ=DAILY'])
  })

  it('parses "setiap <weekday>" / "every <weekday>" as FREQ=WEEKLY;BYDAY=XX', () => {
    expect(values('rapat setiap senin')).toEqual(['FREQ=WEEKLY;BYDAY=MO'])
    expect(values('standup every friday')).toEqual(['FREQ=WEEKLY;BYDAY=FR'])
  })

  it('parses "setiap hari kerja" / "every weekday" as FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', () => {
    // "setiap hari kerja" also contains "setiap hari" as a nested match at
    // this raw-candidate layer (see the dedicated edge-case test below) —
    // toContain here only asserts this pattern IS recognized, not that it's
    // the only candidate found. "every weekday" has no such nested overlap
    // ("weekday" has no word-boundary before "day"), so toEqual is exact there.
    expect(values('cek email setiap hari kerja')).toContain('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')
    expect(values('standup every weekday')).toEqual(['FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'])
  })

  it('parses "setiap N hari" / "every N days" as FREQ=DAILY;INTERVAL=N', () => {
    expect(values('minum obat setiap 3 hari')).toEqual(['FREQ=DAILY;INTERVAL=3'])
    expect(values('water every 2 days')).toEqual(['FREQ=DAILY;INTERVAL=2'])
  })

  it('parses "setiap minggu" / "every week" as FREQ=WEEKLY', () => {
    expect(values('laporan setiap minggu')).toEqual(['FREQ=WEEKLY'])
    expect(values('report every week')).toEqual(['FREQ=WEEKLY'])
  })

  it('parses "setiap bulan" / "every month" as FREQ=MONTHLY', () => {
    expect(values('bayar sewa setiap bulan')).toEqual(['FREQ=MONTHLY'])
    expect(values('pay rent every month')).toEqual(['FREQ=MONTHLY'])
  })

  it('parses "setiap tanggal N" / "every Nth" as FREQ=MONTHLY;BYMONTHDAY=N', () => {
    expect(values('gajian setiap tanggal 25')).toEqual(['FREQ=MONTHLY;BYMONTHDAY=25'])
    expect(values('invoice every 1st')).toEqual(['FREQ=MONTHLY;BYMONTHDAY=1'])
    expect(values('review every 23rd')).toEqual(['FREQ=MONTHLY;BYMONTHDAY=23'])
  })

  it('parses "setiap tahun" / "every year" as FREQ=YEARLY', () => {
    expect(values('perpanjang paspor setiap tahun')).toEqual(['FREQ=YEARLY'])
    expect(values('renew passport every year')).toEqual(['FREQ=YEARLY'])
  })
})

describe('findRecurrenceCandidates — edge cases', () => {
  it('returns an empty array for text with no recurrence phrase', () => {
    expect(findRecurrenceCandidates('beli susu besok')).toEqual([])
  })

  it('is case-insensitive', () => {
    expect(values('SETIAP HARI belanja')).toEqual(['FREQ=DAILY'])
  })

  it('returns both the "setiap hari kerja" and nested "setiap hari" candidates — this function does no containment filtering, that is pickRightmostNonNested\'s job at the call site (Task 3)', () => {
    const candidates = findRecurrenceCandidates('cek email setiap hari kerja')
    expect(candidates.map((c) => c.value)).toEqual(
      expect.arrayContaining(['FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', 'FREQ=DAILY']),
    )
    expect(candidates).toHaveLength(2)
  })

  it('"setiap minggu" (every week) is never confused with Sunday — "minggu" is excluded from the weekday-name pattern', () => {
    expect(values('laporan setiap minggu')).toEqual(['FREQ=WEEKLY'])
  })

  it('reports the correct start/end span covering the whole matched phrase', () => {
    const [c] = findRecurrenceCandidates('siram tanaman setiap hari ya')
    expect(c).toBeDefined()
    expect('siram tanaman setiap hari ya'.slice(c!.start, c!.end)).toBe('setiap hari')
  })

  it('ignores an out-of-range day-of-month ("setiap tanggal 35")', () => {
    expect(values('setiap tanggal 35')).toEqual([])
  })

  it('ignores day 0 in "setiap tanggal" (day < 1 branch)', () => {
    expect(values('setiap tanggal 0')).toEqual([])
  })

  it('ignores an out-of-range day in the English "every Nth" pattern', () => {
    expect(values('every 32nd')).toEqual([])
  })

  it('does not match "setiap 3 hari" as bare "setiap hari" (distinct literal text, no overlap)', () => {
    expect(values('minum obat setiap 3 hari')).toEqual(['FREQ=DAILY;INTERVAL=3'])
  })
})

import { nextOccurrence } from './recurrence.ts'

describe('nextOccurrence', () => {
  it('FREQ=DAILY advances by one day', () => {
    expect(nextOccurrence('FREQ=DAILY', '2026-08-05')).toBe('2026-08-06')
  })

  it('FREQ=DAILY;INTERVAL=N advances by N days', () => {
    expect(nextOccurrence('FREQ=DAILY;INTERVAL=3', '2026-08-05')).toBe('2026-08-08')
  })

  it('FREQ=WEEKLY (no BYDAY) advances by exactly seven days', () => {
    expect(nextOccurrence('FREQ=WEEKLY', '2026-08-05')).toBe('2026-08-12')
  })

  it('FREQ=WEEKLY;BYDAY=XX advances to the next matching weekday, wrapping to next week', () => {
    // 2026-08-05 is a Wednesday. Next Monday is 2026-08-10.
    expect(nextOccurrence('FREQ=WEEKLY;BYDAY=MO', '2026-08-05')).toBe('2026-08-10')
    // Next Friday (later this same week) is 2026-08-07.
    expect(nextOccurrence('FREQ=WEEKLY;BYDAY=FR', '2026-08-05')).toBe('2026-08-07')
  })

  it('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR (weekday) skips the weekend', () => {
    // 2026-08-07 is a Friday — next weekday occurrence is Monday 2026-08-10.
    expect(nextOccurrence('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', '2026-08-07')).toBe('2026-08-10')
  })

  it('FREQ=MONTHLY (no BYMONTHDAY) advances to the same day next month', () => {
    expect(nextOccurrence('FREQ=MONTHLY', '2026-08-15')).toBe('2026-09-15')
  })

  it('FREQ=MONTHLY clamps to the last day of a shorter target month (end-of-month edge case)', () => {
    // Jan 31 -> Feb has 28 days in 2027 (not a leap year).
    expect(nextOccurrence('FREQ=MONTHLY', '2027-01-31')).toBe('2027-02-28')
  })

  it('FREQ=MONTHLY;BYMONTHDAY=N advances to day N of next month', () => {
    expect(nextOccurrence('FREQ=MONTHLY;BYMONTHDAY=25', '2026-08-25')).toBe('2026-09-25')
  })

  it('FREQ=MONTHLY;BYMONTHDAY=31 clamps in a 30-day month', () => {
    expect(nextOccurrence('FREQ=MONTHLY;BYMONTHDAY=31', '2026-08-31')).toBe('2026-09-30')
  })

  it('FREQ=YEARLY advances to the same month/day next year', () => {
    expect(nextOccurrence('FREQ=YEARLY', '2026-08-05')).toBe('2027-08-05')
  })

  it('FREQ=YEARLY clamps Feb 29 to Feb 28 in a non-leap target year (leap-year edge case, spec.md §12)', () => {
    // 2028 is a leap year; 2029 is not. nextOccurrence always advances by
    // exactly one calendar year for YEARLY, so this — not "wait for the
    // next actual leap year" — is the real, spec-required behavior.
    expect(nextOccurrence('FREQ=YEARLY', '2028-02-29')).toBe('2029-02-28')
  })

  it('is stable across a DST transition boundary (calendar-date arithmetic, not wall-clock)', () => {
    // Jakarta has no DST, but the underlying UTC-noon-anchored arithmetic in
    // date.ts is what actually prevents DST bugs — this exercises the same
    // codepath across a boundary where a naive local-Date implementation in
    // a DST timezone would be at risk of drifting a day.
    expect(nextOccurrence('FREQ=DAILY', '2026-03-08')).toBe('2026-03-09')
    expect(nextOccurrence('FREQ=WEEKLY', '2026-03-08')).toBe('2026-03-15')
  })

  it('FREQ=WEEKLY;BYDAY=XX (all invalid codes) falls back to seven-day offset for unreachable-return coverage', () => {
    // nextByDay with invalid codes doesn't find any matching weekday within 7 days,
    // so it returns the fallback (add 7 days). This covers the "unreachable when
    // byDayCodes is non-empty" return statement for 100% branch coverage.
    expect(nextOccurrence('FREQ=WEEKLY;BYDAY=XX,YY', '2026-08-05')).toBe('2026-08-12')
  })

  it('throws on an unrecognized FREQ (malformed/corrupted rule text)', () => {
    expect(() => nextOccurrence('FREQ=BOGUS', '2026-08-05')).toThrow()
  })

  it('throws on a rule with no FREQ at all', () => {
    expect(() => nextOccurrence('', '2026-08-05')).toThrow()
  })

  it('clamps INTERVAL=0 to 1 so it always genuinely advances (reachable from real text like "setiap 0 hari")', () => {
    expect(nextOccurrence('FREQ=DAILY;INTERVAL=0', '2026-08-05')).toBe('2026-08-06')
  })
})
