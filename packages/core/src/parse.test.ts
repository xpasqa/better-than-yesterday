import { describe, expect, it } from 'vitest'
import { addDays, dayOfWeek } from './date.ts'
import { parse } from './parse.ts'

// Wednesday 2026-08-05 — a real day chosen because it is neither a Sunday
// nor a Monday, so "next occurrence" arithmetic for every weekday name is
// exercised somewhere in this file (see the weekday table test).
const NOW = new Date('2026-08-05T03:00:00Z')
const CTX = { now: NOW, timezone: 'Asia/Jakarta', language: 'id' as const }
const TODAY = '2026-08-05'

describe('parse — content extraction', () => {
  it('leaves plain text with no tokens untouched', () => {
    const result = parse('beli susu', CTX)
    expect(result.content).toBe('beli susu')
    expect(result.spans).toEqual([])
  })

  it('collapses the whitespace left behind after removing tokens', () => {
    const result = parse('beli   tiket besok   pesawat', CTX)
    expect(result.content).toBe('beli tiket pesawat')
  })

  it('never discards text it does not understand', () => {
    const result = parse('perbaiki bug #zzz123 di modul pembayaran', CTX)
    // "#zzz123" starts with a letter so it IS a recognized project token —
    // this case instead checks a token-shaped run that is not recognized:
    // a bare '#' with nothing following it.
    const bare = parse('nomor rumah # 12', CTX)
    expect(bare.content).toContain('#')
    expect(result.projectQuery).toBe('zzz123')
  })
})

describe('parse — relative dates', () => {
  const cases: Array<[string, number]> = [
    ['hari ini', 0],
    ['today', 0],
    ['besok', 1],
    ['bsk', 1],
    ['tomorrow', 1],
    ['lusa', 2],
    ['kemarin', -1],
    ['yesterday', -1],
  ]

  for (const [word, offset] of cases) {
    it(`resolves "${word}" to ${offset >= 0 ? '+' : ''}${offset} day(s)`, () => {
      const result = parse(`rapat tim ${word}`, CTX)
      expect(result.dueDate).toBe(addDays(TODAY, offset))
      expect(result.content).toBe('rapat tim')
    })
  }
})

describe('parse — named weekdays', () => {
  // TODAY (2026-08-05) is a Wednesday. Expected day-of-week offsets from
  // Wednesday, "next occurrence including today":
  const cases: Array<[string, number]> = [
    ['rabu', 0], // today is Wednesday
    ['wednesday', 0],
    ['kamis', 1],
    ['jumat', 2],
    ['sabtu', 3],
    ['minggu', 4],
    ['senin', 5],
    ['selasa', 6],
    ['sunday', 4],
    ['monday', 5],
  ]

  for (const [word, offset] of cases) {
    it(`"${word}" is the next occurrence, ${offset} day(s) from today`, () => {
      const result = parse(`meeting ${word}`, CTX)
      expect(result.dueDate).toBe(addDays(TODAY, offset))
    })
  }

  it('"senin depan" always means next week\'s Monday, not this coming Monday', () => {
    const bare = parse('meeting senin', CTX)
    const next = parse('meeting senin depan', CTX)
    expect(next.dueDate).toBe(addDays(bare.dueDate!, 7))
  })

  it('"next monday" (English order) behaves the same as "senin depan"', () => {
    const bare = parse('meeting monday', CTX)
    const next = parse('meeting next monday', CTX)
    expect(next.dueDate).toBe(addDays(bare.dueDate!, 7))
  })
})

