# Auto-scheduling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menutup empat celah tanggal relatif yang sudah didaftar sendiri oleh header `parse.ts`, sehingga `minggu depan` / `next week` / `5 hari lagi` / `akhir bulan` terurai jadi `dueDate` saat mengetik.

**Architecture:** Dua fungsi kalender murni baru di `packages/core/src/date.ts`, lalu enam pola regex baru di `findDateCandidates` milik `parse.ts` plus satu guard pada pola weekday. Nol perubahan UI — quick-add sudah merender `kind: 'date'`.

**Tech Stack:** TypeScript, Vitest, `packages/core` (fungsi murni, tanpa I/O).

## Global Constraints

- `packages/core` haram punya I/O, `Date.now()`, atau state modul. Semua fungsi murni: string masuk, string keluar.
- Format tanggal **selalu** `YYYY-MM-DD`. Aritmetika kalender memakai `Date.UTC(y, m-1, d, 12)` — jam 12 menghindari pergeseran DST, mengikuti `addDays` yang sudah ada.
- **Aturan keras parser: yang tidak dikenali tidak pernah dibuang dari `content`.** Setiap pola baru wajib punya tes yang membuktikan input tak-dikenal keluar utuh.
- `npm run verify` harus hijau. `date.ts` dan `parse.ts` wajib 100% branch coverage.
- Batas `N` adalah 1–999, ditegakkan lewat `\d{1,3}` plus `continue` untuk `N === 0`.
- "Awal periode" adalah aturan tunggal: `minggu depan` → **Senin**, `bulan depan` → **tanggal 1**. Tidak ada clamp tanggal.
- Tes lama tidak boleh diubah kecuali yang secara eksplisit mengunci perilaku `minggu depan` lama (§2 spec).

---

### Task 1: Helper kalender di `date.ts`

**Files:**
- Modify: `packages/core/src/date.ts`
- Test: `packages/core/src/date.test.ts`

**Interfaces:**
- Consumes: `addDays`, `dayOfWeek` (sudah ada di file yang sama)
- Produces: `firstOfNextMonth(dateStr: string): string`, `endOfMonth(dateStr: string): string` — dipakai Task 2

- [ ] **Step 1: Tulis tes yang gagal**

```ts
describe('firstOfNextMonth', () => {
  it('goes to the 1st of the following month', () => {
    expect(firstOfNextMonth('2026-08-07')).toBe('2026-09-01')
  })
  it('works when already on the 1st', () => {
    expect(firstOfNextMonth('2026-08-01')).toBe('2026-09-01')
  })
  it('rolls December into the next year', () => {
    expect(firstOfNextMonth('2026-12-20')).toBe('2027-01-01')
    expect(firstOfNextMonth('2026-12-31')).toBe('2027-01-01')
  })
  it('works from February in both leap and non-leap years', () => {
    expect(firstOfNextMonth('2028-02-29')).toBe('2028-03-01')
    expect(firstOfNextMonth('2026-02-28')).toBe('2026-03-01')
  })
})

describe('endOfMonth', () => {
  it('handles 31-day months', () => {
    expect(endOfMonth('2026-08-07')).toBe('2026-08-31')
  })
  it('handles 30-day months', () => {
    expect(endOfMonth('2026-09-07')).toBe('2026-09-30')
  })
  it('handles February in a leap year', () => {
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29')
  })
  it('handles February in a non-leap year', () => {
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28')
  })
  it('handles the year-2000 rule (divisible by 400 IS a leap year)', () => {
    expect(endOfMonth('2000-02-10')).toBe('2000-02-29')
  })
  it('handles the year-1900 rule (divisible by 100, not 400, is NOT)', () => {
    expect(endOfMonth('1900-02-10')).toBe('1900-02-28')
  })
  it('returns the same date when already on the last day', () => {
    expect(endOfMonth('2026-08-31')).toBe('2026-08-31')
  })
  it('handles December', () => {
    expect(endOfMonth('2026-12-05')).toBe('2026-12-31')
  })
})
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `npx vitest run packages/core/src/date.test.ts`
Expected: FAIL — `firstOfNextMonth is not defined`

- [ ] **Step 3: Implementasi**

Tambahkan di bawah `dayOfWeek` di `packages/core/src/date.ts`:

```ts
/**
 * The 1st of the month after the one containing `dateStr`. December rolls
 * into January of the following year. Never clamps — the 1st always exists,
 * which is exactly why spec 21 §4 chose "start of period" over "same day".
 */
export function firstOfNextMonth(dateStr: string): string {
  const [year, month] = dateStr.split('-').map(Number) as [number, number, number]
  const y = month === 12 ? year + 1 : year
  const m = month === 12 ? 1 : month + 1
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`
}

/**
 * The last day of the month containing `dateStr`. Day 0 of the next month is
 * the last day of this one, so the leap-year rules come from the platform
 * rather than being re-derived here.
 */
export function endOfMonth(dateStr: string): string {
  const [year, month] = dateStr.split('-').map(Number) as [number, number, number]
  const last = new Date(Date.UTC(year, month, 0, 12))
  const d = String(last.getUTCDate()).padStart(2, '0')
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${d}`
}
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `npx vitest run packages/core/src/date.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/date.ts packages/core/src/date.test.ts
git commit -m "feat(core): add firstOfNextMonth and endOfMonth date helpers"
```

