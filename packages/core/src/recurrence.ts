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
    if (!code) continue
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
