# Plan: Project hierarchy & appearance

Urutan eksekusi [spec.md](spec.md). Tiga blok berurutan: A store (tanpa UI),
B modal (fitur jadi terpakai), C sidebar (hierarki & favorit terlihat).

A → B → C. Setelah B, semua sudah bisa dilakukan lewat modal — hierarki dan
section Favorites baru terlihat setelah C.

---

## A. Store — `project-actions.ts`

Tidak ada UI. Bisa di-merge sendiri.

- [ ] `createProject(name, color, parentId, allNodes)` — tambah dua parameter
- [ ] `rank` dihitung di antara saudara sekandung (`n.parentId === parentId`),
      bukan selalu di antara root
- [ ] `updateProject(id, patch, allNodes)` — `name` / `color` / `parentId` /
      `isFavorite`, semuanya opsional
- [ ] `updateProject` menegakkan invarian kedalaman (spec §4.1): induk harus
      project root, dan project yang punya anak tidak boleh dipindah. Kalau
      dilanggar → **tidak menulis apa pun**
- [ ] **Tidak perlu `wouldCreateCycle`** — invarian di atas membuat siklus
      mustahil secara struktural. Tulis alasannya di komentar supaya tidak
      "dilengkapi" orang lain nanti
- [ ] `deleteProject(id, allNodes)` — soft-delete (`deletedAt`) project **dan
      seluruh keturunannya**, satu transaksi Dexie, semua masuk outbox
- [ ] `countDescendants(id, allNodes)` — `{ tasks, subProjects }` untuk dialog
      konfirmasi
- [ ] `resolveOrCreateProjectId` tetap root + warna default
- [ ] Panggilan lama di `CreateProjectModal.tsx` disesuaikan agar tetap kompilasi
- [ ] **Verifikasi:** `npm run typecheck` bersih; `npm test` hijau

## B. Modal — `ProjectModal.tsx`

Bergantung pada A. Menggantikan `CreateProjectModal.tsx`.

- [ ] Satu komponen, dua mode (`create` | `edit`)
- [ ] Nama (input, auto-focus)
- [ ] Warna — swatch, **salin** pola `CreateLabelModal.tsx` (pemakaian kedua;
      policy §1 melarang abstraksi sebelum yang ketiga)
- [ ] Induk — dropdown berisi **hanya project root**, kecuali diri sendiri
- [ ] Dropdown induk **dinonaktifkan** kalau project ini punya anak, dengan
      keterangan singkat kenapa
- [ ] Favorit — checkbox
- [ ] Mode `edit`: tombol **Hapus** + konfirmasi yang menyebut angka dari
      `countDescendants` ("12 task dan 2 sub-project ikut terhapus")
- [ ] `App.tsx` — ganti pemakaian `CreateProjectModal`, tambah state project
      yang sedang diedit
- [ ] Hapus `CreateProjectModal.tsx` + CSS-nya kalau sudah tidak dipakai
- [ ] **Verifikasi:** buat dengan warna+induk+favorit; ubah keempatnya; hapus
      project berisi task dan sub-project; `npm run verify` hijau

## C. Sidebar — hierarki & favorit

Bergantung pada B (butuh modal edit untuk aksi per baris).

- [ ] Section **Favorites** di atas My Projects, isi `isFavorite === true`
- [ ] Project favorit **tetap muncul juga** di My Projects (spec §4.4)
- [ ] My Projects merender dua tingkat: root lalu anaknya, indentasi satu langkah
- [ ] Aksi edit per baris → `ProjectModal` mode `edit`
- [ ] Badge hitungan **tidak disentuh** — `computeProject` sudah subtree-wide
- [ ] **Verifikasi:** dua tingkat tampil benar; favorit muncul di dua tempat;
      hitungan induk mencakup task anak; project lama tetap normal
