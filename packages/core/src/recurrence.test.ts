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
