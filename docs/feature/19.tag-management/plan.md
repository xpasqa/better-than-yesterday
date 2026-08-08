# Plan: Halaman kelola tag

Dua blok. A store, B halaman.

**Bergantung pada fitur 16 (#43) selesai lebih dulu** — kalau tidak, halaman
ini dibangun dengan penamaan `label` lalu harus langsung diganti.

Dilacak di epic **[#53](https://github.com/xpasqa/better-than-yesterday/issues/53)**.

---

## A. Store — `tag-actions.ts`

- [ ] `updateTag(id, { name?, color? })` mengembalikan hasil bertipe
      (`{ok:true}` / `{ok:false, reason}`), bukan melempar — pemanggilnya
      perlu menampilkan pesan
- [ ] Validasi nama: 1–60 karakter setelah trim, **tanpa spasi** — aturannya
      sama persis dengan saat membuat, karena nama itu adalah token `$nama`
- [ ] **Tolak nama yang bentrok** (case-insensitive) dengan tag hidup lain.
      Tanpa ini, `resolveOrCreateLabelIds` yang memakai `.find()` akan
      menempelkan `$nama` ke salah satu tag kembar secara sewenang-wenang
- [ ] `deleteTag(id)` — soft-delete (`deletedAt`), **`node.tagIds` tidak
      disentuh**. Render sudah `.filter(Boolean)`, jadi id yatim otomatis
      lenyap dari tampilan
- [ ] Keduanya lewat outbox seperti tulisan lain
- [ ] **Verifikasi:** `npm run typecheck` bersih; rename bentrok ditolak;
      rename berspasi ditolak

## B. Halaman — `TagsView.tsx`

- [ ] `types/index.ts` — `'tags'` masuk `ViewType`
- [ ] `routes.ts` — `'tags'` masuk `PLAIN_VIEWS`
- [ ] `App.tsx` — cabang baru
- [ ] `Sidebar.tsx` — nav item Tags
- [ ] Daftar tag hidup urut `rank`: titik warna, nama, jumlah pemakaian
- [ ] Jumlah pemakaian dihitung dari `useAllNodes()` yang sudah ada —
      `nodes.filter(n => n.tagIds.includes(tag.id) && n.deletedAt === null).length`
- [ ] Aksi ubah: nama + swatch warna, menampilkan pesan kalau `updateTag`
      mengembalikan `ok:false`
- [ ] Aksi hapus dengan konfirmasi yang **menyebut jumlah task** pemakainya
- [ ] Kondisi kosong yang mengarahkan
- [ ] **Verifikasi:** seluruh Success Criteria spec §7; `npm run verify` hijau
