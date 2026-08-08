# Spec: Drag untuk mengurutkan ulang

**Tanggal:** 2026-08-08
**Status:** **spec saja — belum siap diimplementasi.** Lihat §5.
**Menutup:** `1.todo/todo.md` blok F baris "Drag lintas section/project"

---

## 1. Konteks

`grep -rn "draggable\|onDragStart" apps/web/src` → **nol kecocokan**. Tidak
ada seret di mana pun hari ini; urutan manual cuma bisa diubah lewat urutan
pembuatan.

Padahal separuh mesinnya sudah siap dan teruji:

| Sudah ada | Di mana |
|---|---|
| `between(a, b)` — rank pecahan antar dua tetangga | `packages/core/src/rank.ts`, bertes |
| `rebalance(ranks)` — saat rank terlalu rapat | idem |
| `move`/`indent`/`outdent` di pohon | `packages/core/src/tree.ts` |
| Tulis satu baris → outbox → sync | `node-actions.ts` |

`1.todo/spec.md` sudah menetapkan bentuknya: **drag = ubah `parent_id` +
`rank`**, implementasi yang sama persis dengan indent di Outline. Satu
perpindahan menulis satu baris.

---

## 2. Scope

**In:**
- Seret untuk mengurutkan ulang task **di dalam satu daftar** (project, Inbox)
- Rank baru dari `between(sebelumnya, sesudahnya)`
- Indikator garis sisip saat menyeret

**Out (dengan alasan):**
- **Seret lintas project** — butuh sasaran jatuh di Sidebar, yang wataknya
  lain (sasaran kecil, perlu auto-scroll, perlu membuka Area yang tertutup).
  Memindahkan project tetap lewat `NodeDetailModal`.
- **Seret antar kolom board** — sudah milik [fitur 22](../22.board/spec.md)
  blok C. Di sana ia mengubah `parentId`; di sini `rank`.
- **Seret di Today/Upcoming** — urutannya ditentukan tanggal lalu prioritas
  (`views.ts:27`), bukan `rank`. Menyeret di sana berarti berbohong: kartunya
  akan melompat balik saat render berikutnya. Kalau memang diinginkan, itu
  keputusan produk tersendiri.
- **Seret di layar sentuh** — HTML5 drag tidak jalan di sana. Sama seperti
  board.

---

## 3. Yang harus benar

**`rebalance` wajib dipanggil, bukan hanya tersedia.** `between()` menghasilkan
string yang makin panjang tiap sisipan di celah yang sama. Menyeret berulang
kali ke posisi yang sama membuat rank tumbuh sampai perbandingan string jadi
mahal. `rank.ts` sudah punya `rebalance`; yang belum ada adalah **titik yang
memutuskan kapan memanggilnya**.

Ambang yang dipilih: panjang rank > 32 karakter di daftar itu → rebalance
seluruh saudara sekandung dalam satu transaksi.

> Ini menulis N baris sekaligus ke outbox. Sama seperti `deleteSection` di
> [fitur 22](../22.board/spec.md), dan diterima dengan alasan yang sama:
> jarang, disengaja, dan satu batch.

**Menjatuhkan di tempat semula tidak boleh menulis apa pun.** Tanpa penjaga
ini, tiap seret yang gagal tetap menaikkan `updatedAt` dan mengirim baris ke
server — LWW yang berisik tanpa perubahan nyata.

---

## 4. Blok kerja

| Blok | Isi |
|---|---|
| A | `reorderSibling(itemId, beforeId, afterId)` di store — hitung rank, ambang rebalance |
| B | Seret di `ProjectReal`/`InboxReal` + garis sisip |

---

## 5. Kenapa ini belum masuk Ready

**Sengaja ditahan di Backlog sampai [fitur 22](../22.board/spec.md) blok C
mendarat.**

Blok C memperkenalkan seret HTML5 pertama di app ini — `draggable`,
`dataTransfer`, penanda sasaran jatuh, dan keputusan soal bagaimana kartu
yang sedang diseret terlihat. Menulis rencana untuk seret **kedua** sebelum
yang pertama ada berarti menebak idiomnya, lalu hampir pasti menulis ulang.

Dua cara menyeret yang berbeda di satu aplikasi lebih buruk daripada satu
cara yang datang belakangan.

Begitu blok C mendarat: baca idiomnya, tulis `plan.md`, naikkan ke Ready.
Spec ini tidak perlu berubah — yang ditunggu bentuk implementasinya, bukan
keputusannya.

---

## 6. Success Criteria

- [ ] Menyeret task di project mengubah urutannya, dan bertahan setelah reload
- [ ] Menjatuhkan di tempat semula **tidak menulis apa pun**
- [ ] Garis sisip menunjukkan posisi jatuh sebelum dilepas
- [ ] Menyeret 50 kali berturut-turut di celah yang sama tidak membuat rank
      membengkak — `rebalance` benar-benar terpanggil
- [ ] Idiom seretnya **sama** dengan board, bukan cara kedua
- [ ] `npm run verify` hijau
