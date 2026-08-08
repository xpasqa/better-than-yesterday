# Plan: Project hierarchy & appearance

Urutan eksekusi [spec.md](spec.md). Tiga blok berurutan: A store (tanpa UI),
B modal (fitur jadi terpakai), C sidebar (hierarki terlihat).

A → B → C. Setelah B, warna dan sub-project sudah bisa dibuat & diubah —
tapi hierarkinya belum kelihatan di sidebar sampai C selesai.

---

## A. Store — `project-actions.ts`

Tidak ada UI. Bisa di-merge sendiri.

- [ ] `createProject(name, color, parentId, allNodes)` — tambah dua parameter
- [ ] `rank` dihitung di antara saudara sekandung (`n.parentId === parentId`),
      bukan selalu di antara root
- [ ] `updateProject(id, patch, allNodes)` — `name` / `color` / `parentId`,
      semuanya opsional
- [ ] `updateProject` memanggil `wouldCreateCycle` dari `@better/core/tree`
      sebelum memindah; kalau siklus → **tidak menulis apa pun**, return diam
- [ ] `resolveOrCreateProjectId` tetap root + warna default (quick-add tidak
      punya UI untuk memilih induk)
- [ ] Panggilan lama `createProject(trimmed, [...nodes])` di
      `CreateProjectModal.tsx` disesuaikan agar tetap kompilasi
- [ ] **Verifikasi:** `npm run typecheck` bersih; `npm test` hijau

## B. Modal — `ProjectModal.tsx`

Bergantung pada A. Menggantikan `CreateProjectModal.tsx`.

- [ ] Satu komponen, dua mode (`create` | `edit`) — bukan dua komponen
- [ ] Field nama (input, auto-focus)
- [ ] Field warna — swatch, **salin** pola `CreateLabelModal.tsx` (pemakaian
      kedua; policy §1 melarang abstraksi sebelum yang ketiga)
- [ ] Field induk — dropdown, default "Tidak ada — project utama"
- [ ] Mode `edit`: dropdown induk **menyembunyikan project itu sendiri dan
      seluruh keturunannya** (cegah siklus di daftar pilihan, bukan di validasi)
- [ ] Mode `edit`: field terisi nilai project yang sedang diubah
- [ ] `App.tsx` — ganti pemakaian `CreateProjectModal`, tambah state untuk
      project yang sedang diedit
- [ ] Hapus `CreateProjectModal.tsx` + CSS-nya kalau sudah tidak dipakai
- [ ] **Verifikasi:** buat project dengan warna & induk; ubah ketiganya di
      project yang sudah ada; `npm run verify` hijau

## C. Sidebar — hierarki

Bergantung pada B (butuh modal edit untuk tombol edit per baris).

- [ ] Bangun pohon dari `parentId`, render depth-first (Inbox tetap dikecualikan)
- [ ] Indentasi per level; berhenti melebar setelah level 3
- [ ] Tombol edit per baris → `ProjectModal` mode `edit`
- [ ] Badge hitungan **tidak disentuh** — `computeProject` sudah subtree-wide
- [ ] **Verifikasi:** project 3 level tampil dengan indentasi benar; hitungan
      induk mencakup task anak; project lama tanpa `parentId` tetap normal
