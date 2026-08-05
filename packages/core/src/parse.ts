// Quick-add parser: turns one line of typed Indonesian/English text into a
// title plus structured fields. Pure — no I/O, no tree access, `now` passed
// in explicitly. See docs/feature/2.backend/1.todo/spec.md §5 and the token
// convention in docs/feature/2.backend/spec.md §3.5 (# project, @ mention,
// $ label, ! priority).
//
// Scope of this version: relative day words, named weekdays (bare and
// "depan"/"next"), explicit d/m and d-m dates, ISO dates, "d month-name"
// dates, jam/bare/am-pm time phrases, minute durations, priority, and the
// four sigil tokens. NOT implemented yet: compound relative phrases
// ("minggu depan" and "bulan depan" on their own, "N hari lagi", "akhir
// bulan") and recurrence phrases — `recurrence` below is always null until
// `core/recurrence.ts` exists. Anything not recognized is left in the title
// untouched, per the parser's one hard rule: never discard text it did not
// understand.
import { addDays, dayOfWeek, localDate } from './date.ts'

export type ParseSpanKind =
  | 'date'
  | 'time'
  | 'duration'
  | 'recurrence'
  | 'project'
  | 'label'
  | 'priority'
  | 'mention'

export interface ParseSpan {
  start: number
  end: number
  kind: ParseSpanKind
}

export interface ParseContext {
  now: Date
  timezone: string
  language: 'id' | 'en'
}

export interface ParseResult {
  content: string
  spans: ParseSpan[]
  dueDate: string | null
  dueTime: string | null
  durationMin: number | null
  recurrence: string | null
  projectQuery: string | null
  labelNames: string[]
  mentionQueries: string[]
  priority: 1 | 2 | 3 | null
}

interface Candidate<T> {
  start: number
  end: number
  value: T
}

/**
 * Keeps the rightmost candidate, after first dropping any candidate that is
 * strictly contained inside a larger one (so "jam 9:00" — one phrase — does
 * not lose to its own "9:00" sub-match just because the sub-match starts
 * later). Distinct, non-nested mentions elsewhere in the text still resolve
 * by "rightmost start wins", per spec.
 */
function pickRightmostNonNested<T>(candidates: Candidate<T>[]): Candidate<T> | null {
  const outer = candidates.filter(
    (c) =>
      !candidates.some(
        (other) =>
          other !== c &&
          other.start <= c.start &&
          other.end >= c.end &&
          (other.start < c.start || other.end > c.end),
      ),
  )
  let best: Candidate<T> | null = null
  for (const c of outer) {
    if (best === null || c.start > best.start) best = c
  }
  return best
}

const RELATIVE_DAY_OFFSETS: Record<string, number> = {
  'hari ini': 0,
  today: 0,
  besok: 1,
  bsk: 1,
  tomorrow: 1,
  lusa: 2,
  kemarin: -1,
  yesterday: -1,
}

const WEEKDAY_NUMBERS: Record<string, number> = {
  minggu: 0,
  sunday: 0,
  senin: 1,
  monday: 1,
  selasa: 2,
  tuesday: 2,
  rabu: 3,
  wednesday: 3,
  kamis: 4,
  thursday: 4,
  jumat: 5,
  friday: 5,
  sabtu: 6,
  saturday: 6,
}

const MONTH_NUMBERS: Record<string, number> = {
  jan: 1,
  januari: 1,
  january: 1,
  feb: 2,
  februari: 2,
  february: 2,
  mar: 3,
  maret: 3,
  march: 3,
  apr: 4,
  april: 4,
  mei: 5,
  may: 5,
  jun: 6,
  juni: 6,
  june: 6,
  jul: 7,
  juli: 7,
  july: 7,
  agu: 8,
  agt: 8,
  agustus: 8,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  okt: 10,
  oktober: 10,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  des: 12,
  desember: 12,
  dec: 12,
  december: 12,
}

/** This year's `month/day`, rolled to next year if that date has already passed. */
function resolveYear(today: string, month: number, day: number): string {
  const year = Number(today.slice(0, 4))
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  const thisYear = `${year}-${mm}-${dd}`
  return thisYear >= today ? thisYear : `${year + 1}-${mm}-${dd}`
}