describe('parse — explicit dates', () => {
  it('parses d/m as this year when the date has not passed yet', () => {
    // "25/12" from 2026-08-05 is still ahead this year.
    const result = parse('kado natal 25/12', CTX)
    expect(result.dueDate).toBe('2026-12-25')
  })

  it('parses d-m the same as d/m', () => {
    const result = parse('kado natal 25-12', CTX)
    expect(result.dueDate).toBe('2026-12-25')
  })

  it('rolls over to next year when the day/month has already passed this year', () => {
    // "1/1" (Jan 1) has already passed relative to 2026-08-05.
    const result = parse('resolusi 1/1', CTX)
    expect(result.dueDate).toBe('2027-01-01')
  })

  it('parses a literal ISO date regardless of today\'s date', () => {
    const result = parse('deadline proyek 2026-12-25', CTX)
    expect(result.dueDate).toBe('2026-12-25')
  })

  it('parses "d month-name" in Indonesian', () => {
    const result = parse('bayar pajak 3 sep', CTX)
    expect(result.dueDate).toBe('2026-09-03')
  })

  it('parses "d month-name" with a full English month name', () => {
    const result = parse('renew passport 3 september', CTX)
    expect(result.dueDate).toBe('2026-09-03')
  })
})

describe('parse — rightmost date wins', () => {
  it('keeps only the rightmost of two distinct date mentions', () => {
    const result = parse('pindah dari besok jadi lusa', CTX)
    expect(result.dueDate).toBe(addDays(TODAY, 2)) // lusa, the rightmost
    // The earlier, unused mention is not a recognized token here — it stays
    // in the title exactly like any other text the parser did not use.
    expect(result.content).toBe('pindah dari besok jadi')
  })
})

describe('parse — time', () => {
  const cases: Array<[string, string]> = [
    ['jam 9', '09:00'],
    ['jam 14', '14:00'],
    ['9:00', '09:00'],
    ['9.00', '09:00'],
    ['14:00', '14:00'],
    ['jam 9 pagi', '09:00'],
    ['jam 9 malam', '21:00'],
    ['9pm', '21:00'],
    ['9am', '09:00'],
  ]

  for (const [phrase, expected] of cases) {
    it(`"${phrase}" resolves to ${expected}`, () => {
      const result = parse(`checkup ${phrase}`, CTX)
      expect(result.dueTime).toBe(expected)
    })
  }

  it('does not double-count "jam 9:00" as two separate time candidates', () => {
    const result = parse('checkup jam 9:00', CTX)
    expect(result.dueTime).toBe('09:00')
    expect(result.content).toBe('checkup')
  })

  it('keeps only the rightmost of two distinct time mentions', () => {
    const result = parse('geser dari jam 9 ke jam 5 sore', CTX)
    expect(result.dueTime).toBe('17:00')
  })
})

describe('parse — duration', () => {
  it('parses "selama N menit"', () => {
    const result = parse('fokus nulis selama 45 menit', CTX)
    expect(result.durationMin).toBe(45)
    expect(result.content).toBe('fokus nulis')
  })

  it('parses "for Nm"', () => {
    const result = parse('deep work for 90m', CTX)
    expect(result.durationMin).toBe(90)
  })

  it('parses a bare "N min"', () => {
    const result = parse('beresin laporan 45 min', CTX)
    expect(result.durationMin).toBe(45)
    expect(result.content).toBe('beresin laporan')
  })
})

describe('parse — priority', () => {
  it('parses !1 through !3 as their number', () => {
    expect(parse('urgent !1', CTX).priority).toBe(1)
    expect(parse('sedang !2', CTX).priority).toBe(2)
    expect(parse('rendah !3', CTX).priority).toBe(3)
  })

  it('parses !4 as null — Todoist\'s "no priority"', () => {
    expect(parse('santai !4', CTX).priority).toBeNull()
  })

  it('does not exist by default', () => {
    expect(parse('tidak ada prioritas', CTX).priority).toBeNull()
  })

  it('does not match "!" stuck to a word (an exclamation, not a token)', () => {
    const result = parse('kerjaan ini bagus!', CTX)
    expect(result.priority).toBeNull()
    expect(result.content).toBe('kerjaan ini bagus!')
  })

  it('does not match "p1"-style Todoist syntax — that stays literal title text', () => {
    const result = parse('tulis draft p1', CTX)
    expect(result.priority).toBeNull()
    expect(result.content).toBe('tulis draft p1')
  })
})

