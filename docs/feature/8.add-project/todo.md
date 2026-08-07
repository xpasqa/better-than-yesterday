# Todo: Add Project dari Sidebar

**Diaudit ulang 2026-08-07 (issue #22):** dokumen ini sebelumnya menunjukkan
0/13 padahal fitur sudah selesai — hanya lewat pendekatan berbeda dari yang
direncanakan di sini. Rencana awal: input inline `<li>` di dalam Sidebar
(`handleAddProjectClick`, `addingProject` state). Implementasi aktual:
modal dialog terpisah (`CreateProjectModal.tsx`, di-portal ke `document.body`),
dipicu dari `onAddProject` prop Sidebar. `Sidebar.tsx` tidak pernah punya
`handleAddProjectClick`/`addingProject` — item di bawah yang menyebutnya
diganti dengan padanan aktualnya di modal.

## Implementasi

- [x] Tombol `+` di Sidebar memicu `onAddProject` → `App.tsx` membuka
      `CreateProjectModal` (padanan `handleAddProjectClick` + `addingProject`
      di rencana awal)
- [x] `CreateProjectModal` render sebagai overlay/dialog (`role="dialog"`,
      `aria-modal`), bukan inline `<li>` di dalam list project
- [x] Auto-focus input saat modal terbuka (`inputRef.current?.focus()` di
      `useEffect`)
- [x] `onKeyDown`: Enter submit (`handleSubmit`), Escape close
- [x] Klik di luar modal (`overlay onClick`, cek `e.target === e.currentTarget`)
      menutup modal — padanan `onBlur`-cancel di rencana awal
- [x] Setelah submit: `createProject` (Dexie + outbox + sync), lalu
      `onCreated(id)` → `App.tsx` navigate ke project baru
- [x] CSS modal ada (`CreateProjectModal.css`)

## Verifikasi

Diverifikasi lewat pembacaan kode (`CreateProjectModal.tsx`,
`project-actions.ts`), bukan browser langsung — dicatat di sini alih-alih
diklaim "diuji" tanpa bukti.

- [x] Klik `+` → modal muncul dengan input auto-focus
- [x] Ketik nama → Enter → `createProject` dipanggil, `onCreated` navigate
      ke project baru
- [x] Enter dengan input kosong → `handleSubmit` early-return
      (`trimmed` kosong), tidak memanggil `createProject`
- [x] Escape → modal close (listener `keydown` di `document`)
- [x] Klik di luar → modal close (overlay `onClick` guard)
- [x] Hard refresh → project tetap ada — `createProject` menulis ke
      `db.nodes` + `db.outbox` dalam satu transaksi Dexie, pola sama dengan
      seluruh store lain yang sudah terbukti persisted
- [ ] **Belum diverifikasi di browser sungguhan** — tidak ada tooling
      browser tersedia di sesi audit ini (lihat issue #22); rekomendasi:
      jalankan manual sekali sebelum menganggap fitur ini 100% tuntas
