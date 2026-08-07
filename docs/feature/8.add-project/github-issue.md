## Deskripsi

Tombol `+` di sebelah header **My Projects** di sidebar tidak melakukan apa-apa saat diklik. Tidak ada `onClick` handler yang terpasang, sehingga user tidak bisa menambahkan project baru dari sidebar — berbeda dengan UX Todoist yang menjadi acuan.

Satu-satunya cara membuat project baru sekarang adalah via quick-add syntax `#NamaProject` di task input, yang discoverability-nya rendah.

Spec lengkap: `docs/feature/8.add-project/spec.md`

## Root Cause

Tombol `+` di `Sidebar.tsx:228` tidak memiliki `onClick` handler dan inline input form belum di-render saat `addingProject === true`.

## Perilaku yang Diharapkan (seperti Todoist)

1. Klik `+` → section projects expand otomatis, inline input muncul di bawah list project
2. User mengetik nama project → tekan **Enter** untuk konfirmasi, **Escape** untuk batal
3. Input kosong saat Enter → tidak membuat project
4. Project baru langsung muncul di sidebar (reaktif via Dexie live query) dan tersimpan ke outbox sync

## Konteks Teknis

Semua infrastruktur sudah ada, tinggal disambungkan:

| Komponen | Status | File |
|---|---|---|
| `createProject(name, allNodes)` | ✅ ada | `apps/web/src/store/project-actions.ts:22` |
| State `addingProject`, `newProjectName` | ✅ ada | `Sidebar.tsx:61–62` |
| `handleAddProjectClick` / `handleAddProjectSubmit` | ✅ ada | `Sidebar.tsx:65–86` |
| `realProjects` derived dari `realNodes` | ✅ ada | `Sidebar.tsx:99–101` |
| CSS `.sidebar__project-add-row` + `.sidebar__project-add-input` | ✅ ada | `Sidebar.css:392–414` |
| `onClick` di tombol `+` | ❌ belum dipasang | `Sidebar.tsx:228` |
| Inline input `{addingProject && ...}` | ❌ belum di-render | — |

## Tugas Implementasi

- [ ] Pasang `onClick={handleAddProjectClick}` + `aria-expanded={addingProject}` ke tombol `+`
- [ ] Render `<li className="sidebar__project-add-row">` dengan `<input>` setelah project list saat `addingProject === true`
- [ ] Verifikasi Enter submit, Escape/blur cancel berjalan benar
- [ ] Verifikasi project baru muncul reaktif dan view berpindah ke project baru
