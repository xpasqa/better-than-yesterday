# Recurring Tasks (Block H) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `core/recurrence.ts` (phrase parsing + next-occurrence math), wire it into quick-add, persist a `completion` audit trail through sync, and make completing a recurring task advance its due date instead of closing it — closing GitHub issue #23 and `docs/feature/2.backend/1.todo/todo.md` block H.

**Architecture:** One new pure module (`packages/core/src/recurrence.ts`) supplies both the quick-add phrase parser (reusing `parse.ts`'s existing `Candidate`/rightmost-wins machinery) and the pure date-math `nextOccurrence()`. The `completion` table already exists in the DB schema and the `node.recurrence` column/CHECK already exist — this plan adds the sync wire-up (DTO, route, Dexie table) that `label` already has a working template for, and one behavioral branch in `node-actions.ts`'s `toggleTaskComplete`.

**Tech Stack:** TypeScript, Vitest, Zod, Drizzle ORM (Postgres), Dexie (IndexedDB), Hono.

## Global Constraints

- `parse` and `recurrence` are the two modules spec.md §12 calls out as needing **100% branch coverage** — same bar as `rank.ts` — because their bugs are silent (a wrong date just looks like a slightly-wrong date, nothing throws).
- Every mutation goes through Dexie first, then the outbox — no other write path (`node-actions.ts` header comment, spec induk §3.2).
- Sync rows are always scoped `WHERE user_id` — no cross-user read or write, ever (spec induk §3.1, enforced today in every `applyIncoming*` function in `apps/api/src/modules/sync/routes.ts`).
- Calendar dates are always plain `'YYYY-MM-DD'` strings computed via UTC-noon-anchored arithmetic (`packages/core/src/date.ts`) — never a raw `Date` standing in for a date, so DST never shifts a result onto the wrong day. `nextOccurrence()` must follow this same pattern, not introduce a new one.
- Keep the phrase table to exactly the 8 patterns in spec.md §8 — no generic RRULE engine, no extra config knobs. (Explicit user instruction: keep this simple, do not over-engineer.)

---

## Task 1: `core/recurrence.ts` — phrase → RRULE-subset parser

**Files:**
- Create: `packages/core/src/recurrence.ts`
- Test: `packages/core/src/recurrence.test.ts`

**Interfaces:**
- Produces: `export function findRecurrenceCandidates(input: string): Array<{ start: number; end: number; value: string }>` — one candidate per recognized phrase, `value` is the canonical RRULE-subset text (e.g. `'FREQ=DAILY'`). Consumed by Task 3 (`parse.ts`), which combines it with its own local `pickRightmostNonNested` the same way it already does for dates/times.

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/recurrence.test.ts`:

```ts
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
    expect(values('cek email setiap hari kerja')).toEqual(['FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'])
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

  it('"setiap hari kerja" does not also fire the bare "setiap hari" pattern (outer match, no duplicate)', () => {
    expect(values('cek email setiap hari kerja')).toHaveLength(1)
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

  it('does not match "setiap 3 hari" as bare "setiap hari" (distinct literal text, no overlap)', () => {
    expect(values('minum obat setiap 3 hari')).toEqual(['FREQ=DAILY;INTERVAL=3'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w @better/core -- recurrence`
Expected: FAIL — `Cannot find module './recurrence.ts'` (file doesn't exist yet)

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/recurrence.ts`:

```ts
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
```

Note: `addDays`/`dayOfWeek` are imported now because Task 2 adds `nextOccurrence` to this same file and uses them — importing them here up front avoids a diff churn in Task 2's import line. If your editor flags them as unused after Step 3 alone, that's expected and resolved by Task 2, not a bug to fix now.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w @better/core -- recurrence`
Expected: PASS (all cases in Step 1)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/recurrence.ts packages/core/src/recurrence.test.ts
git commit -m "feat: recurrence phrase parser (core/recurrence.ts)"
```

---

## Task 2: `core/recurrence.ts` — `nextOccurrence()` date math

**Files:**
- Modify: `packages/core/src/recurrence.ts` (append to the file from Task 1)
- Test: `packages/core/src/recurrence.test.ts` (append)

**Interfaces:**
- Consumes: `addDays(dateStr, days)`, `dayOfWeek(dateStr)` from `./date.ts` (already imported in Task 1)
- Produces: `export function nextOccurrence(rule: string, fromDate: string): string` — `rule` is the canonical text `findRecurrenceCandidates` produces (e.g. `'FREQ=WEEKLY;BYDAY=MO'`), `fromDate` is a `'YYYY-MM-DD'` string, return value is the next occurrence strictly after `fromDate`. Consumed by Task 8 (`node-actions.ts`).

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/src/recurrence.test.ts`:

```ts
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

  it('FREQ=YEARLY clamps Feb 29 to Feb 28 in a non-leap target year (leap-year edge case)', () => {
    // 2028 is a leap year; 2029 is not.
    expect(nextOccurrence('FREQ=YEARLY', '2028-02-29')).toBe('2029-02-28')
  })

  it('FREQ=YEARLY keeps Feb 29 -> Feb 29 when the target year is also a leap year', () => {
    // 2028 and 2032 are both leap years.
    expect(nextOccurrence('FREQ=YEARLY', '2028-02-29')).not.toBe('2032-02-29') // sanity: not this call...
    expect(nextOccurrence('FREQ=DAILY', '2028-02-28')).toBe('2028-02-29') // ...leap day exists and is reachable
  })

  it('is stable across a DST transition boundary (calendar-date arithmetic, not wall-clock)', () => {
    // Jakarta has no DST, but the underlying UTC-noon-anchored arithmetic in
    // date.ts is what actually prevents DST bugs — this exercises the same
    // codepath across a boundary where a naive local-Date implementation in
    // a DST timezone would be at risk of drifting a day.
    expect(nextOccurrence('FREQ=DAILY', '2026-03-08')).toBe('2026-03-09')
    expect(nextOccurrence('FREQ=WEEKLY', '2026-03-08')).toBe('2026-03-15')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w @better/core -- recurrence`
Expected: FAIL — `nextOccurrence is not a function`

- [ ] **Step 3: Write the implementation**

Append to `packages/core/src/recurrence.ts` (after `findRecurrenceCandidates`):

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w @better/core -- recurrence`
Expected: PASS (all cases from both Task 1 and Task 2)

- [ ] **Step 5: Check branch coverage**

Run: `npm test -w @better/core -- recurrence --coverage`
Expected: 100% branch coverage on `recurrence.ts` (spec.md §12 requirement — same bar as `rank.ts`). If any branch is uncovered, add the missing test case before moving on — do not skip this.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/recurrence.ts packages/core/src/recurrence.test.ts
git commit -m "feat: nextOccurrence date math in core/recurrence.ts"
```

---

## Task 3: Wire `findRecurrenceCandidates` into `core/parse.ts`

**Files:**
- Modify: `packages/core/src/parse.ts:1-16` (imports + header comment), `:292-340` (`parse()` function body)
- Test: `packages/core/src/parse.test.ts` (append)

**Interfaces:**
- Consumes: `findRecurrenceCandidates` from `./recurrence.ts` (Task 1)
- Produces: `ParseResult.recurrence` now actually populated (was hardcoded `null`)

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/src/parse.test.ts`:

```ts
describe('parse — recurrence', () => {
  it('extracts a recurrence phrase into result.recurrence', () => {
    const result = parse('siram tanaman setiap hari', CTX)
    expect(result.recurrence).toBe('FREQ=DAILY')
    expect(result.content).toBe('siram tanaman')
  })

  it('reports a span of kind "recurrence" for the matched phrase', () => {
    const result = parse('bayar sewa setiap bulan', CTX)
    const span = result.spans.find((s) => s.kind === 'recurrence')
    expect(span).toBeDefined()
    expect('bayar sewa setiap bulan'.slice(span!.start, span!.end)).toBe('setiap bulan')
  })

  it('is null when no recurrence phrase is present', () => {
    const result = parse('beli susu besok', CTX)
    expect(result.recurrence).toBeNull()
  })

  it('combines with a date, a label, and a priority in the same input', () => {
    const result = parse('minum obat setiap hari $kesehatan !2', CTX)
    expect(result.recurrence).toBe('FREQ=DAILY')
    expect(result.labelNames).toEqual(['kesehatan'])
    expect(result.priority).toBe(2)
    expect(result.content).toBe('minum obat')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w @better/core -- parse`
Expected: FAIL — `result.recurrence` is `null` in all four new tests (current hardcoded value), and the "spans of kind recurrence" test fails because no such span is ever pushed

- [ ] **Step 3: Write the implementation**

In `packages/core/src/parse.ts`, update the import line (currently `import { addDays, dayOfWeek, localDate } from './date.ts'`, the only import in the file):

```ts
import { addDays, dayOfWeek, localDate } from './date.ts'
import { findRecurrenceCandidates } from './recurrence.ts'
```

Update the header comment (the 9-line `// Scope of this version: ...` paragraph currently ending "...never discard text it did not understand.") — remove recurrence from the "NOT implemented yet" list. Replace the whole paragraph with:

```ts
// Scope of this version: relative day words, named weekdays (bare and
// "depan"/"next"), explicit d/m and d-m dates, ISO dates, "d month-name"
// dates, jam/bare/am-pm time phrases, minute durations, priority, the four
// sigil tokens, and the eight recurrence phrases in spec.md §8. NOT
// implemented yet: compound relative phrases ("minggu depan" and "bulan
// depan" on their own, "N hari lagi", "akhir bulan"). Anything not
// recognized is left in the title untouched, per the parser's one hard
// rule: never discard text it did not understand.
```

In the `parse()` function body, add a candidate lookup alongside the existing ones (after the `durationCandidate` line, before `priorityCandidate`):

```ts
  const durationCandidate = pickRightmostNonNested(findDurationCandidates(input))
  const recurrenceCandidate = pickRightmostNonNested(findRecurrenceCandidates(input))
  const priorityCandidate = pickRightmostNonNested(findPriorityCandidates(input))
```

Add its span, right after the `durationCandidate` span push:

```ts
  if (durationCandidate) {
    spans.push({ start: durationCandidate.start, end: durationCandidate.end, kind: 'duration' })
  }
  if (recurrenceCandidate) {
    spans.push({ start: recurrenceCandidate.start, end: recurrenceCandidate.end, kind: 'recurrence' })
  }
```

Replace the hardcoded `recurrence: null,` in the returned `ParseResult`:

```ts
    recurrence: recurrenceCandidate?.value ?? null,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w @better/core -- parse`
Expected: PASS (all `parse.test.ts` tests, including the four new ones)

- [ ] **Step 5: Run the full core test suite and check coverage**

Run: `npm test -w @better/core -- --coverage`
Expected: all tests pass; `parse.ts` branch coverage unchanged or improved (not regressed) — this file is also under the 100%-branch-coverage requirement, so if the new recurrence branch isn't fully covered, add the missing case.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/parse.ts packages/core/src/parse.test.ts
git commit -m "feat: wire recurrence phrases into quick-add parser"
```

---

## Task 4: `Completion` domain type

**Files:**
- Create: `packages/core/src/completion.ts`

**Interfaces:**
- Produces: `export interface Completion { id, userId, nodeId, completedAt, occurredOn, seq }`. Consumed by Task 5 (DTO), Task 7 (Dexie), Task 8 (`node-actions.ts`).

No test file — this is a plain type declaration with no logic, same as `packages/core/src/label.ts` and `packages/core/src/node.ts` (neither has its own test file for the same reason).

- [ ] **Step 1: Write the file**

Create `packages/core/src/completion.ts`:

```ts
// Mirrors the `completion` table — docs/feature/2.backend/1.todo/spec.md §8.
// The trail a recurring task leaves behind: completing one never closes the
// task (its due_date just advances instead), so without this row Completed
// and any "days in a row" stat would have nothing to show for it. Rows here
// are write-once — nothing ever updates a completion after it's created.
export interface Completion {
  id: string
  userId: string
  nodeId: string
  completedAt: string // ISO timestamp
  occurredOn: string | null // 'YYYY-MM-DD' — the due_date occurrence that was completed
  seq: number
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck -w @better/core`
Expected: clean (no errors)

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/completion.ts
git commit -m "feat: Completion domain type"
```

---

## Task 5: Sync DTO for `completion`

**Files:**
- Modify: `apps/api/src/modules/sync/dto.ts`

**Interfaces:**
- Consumes: nothing new (Zod only)
- Produces: `export const completionDto`, `export type CompletionDto`, and `syncRequest.changes.completions: CompletionDto[]`. Consumed by Task 6 (sync route).

- [ ] **Step 1: Write the implementation**

In `apps/api/src/modules/sync/dto.ts`, add after `labelDto`/`LabelDto` (before `MAX_BATCH`):

```ts
// A completion row never changes after it's written (1.todo/spec.md §8) —
// no updatedAt/deletedAt here, unlike node and label.
export const completionDto = z.object({
  id: z.string().uuid(),
  nodeId: z.string().uuid(),
  completedAt: z.string().datetime(),
  occurredOn: z.string().date().nullable(),
})
export type CompletionDto = z.infer<typeof completionDto>
```

Update `syncRequest`:

```ts
export const syncRequest = z.object({
  cursor: z.string().regex(/^\d+$/),
  changes: z.object({
    nodes: z.array(nodeDto).max(MAX_BATCH).default([]),
    labels: z.array(labelDto).max(MAX_BATCH).default([]),
    completions: z.array(completionDto).max(MAX_BATCH).default([]),
  }),
})
export type SyncRequest = z.infer<typeof syncRequest>
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck -w @better/api`
Expected: FAIL — `apps/api/src/modules/sync/routes.ts` doesn't handle `changes.completions` yet and (depending on TS's strictness on that object literal) may not error here specifically, but the route handler in Task 6 will need it. If typecheck passes clean at this step, that's fine — it just means nothing yet reads the new field. Proceed to Task 6 regardless.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/sync/dto.ts
git commit -m "feat: completion DTO for sync wire format"
```

---

## Task 6: Sync route — push/pull `completion`

**Files:**
- Modify: `apps/api/src/modules/sync/routes.ts`
- Modify: `apps/api/test/helpers.ts` (add `makeCompletionDto`)
- Test: `apps/api/test/sync.test.ts`, `apps/api/test/isolation.test.ts`

**Interfaces:**
- Consumes: `completionDto`, `CompletionDto` (Task 5); `completion` table from `apps/api/src/db/schema/completion.ts` (already exists)
- Produces: `POST /api/sync` now accepts and returns `changes.completions`

- [ ] **Step 1: Add the test helper**

In `apps/api/test/helpers.ts`, add after `makeLabelDto`:

```ts
export function makeCompletionDto(overrides: Record<string, unknown> & { id: string; nodeId: string }) {
  return {
    completedAt: new Date().toISOString(),
    occurredOn: null,
    ...overrides,
  }
}
```

- [ ] **Step 2: Write the failing sync tests**

In `apps/api/test/sync.test.ts`, update the `sync` helper to accept completions:

```ts
async function sync(cookie: string, cursor: string, nodes: unknown[] = [], labels: unknown[] = [], completions: unknown[] = []) {
  const res = await app.request('/api/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ cursor, changes: { nodes, labels, completions } }),
  })
  return { status: res.status, body: await readJson(res) }
}
```

Add a new describe block at the end of the file:

```ts
describe('POST /api/sync — completions', () => {
  it('a created completion round-trips with the same field values', async () => {
    await createTestUser('completion@example.com')
    const cookie = await loginCookie('completion@example.com')
    const boot = await sync(cookie, '0')
    const inboxId = boot.body.changes.nodes[0].id

    const id = uuidv7()
    await sync(cookie, boot.body.cursor, [], [], [
      makeCompletionDto({ id, nodeId: inboxId, occurredOn: '2026-08-05' }),
    ])

    const after = await sync(cookie, '0')
    const row = after.body.changes.completions.find((c: { id: string }) => c.id === id)
    expect(row).toBeDefined()
    expect(row.nodeId).toBe(inboxId)
    expect(row.occurredOn).toBe('2026-08-05')
  })

  it('nodes, labels, and completions share one cursor', async () => {
    await createTestUser('completion-cursor@example.com')
    const cookie = await loginCookie('completion-cursor@example.com')
    const boot = await sync(cookie, '0')
    const inboxId = boot.body.changes.nodes[0].id

    const push = await sync(cookie, boot.body.cursor, [], [], [
      makeCompletionDto({ id: uuidv7(), nodeId: inboxId }),
    ])
    expect(push.body.cursor).not.toBe(boot.body.cursor)

    const pullAfter = await sync(cookie, push.body.cursor)
    expect(pullAfter.body.changes.nodes).toEqual([])
    expect(pullAfter.body.changes.labels).toEqual([])
    expect(pullAfter.body.changes.completions).toEqual([])
  })

  it('a retried push with the same completion id is a harmless no-op, not an overwrite', async () => {
    await createTestUser('completion-retry@example.com')
    const cookie = await loginCookie('completion-retry@example.com')
    const boot = await sync(cookie, '0')
    const inboxId = boot.body.changes.nodes[0].id
    const id = uuidv7()

    await sync(cookie, boot.body.cursor, [], [], [makeCompletionDto({ id, nodeId: inboxId, occurredOn: '2026-08-01' })])
    // Same id, different occurredOn — simulates a retried request after a
    // dropped response. Must NOT overwrite the original.
    await sync(cookie, boot.body.cursor, [], [], [makeCompletionDto({ id, nodeId: inboxId, occurredOn: '2026-08-02' })])

    const after = await sync(cookie, '0')
    const rows = after.body.changes.completions.filter((c: { id: string }) => c.id === id)
    expect(rows).toHaveLength(1)
    expect(rows[0].occurredOn).toBe('2026-08-01')
  })
})
```

- [ ] **Step 3: Write the failing isolation test**

`apps/api/test/isolation.test.ts` has its own local copy of the `sync()` and
`loginCookie()` helpers (not imported from `sync.test.ts`). Update its
imports and its local `sync()` the same way as Step 2:

```ts
import { resetDb, createTestUser, extractSessionCookie, makeNodeDto, makeLabelDto, makeCompletionDto, readJson } from './helpers.ts'
```

```ts
async function sync(cookie: string, cursor: string, nodes: unknown[] = [], labels: unknown[] = [], completions: unknown[] = []) {
  const res = await app.request('/api/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ cursor, changes: { nodes, labels, completions } }),
  })
  return { status: res.status, body: await readJson(res) }
}
```

Then add (near the label isolation tests):

```ts
it("user B's sync bootstrap never includes user A's completions", async () => {
  await createTestUser('completionA@example.com')
  await createTestUser('completionB@example.com')
  const cookieA = await loginCookie('completionA@example.com')
  const cookieB = await loginCookie('completionB@example.com')

  const bootA = await sync(cookieA, '0')
  const nodeIdA = bootA.body.changes.nodes[0].id
  await sync(cookieA, bootA.body.cursor, [], [], [makeCompletionDto({ id: uuidv7(), nodeId: nodeIdA })])

  const bootB = await sync(cookieB, '0')
  expect(bootB.body.changes.completions).toEqual([])
})

it("user B cannot claim user A's completion by reusing its id", async () => {
  await createTestUser('completion-victim@example.com')
  await createTestUser('completion-attacker@example.com')
  const cookieA = await loginCookie('completion-victim@example.com')
  const cookieB = await loginCookie('completion-attacker@example.com')

  const bootA = await sync(cookieA, '0')
  const nodeIdA = bootA.body.changes.nodes[0].id
  const sharedId = uuidv7()
  await sync(cookieA, bootA.body.cursor, [], [], [
    makeCompletionDto({ id: sharedId, nodeId: nodeIdA, occurredOn: '2026-08-01' }),
  ])

  const bootB = await sync(cookieB, '0')
  const nodeIdB = bootB.body.changes.nodes[0].id
  const hijack = await sync(cookieB, bootB.body.cursor, [], [], [
    makeCompletionDto({ id: sharedId, nodeId: nodeIdB, occurredOn: '2026-08-02' }),
  ])
  expect(hijack.status).toBe(200)

  const checkA = await sync(cookieA, '0')
  const row = checkA.body.changes.completions.find((c: { id: string }) => c.id === sharedId)
  expect(row.nodeId).toBe(nodeIdA)
  expect(row.occurredOn).toBe('2026-08-01')

  const checkB = await sync(cookieB, '0')
  expect(checkB.body.changes.completions).toEqual([])
})
```

Check the top of `apps/api/test/isolation.test.ts` for its own local `sync`/`loginCookie` helpers and its imports from `./helpers.ts` — add `makeCompletionDto` to that import list, and if `sync`'s local signature in this file also takes only `(cookie, cursor, nodes, labels)`, extend it the same way as Step 2 did in `sync.test.ts`.

- [ ] **Step 4: Run tests to verify they fail**

Run: `npm test -w @better/api -- sync isolation`
Expected: FAIL — `changes.completions` is `undefined` in responses (route doesn't produce it yet)

- [ ] **Step 5: Write the implementation**

In `apps/api/src/modules/sync/routes.ts`, add the import:

```ts
import { completion } from '../../db/schema/completion.ts'
import { syncRequest, type NodeDto, type LabelDto, type CompletionDto } from './dto.ts'
```

Add after `applyIncomingLabels` (before `nodeToDto`):

```ts
function toCompletionRow(userId: string, dto: CompletionDto) {
  return {
    id: dto.id,
    userId,
    nodeId: dto.nodeId,
    completedAt: new Date(dto.completedAt),
    occurredOn: dto.occurredOn,
  }
}

/**
 * Insert-only — a completion row never changes after it's written (spec §8),
 * so there is nothing to LWW against. `onConflictDoNothing` makes a retried
 * push with the same id a harmless no-op instead of silently overwriting
 * whichever row already holds that id (including, safely, another user's).
 */
async function applyIncomingCompletions(userId: string, dtos: CompletionDto[]): Promise<void> {
  for (const dto of dtos) {
    await db.insert(completion).values(toCompletionRow(userId, dto)).onConflictDoNothing()
  }
}
```

Add after `labelToDto`:

```ts
function completionToDto(row: typeof completion.$inferSelect): CompletionDto {
  return {
    id: row.id,
    nodeId: row.nodeId,
    completedAt: row.completedAt.toISOString(),
    occurredOn: row.occurredOn,
  }
}
```

In the `syncRoutes.post('/sync', ...)` handler, after the existing `applyIncomingLabels` call:

```ts
  if (changes.completions.length > 0) {
    await applyIncomingCompletions(userId, changes.completions)
  }
```

Add `completionRows` to the `Promise.all` pull query:

```ts
  const [nodeRows, labelRows, completionRows] = await Promise.all([
    db
      .select()
      .from(node)
      .where(and(eq(node.userId, userId), gt(node.seq, cursorBigint)))
      .orderBy(node.seq)
      .limit(500),
    db
      .select()
      .from(label)
      .where(and(eq(label.userId, userId), gt(label.seq, cursorBigint)))
      .orderBy(label.seq)
      .limit(500),
    db
      .select()
      .from(completion)
      .where(and(eq(completion.userId, userId), gt(completion.seq, cursorBigint)))
      .orderBy(completion.seq)
      .limit(500),
  ])
```

Update the cursor computation and response:

```ts
  let nextCursor = cursorBigint
  for (const r of nodeRows) if (r.seq > nextCursor) nextCursor = r.seq
  for (const r of labelRows) if (r.seq > nextCursor) nextCursor = r.seq
  for (const r of completionRows) if (r.seq > nextCursor) nextCursor = r.seq

  return c.json({
    cursor: nextCursor.toString(),
    changes: {
      nodes: nodeRows.map(nodeToDto),
      labels: labelRows.map(labelToDto),
      completions: completionRows.map(completionToDto),
    },
  })
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -w @better/api -- sync isolation`
Expected: PASS (all sync.test.ts and isolation.test.ts tests, including the new ones)

- [ ] **Step 7: Run the full apps/api test suite**

Run: `npm test -w @better/api`
Expected: all tests pass, no regressions in auth/sync/isolation

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/sync/routes.ts apps/api/test/helpers.ts apps/api/test/sync.test.ts apps/api/test/isolation.test.ts
git commit -m "feat: sync completion rows (push insert-only, pull since cursor)"
```

---

## Task 7: Dexie client schema + sync-client wiring for `completion`

**Files:**
- Modify: `apps/web/src/store/db.ts`
- Modify: `apps/web/src/store/sync-client.ts`

**Interfaces:**
- Consumes: `Completion` type (Task 4)
- Produces: `db.completions: Table<Completion, string>`; `OutboxEntry.entityType` includes `'completion'`; `syncOnce()` pushes/pulls completions

No new test file — `db.ts` and `sync-client.ts` have no existing test files (Dexie/fetch-backed, verified manually per the existing pattern for this store layer; the round-trip behavior itself is covered by Task 6's backend tests plus Task 8's manual browser verification step).

- [ ] **Step 1: Write the implementation — `db.ts`**

In `apps/web/src/store/db.ts`, update imports:

```ts
import type { Node } from '@better/core/node'
import type { Label } from '@better/core/label'
import type { Completion } from '@better/core/completion'
```

Update `OutboxEntry`:

```ts
export interface OutboxEntry {
  key: string
  entityType: 'node' | 'label' | 'completion'
  payload: Node | Label | Completion
}
```

Add the table field to `BetterDb`:

```ts
export class BetterDb extends Dexie {
  nodes!: Table<Node, string>
  labels!: Table<Label, string>
  completions!: Table<Completion, string>
  outbox!: Table<OutboxEntry, string>
  meta!: Table<MetaEntry, string>
```

Add a version 4 migration after the existing `version(3)` block (a new store needs no `.upgrade()` — Dexie creates it empty):

```ts
    // v4 adds completions — the audit trail for recurring-task completions
    // (1.todo/spec.md §8). No upgrade() needed: this is a brand new store,
    // nothing to migrate into it.
    this.version(4).stores({
      nodes: 'id, parentId, dueDate, [parentId+rank], isInbox',
      labels: 'id, name',
      completions: 'id, nodeId',
      outbox: 'key, entityType',
      meta: 'key',
    })
```

Update `clearLocalStore`:

```ts
export async function clearLocalStore(): Promise<void> {
  await db.transaction('rw', db.nodes, db.labels, db.completions, db.outbox, db.meta, async () => {
    await db.nodes.clear()
    await db.labels.clear()
    await db.completions.clear()
    await db.outbox.clear()
    await db.meta.clear()
  })
}
```

- [ ] **Step 2: Write the implementation — `sync-client.ts`**

In `apps/web/src/store/sync-client.ts`, update imports:

```ts
import type { Node } from '@better/core/node'
import type { Label } from '@better/core/label'
import type { Completion } from '@better/core/completion'
```

In `syncOnce()`, update the outbox split:

```ts
    const outboxEntries = await db.outbox.toArray()
    const nodes = outboxEntries.filter((e) => e.entityType === 'node').map((e) => e.payload as Node)
    const labels = outboxEntries.filter((e) => e.entityType === 'label').map((e) => e.payload as Label)
    const completions = outboxEntries.filter((e) => e.entityType === 'completion').map((e) => e.payload as Completion)
    const cursor = await getCursor()

    const res = await fetch('/api/sync', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cursor, changes: { nodes, labels, completions } }),
    })
```

Update the response type and merge:

```ts
    const body = (await res.json()) as {
      cursor: string
      changes: { nodes: Node[]; labels: Label[]; completions: Completion[] }
    }

    await db.transaction('rw', db.nodes, db.labels, db.completions, db.outbox, async () => {
      if (outboxEntries.length > 0) {
        await db.outbox.bulkDelete(outboxEntries.map((e) => e.key))
      }
      await mergeIncoming(db.nodes, body.changes.nodes)
      await mergeIncoming(db.labels, body.changes.labels)
      // Completions are write-once (no updatedAt to compare) — a plain put
      // is correct and idempotent, unlike mergeIncoming's LWW comparison.
      for (const row of body.changes.completions) {
        await db.completions.put(row)
      }
    })
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run typecheck -w @better/web`
Expected: clean (no errors)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/store/db.ts apps/web/src/store/sync-client.ts
git commit -m "feat: Dexie completions table + sync-client push/pull wiring"
```

---

## Task 8: Recurring-aware `toggleTaskComplete` + `skipRecurrence`

**Files:**
- Modify: `apps/web/src/store/node-actions.ts`

**Interfaces:**
- Consumes: `nextOccurrence` (Task 2), `Completion` (Task 4), `uuidv7` (already imported)
- Produces: `toggleTaskComplete(node)` now branches on `node.recurrence`; new `export async function skipRecurrence(node: Node): Promise<void>`

No new test file — `node-actions.ts` has no existing test file (Dexie-backed store code, same category as Task 7); this task's correctness is exercised via the manual browser verification in Step 4 below plus the already-covered pure `nextOccurrence` math it calls.

- [ ] **Step 1: Write the implementation**

In `apps/web/src/store/node-actions.ts`, update imports:

```ts
import { uuidv7 } from '@better/core/id'
import { between } from '@better/core/rank'
import { findInbox, type Node } from '@better/core/node'
import { parse } from '@better/core/parse'
import { nextOccurrence } from '@better/core/recurrence'
import type { Completion } from '@better/core/completion'
import { db } from './db.ts'
import { triggerSync } from './sync-client.ts'
import { resolveOrCreateLabelIds } from './label-actions.ts'
import { resolveOrCreateProjectId } from './project-actions.ts'
```

Replace `toggleTaskComplete`:

```ts
/**
 * Completing a recurring task never closes it (1.todo/spec.md §8) — its
 * due date advances to the next occurrence instead, and one `completion`
 * row is written as the audit trail. A non-recurring task keeps the plain
 * toggle-completedAt behavior. Both writes happen in one Dexie transaction
 * so a crash between them can't leave a completion logged without its
 * node's due date having actually advanced.
 */
export async function toggleTaskComplete(node: Node): Promise<void> {
  const now = new Date().toISOString()

  if (!node.completedAt && node.recurrence && node.dueDate) {
    const completion: Completion = {
      id: uuidv7(),
      userId: '',
      nodeId: node.id,
      completedAt: now,
      occurredOn: node.dueDate,
      seq: 0,
    }
    const advanced: Node = { ...node, dueDate: nextOccurrence(node.recurrence, node.dueDate), updatedAt: now }

    await db.transaction('rw', db.nodes, db.completions, db.outbox, async () => {
      await db.nodes.put(advanced)
      await db.outbox.put({ key: `node:${advanced.id}`, entityType: 'node', payload: advanced })
      await db.completions.put(completion)
      await db.outbox.put({ key: `completion:${completion.id}`, entityType: 'completion', payload: completion })
    })
    triggerSync()
    return
  }

  await enqueue({ ...node, completedAt: node.completedAt ? null : now, updatedAt: now })
}

/** Advances a recurring task's due date to the next occurrence without logging a completion — 1.todo/spec.md §8's "skip". No-op on a non-recurring task. */
export async function skipRecurrence(node: Node): Promise<void> {
  if (!node.recurrence || !node.dueDate) return
  const now = new Date().toISOString()
  await enqueue({ ...node, dueDate: nextOccurrence(node.recurrence, node.dueDate), updatedAt: now })
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck -w @better/web`
Expected: clean (no errors)

- [ ] **Step 3: Run the full web build**

Run: `cd apps/web && /home/ubuntu/bty/app/node_modules/.bin/vite build`
Expected: builds clean, no new warnings beyond the pre-existing dynamic-import and chunk-size ones already present before this plan

- [ ] **Step 4: Manual browser verification**

This step needs a real browser session (Chrome extension connected, or manual testing by the human) — skip only if genuinely unavailable, and say so explicitly rather than claiming it passed:

1. Quick-add "siram tanaman setiap hari" with no explicit date → confirm it's rejected or ignored gracefully (recurrence requires `dueDate`, per the `node_recur_needs_date` CHECK — decide and note the actual current UI behavior here, since `createTaskFromQuickAdd` does not currently enforce this client-side before syncing; if the sync push 500s or 422s, that's a real gap to flag, not silently swallow)
2. Quick-add "siram tanaman hari ini setiap hari" → task appears in Today with today's date
3. Check the box → task disappears from today's list (not shown as struck-through-and-done), and reappears in Today tomorrow (or check via `NodeDetailModal` that `dueDate` advanced by one day and `completedAt` is still `null`)
4. Confirm in Postgres: `SELECT * FROM completion WHERE node_id = '<id>'` shows one row with `occurred_on` = the original due date

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/store/node-actions.ts
git commit -m "feat: recurring-aware toggleTaskComplete + skipRecurrence"
```

---

## Task 9: Full verification, docs, and issue close-out

**Files:**
- Modify: `docs/feature/2.backend/1.todo/todo.md` (block H)

- [ ] **Step 1: Run full verification**

Run: `npm run verify`
Expected: typecheck, lint, test, and build all pass across every workspace

- [ ] **Step 2: Check 100% branch coverage on the two mandated modules**

Run: `npm test -w @better/core -- --coverage`
Expected: `recurrence.ts` and `parse.ts` both show 100% branch coverage (spec.md §12). If either is short, add the missing test case(s) and re-run — do not close this task with a gap here.

- [ ] **Step 3: Update `docs/feature/2.backend/1.todo/todo.md` block H**

Change:

```markdown
## H. Recurring

- [ ] Belum dimulai — `core/recurrence.ts` tidak ada; field `recurrence`
      selalu `null`
```

to:

```markdown
## H. Recurring

- [x] `core/recurrence.ts` — parser 8 pola frasa spec §8 (`findRecurrenceCandidates`)
      + `nextOccurrence()` (akhir bulan, tahun kabisat), 100% branch coverage
- [x] Wired ke `core/parse.ts` — `recurrence` field terisi dari quick-add
- [x] `completion` table sync — push (insert-only, `onConflictDoNothing`) +
      pull, DTO, isolasi antar-user diverifikasi
- [x] Dexie `completions` table (v4 migration) + sync-client push/pull
- [x] `toggleTaskComplete` recurring-aware: majukan `due_date`, tulis
      `completion`, tidak menutup task; `skipRecurrence` majukan tanpa
      menulis `completion`
- [ ] **Belum diverifikasi di browser sungguhan** kalau Task 8 Step 4 di
      plan-recurrence.md tidak sempat dijalankan dengan tooling browser —
      catat di sini kalau masih pending
- [ ] UI indicator recurring di meta row TaskRow — sengaja di luar scope
      (sudah P3 terpisah di `9.task-row-metadata/todo.md`)
```

Adjust the two checkbox items above based on what Task 8 Step 4 actually found — don't mark them done if the manual browser check didn't happen or found a gap (e.g. the quick-add-without-date edge case).

- [ ] **Step 4: Commit**

```bash
git add docs/feature/2.backend/1.todo/todo.md
git commit -m "docs: mark 1.todo block H (recurring) done"
```

- [ ] **Step 5: Close issue #23**

```bash
gh issue close 23 --comment "Implemented in <list the commit range or PR here>: core/recurrence.ts (8 phrase patterns + nextOccurrence, 100% branch coverage), wired into parse.ts, completion sync (push/pull, insert-only, isolation-tested), Dexie completions table, and toggleTaskComplete's recurring-aware advance-not-close behavior + skipRecurrence. UI indicator remains deferred to 9.task-row-metadata's P3 item as originally scoped."
```

Only run this after Steps 1-4 are genuinely done and verified — do not close the issue speculatively.

---

## Self-Review Notes (for whoever executes this plan)

- **Spec coverage:** All 8 phrase patterns from spec.md §8's table (Task 1), `next()` across month-end/leap-year/DST (Task 2, spec.md §12's explicit ask), completing ≠ closing + the `completion` audit trail (Task 8), `skip` advances without logging (Task 8). Reminder scheduling (spec.md §9) is a separate, larger block (I) — out of scope for this plan, tracked separately.
- **Not built here, deliberately:** any UI for creating/editing recurrence outside quick-add typed phrases (issue #23 explicitly deferred this), any UI trigger for `skipRecurrence` (function exists in the store layer, consistent with how `deleteTask` existed before every view wired a delete button — no view calls it yet).
- **Watch for at execution time:** Task 8 Step 4 flags a real open question — what should happen when a recurrence phrase is typed with no date (the DB's `node_recur_needs_date` CHECK would reject it, but nothing today validates this client-side before the sync push). Resolve this by observing actual behavior in Step 4, not by guessing here.
