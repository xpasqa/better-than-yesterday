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
  // Sunday/"minggu" is deliberately excluded — this file's own output for
  // "setiap minggu" is the unambiguous FREQ=WEEKLY (spec.md §8 row 5, "every
  // week"), never a weekday-anchored rule. That said, `parse()` composes
  // this module's output with parse.ts's separate `findDateCandidates`,
  // which DOES treat bare "minggu" as Sunday for date purposes — so the
  // *composed* result of e.g. `parse('laporan setiap minggu', ctx)` is
  // `dueDate: <next Sunday>, recurrence: 'FREQ=WEEKLY'`, which in practice
  // behaves as "every Sunday". That's benign (Sunday is a fine anchor for a
  // weekly task) and intentional at the composition layer, just documented
  // here so it isn't mistaken for the bug it resembles. See
  // parse.test.ts's "setiap minggu" composition test for the pinned
  // behavior.
}

const DAY_NAMES: Record<string, string> = {
  SU: 'Minggu', MO: 'Senin', TU: 'Selasa', WE: 'Rabu',
  TH: 'Kamis', FR: 'Jumat', SA: 'Sabtu',
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/**
 * Converts an RRULE string (as produced by this module) into a short human
 * phrase in Indonesian, for display only. Returns null for anything this app
 * does not itself produce — the caller shows no icon, which is a cosmetic gap,
 * whereas throwing would take down the whole list.
 */
export function describeRecurrence(rule: string | null): string | null {
  if (!rule) return null
  try {
    const parts = new Map(
      rule.split(';').map((p) => {
        const i = p.indexOf('=')
        return [p.slice(0, i), p.slice(i + 1)] as [string, string]
      }),
    )

    const freq = parts.get('FREQ')

    if (freq === 'DAILY') {
      const interval = parts.get('INTERVAL')
      if (!interval) return 'setiap hari'
      const n = Number(interval)
      if (!Number.isInteger(n) || n < 1) return null
      return n === 1 ? 'setiap hari' : `setiap ${n} hari`
    }

    if (freq === 'WEEKLY') {
      const byday = parts.get('BYDAY')
      if (!byday) return null
      if (byday === 'MO,TU,WE,TH,FR') return 'setiap hari kerja'
      const days = byday.split(',')
      if (days.length === 1 && DAY_NAMES[days[0]]) return `setiap ${DAY_NAMES[days[0]]}`
      return null
    }

    if (freq === 'MONTHLY') {
      const bymonthday = parts.get('BYMONTHDAY')
      if (!bymonthday) return null
      const d = Number(bymonthday)
      return Number.isInteger(d) && d > 0 ? `setiap tanggal ${d}` : null
    }

    if (freq === 'YEARLY') {
      const bymonth = parts.get('BYMONTH')
      const bymonthday = parts.get('BYMONTHDAY')
      if (!bymonth || !bymonthday) return null
      const m = Number(bymonth)
      const d = Number(bymonthday)
      if (!Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(d) || d < 1) return null
      return `setiap ${d} ${MONTH_NAMES[m - 1]}`
    }

    return null
  } catch {
    return null
  }
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
  byMonth: number | null
}

function parseRule(rule: string): ParsedRule {
  const parts: Record<string, string> = {}
  for (const part of rule.split(';')) {
    const [key, value] = part.split('=')
    if (key && value) parts[key] = value
  }
  return {
    freq: parts.FREQ as ParsedRule['freq'],
    interval: Math.max(1, Number(parts.INTERVAL) || 1),
    byDay: parts.BYDAY ? parts.BYDAY.split(',') : null,
    byMonthDay: parts.BYMONTHDAY ? Number(parts.BYMONTHDAY) : null,
    byMonth: parts.BYMONTH ? Number(parts.BYMONTH) : null,
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

/**
 * `dateStr`'s year shifted by `years`, re-targeting a fixed `targetMonth`/
 * `targetDay` rather than reading them off `dateStr`. This is what lets a
 * Feb-29-anchored yearly rule recover to Feb 29 the next time the target
 * year is itself a leap year, instead of staying clamped to Feb 28 forever
 * once a non-leap year clamps it once (see `nextOccurrence`'s BYMONTH branch).
 */
function addYears(dateStr: string, years: number, targetMonth: number, targetDay: number): string {
  const year = Number(dateStr.split('-')[0])
  const targetYear = year + years
  const clampedDay = Math.min(targetDay, daysInMonth(targetYear, targetMonth))
  return `${String(targetYear).padStart(4, '0')}-${String(targetMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`
}

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

/** The next date after `fromDate` (exclusive) whose weekday is in `byDayCodes`. */
function nextByDay(fromDate: string, byDayCodes: string[]): string {
  const targets = new Set(byDayCodes.map((c) => DAY_CODES.indexOf(c)))
  const fromDow = dayOfWeek(fromDate)
  for (let add = 1; add <= 7; add++) {
    if (targets.has((fromDow + add) % 7)) return addDays(fromDate, add)
  }
  return addDays(fromDate, 7) // defensive fallback for malformed BYDAY content (e.g., all invalid codes)
}

/**
 * The next occurrence strictly after `fromDate` for a rule produced by
 * `findRecurrenceCandidates`. Pure calendar-date arithmetic — see
 * date.ts's header comment for why this sidesteps DST entirely rather than
 * needing special-case handling for it.
 */
export function nextOccurrence(rule: string, fromDate: string): string {
  const { freq, interval, byDay, byMonthDay, byMonth } = parseRule(rule)
  if (freq === 'DAILY') return addDays(fromDate, interval)
  if (freq === 'WEEKLY') return byDay ? nextByDay(fromDate, byDay) : addDays(fromDate, 7)
  if (freq === 'MONTHLY') return byMonthDay ? addMonthsToDay(fromDate, 1, byMonthDay) : addMonths(fromDate, 1)
  if (freq === 'YEARLY') {
    return byMonth && byMonthDay ? addYears(fromDate, 1, byMonth, byMonthDay) : addMonths(fromDate, 12)
  }
  throw new Error(`nextOccurrence: unrecognized or missing FREQ in rule "${rule}"`)
}

/**
 * Like `nextOccurrence`, but catches an overdue task up to today in one
 * call instead of requiring one call per missed occurrence (issue #26,
 * Todoist-style): loops until the result is strictly after `notAfter`
 * (typically today), not just one step past `fromDate`. Each step still
 * advances from the actual previous occurrence rather than jumping
 * straight to `nextOccurrence(rule, notAfter)` — that shortcut would work
 * for anchored patterns (weekday/day-of-month/month+day all re-derive
 * correctly from any date) but would silently reset the phase of an
 * interval-based rule (`FREQ=DAILY;INTERVAL=N`) to be relative to
 * `notAfter` instead of to whenever the task actually started. Terminates
 * because `nextOccurrence` always returns strictly after its input, so the
 * date is guaranteed to exceed `notAfter` after finitely many steps.
 */
export function nextOccurrenceAfter(rule: string, fromDate: string, notAfter: string): string {
  let next = nextOccurrence(rule, fromDate)
  while (next <= notAfter) {
    next = nextOccurrence(rule, next)
  }
  return next
}

/**
 * Embeds a fixed anchor (BYMONTHDAY for monthly, BYMONTH+BYMONTHDAY for
 * yearly) into a bare `FREQ=MONTHLY`/`FREQ=YEARLY` rule, derived from
 * `dueDate`, the day the task actually falls on — issue #25: without an
 * anchor, `nextOccurrence` re-derives the day-of-month from whatever the
 * *current* (possibly already-clamped) due date is on each call, so a task
 * due the 31st permanently drifts to the 28th/30th after crossing one short
 * month and never recovers. Storing the anchor in the rule text itself
 * fixes that — it's what `findRecurrenceCandidates` already does for the
 * "setiap tanggal N" pattern; this just extends the same fix to the bare
 * "setiap bulan"/"setiap tahun" patterns, which don't carry a day on their
 * own since the phrase itself doesn't name one. Also re-anchors already-anchored
 * MONTHLY/YEARLY rules when dueDate changes (issue #75 — chip tanggal overrides
 * the original anchor). A no-op for all other rule shapes and for a null rule
 * or null dueDate.
 */
export function anchorRecurrence(rule: string | null, dueDate: string | null): string | null {
  if (rule === 'FREQ=MONTHLY' || rule === 'FREQ=YEARLY') return reanchorRecurrence(rule, dueDate)
  return rule
}

/**
 * Like `anchorRecurrence`, but *replaces* an anchor that's already there
 * instead of leaving it — issue #75. Use this when the user has just picked
 * a due date directly: the rule's baked-in day was derived from whatever
 * date the task happened to have at creation time, and once the user moves
 * the task to another day that day is stale. Left stale, completing the task
 * sends it back to the old day and it stays there permanently — the same
 * silent drift as issue #25, reached from the other direction.
 *
 * MONTHLY/YEARLY carry their date anchor as a day-of-month/month; WEEKLY
 * with BYDAY carries it as a day-of-week (issue #85) — both get replaced
 * with whatever `dueDate` now falls on. DAILY, INTERVAL and bare WEEKLY
 * (no BYDAY) take their phase from `dueDate` itself, so they follow a moved
 * date with no help needed here.
 *
 * Only ever call this for a date the user chose. Calling it on a date that
 * *the rule itself* produced would re-derive the anchor from an occurrence
 * that may have been clamped by a short month — which is exactly the drift
 * issue #25 exists to prevent. That's why `toggleTaskComplete` and
 * `skipRecurrence` advance the due date without going near this.
 */
export function reanchorRecurrence(rule: string | null, dueDate: string | null): string | null {
  if (!rule || !dueDate) return rule
  const [, monthStr, dayStr] = dueDate.split('-')
  const month = Number(monthStr)
  const day = Number(dayStr)
  if (rule.startsWith('FREQ=MONTHLY')) return `FREQ=MONTHLY;BYMONTHDAY=${day}`
  if (rule.startsWith('FREQ=YEARLY')) return `FREQ=YEARLY;BYMONTH=${month};BYMONTHDAY=${day}`
  if (rule.startsWith('FREQ=WEEKLY') && rule.includes('BYDAY=')) {
    return `FREQ=WEEKLY;BYDAY=${DAY_CODES[dayOfWeek(dueDate)]}`
  }
  return rule
}