---

### Task 2: Pola tanggal majemuk di `parse.ts`

**Files:**
- Modify: `packages/core/src/parse.ts`
- Test: `packages/core/src/parse.test.ts`

**Interfaces:**
- Consumes: `firstOfNextMonth`, `endOfMonth` dari Task 1; `addDays`, `dayOfWeek` yang sudah ada
- Produces: tidak ada API baru — `parse()` tetap bertanda tangan sama, hanya mengenali lebih banyak frasa

- [ ] **Step 1: Tulis tes yang gagal**

Tambahkan di `parse.test.ts`. Pola `ctx` mengikuti tes yang sudah ada di file itu.

```ts
describe('compound relative dates', () => {
  const at = (isoDay: string) => ({ now: new Date(`${isoDay}T03:00:00Z`), timezone: 'Asia/Jakarta' })

  it('"minggu depan" means next Monday, not next Sunday', () => {
    const r = parse('rapat minggu depan', at('2026-08-07')) // Friday
    expect(r.dueDate).toBe('2026-08-10')
    expect(r.content).toBe('rapat')
  })

  it('"minggu depan" is still next Monday when today IS Sunday', () => {
    const r = parse('rapat minggu depan', at('2026-08-09')) // Sunday
    expect(r.dueDate).toBe('2026-08-10')
  })

  it('"next week" behaves the same as "minggu depan"', () => {
    expect(parse('meeting next week', at('2026-08-07')).dueDate).toBe('2026-08-10')
  })

  it('"hari minggu depan" keeps the Sunday reading', () => {
    const r = parse('rapat hari minggu depan', at('2026-08-07'))
    expect(r.dueDate).toBe('2026-08-16')
    expect(r.content).toBe('rapat hari')
  })

  it('"bulan depan" is the 1st of next month', () => {
    expect(parse('bayar sewa bulan depan', at('2026-08-07')).dueDate).toBe('2026-09-01')
  })

  it('"bulan depan" rolls December into next year', () => {
    expect(parse('bayar sewa bulan depan', at('2026-12-20')).dueDate).toBe('2027-01-01')
  })

  it('"next month" behaves the same', () => {
    expect(parse('pay rent next month', at('2026-08-07')).dueDate).toBe('2026-09-01')
  })

  it('"akhir bulan" is the last day of the current month', () => {
    expect(parse('lapor akhir bulan', at('2026-08-07')).dueDate).toBe('2026-08-31')
  })

  it('"akhir bulan" is leap-year correct', () => {
    expect(parse('lapor akhir bulan', at('2028-02-10')).dueDate).toBe('2028-02-29')
  })

  it('"end of month" behaves the same', () => {
    expect(parse('report end of month', at('2026-08-07')).dueDate).toBe('2026-08-31')
  })

  it('"N hari lagi" adds N days', () => {
    const r = parse('kirim 5 hari lagi', at('2026-08-07'))
    expect(r.dueDate).toBe('2026-08-12')
    expect(r.content).toBe('kirim')
  })

  it('"in N days" adds N days, singular and plural', () => {
    expect(parse('ship in 5 days', at('2026-08-07')).dueDate).toBe('2026-08-12')
    expect(parse('ship in 1 day', at('2026-08-07')).dueDate).toBe('2026-08-08')
  })

  it('"N minggu lagi" adds N weeks', () => {
    expect(parse('cek 2 minggu lagi', at('2026-08-07')).dueDate).toBe('2026-08-21')
    expect(parse('cek in 2 weeks', at('2026-08-07')).dueDate).toBe('2026-08-21')
  })

  it('rejects "0 hari lagi" and leaves the text untouched', () => {
    const r = parse('beli 0 hari lagi', at('2026-08-07'))
    expect(r.dueDate).toBeNull()
    expect(r.content).toBe('beli 0 hari lagi')
  })

  it('composes with time, project and priority', () => {
    const r = parse('rapat minggu depan jam 9 #Kerja p1', at('2026-08-07'))
    expect(r.dueDate).toBe('2026-08-10')
    expect(r.dueTime).toBe('09:00')
    expect(r.projectQuery).toBe('Kerja')
    expect(r.priority).toBe(1)
    expect(r.content).toBe('rapat')
  })

  it('rightmost mention still wins', () => {
    expect(parse('besok atau minggu depan', at('2026-08-07')).dueDate).toBe('2026-08-10')
  })
})
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `npx vitest run packages/core/src/parse.test.ts`
Expected: FAIL. Perhatikan bahwa `"minggu depan"` gagal dengan `2026-08-16` (perilaku lama, hari Minggu) — bukan `undefined`. Itu konfirmasi tabrakan yang dijelaskan spec §2.

- [ ] **Step 3: Tambahkan guard pada pola weekday**

Di `findDateCandidates`, di dalam loop `weekdayPattern`, tepat setelah
`if (target === undefined) continue`:

```ts
    // "minggu depan" means *next week*, not *next Sunday* — see spec 21 §2.
    // Release the span here so the compound pattern below can claim it.
    // "hari minggu depan" keeps the weekday reading, so the guard checks for
    // a preceding "hari ". Do NOT replace this with pattern ordering:
    // pickRightmostNonNested keeps BOTH candidates when spans are identical,
    // and the winner would silently depend on push order.
    const isSundayWord = m[2]!.toLowerCase() === 'minggu'
    const precededByHari = /\bhari\s+$/i.test(input.slice(0, m.index))
    if (isSundayWord && isNextWeek && !precededByHari) continue
