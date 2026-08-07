# Todo: Add Project dari Sidebar

## Implementasi

- [ ] Verifikasi isi `handleAddProjectClick` di Sidebar.tsx:65
- [ ] Pasang `onClick={handleAddProjectClick}` + `aria-expanded` ke tombol `+`
- [ ] Render inline input (`<li>`) setelah project list saat `addingProject === true`
- [ ] Handle `onKeyDown`: Enter submit, Escape cancel
- [ ] Handle `onBlur`: cancel dengan delay
- [ ] Setelah submit: reset state + `onProjectChange(newId)`
- [ ] Tambah CSS untuk inline input jika belum ada

## Verifikasi

- [ ] Klik `+` → input muncul dengan auto-focus
- [ ] Ketik nama → Enter → project muncul di list, view berpindah
- [ ] Enter dengan input kosong → tidak buat project, input tetap
- [ ] Escape → input hilang, state bersih
- [ ] Blur (klik di luar) → sama seperti Escape
- [ ] Hard refresh → project tetap ada (Dexie persisted)
