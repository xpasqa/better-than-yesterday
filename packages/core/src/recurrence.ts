// Recurring-task phrase parser + next-occurrence math.
// docs/feature/2.backend/1.todo/spec.md §8 — exactly the eight patterns in
// that table, stored as a small RRULE subset (canonical text, e.g.
// 'FREQ=WEEKLY;BYDAY=MO'). Not a general RRULE engine — anything outside
// these eight patterns is left as plain title text, same rule `parse.ts`
// already follows for everything else it doesn't recognize.
import { addDays, dayOfWeek } from './date.ts'

interface Candidate {
  start: number
  end: number
  value: string
}

const WEEKDAY_TO_CODE: Record<string, string> = {
  senin: 'MO',
  monday: 'MO',
  selasa: 'TU',
  tuesday: 'TU',
  rabu: 'WE',
  wednesday: 'WE',
  kamis: 'TH',
  thursday: 'TH',
  jumat: 'FR',
  friday: 'FR',
  sabtu: 'SA',
  saturday: 'SA',
  // Sunday/"minggu" is deliberately excluded — "setiap minggu" means
  // "every week" (spec.md §8 row 5), not "every Sunday". Spec's eight
  // patterns have no "every Sunday" row, so there is nothing to support.
}

/** Finds every occurrence of the eight spec.md §8 recurrence phrases in `input`. */
export function findRecurrenceCandidates(input: string): Candidate[] {
  const candidates: Candidate[] = []

  for (const m of input.matchAll(/\b(?:setiap hari kerja|every weekday)\b/gi)) {
    candidates.push({ start: m.index, end: m.index + m[0].length, value: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' })
  }

  for (const m of input.matchAll(/\b(?:setiap hari|every day)\b/gi)) {
    candidates.push({ start: m.index, end: m.index + m[0].length, value: 'FREQ=DAILY' })
  }

  for (const m of input.matchAll(/\bsetiap\s+(\d+)\s+hari\b/gi)) {
    candidates.push({ start: m.index, end: m.index + m[0].length, value: `FREQ=DAILY;INTERVAL=${m[1]}` })
  }
  for (const m of input.matchAll(/\bevery\s+(\d+)\s+days?\b/gi)) {
    candidates.push({ start: m.index, end: m.index + m[0].length, value: `FREQ=DAILY;INTERVAL=${m[1]}` })
  }

  for (const m of input.matchAll(
    /\b(?:setiap|every)\s+(senin|selasa|rabu|kamis|jumat|sabtu|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi,
  )) {
    const code = WEEKDAY_TO_CODE[m[1]!.toLowerCase()]
    candidates.push({ start: m.index, end: m.index + m[0].length, value: `FREQ=WEEKLY;BYDAY=${code}` })
  }

  for (const m of input.matchAll(/\b(?:setiap minggu|every week)\b/gi)) {
    candidates.push({ start: m.index, end: m.index + m[0].length, value: 'FREQ=WEEKLY' })
  }

  for (const m of input.matchAll(/\b(?:setiap bulan|every month)\b/gi)) {
    candidates.push({ start: m.index, end: m.index + m[0].length, value: 'FREQ=MONTHLY' })
  }

  for (const m of input.matchAll(/\bsetiap tanggal\s+(\d{1,2})\b/gi)) {
    const day = Number(m[1])
    if (day < 1 || day > 31) continue
    candidates.push({ start: m.index, end: m.index + m[0].length, value: `FREQ=MONTHLY;BYMONTHDAY=${day}` })
  }
  for (const m of input.matchAll(/\bevery\s+(\d{1,2})(?:st|nd|rd|th)\b/gi)) {
    const day = Number(m[1])
    if (day < 1 || day > 31) continue
    candidates.push({ start: m.index, end: m.index + m[0].length, value: `FREQ=MONTHLY;BYMONTHDAY=${day}` })
  }

  for (const m of input.matchAll(/\b(?:setiap tahun|every year)\b/gi)) {
    candidates.push({ start: m.index, end: m.index + m[0].length, value: 'FREQ=YEARLY' })
  }

  return candidates
}

interface ParsedRule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
  interval: number
  byDay: string[] | null
  byMonthDay: number | null
}

function parseRule(rule: string): ParsedRule {
  const parts: Record<string, string> = {}
  for (const part of rule.split(';')) {
    const [key, value] = part.split('=')
    if (key && value) parts[key] = value
  }
  return {
    freq: parts.FREQ as ParsedRule['freq'],
    interval: parts.INTERVAL ? Number(parts.INTERVAL) : 1,
    byDay: parts.BYDAY ? parts.BYDAY.split(',') : null,
    byMonthDay: parts.BYMONTHDAY ? Number(parts.BYMONTHDAY) : null,
  }
}

/** Last day of the given month (1-12). Day 0 of the following month is the last day of this one. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** `dateStr` shifted by `months`, with `targetDay` clamped to however many days that target month actually has. */
function addMonthsToDay(dateStr: string, months: number, targetDay: number): string {
  const [year, month] = dateStr.split('-').map(Number) as [number, number, number]
  const totalMonths = year * 12 + (month - 1) + months
  const targetYear = Math.floor(totalMonths / 12)
  const targetMonth = (totalMonths % 12) + 1
  const clampedDay = Math.min(targetDay, daysInMonth(targetYear, targetMonth))
  return `${String(targetYear).padStart(4, '0')}-${String(targetMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`
}

/** `dateStr` shifted by `months`, keeping the same day-of-month (clamped if the target month is shorter). */
function addMonths(dateStr: string, months: number): string {
  const day = Number(dateStr.split('-')[2])
  return addMonthsToDay(dateStr, months, day)
}

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

/** The next date after `fromDate` (exclusive) whose weekday is in `byDayCodes`. */
function nextByDay(fromDate: string, byDayCodes: string[]): string {
  const targets = new Set(byDayCodes.map((c) => DAY_CODES.indexOf(c)))
  const fromDow = dayOfWeek(fromDate)
  for (let add = 1; add <= 7; add++) {
    if (targets.has((fromDow + add) % 7)) return addDays(fromDate, add)
  }
  return addDays(fromDate, 7) // unreachable when byDayCodes is non-empty; keeps the function total
}

/**
 * The next occurrence strictly after `fromDate` for a rule produced by
 * `findRecurrenceCandidates`. Pure calendar-date arithmetic — see
 * date.ts's header comment for why this sidesteps DST entirely rather than
 * needing special-case handling for it.
 */
export function nextOccurrence(rule: string, fromDate: string): string {
  const { freq, interval, byDay, byMonthDay } = parseRule(rule)
  if (freq === 'DAILY') return addDays(fromDate, interval)
  if (freq === 'WEEKLY') return byDay ? nextByDay(fromDate, byDay) : addDays(fromDate, 7)
  if (freq === 'MONTHLY') return byMonthDay ? addMonthsToDay(fromDate, 1, byMonthDay) : addMonths(fromDate, 1)
  return addMonths(fromDate, 12) // YEARLY
}