describe('parse — project, label, mention sigils', () => {
  it('extracts a single project token', () => {
    const result = parse('bikin spec produk #ProductDesign', CTX)
    expect(result.projectQuery).toBe('ProductDesign')
    expect(result.content).toBe('bikin spec produk')
  })

  it('extracts multiple label tokens', () => {
    const result = parse('bayar listrik $rumah $penting', CTX)
    expect(result.tagNames).toEqual(['rumah', 'penting'])
    expect(result.content).toBe('bayar listrik')
  })

  it('extracts multiple mention tokens', () => {
    const result = parse('lanjutkan @riset dan @draft', CTX)
    expect(result.mentionQueries).toEqual(['riset', 'draft'])
  })

  it('does not treat "$5" (a price) as a label — labels must start with a letter', () => {
    const result = parse('beli kopi $5', CTX)
    expect(result.tagNames).toEqual([])
    expect(result.content).toBe('beli kopi $5')
  })

  it('is order-independent across all four sigils plus a date and time', () => {
    const a = parse('rapat tim besok jam 9 #Kerja $penting !1', CTX)
    const b = parse('!1 $penting rapat tim #Kerja besok jam 9', CTX)
    const c = parse('#Kerja rapat tim jam 9 besok !1 $penting', CTX)
    for (const r of [a, b, c]) {
      expect(r.content).toBe('rapat tim')
      expect(r.dueDate).toBe(addDays(TODAY, 1))
      expect(r.dueTime).toBe('09:00')
      expect(r.projectQuery).toBe('Kerja')
      expect(r.tagNames).toEqual(['penting'])
      expect(r.priority).toBe(1)
    }
  })
})

describe('parse — spans', () => {
  it('reports a span whose substring matches the recognized token', () => {
    const input = 'beli tiket besok'
    const result = parse(input, CTX)
    const dateSpan = result.spans.find((s) => s.kind === 'date')!
    expect(dateSpan).toBeDefined()
    expect(input.slice(dateSpan.start, dateSpan.end)).toBe('besok')
  })

  it('reports one span per kept token, in order of appearance', () => {
    const input = 'rapat besok jam 9 #Kerja'
    const result = parse(input, CTX)
    expect(result.spans.map((s) => s.kind)).toEqual(['date', 'time', 'project'])
    expect(result.spans.every((s, i) => i === 0 || s.start > result.spans[i - 1]!.start)).toBe(true)
  })
})

describe('parse — full example from the spec', () => {
  it('matches the worked example in docs/feature/2.backend/1.todo/spec.md §5', () => {
    const result = parse('beli tiket pesawat besok jam 9 pagi #Travel $penting !1', CTX)
    expect(result.content).toBe('beli tiket pesawat')
    expect(result.dueDate).toBe(addDays(TODAY, 1))
    expect(result.dueTime).toBe('09:00')
    expect(result.projectQuery).toBe('Travel')
    expect(result.tagNames).toEqual(['penting'])
    expect(result.priority).toBe(1)
  })
})

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
    const result = parse('minum obat besok setiap hari $kesehatan !2', CTX)
    expect(result.dueDate).toBe(addDays(TODAY, 1))
    expect(result.recurrence).toBe('FREQ=DAILY')
    expect(result.tagNames).toEqual(['kesehatan'])
    expect(result.priority).toBe(2)
    expect(result.content).toBe('minum obat')
  })

  it('resolves "setiap hari kerja" to the outer weekday-set match, not the nested bare "setiap hari" — pickRightmostNonNested\'s containment filter at work (findRecurrenceCandidates itself returns both, see recurrence.test.ts)', () => {
    const result = parse('cek email setiap hari kerja', CTX)
    expect(result.recurrence).toBe('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')
    expect(result.content).toBe('cek email')
  })

  it('"setiap minggu" composes with date-word matching to anchor on the next Sunday — documents the actual behavior, not a claim that it never happens', () => {
    const result = parse('laporan setiap minggu', CTX)
    expect(result.recurrence).toBe('FREQ=WEEKLY')
    expect(dayOfWeek(result.dueDate!)).toBe(0) // Sunday
  })
})
