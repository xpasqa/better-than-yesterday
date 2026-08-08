# Plan: Label → Tag

Tiga blok berurutan. Murni mekanis — `npm run typecheck` adalah jaring
pengamannya di tiap langkah.

Dilacak di epic **[#43](https://github.com/xpasqa/better-than-yesterday/issues/43)**.

---

## A. Core & database

- [ ] `packages/core/src/label.ts` → `tag.ts`; `interface Label` → `Tag`
- [ ] `packages/core/package.json` — entri exports `./label` → `./tag`
      (**mudah terlewat**; pernah jadi bug di #23 dan bikin typecheck rusak)
- [ ] `apps/api/src/db/schema/label.ts` → `tag.ts`; tabel `label` → `tag`
- [ ] `node.labelIds` → `node.tagIds`; kolom `label_ids` → `tag_ids`
- [ ] Migrasi: `ALTER TABLE label RENAME TO tag`, `ALTER TABLE node RENAME
      COLUMN label_ids TO tag_ids`, plus rename index & constraint terkait
- [ ] Jalankan migrasi di DB dev **dan** DB test
- [ ] **Verifikasi:** `npm run db:migrate` bersih; `npm run typecheck` bersih

## B. Lapisan sync

- [ ] `dto.ts` — `labelDto` → `tagDto`, `changes.labels` → `changes.tags`
- [ ] `modules/sync/routes.ts` — `applyIncomingLabels` → `applyIncomingTags`,
      `labelToDto` → `tagToDto`, query & cursor ikut
- [ ] `test/helpers.ts` — `makeLabelDto` → `makeTagDto`, `truncate` ikut
- [ ] `test/sync.test.ts` + `test/isolation.test.ts` — helper `sync()` lokal
      di **kedua** berkas menerima `tags`, bukan `labels` (dua berkas punya
      salinan `sync()` sendiri — pernah jadi jebakan di #23)
- [ ] Dexie: tabel `labels` → `tags`, naikkan versi + `.upgrade()` yang
      memindahkan baris lama. **Jangan** biarkan data lama hilang
- [ ] `sync-client.ts` — pecahan outbox `entityType: 'tag'`, body & merge ikut
- [ ] **Verifikasi:** `npm test` hijau, 45 tes `apps/api` lulus; round-trip tag
      benar-benar tersimpan dan terbaca kembali

## C. UI

- [ ] `store/label-actions.ts` → `tag-actions.ts`; `resolveOrCreateLabelIds`
      → `resolveOrCreateTagIds`; `createLabelFromUI` → `createTagFromUI`
- [ ] `CreateLabelModal.tsx` → `CreateTagModal.tsx` + CSS-nya
- [ ] `useAllLabels` → `useAllTags`
- [ ] `NodeDetailModal`, `TaskRow`, dan pemakai lain — prop `labelsById` →
      `tagsById`, teks tampilan "Label" → "Tag"
- [ ] `core/parse.ts` — `labelNames` di `ParseResult` → `tagNames`. Sigil `$`
      **tidak berubah**, dan 57 tes parser harus tetap hijau tanpa disunting
      selain penggantian nama field
- [ ] **Verifikasi:** `npm run verify` hijau; quick-add `$nama` tetap membuat
      tag dan menempelkannya; warna tag tetap jalan