function findDateCandidates(input: string, today: string): Candidate<string>[] {
  const candidates: Candidate<string>[] = []

  // ISO literal — checked first so its digits are claimed before the
  // looser d/m pattern below ever gets a chance to look at them.
  for (const m of input.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    candidates.push({ start: m.index, end: m.index + m[0].length, value: m[0] })
  }

  // Relative words — longest phrase first so "hari ini" wins over a
  // hypothetical bare "hari" (which isn't in the table, but keeps the
  // pattern honest about matching whole phrases).
  const relativePattern = /\b(hari ini|today|besok|bsk|tomorrow|lusa|kemarin|yesterday)\b/gi
  for (const m of input.matchAll(relativePattern)) {
    const offset = RELATIVE_DAY_OFFSETS[m[0].toLowerCase()]
    if (offset === undefined) continue
    candidates.push({ start: m.index, end: m.index + m[0].length, value: addDays(today, offset) })
  }

  // Named weekday, optionally with a leading "next " or a trailing " depan"
  // — both mean "skip this week even if the day hasn't happened yet".
  const weekdayPattern =
    /\b(?:(next)\s+)?(minggu|senin|selasa|rabu|kamis|jumat|sabtu|sunday|monday|tuesday|wednesday|thursday|friday|saturday)(?:\s+(depan))?\b/gi
  for (const m of input.matchAll(weekdayPattern)) {
    const target = WEEKDAY_NUMBERS[m[2]!.toLowerCase()]
    if (target === undefined) continue
    const isNextWeek = Boolean(m[1]) || Boolean(m[3])
    const todayDow = dayOfWeek(today)
    let offset = (target - todayDow + 7) % 7
    if (isNextWeek) offset += 7
    candidates.push({ start: m.index, end: m.index + m[0].length, value: addDays(today, offset) })
  }

  // Explicit numeric d/m or d-m.
  for (const m of input.matchAll(/\b(\d{1,2})[/-](\d{1,2})\b/g)) {
    const day = Number(m[1])
    const month = Number(m[2])
    if (month < 1 || month > 12 || day < 1 || day > 31) continue
    candidates.push({ start: m.index, end: m.index + m[0].length, value: resolveYear(today, month, day) })
  }

  // "d month-name" — broad NUMBER WORD match, kept only if WORD is a real
  // month name. This avoids a second giant alternation for every spelling.
  for (const m of input.matchAll(/\b(\d{1,2})\s+([a-z]+)\b/gi)) {
    const month = MONTH_NUMBERS[m[2]!.toLowerCase()]
    const day = Number(m[1])
    if (month === undefined || day < 1 || day > 31) continue
    candidates.push({ start: m.index, end: m.index + m[0].length, value: resolveYear(today, month, day) })
  }

  return candidates
}

function hourWithSuffix(hour: number, suffix: string | undefined): number {
  const s = suffix?.toLowerCase()
  if (s === 'pagi' || s === 'am') return hour % 12
  if (s === 'siang' || s === 'sore' || s === 'malam' || s === 'pm') {
    return hour === 12 ? 12 : hour + 12
  }
  // No suffix: 13-23 is already 24h. 1-12 defaults to AM, except a bare 12
  // is treated as noon — the more common meaning for "jam 12" with no
  // qualifier — rather than mod-ing it down to midnight.
  if (hour >= 13) return hour
  if (hour === 12) return 12
  return hour
}

function findTimeCandidates(input: string): Candidate<string>[] {
  const candidates: Candidate<string>[] = []

  for (const m of input.matchAll(
    /\bjam\s+(\d{1,2})(?:[:.](\d{2}))?\s*(pagi|siang|sore|malam)?\b/gi,
  )) {
    const hour = hourWithSuffix(Number(m[1]), m[3])
    const minute = m[2] ?? '00'
    candidates.push({
      start: m.index,
      end: m.index + m[0].length,
      value: `${String(hour).padStart(2, '0')}:${minute}`,
    })
  }

  for (const m of input.matchAll(/\b(\d{1,2})[:.](\d{2})\b/g)) {
    candidates.push({
      start: m.index,
      end: m.index + m[0].length,
      value: `${m[1]!.padStart(2, '0')}:${m[2]}`,
    })
  }

  for (const m of input.matchAll(/\b(\d{1,2})\s?(am|pm)\b/gi)) {
    const hour = hourWithSuffix(Number(m[1]), m[2])
    candidates.push({ start: m.index, end: m.index + m[0].length, value: `${String(hour).padStart(2, '0')}:00` })
  }

  return candidates
}

