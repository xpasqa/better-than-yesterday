# Todoist UI Clone — Spec & Progress

> ⚠️ **PENTING — baca [Hasil Verifikasi Runtime](#hasil-verifikasi-runtime-4-agustus-2026) di bagian bawah dulu.**
> Bagian "Spec untuk Agent Berikutnya" di dokumen ini ditulis TANPA akses ke Todoist asli
> dan **banyak angkanya salah**. Bagian verifikasi di bawah berisi nilai yang diukur langsung
> dari DOM Todoist yang sudah login. Kalau ada konflik, **yang di bawah yang benar**.

## Konteks

Project ini adalah rekonstruksi UI Todoist menggunakan React + Vite + TypeScript, dibuat sebagai bahan eksplorasi untuk keperluan interview di Todoist/Doist. Tujuan akhir adalah pixel-perfect clone dari tampilan Todoist web app.

---

## Yang Sudah Dikerjakan

### 1. Ekstraksi Design Tokens
- Mount DMG Todoist 9.29.1-arm64 → konfirmasi bahwa app.asar hanya berisi Electron shell, UI di-load dari `app.todoist.com`
- Fetch HTML dari `app.todoist.com` → HTML statis, butuh login untuk render UI
- Eksekusi script di Console Todoist web → berhasil extract **semua CSS custom properties dari `:root`** secara lengkap

Design tokens yang berhasil di-extract:
- `--reactist-*` → spacing, typography, border-radius, warna component library Doist
- `--product-library-*` → full design system tokens (background, border, actionable, priorities, meta colors, selectable, schedule)
- Layout tokens: `--sidebar-width`, `--task-detail-modal-width: 864px`, `--editor-max-width: 800px`
- Priority colors: `--todoist-p1-color: #d1453b`, p2 `#eb8909`, p3 `#246fe0`, p4 `#666`
- Animation tokens, stacking order, scrollbar tokens

### 2. Setup Project
- Vite + React + TypeScript di `/Users/pasqa/Code/better`
- Dev server berjalan di port 4200 dengan `strictPort: false`
- Build clean tanpa error TypeScript

### 3. File Structure
```
src/
  components/
    Sidebar.tsx / Sidebar.css
    MainContent.tsx / MainContent.css
    TaskList.tsx / TaskList.css
    TaskItem.tsx / TaskItem.css
    AddTaskForm.tsx / AddTaskForm.css
  data/
    mockData.ts        ← 10 sample tasks, 5 projects, 4 labels
  styles/
    variables.css      ← semua design tokens dari Todoist
    global.css         ← reset, scrollbar, base styles
  types/
    index.ts           ← Task, Project, Label, Priority, ViewType types
  App.tsx / App.css
  main.tsx
  index.css
```

### 4. Fitur yang Sudah Berjalan
- Sidebar: navigasi Inbox / Today / Upcoming / Filters & Labels
- Sidebar: Favorites section dan My Projects section (collapsible)
- Sidebar: collapse/expand button
- MainContent: Today view dengan overdue section dan today section
- MainContent: switch view (Inbox, Today, Upcoming, Project)
- TaskItem: checkbox dengan warna per priority (p1-p4)
- TaskItem: due date display (overdue = merah, today = hijau, tomorrow)
- TaskItem: label dan project indicator
- TaskItem: hover actions + delete dropdown
- AddTaskForm: inline form dengan due date picker, priority selector, project selector
- AddTaskForm: keyboard shortcut Enter (submit) dan Escape (cancel)
- Toggle complete task (strikethrough + pindah ke completed section)
- Completed section collapsible

---

## Masalah yang Belum Terselesaikan

### CRITICAL — Visual belum pixel-perfect
UI saat ini terlihat jauh dari Todoist asli. Agent berikutnya perlu melakukan redesign menyeluruh berdasarkan referensi visual Todoist.

**Root cause:** Kita tidak bisa melihat screenshot Todoist asli untuk compare, dan agent tidak bisa akses browser langsung untuk inspect rendered HTML.

**Yang dibutuhkan agent berikutnya:**
1. Akses ke screenshot Todoist atau kemampuan inspect DOM Todoist yang sudah login
2. Atau: user paste HTML dari DevTools Todoist untuk setiap bagian UI

---

## Spec untuk Agent Berikutnya

### Prioritas 1 — Layout Utama (Sidebar + Main Content)

**Sidebar (target: identik dengan Todoist):**
- Width: 220px, background: `#fcfaf8`
- Tidak ada border-right yang visible — Todoist pakai subtle shadow/transition
- Header: avatar workspace (merah, rounded square) + nama workspace + tombol collapse
- Nav items: height 30-32px, padding `4px 8px`, border-radius 5px
- Active state: background `rgba(0,0,0,0.07)` bukan highlighted
- Icon warna: Inbox=`#246fe0`, Today=`#058527`, Upcoming=`#692ec2`, Filters=`#f48318`
- Section headers: uppercase, 11px, warna `#808080`, chevron di kiri
- Task count badge: di kanan, warna `#808080`, font 12px
- Project dots: 8px lingkaran solid

**Main Content:**
- Background: `#ffffff` (putih bersih)
- Padding: `32px 55px` kiri-kanan, content max-width `800px` centered
- Title "Today": font-size 20px, font-weight 700, warna `#202020`
- Subtitle tanggal: 13px, warna `#999`
- Section divider: 1px solid `#eee`, label 13px semi-bold

### Prioritas 2 — Task Item (paling kritikal untuk pixel-perfect)

Struktur HTML task item Todoist:
```
[checkbox circle] [content area] [actions on hover]
  content area:
    - task title (14px, #202020, line-height 21px)
    - description (12px, #808080) — hanya tampil kalau ada
    - meta row: due date + labels + project name (12px, di kiri; project di kanan)
```

Detail visual:
- Checkbox: 18px circle, border 1.5px dengan warna sesuai priority
- Hover state checkbox: background light tinted sesuai priority color
- Completed state: title strikethrough + warna #999, checkbox filled dengan warna priority
- Row hover: background `rgba(0,0,0,0.018)` — sangat subtle
- Actions muncul on hover: today icon, comment icon, more (⋯)
- Separator antar task: 1px solid `#f0f0f0` — sangat tipis
- Tidak ada card/box per task — flat list

### Prioritas 3 — Add Task Form

- Border: 1px solid `#e0e0e0`, border-radius 10px
- Shadow: `0px 4px 10px rgba(0,0,0,0.08)`
- Title input: 14px, font-weight 500, placeholder "Task name" warna `#bbb`
- Description input: 13px, placeholder "Description"
- Toolbar: due date button + priority button + project button, semua pakai border 1px `#e0e0e0`, height 26px, font-size 12px
- Submit button: background `#db4035`, color white, border-radius 5px, height 30px
- Cancel button: background `#f0f0f0`, color `#555`

### Prioritas 4 — Top Bar (belum ada!)

Todoist punya top bar di atas main content:
- Height: 44px
- Background: white
- Contains: search icon, bell notification, help (?) icon
- Border-bottom: 1px solid `#f0f0f0`
- Ini penting untuk pixel-perfect karena tanpa top bar tampilan terasa "kosong" di atas

### Prioritas 5 — Empty States

Setiap view perlu empty state:
- Today dengan 0 task: ilustrasi + "What do you want to accomplish today?"
- Inbox kosong: "Your peace of mind is priceless"

---

## Design Tokens Penting (Sudah Terverifikasi dari Runtime)

```css
/* Background */
--bg-sidebar: #fcfaf8
--bg-main: #ffffff

/* Text */
--text-primary: #202020
--text-secondary: #666
--text-tertiary: #999

/* Brand */
--brand-red: #dc4c3e
--brand-red-primary: #d33322    /* actionable primary */
--brand-red-hover: #c3392c

/* Dividers */
--divider-primary: #eee
--divider-subtle: #f0f0f0       /* antar task items */

/* Priorities */
--p1: #d1453b
--p2: #eb8909
--p3: #246fe0
--p4: #999

/* Spacing (dari reactist) */
--spacing-xs: 4px
--spacing-sm: 8px
--spacing-md: 12px
--spacing-lg: 16px
--spacing-xl: 24px
```

---

## Tech Stack

- React 19 + TypeScript + Vite 8
- CSS Modules (plain CSS per component, no Tailwind)
- No external UI library
- Dev server: `localhost:4200`
- Build: `npm run build` (clean, 0 errors)

---

## Cara Menjalankan

```bash
cd /Users/pasqa/Code/better
npm run dev   # → http://localhost:4200
npm run build # → dist/
```

---

## Catatan untuk Agent Berikutnya

1. **Jangan refactor struktur komponen** — sudah cukup baik, fokus pada CSS/visual saja
2. **Prioritaskan TaskItem dulu** — ini yang paling visible dan kritikal
3. ~~Gunakan nilai exact dari design tokens di atas~~ → pakai [Hasil Verifikasi Runtime](#hasil-verifikasi-runtime-4-agustus-2026)
4. **Minta user paste HTML dari DevTools** jika perlu struktur yang lebih akurat
5. ~~Top bar perlu dibuat dari scratch~~ → **SALAH, top bar tidak ada.** Lihat verifikasi.
6. **Test di viewport 1280px** — ini ukuran paling umum Todoist dipakai

---

## Hasil Verifikasi Runtime (4 Agustus 2026)

Diukur langsung dari `app.todoist.com` yang sudah login, via `getComputedStyle` +
`getBoundingClientRect` di DOM asli. Viewport 1440px. **Ini sumber kebenaran.**

### Koreksi terhadap spec di atas

| Elemen | Ditulis di spec | Aktual (terukur) |
|---|---|---|
| Sidebar width | 220px | **280px** |
| Nav item | h 30–32px, pad `4px 8px` | **h 34px**, pad `5px`, wrapper 256×34 |
| Nav active state | `rgba(0,0,0,0.07)` | **`#ffefe5`** (peach), teks tetap `#202020` |
| Judul view | 20px / 700 | **26px / 700**, line-height 35px |
| Subtitle | tanggal, 13px `#999` | **"5 tasks"**, 14px / 400, `#666` |
| Section header | 13px semi-bold | **14px / 700**, line-height 20px |
| Separator task | `#f0f0f0` | **`#eee`** |
| Meta text | `#808080` | **`#666`** |
| Project indicator | dot 8px solid | **ikon `#` (hash)** berwarna |
| Background halaman | main putih | **body `#fcfaf8`**, main `#fff` di atasnya |
| Top bar | ada, h 44px | **TIDAK ADA** — jangan bikin `TopBar.tsx` |

Yang sudah benar di spec lama: task title 14px `#202020` lh 21px · checkbox visual 18px ·
priority colors (`#d1453b` `#eb8909` `#246fe0` `#666`) · `--editor-max-width: 800px` ·
sidebar bg `#fcfaf8`.

### Layout

- Body & sidebar background `#fcfaf8`; `<main>` putih, mulai di x=280, lebar sisa viewport
- Kolom konten **800px, centered**
- Section header melebar jadi **832px** (−16px tiap sisi terhadap kolom konten)
- Font stack: `-apple-system, "system-ui", "Segoe UI", "Noto Sans", system-ui, sans-serif`
- Base font-size body: 13px

### Sidebar

- Width **280px**, nav item x=12, wrapper **256×34**, inner link 230×34
- Pitch antar item **34px, tanpa gap**; padding `5px`; border-radius `5px`
- Font item: 13px / 400, `#202020`
- Active: background `#ffefe5`
- "Add task": 14px / 600, `#d33322`
- Header akun: 13px / 600, `#666`
- Urutan nav: Search · Inbox · Today · Upcoming · Filters & Labels · **Reporting**
  (`Reporting` belum ada di project — perlu ditambah)
- Badge "Used: 4/5" di section header: bg `#eee`, teks `#5e5e5e`
- **Tidak ada section Favorites** di akun free

### Task Item (terukur, item 2 baris = tinggi 58px)

```
outer      816×58 @x=−8        ← melebar 8px kiri-kanan (area hover bg)
checkbox   hit 24×24; lingkaran visual 18×18 @x=0,y=11
           ring digambar pakai SVG stroke, bukan CSS border
content    751×58 @x=27
  title    751×23 @y=8    14px / 400 / lh 21px   #202020
  meta     751×16 @y=34   12px / 400 / lh 16px   #666
           due date lewat tempo → 12px / 400 / lh 18px  #d1453b
actions    3 tombol 24×24, pitch 32px, rata kanan
border-bottom: 1px solid #eee
```

- Row background default `#fff`, padding `0`
- Nama project di meta row rata kanan, 12px `#666`

### Header view

- `<h1>` 26px / 700 / lh 35px `#202020`
- Subtitle "N tasks" 14px / 400 `#666`, indent 20px (ada ikon ✓ di kiri)
- Section "Overdue" 14px / 700 / lh 20px `#202020`; link "Reschedule" 13px / 600 `#d33322`
- Section tanggal `4 Aug ‧ Today ‧ Tuesday` — 14px / 700, elemen `<a>`,
  separator pakai `‧` (U+2027), bukan `·`
- Kanan atas: tombol "Display" 13px / 600 `#666` (+ banner "Connect calendar" yang dismissable)

### Add Task Form — struktur berbeda dari spec lama

Dari screenshot (belum terukur exact). Bukan tombol Submit/Cancel bergaya teks:

- Card border-radius besar, border tipis 1px, tanpa shadow berat
- Input "Task name" placeholder abu
- Toolbar berisi **chip/pill** dengan border 1px + radius penuh:
  `+` · `Inbox` · `Today` · `Priority` · `Attachment`
- Chip yang terisi berubah warna (`Today` → **hijau**) dan dapat `×` untuk clear
- Kanan: `×` (cancel) + satu **icon button merah rounded-square**
- Field Description tidak langsung tampil — kemungkinan di balik tombol `+`

### Belum ada di spec sama sekali

- **Task detail modal** — 2 kolom. Kiri: checkbox + judul besar bold, "Description",
  "+ Add sub-task", divider, kotak Comment dengan avatar + ikon attachment.
  Kanan (panel properti, bg lebih terang): Project / Date / Deadline / Priority /
  Labels / Reminders / Location — tiap baris label + value + divider tipis.
  Header modal: breadcrumb `# Personal / ▫ Wishlist`, panah atas-bawah, `⋯`, `×`.
- **Add project dialog** — Name (dengan counter `0/120`), Description textarea,
  Color select, Workspace select, tombol Cancel + Add (Add disabled = merah muda pucat).
- **Project view** — judul project → "Add a description" → "+ Add task" →
  section grouping (mis. "Wishlist 1", "Health 1") masing-masing dengan `⋯` dan
  "+ Add task" sendiri.

### Belum terukur

Hover state task row, warna checkbox per-priority p1–p3 (semua task di akun test
berpriority p4), dimensi exact Add Task form, dan empty state.
