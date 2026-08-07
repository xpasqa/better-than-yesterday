# Plan: Add Project dari Sidebar

## Pendekatan

Semua infrastruktur sudah ada. Implementasi murni wiring UI:
1. Pasang `onClick` ke tombol `+`
2. Render inline input di bawah project list
3. Handle keyboard events (Enter/Escape) dan blur

Tidak ada perubahan di layer store, data model, atau API.

## Urutan Pekerjaan

### Step 1 — Pasang onClick ke tombol `+` (Sidebar.tsx:228)
- `onClick={handleAddProjectClick}`
- `aria-expanded={addingProject}`
- Pastikan `handleAddProjectClick` expand section jika belum expand

### Step 2 — Render inline input di dalam project list
- Setelah `{realProjects.map(...)}` dan `{allProjects.map(...)}`, tambahkan
  kondisi `{addingProject && <li>...</li>}`
- Di dalam `<li>`: prefix `#` + `<input>` dengan `autoFocus`, `aria-label`,
  `value`, `onChange`, `onKeyDown`, `onBlur`

### Step 3 — Handler keyboard
- `onKeyDown`: Enter → submit jika nama non-kosong, Escape → cancel
- `onBlur`: cancel (dengan delay kecil untuk menghindari race dengan click)

### Step 4 — Submit action
- `handleAddProjectClick` di Sidebar.tsx:65 kemungkinan sudah partial —
  verifikasi isinya, lengkapi jika perlu
- Setelah `createProject` selesai: reset state, panggil `onProjectChange(id)`

### Step 5 — CSS
- Cek `Sidebar.css` untuk class yang sudah ada
- Tambahkan style untuk inline input jika belum ada

## File yang Diubah

- `apps/web/src/components/Sidebar.tsx`
- `apps/web/src/components/Sidebar.css` (jika perlu style baru)
