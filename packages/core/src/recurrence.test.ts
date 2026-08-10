import { describe, expect, it } from 'vitest'
import {
  anchorRecurrence,
  describeRecurrence,
  findRecurrenceCandidates,
  nextOccurrence,
  nextOccurrenceAfter,
  reanchorRecurrence,
} from './recurrence.ts'

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

  it('FREQ=MONTHLY;BYMONTHDAY=31 recovers to day 31 after crossing short months — no permanent drift (issue #25)', () => {
    // Without an anchor baked into the rule, addMonths would re-read the
    // day off the previous (already-clamped) fromDate on every call, so a
    // task due the 31st would drift to the 28th and stay there forever.
    // BYMONTHDAY makes each call re-target 31 independently of what the
    // previous occurrence landed on.
    let date = '2027-01-31'
    const rule = 'FREQ=MONTHLY;BYMONTHDAY=31'
    const results: string[] = []
    for (let i = 0; i < 4; i++) {
      date = nextOccurrence(rule, date)
      results.push(date)
    }
    expect(results).toEqual(['2027-02-28', '2027-03-31', '2027-04-30', '2027-05-31'])
  })

  it('FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29 recovers to Feb 29 the next time the target year is a leap year (issue #25)', () => {
    // Without BYMONTH/BYMONTHDAY, addMonths(fromDate, 12) would re-read the
    // day off fromDate — once clamped to 28 in a non-leap year, it would
    // stay 28 forever, never recovering even in a later leap year. The
    // anchored version always re-targets Feb 29 from the rule itself.
    const rule = 'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29'
    expect(nextOccurrence(rule, '2028-02-29')).toBe('2029-02-28') // clamped, 2029 not leap
    expect(nextOccurrence(rule, '2029-02-28')).toBe('2030-02-28') // clamped again, 2030 not leap
    expect(nextOccurrence(rule, '2031-02-28')).toBe('2032-02-29') // recovers — 2032 is leap
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

describe('anchorRecurrence', () => {
  it('embeds BYMONTHDAY into a bare FREQ=MONTHLY, derived from dueDate', () => {
    expect(anchorRecurrence('FREQ=MONTHLY', '2027-01-31')).toBe('FREQ=MONTHLY;BYMONTHDAY=31')
  })

  it('embeds BYMONTH and BYMONTHDAY into a bare FREQ=YEARLY, derived from dueDate', () => {
    expect(anchorRecurrence('FREQ=YEARLY', '2028-02-29')).toBe('FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29')
  })

  it('leaves an already-anchored rule untouched', () => {
    expect(anchorRecurrence('FREQ=MONTHLY;BYMONTHDAY=25', '2026-08-25')).toBe('FREQ=MONTHLY;BYMONTHDAY=25')
  })

  it('keeps a day the user named out loud, even when dueDate defaulted to some other day', () => {
    // The create path calls this with a dueDate that defaults to *today*
    // whenever the phrase carried no date of its own — and "setiap tanggal 8"
    // is exactly such a phrase. Re-anchoring here would rewrite the day the
    // user typed to whatever day they happened to type it on: "setiap tanggal
    // 8" entered on the 10th would silently become BYMONTHDAY=10.
    //
    // This is why re-anchoring lives in `reanchorRecurrence` and is reachable
    // only from `updateNode` (a date the user picked), never from create.
    // A branch that merged the two functions into one shipped precisely this
    // regression, so the boundary is pinned here rather than left implicit.
    expect(anchorRecurrence('FREQ=MONTHLY;BYMONTHDAY=8', '2026-08-10')).toBe('FREQ=MONTHLY;BYMONTHDAY=8')
  })

  it('leaves non-MONTHLY/YEARLY rules untouched', () => {
    expect(anchorRecurrence('FREQ=DAILY', '2026-08-05')).toBe('FREQ=DAILY')
    expect(anchorRecurrence('FREQ=WEEKLY;BYDAY=MO', '2026-08-10')).toBe('FREQ=WEEKLY;BYDAY=MO')
  })

  it('is a no-op for a null rule or a null dueDate', () => {
    expect(anchorRecurrence(null, '2026-08-05')).toBeNull()
    expect(anchorRecurrence('FREQ=MONTHLY', null)).toBe('FREQ=MONTHLY')
  })
})

describe('describeRecurrence', () => {
  const cases: [string | null, string | null][] = [
    ['FREQ=DAILY', 'setiap hari'],
    ['FREQ=DAILY;INTERVAL=1', 'setiap hari'],  // INTERVAL=1 same as bare FREQ=DAILY
    ['FREQ=DAILY;INTERVAL=3', 'setiap 3 hari'],
    ['FREQ=WEEKLY;BYDAY=MO', 'setiap Senin'],
    ['FREQ=WEEKLY;BYDAY=SU', 'setiap Minggu'],
    ['FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', 'setiap hari kerja'],
    ['FREQ=MONTHLY;BYMONTHDAY=8', 'setiap tanggal 8'],
    ['FREQ=YEARLY;BYMONTH=8;BYMONTHDAY=17', 'setiap 17 Agustus'],
    ['FREQ=HOURLY', null],
    ['bukan rrule', null],
    ['', null],
    [null, null],
  ]
  it.each(cases)('describes %s as %s', (rule, expected) => {
    expect(describeRecurrence(rule)).toBe(expected)
  })

  it('does not throw on a malformed rule', () => {
    expect(() => describeRecurrence('FREQ=MONTHLY;BYMONTHDAY=')).not.toThrow()
    expect(describeRecurrence('FREQ=MONTHLY;BYMONTHDAY=')).toBeNull()
  })
})

describe('reanchorRecurrence — issue #75, the due date the user just picked wins over a stale anchor', () => {
  it('moves BYMONTHDAY to the new dueDate, unlike anchorRecurrence which would leave it stale', () => {
    // The exact repro in issue #75: "bayar listrik setiap bulan" typed on the
    // 8th anchors to BYMONTHDAY=8, then the date chip moves the task to the
    // 20th. anchorRecurrence is a no-op here (the rule is already anchored),
    // which is why re-anchoring needs its own function.
    expect(reanchorRecurrence('FREQ=MONTHLY;BYMONTHDAY=8', '2026-08-20')).toBe('FREQ=MONTHLY;BYMONTHDAY=20')
  })

  it('moves BYMONTH and BYMONTHDAY to the new dueDate for a yearly rule', () => {
    expect(reanchorRecurrence('FREQ=YEARLY;BYMONTH=8;BYMONTHDAY=8', '2027-03-02')).toBe(
      'FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=2',
    )
  })

  it('anchors a still-bare rule too, so the create and edit paths agree', () => {
    expect(reanchorRecurrence('FREQ=MONTHLY', '2026-08-20')).toBe('FREQ=MONTHLY;BYMONTHDAY=20')
    expect(reanchorRecurrence('FREQ=YEARLY', '2026-08-20')).toBe('FREQ=YEARLY;BYMONTH=8;BYMONTHDAY=20')
  })

  it('leaves rules that carry no date anchor untouched — their phase follows dueDate on its own', () => {
    expect(reanchorRecurrence('FREQ=DAILY;INTERVAL=3', '2026-08-20')).toBe('FREQ=DAILY;INTERVAL=3')
    expect(reanchorRecurrence('FREQ=WEEKLY', '2026-08-20')).toBe('FREQ=WEEKLY')
  })

  it('leaves BYDAY alone — "setiap senin" names its own day, and #75 is not about weekday rules', () => {
    expect(reanchorRecurrence('FREQ=WEEKLY;BYDAY=MO', '2026-08-19')).toBe('FREQ=WEEKLY;BYDAY=MO')
  })

  it('is a no-op for a null rule or a null dueDate', () => {
    expect(reanchorRecurrence(null, '2026-08-20')).toBeNull()
    expect(reanchorRecurrence('FREQ=MONTHLY;BYMONTHDAY=8', null)).toBe('FREQ=MONTHLY;BYMONTHDAY=8')
  })

  it('leaves the rule alone when the re-anchored date lands on the day it already had', () => {
    expect(reanchorRecurrence('FREQ=MONTHLY;BYMONTHDAY=8', '2026-09-08')).toBe('FREQ=MONTHLY;BYMONTHDAY=8')
  })
})

describe('nextOccurrenceAfter — issue #26, catches an overdue task up to today in one call', () => {
  it('matches plain nextOccurrence when the task is not overdue (fromDate is today or later)', () => {
    // Not overdue: a single step already lands after "today", so this
    // must behave identically to the existing single-step nextOccurrence —
    // no special-casing needed for the common, non-overdue path.
    expect(nextOccurrenceAfter('FREQ=DAILY', '2026-08-05', '2026-08-05')).toBe(
      nextOccurrence('FREQ=DAILY', '2026-08-05'),
    )
  })

  it('FREQ=DAILY overdue by three weeks jumps straight to tomorrow, not one call per missed day', () => {
    expect(nextOccurrenceAfter('FREQ=DAILY', '2026-07-15', '2026-08-05')).toBe('2026-08-06')
  })

  it('FREQ=WEEKLY;BYDAY=MO overdue by a month jumps to the next real Monday', () => {
    // 2026-08-05 is a Wednesday; the next Monday on/after it is 2026-08-10.
    expect(nextOccurrenceAfter('FREQ=WEEKLY;BYDAY=MO', '2026-07-06', '2026-08-05')).toBe('2026-08-10')
  })

  it('FREQ=MONTHLY;BYMONTHDAY=15 overdue by several months jumps to this month\'s (or next month\'s) 15th', () => {
    expect(nextOccurrenceAfter('FREQ=MONTHLY;BYMONTHDAY=15', '2026-04-15', '2026-08-05')).toBe('2026-08-15')
  })

  it('preserves interval-based phase alignment instead of resetting the cadence to today (the reason a loop is needed, not a direct nextOccurrence(rule, today) shortcut)', () => {
    // Original cadence: Jan 1, 4, 7, 10, 13, 16, 19, 22, 25... every 3 days.
    // Last known occurrence Jan 10, "today" is Jan 20 — catching up must
    // land on the next date IN THAT SEQUENCE (Jan 22), not on
    // nextOccurrence('FREQ=DAILY;INTERVAL=3', '2026-01-20') = Jan 23, which
    // would silently reset the phase to be relative to today instead.
    expect(nextOccurrenceAfter('FREQ=DAILY;INTERVAL=3', '2026-01-10', '2026-01-20')).toBe('2026-01-22')
  })

  it('the result is always strictly after "today", never equal to it', () => {
    // A task due exactly today, completed today: single-step already
    // exceeds today, so the loop must not run an unnecessary extra step.
    expect(nextOccurrenceAfter('FREQ=DAILY', '2026-08-05', '2026-08-05')).toBe('2026-08-06')
  })
})
