# Metadata Terurai Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menampilkan dua hal yang parser sudah pahami tapi UI tidak pernah beritahu — hasil parse quick-add, dan status berulang sebuah task.

**Architecture:** Satu fungsi murni baru di `packages/core/src/recurrence.ts` untuk menerjemahkan RRULE jadi frasa manusia; `QuickAddBar` memanggil `parse()` saat render untuk pratinjau; `TaskRow` menambah satu ikon di meta row.

**Tech Stack:** TypeScript, React, Vitest.

## Global Constraints

- Nol perubahan model, skema, atau tulisan ke DB. Fitur ini **murni perenderan**.
- `packages/core` haram punya I/O atau state modul.
- Rule yang tidak dikenal → `describeRecurrence` mengembalikan `null`, **tidak melempar**. Ikon hilang itu kosmetik; komponen melempar mematikan seluruh daftar.
- Warna dari variabel tema yang sudah ada, jangan hardcode hex — dark mode akan rusak.
- `npm run verify` hijau; `describeRecurrence` 100% branch coverage.

---

### Task 1: `describeRecurrence` di core

**Files:**
- Modify: `packages/core/src/recurrence.ts`
- Test: `packages/core/src/recurrence.test.ts`

**Interfaces:**
- Produces: `describeRecurrence(rule: string | null): string | null` — dipakai Task 2 dan Task 3

- [ ] **Step 1: Tulis tes yang gagal**

