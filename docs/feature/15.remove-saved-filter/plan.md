# Plan: Hapus filter tersimpan

Satu blok. Dilacak di epic
**[#41](https://github.com/xpasqa/better-than-yesterday/issues/41)**.

## A. Cabut skema & rapikan dokumen

- [ ] Hapus `apps/api/src/db/schema/saved-filter.ts`
- [ ] Hapus impor + spread `savedFilter` dari `apps/api/src/db/client.ts:7,23`
- [ ] Hapus `saved_filter` dari `truncate` di `apps/api/test/helpers.ts:12`
- [ ] Perbarui komentar yang menyebutnya: `db/schema/sync-seq.ts:3`,
      `modules/sync/routes.ts:3`
- [ ] Migrasi: `DROP TABLE saved_filter;` — tidak ada data yang perlu
      diselamatkan, tabelnya tidak pernah dipakai
- [ ] Jalankan migrasi di DB dev **dan** DB test
- [ ] `1.todo/spec.md` §7 — dicoret + catatan kenapa dibatalkan (jangan
      dihapus diam-diam; rancangannya punya alasan yang ditulis rapi, dan
      menghilangkannya tanpa jejak membuat orang mengusulkannya lagi dari nol)
- [ ] `1.todo/todo.md` blok G — judulnya jadi "Pencarian" saja
- [ ] **Verifikasi:** `grep -rn "savedFilter\|saved_filter" apps packages` kosong;
      `npm run db:migrate` bersih; `npm run verify` hijau
