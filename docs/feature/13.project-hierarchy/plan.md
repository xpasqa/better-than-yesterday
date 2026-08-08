# Plan: Area → Project

Urutan eksekusi [spec.md](spec.md). Empat blok berurutan.

A → B → C → D. A murni skema (tanpa UI), B store, C modal (fitur jadi
terpakai), D sidebar (struktur terlihat).

---

## A. Migrasi & core — `kind='area'`

Tanpa UI. Empat tempat mengunci daftar `kind`, semuanya harus seiring.

- [ ] `apps/api/src/db/schema/node.ts:32` — `enum: ['area','project','section','item']`
- [ ] `apps/api/src/db/schema/node.ts:64` — CHECK `in ('area','project','section','item')`
- [ ] `packages/core/src/node.ts:5` — `NodeKind` tambah `'area'`
- [ ] `apps/api/src/modules/sync/dto.ts:9` — `z.enum([...])` tambah `'area'`
- [ ] Migrasi SQL: `DROP CONSTRAINT node_kind_check` lalu `ADD CONSTRAINT` dengan
      daftar baru. Kolomnya `text`, jadi tidak ada perubahan tipe
- [ ] Jalankan migrasi di DB dev **dan** DB test
- [ ] **Verifikasi:** `npm run db:migrate` bersih; `npm run typecheck` bersih;
      `npm test` hijau; menyimpan node ber-`kind='area'` lewat sync tidak ditolak

## B. Store — `project-actions.ts`

Bergantung pada A.

- [ ] `createArea(name, color, allNodes)` — `parentId` selalu `null`
- [ ] `createProject(name, color, areaId, allNodes)` — `areaId` boleh `null`
- [ ] `rank` dihitung di antara saudara sekandung (`n.parentId === parentId`)
- [ ] `updateNodeMeta(id, patch, allNodes)` — nama/warna/parentId/isFavorite
- [ ] Invarian: `parentId` project hanya boleh `null` atau id node ber-`kind='area'`;
      area selalu `parentId: null`. Kalau dilanggar → **tidak menulis apa pun**
- [ ] **Tidak perlu `wouldCreateCycle`** — invarian di atas membuat siklus mustahil
      karena `area` dan `project` beda `kind`. Tulis alasannya di komentar
- [ ] `deleteWithDescendants(id, allNodes)` — soft-delete node + seluruh
      keturunannya, satu transaksi Dexie, semua masuk outbox
- [ ] `countDescendants(id, allNodes)` → `{ projects, tasks }`
- [ ] `resolveOrCreateProjectId` (quick-add `#project`) tetap tanpa area
- [ ] **Verifikasi:** `npm run typecheck` bersih; `npm test` hijau

## C. Modal — `ProjectModal.tsx`

Bergantung pada B. Menggantikan `CreateProjectModal.tsx`.

- [ ] Satu komponen: dua mode (`create`|`edit`) × dua tipe (`area`|`project`)
- [ ] Field aktif per tipe sesuai spec §6.C — area tanpa dropdown area dan
      tanpa favorit
- [ ] Warna — **salin** pola `CreateLabelModal.tsx` (pemakaian kedua; policy §1)
- [ ] Dropdown area (project saja), default "Tanpa area"
- [ ] Mode `edit`: tombol Hapus + konfirmasi bernomor dari `countDescendants`
- [ ] `App.tsx` — ganti pemakaian `CreateProjectModal`, tambah state node yang diedit
- [ ] Hapus `CreateProjectModal.tsx` + CSS-nya kalau sudah tidak dipakai
- [ ] **Verifikasi:** buat area; buat project di dalamnya; pindah antar-area;
      favoritkan; hapus area berisi project + task; `npm run verify` hijau

## D. Sidebar

Bergantung pada C.

- [ ] Section **Favorites** di atas, isi project ber-`isFavorite`
- [ ] Daftar Area, masing-masing dengan project di bawahnya (indentasi satu langkah)
- [ ] Project tanpa area → kelompok terakhir tanpa judul
- [ ] Project favorit **tetap muncul juga** di bawah areanya (spec §4.4)
- [ ] Aksi edit per baris → `ProjectModal`
- [ ] Badge hitungan **tidak disentuh** — `computeProject` sudah subtree-wide,
      jadi hitungan area otomatis benar
- [ ] **Verifikasi:** Area→Project tampil benar; favorit di dua tempat; hitungan
      area mencakup seluruh project; project lama tanpa area tetap normal