```ts
describe('describeRecurrence', () => {
  const cases: [string | null, string | null][] = [
    ['FREQ=DAILY', 'setiap hari'],
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
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `npx vitest run packages/core/src/recurrence.test.ts`
Expected: FAIL — `describeRecurrence is not defined`

- [ ] **Step 3: Implementasi**

```ts
const DAY_NAMES: Record<string, string> = {
  SU: 'Minggu', MO: 'Senin', TU: 'Selasa', WE: 'Rabu',
  TH: 'Kamis', FR: 'Jumat', SA: 'Sabtu',
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/**
 * An RRULE as a short human phrase, for display only. Returns null for
 * anything this app does not itself produce — the caller shows no icon,
 * which is a cosmetic gap, whereas throwing would take down the whole list.
 */
export function describeRecurrence(rule: string | null): string | null {
  if (!rule) return null
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
    return Number.isInteger(n) && n > 1 ? `setiap ${n} hari` : null
  }

  if (freq === 'WEEKLY') {
    const byday = parts.get('BYDAY')
    if (!byday) return null
    if (byday === 'MO,TU,WE,TH,FR') return 'setiap hari kerja'
    const name = DAY_NAMES[byday]
    return name ? `setiap ${name}` : null
  }

  if (freq === 'MONTHLY') {
    const day = Number(parts.get('BYMONTHDAY'))
    return Number.isInteger(day) && day >= 1 && day <= 31 ? `setiap tanggal ${day}` : null
  }

  if (freq === 'YEARLY') {
    const month = Number(parts.get('BYMONTH'))
    const day = Number(parts.get('BYMONTHDAY'))
    if (!Number.isInteger(month) || month < 1 || month > 12) return null
    if (!Number.isInteger(day) || day < 1 || day > 31) return null
    return `setiap ${day} ${MONTH_NAMES[month - 1]}`
  }

  return null
}
```

> `Number('')` adalah `0`, bukan `NaN` — itulah kenapa penjaganya memeriksa
> rentang, bukan cuma `Number.isInteger`. Tes `BYMONTHDAY=` mengunci ini.

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `npx vitest run packages/core/src/recurrence.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/recurrence.ts packages/core/src/recurrence.test.ts
git commit -m "feat(core): describeRecurrence — RRULE to a human phrase"
```

---

### Task 2: Ikon recurring di `TaskRow`

**Files:**
- Modify: `apps/web/src/components/TaskRow.tsx`
- Modify: `apps/web/src/components/TaskRow.css` (atau CSS yang dipakainya)

**Interfaces:**
- Consumes: `describeRecurrence` dari Task 1

- [ ] **Step 1: Perluas penjaga meta row**

Di `TaskRow.tsx:87` penjaganya sekarang:

```tsx
{(dueInfo || node.dueTime || taskLabels.length > 0 || parentProject) && (
```

Ganti jadi:

```tsx
{(dueInfo || node.dueTime || node.recurrence || taskLabels.length > 0 || parentProject) && (
```

> **Ini langkah yang paling gampang terlewat dan paling merusak.** Enam dari
> delapan pola recurrence spec §8 tidak membawa frasa tanggal — `siram
> tanaman setiap hari` adalah bentuk yang **normal**. Tanpa `node.recurrence`
> di penjaga, meta row-nya tidak dirender sama sekali, jadi ikonnya tidak
> pernah muncul untuk justru kasus yang paling sering.

- [ ] **Step 2: Tambahkan ikonnya**

Import `ArrowsClockwiseIcon` dari `@phosphor-icons/react` dan
`describeRecurrence` dari `@better/core/recurrence`. Di dalam meta row,
setelah blok tanggal:

```tsx
{node.recurrence && (() => {
  const label = describeRecurrence(node.recurrence)
  return label ? (
    <span className="task-row__recurrence" title={label}>
      <ArrowsClockwiseIcon size={12} />
      {label}
    </span>
  ) : null
})()}
```

- [ ] **Step 3: Gaya**

```css
.task-row__recurrence { display: inline-flex; align-items: center; gap: 3px; color: var(--text-tertiary); font-size: 12px; }
```

- [ ] **Step 4: Verifikasi**

Run: `npm run verify`

Lalu di browser: quick-add `siram tanaman setiap hari` — task muncul dengan
ikon berulang **dan** teks "setiap hari", meski tidak punya tanggal, label,
atau project.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/TaskRow.tsx apps/web/src/components/TaskRow.css
git commit -m "feat(web): show recurrence indicator in TaskRow meta row"
```

---

### Task 3: Pratinjau parse di `QuickAddBar`

**Files:**
- Modify: `apps/web/src/components/QuickAddBar.tsx`
- Modify: `apps/web/src/components/RealView.css`

**Interfaces:**
- Consumes: `parse` dari `@better/core/parse`; `describeRecurrence` dari Task 1

- [ ] **Step 1: Hitung pratinjau**

`QuickAddBar` sudah menerima `timezone`. Tambahkan di badan komponen:

```tsx
const trimmed = value.trim()
const parsed = trimmed ? parse(value, { now: new Date(), timezone, language: 'id' }) : null
const recurrenceLabel = parsed ? describeRecurrence(parsed.recurrence) : null
const hasMetadata = Boolean(
  parsed &&
    (parsed.dueDate || parsed.dueTime || parsed.recurrence || parsed.projectQuery ||
      parsed.priority !== null || parsed.labelNames.length > 0),
)
```

> `parse()` sinkron, di memori, tanpa I/O — tidak ada yang perlu di-debounce,
> prinsip yang sama dengan `SearchView` di [spec 12](../12.search/spec.md) §3.
>
> `language: 'id'` disalin apa adanya dari perilaku sekarang. Ia **parameter
> mati** — `parse.ts` tidak pernah membacanya (lihat issue [#74](https://github.com/xpasqa/better-than-yesterday/issues/74)) — jadi
> nilainya tidak berpengaruh, dan mengubahnya bukan urusan task ini.

- [ ] **Step 2: Render barisnya**

Tepat di bawah `<form>`, masih di dalam pembungkusnya:

```tsx
{hasMetadata && parsed && (
  <div className="quick-add__preview">
    {parsed.content && <span className="quick-add__preview-title">{parsed.content}</span>}
    {parsed.dueDate && (
      <span className="quick-add__chip">
        {new Date(parsed.dueDate + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
      </span>
    )}
    {parsed.dueTime && <span className="quick-add__chip">{parsed.dueTime}</span>}
    {recurrenceLabel && <span className="quick-add__chip">{recurrenceLabel}</span>}
    {parsed.projectQuery && <span className="quick-add__chip">#{parsed.projectQuery}</span>}
    {parsed.priority !== null && <span className="quick-add__chip">P{parsed.priority}</span>}
    {parsed.labelNames.map((name) => (
      <span key={name} className="quick-add__chip">${name}</span>
    ))}
  </div>
)}
```

Tanggal diformat manusiawi, bukan ISO — `2026-08-10` tidak menjawab
"berarti hari apa?", dan itu justru pertanyaan yang muncul saat mengetik
`minggu depan`.

- [ ] **Step 3: Gaya**

```css
.quick-add__preview { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 6px 12px 0; font-size: 12px; color: var(--text-tertiary); }
.quick-add__preview-title { color: var(--text-secondary); font-weight: 500; }
.quick-add__chip { background: var(--bg-secondary); border-radius: 4px; padding: 1px 6px; }
```

- [ ] **Step 4: Verifikasi**

Run: `npm run verify`

Di browser, ketik `rapat tim minggu depan jam 9 #Kerja !1` — pratinjau
menampilkan `rapat tim` plus chip tanggal (**tanggal Senin sungguhan**, bukan
teks `minggu depan`), jam, project, dan prioritas. Hapus semuanya sampai
tinggal `rapat tim` — pratinjau hilang.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/QuickAddBar.tsx apps/web/src/components/RealView.css
git commit -m "feat(web): show what quick-add parsed, below the input"
```