function findDurationCandidates(input: string): Candidate<number>[] {
  const candidates: Candidate<number>[] = []
  for (const m of input.matchAll(/\bselama\s+(\d+)\s*(?:menit|mnt)\b/gi)) {
    candidates.push({ start: m.index, end: m.index + m[0].length, value: Number(m[1]) })
  }
  for (const m of input.matchAll(/\bfor\s+(\d+)\s*m(?:in)?\b/gi)) {
    candidates.push({ start: m.index, end: m.index + m[0].length, value: Number(m[1]) })
  }
  for (const m of input.matchAll(/\b(\d+)\s*min\b/gi)) {
    candidates.push({ start: m.index, end: m.index + m[0].length, value: Number(m[1]) })
  }
  return candidates
}

function findPriorityCandidates(input: string): Candidate<1 | 2 | 3 | null>[] {
  const candidates: Candidate<1 | 2 | 3 | null>[] = []
  for (const m of input.matchAll(/(?<=^|\s)!([1-4])(?=\s|$)/g)) {
    const n = Number(m[1])
    candidates.push({ start: m.index, end: m.index + m[0].length, value: n === 4 ? null : (n as 1 | 2 | 3) })
  }
  return candidates
}

/** Sigil-prefixed names: `#project`, `$label`, `@mention` — must start with a letter, so "$5" (a price) is not a label. */
function findSigilCandidates(input: string, sigil: string): Candidate<string>[] {
  const pattern = new RegExp(`[${sigil}](\\p{L}[\\p{L}\\p{N}_-]*)`, 'gu')
  const candidates: Candidate<string>[] = []
  for (const m of input.matchAll(pattern)) {
    candidates.push({ start: m.index, end: m.index + m[0].length, value: m[1]! })
  }
  return candidates
}

export function parse(input: string, ctx: ParseContext): ParseResult {
  const today = localDate(ctx.now, ctx.timezone)

  const dateCandidate = pickRightmostNonNested(findDateCandidates(input, today))
  const timeCandidate = pickRightmostNonNested(findTimeCandidates(input))
  const durationCandidate = pickRightmostNonNested(findDurationCandidates(input))
  const priorityCandidate = pickRightmostNonNested(findPriorityCandidates(input))
  const projectCandidate = pickRightmostNonNested(findSigilCandidates(input, '#'))
  const labelCandidates = findSigilCandidates(input, '$')
  const mentionCandidates = findSigilCandidates(input, '@')

  const spans: ParseSpan[] = []
  if (dateCandidate) spans.push({ start: dateCandidate.start, end: dateCandidate.end, kind: 'date' })
  if (timeCandidate) spans.push({ start: timeCandidate.start, end: timeCandidate.end, kind: 'time' })
  if (durationCandidate) {
    spans.push({ start: durationCandidate.start, end: durationCandidate.end, kind: 'duration' })
  }
  if (priorityCandidate) {
    spans.push({ start: priorityCandidate.start, end: priorityCandidate.end, kind: 'priority' })
  }
  if (projectCandidate) {
    spans.push({ start: projectCandidate.start, end: projectCandidate.end, kind: 'project' })
  }
  for (const c of labelCandidates) spans.push({ start: c.start, end: c.end, kind: 'label' })
  for (const c of mentionCandidates) spans.push({ start: c.start, end: c.end, kind: 'mention' })
  spans.sort((a, b) => a.start - b.start)

  let content = ''
  let cursor = 0
  for (const span of spans) {
    content += input.slice(cursor, span.start)
    cursor = span.end
  }
  content += input.slice(cursor)
  content = content.replace(/\s+/g, ' ').trim()

  return {
    content,
    spans,
    dueDate: dateCandidate?.value ?? null,
    dueTime: timeCandidate?.value ?? null,
    durationMin: durationCandidate?.value ?? null,
    recurrence: null,
    projectQuery: projectCandidate?.value ?? null,
    labelNames: labelCandidates.map((c) => c.value),
    mentionQueries: mentionCandidates.map((c) => c.value),
    priority: priorityCandidate?.value ?? null,
  }
}
