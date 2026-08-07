# Spec: Real View Parity — Layout, AddTaskForm, dan Seed Data

## Objective

Membuat semua real (store-backed) views — Today, Inbox, Upcoming, Project —
**identik secara visual dan fungsional** dengan mock frontend (`MainContent` +
`TaskItem` + `AddTaskForm`).

Tiga area utama:
1. **Layout parity** — real views harus pakai layout persis sama dengan `MainContent`
2. **AddTaskForm parity** — ganti `QuickAddBar` (plain input) dengan `AddTaskForm`
   yang sudah ada (rounded card, chip toolbar, priority, due date, description)
3. **Seed data** — insert task & label sample ke DB akun `pasqa@xvntr.my.id`
   sehingga ada data nyata untuk test visual

---

## Tech Stack

- React 19 + TypeScript + Vite + CSS polos
- Dexie (local) + Hono API (server sync)
- CSS variables dari `variables.css` — semua ukuran sudah didefinisikan
- `@phosphor-icons/react` untuk icons
- `@dnd-kit/core` untuk drag & drop (mock sudah pakai, real belum)
- Node 22 + `tsx scripts/user.ts` untuk CLI seed

---

## Commands

```bash
# Type check
cd apps/web && npx tsc --noEmit

# Build + deploy
sudo chown -R ubuntu:ubuntu apps/web/node_modules/.vite-temp apps/web/node_modules/.tmp apps/web/dist 2>/dev/null || true
node_modules/.bin/vite build --config apps/web/vite.config.ts
sudo cp -r apps/web/dist/. /var/www/bty.xvntr.my.id/
sudo nginx -s reload

# Seed DB
npm run user -- --help
```

---

## Gap Analysis: Mock vs Real

### 1. Layout

| Aspek | Mock (MainContent) | Real saat ini | Gap |
|---|---|---|---|
| Container class | `main-content` → `main-content__inner` | `real-view` → `real-view__inner` | Sudah sama setelah feature 9, tapi class name berbeda |
| Max width | `--editor-max-width` (800px) | `--editor-max-width` ✅ | — |
| Padding | `56px 0 100px` | `56px 0 100px` ✅ | — |
| Header | `main-content__header` + title + subtitle | `real-view__header` + h1 + subtitle ✅ | Sudah mirip |
| Section header | `main-content__section-header` dengan label + count | `real-view__group-label` plain uppercase text | Section header kurang count + styling |
| Task list | `<ul>` + `TaskItem` | `<ul>` + `TaskRow` | TaskRow perlu bleed CSS |

### 2. AddTaskForm vs QuickAddBar

| Fitur | Mock AddTaskForm | Real QuickAddBar | Gap |
|---|---|---|---|
| UI style | Rounded card (`border-radius: 12px`) dengan border | Plain `<input>` + red button | **Beda total** |
| Trigger | Klik "+ Add task" button → form expand inline | Input selalu visible | Perlu "+Add task" trigger |
| Title input | Bare input, no border | Input dengan border | Style berbeda |
| Description | Textarea opsional (klik untuk show) | Tidak ada | Missing |
| Due date chip | Outlined chip dengan calendar icon, turns colored when set | Tidak ada | Missing |
| Priority chip | Outlined chip dengan flag icon | Tidak ada | Missing |
| Project chip | Outlined chip dengan `#` icon | Tidak ada (defaultParentId implicit) | Missing |
| Submit/Cancel | `PaperPlaneTiltIcon` submit + `XIcon` cancel | "Add" button | Style berbeda |
| Natural language | Tidak ada — explicit field-by-field | ✅ `createTaskFromQuickAdd` NLP | Real lebih powerful tapi less visual |
| Position | Di bawah section header, di atas task list | Di atas semua tasks | — |

**Keputusan desain:**
Real views akan pakai `AddTaskForm` yang sudah ada, tapi connected ke
`createTaskFromQuickAdd` + `updateNode` untuk persistence. `QuickAddBar` tetap
ada sebagai fallback NLP (advanced users), tapi main add-task UX adalah form
card seperti mock.

