// Calendar-date helpers. A "calendar date" here is always a plain
// 'YYYY-MM-DD' string — never a Date object standing in for one, because a
// Date is a UTC instant and a due date has no timezone (spec induk §3.6).
//
// "Today" is a question with a timezone-dependent answer, and per
// docs/feature/2.backend/1.todo/spec.md that timezone lives on the user, not
// the device — so every entry point here takes it explicitly.

/** Renders a UTC instant as the calendar date it falls on in `timezone`. */
export function localDate(instant: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)

  const year = parts.find((p) => p.type === 'year')!.value
  const month = parts.find((p) => p.type === 'month')!.value
  const day = parts.find((p) => p.type === 'day')!.value
  return `${year}-${month}-${day}`
}

/** What calendar date "today" is right now, in `timezone`. `now` defaults to the wall clock. */
export function todayInTimezone(timezone: string, now: Date = new Date()): string {
  return localDate(now, timezone)
}

/**
 * Shifts a 'YYYY-MM-DD' string by `days` (positive, negative, or zero).
 * Pure calendar arithmetic — computed at UTC noon so no timezone or DST
 * transition can push the result onto the wrong day.
 */
export function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number) as [number, number, number]
  const shifted = new Date(Date.UTC(year, month - 1, day, 12))
  shifted.setUTCDate(shifted.getUTCDate() + days)

  const y = String(shifted.getUTCFullYear()).padStart(4, '0')
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const d = String(shifted.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Day of week for a 'YYYY-MM-DD' string: 0 = Sunday .. 6 = Saturday. */
export function dayOfWeek(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/** -1 if `a` is earlier than `b`, 1 if later, 0 if the same day. */
export function compareDates(a: string, b: string): -1 | 0 | 1 {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}