```

`isNextWeek` sudah dihitung di baris atasnya; pindahkan perhitungannya ke
atas guard bila perlu.

- [ ] **Step 4: Tambahkan pola majemuk**

Di `findDateCandidates`, **setelah** loop weekday dan sebelum pola `d/m`:

```ts
  // "minggu depan" / "next week" → next Monday. dayOfWeek: 0=Sun … 6=Sat.
  // Sunday is only ONE day before Monday, so `8 - dow` would overshoot by a
  // week — hence the explicit branch.
  for (const m of input.matchAll(/\b(?:minggu\s+depan|next\s+week)\b/gi)) {
    const dow = dayOfWeek(today)
    const toNextMonday = dow === 0 ? 1 : 8 - dow
    candidates.push({ start: m.index, end: m.index + m[0].length, value: addDays(today, toNextMonday) })
  }

  // "bulan depan" / "next month" → the 1st. Start-of-period, never clamped.
  for (const m of input.matchAll(/\b(?:bulan\s+depan|next\s+month)\b/gi)) {
    candidates.push({ start: m.index, end: m.index + m[0].length, value: firstOfNextMonth(today) })
  }

  // "akhir bulan" / "end of month".
  for (const m of input.matchAll(/\b(?:akhir\s+bulan|end\s+of\s+(?:the\s+)?month)\b/gi)) {
    candidates.push({ start: m.index, end: m.index + m[0].length, value: endOfMonth(today) })
  }

  // "N hari lagi" / "in N days" / "N minggu lagi" / "in N weeks".
  // \d{1,3} enforces the 1–999 ceiling from spec 21 §4; N === 0 is dropped
  // because "0 hari lagi" is not a sentence anyone types on purpose.
  const countedPatterns: [RegExp, number][] = [
    [/\b(\d{1,3})\s+hari\s+lagi\b/gi, 1],
    [/\bin\s+(\d{1,3})\s+days?\b/gi, 1],
    [/\b(\d{1,3})\s+minggu\s+lagi\b/gi, 7],
    [/\bin\s+(\d{1,3})\s+weeks?\b/gi, 7],
  ]
  for (const [pattern, multiplier] of countedPatterns) {
    for (const m of input.matchAll(pattern)) {
      const n = Number(m[1])
      if (n === 0) continue
      candidates.push({ start: m.index, end: m.index + m[0].length, value: addDays(today, n * multiplier) })
    }
  }
```

Tambahkan `firstOfNextMonth` dan `endOfMonth` ke import dari `./date.ts`.

- [ ] **Step 5: Jalankan tes, pastikan lulus**

Run: `npx vitest run packages/core/src/parse.test.ts`
Expected: PASS — termasuk tes lama `"senin depan" always means next week's Monday`, yang membuktikan guard tidak melukai nama hari lain.

- [ ] **Step 6: Perbarui header file**

Blok komentar di `parse.ts` baris ~9-13 mendaftar celah yang kini tertutup semua. Ganti kalimatnya:

```
// Scope of this version: relative day words, named weekdays (bare and
// "depan"/"next"), compound relative phrases ("minggu depan", "bulan depan",
// "N hari lagi", "akhir bulan"), explicit d/m and d-m dates, ISO dates,
// "d month-name" dates, jam/bare/am-pm time phrases, minute durations,
// priority, the four sigil tokens, and the eight recurrence phrases in
// spec.md §8. Anything not recognized is left in the title untouched, per
// the parser's one hard rule: never discard text it did not understand.
```

Komentar yang menyebut celah sudah-tertutup adalah komentar yang berbohong.

- [ ] **Step 7: Verifikasi penuh**

Run: `npm run verify`
Expected: hijau, coverage `date.ts` dan `parse.ts` 100% branch.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/parse.ts packages/core/src/parse.test.ts
git commit -m "feat(core): parse compound relative dates (minggu depan, N hari lagi, akhir bulan)"
```