### 3. TaskRow vs TaskItem CSS

| Aspek | TaskItem | TaskRow | Gap |
|---|---|---|---|
| `--task-row-bleed` | ✅ `inset: 0 calc(-1 * var(--task-row-bleed))` | ❌ tidak ada | Hover area kurang lebar |
| `border-bottom` | `1px solid var(--divider-primary)` pada tiap row | ✅ sudah ada di TaskRow.css | — |
| `last-child` no border | ✅ | ✅ | — |
| Content area cursor | `cursor: pointer` saat `onOpenNode` | `cursor: pointer` ✅ | — |

### 4. Seed Data

Akun `pasqa@xvntr.my.id` tidak punya task sama sekali di DB. Perlu insert:

**Projects:** Work, Personal, Shopping, Health
**Labels:** email, call, important, waiting
**Tasks:** ~8-10 task dengan berbagai priority, due date, labels

Mekanisme seed: script TypeScript yang connect langsung ke Postgres
(pakai Drizzle yang sudah ada) dan insert via SQL.

---

## Acceptance Criteria

### Layout
- [ ] Real views menggunakan class CSS yang konsisten (`real-view`, `real-view__inner`)
- [ ] Section header menampilkan label + task count seperti mock
- [ ] `--task-row-bleed` diterapkan di `TaskRow.css`

### AddTaskForm
- [ ] Klik "+ Add task" di bawah header → form card expand (seperti mock)
- [ ] Form punya: title input, optional description, due date chip, priority chip
- [ ] Enter atau klik submit → task tersimpan ke Dexie + outbox
- [ ] Escape atau klik cancel → form collapse
- [ ] Form collapse setelah submit

### Seed data
- [ ] Script `scripts/seed-tasks.ts` yang bisa dijalankan dengan `npm run seed`
- [ ] Insert 4 projects + 4 labels + 8-10 tasks untuk user `pasqa@xvntr.my.id`
- [ ] Script idempotent (tidak duplikat jika dijalankan 2x)

---

## File yang Akan Diubah/Dibuat

### Diubah
- `apps/web/src/components/TaskRow.css` — tambah `--task-row-bleed` hover
- `apps/web/src/components/TodayReal.tsx` — pakai AddTaskForm, section header
- `apps/web/src/components/InboxReal.tsx` — pakai AddTaskForm
- `apps/web/src/components/UpcomingReal.tsx` — pakai AddTaskForm
- `apps/web/src/components/ProjectReal.tsx` — pakai AddTaskForm
- `apps/web/src/components/AddTaskForm.tsx` — connect ke real store

### Dibuat
- `scripts/seed-tasks.ts` — seed script
- `apps/web/src/components/AddTaskFormReal.tsx` — wrapper AddTaskForm untuk Node store
- `apps/web/src/components/AddTaskFormReal.css` — style overrides jika perlu

---

## Batasan Scope

- **Tidak termasuk:** drag & drop reorder di real views (P3 dari feature 9)
- **Tidak termasuk:** sections di ProjectReal (P2 dari feature 9)
- **Tidak termasuk:** ubah `AddTaskForm.tsx` itu sendiri — buat wrapper baru
- **Tidak termasuk:** board view di real views
- `AddTaskForm.tsx` **jangan diubah** — tetap pakai mock data untuk MainContent

---

## Open Questions

1. `AddTaskForm` pakai explicit fields (priority, due date picker) sedangkan
   `QuickAddBar` pakai NLP. Untuk real views, gunakan hybrid: form card
   menggunakan NLP `createTaskFromQuickAdd` di bawah tapi UI-nya explicit fields.
   → **Keputusan: buat `AddTaskFormReal` yang visually identik dengan `AddTaskForm`
   tapi menggunakan `createTaskFromQuickAdd` + `updateNode` di bawah.**

2. Seed script: apakah pakai Drizzle ORM atau raw SQL?
   → **Keputusan: pakai Drizzle ORM yang sudah ada di `apps/api/src/db/`**
