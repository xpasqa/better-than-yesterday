# Plan: Outline dilepas dari Todo

Rujukan: [spec.md](spec.md) untuk *kenapa*, [context.md](context.md) untuk
percabangan yang ditolak. Dokumen ini hanya *bagaimana*.

Tujuh blok. Tiap blok berdiri sendiri, punya tes sendiri, dan bisa di-commit
sendiri. Urutan ketergantungan di [todo.md](todo.md).

---

## Blok A — `kind='note'` masuk ke seluruh rantai tipe

Menambah satu nilai enum, dari database sampai store klien. Belum mengubah
perilaku apa pun: sesudah blok ini `note` sah tapi belum ada yang membuatnya.

1. **`packages/core/src/node.ts`**
   - `NodeKind` → `'area' | 'project' | 'section' | 'item' | 'note'`.
   - Tambah field `linkedTaskId: string | null` di interface `Node`, dengan
     komentar satu kalimat: bermakna hanya pada `kind='note'` (§3.2).
   - Pastikan `sanitizeNode` meneruskan field baru apa adanya.

2. **`apps/api/src/db/schema/node.ts`**
   - Enum drizzle kolom `kind` ikut `'note'`.
   - `check('node_kind_check', …)` ikut `'note'`.
   - Kolom baru `linkedTaskId: text('linked_task_id').references((): AnyPgColumn => node.id)`
     — tanpa `onDelete`, alasannya §3.2.

3. **`apps/api/drizzle/0009_outline_note_kind.sql`** — tulis tangan, mengikuti
   bentuk `0005_add_area_kind.sql`:
   ```sql
   ALTER TABLE "node" DROP CONSTRAINT "node_kind_check";
   ALTER TABLE "node" ADD CONSTRAINT "node_kind_check"
     CHECK (kind in ('area','project','section','item','note'));
   ALTER TABLE "node" ADD COLUMN "linked_task_id" text REFERENCES "node"("id");
   ```
   Perbarui `drizzle/meta/` lewat `npm run db:generate -w @better/api` kalau
   generator dipakai; kalau tidak, samakan tangan seperti migrasi 0005.

4. **`apps/api/src/modules/sync/dto.ts`** — `z.enum([… , 'note'])`, dan
   `linkedTaskId: z.string().nullable()`.

5. **`apps/api/src/modules/sync/routes.ts`** — tambahkan `linkedTaskId` di
   keempat titik pemetaan baris↔DTO (baris ~22, ~63, ~140, ~169, ~205, ~255,
   ~268 — ikuti pola `kind` yang sudah ada di tiap titik).

6. **`apps/web/src/store/db.ts`** — pastikan skema Dexie menyimpan field baru.
   Kalau `nodes` tidak meng-index `kind`/`linkedTaskId`, tidak perlu naik
   versi; kalau meng-index, naikkan versi store dengan upgrade kosong.

**Selesai kalau:** `npm run verify` hijau dan migrasi jalan di database tes.

---

## Blok B — migrasi data lama

`apps/api/drizzle/0010_outline_degrade_orphan_items.sql` — persis SQL di
[spec §8](spec.md), termasuk `updated_at = now()` dan `seq = nextval('sync_seq')`.

Dipisah dari blok A dengan sengaja: A mengubah *bentuk*, B mengubah *isi*.
Kalau heuristiknya salah, yang di-revert cuma B.

**Tes** — `apps/api/src/db/migrate-degrade.test.ts` (atau berkas tes migrasi
yang sudah ada), lima kasus dari [spec §10](spec.md):
task di dalam project bertahan `item` · isi Inbox bertahan · task di bawah
`area`→`project` bertahan · baris akar jadi `note` · `seq` node yang berubah
naik dan yang tidak berubah tidak naik.

**Selesai kalau:** kelima tes hijau di database tes yang diisi fixture.

---

## Blok C — kunci turunan `kind`, dan buka search

Tujuh modul memfilter `kind === 'item'`. Enam sudah benar tanpa disentuh —
yang dibutuhkan tes yang mengunci perilakunya ([spec §6.1](spec.md)). Yang
ketujuh, `search.ts`, justru harus dilonggarkan.

1. **Tes penguncian** (`packages/core/src/*.test.ts`): tambahkan satu node
   `kind='note'` ke fixture `views.test.ts`, `logbook.test.ts`,
   `board.test.ts`, lalu tegaskan ia **tidak** muncul di `today`, `upcoming`,
   `anytime`, `someday`, `inbox`, `project`, `completed`, logbook, dan board.

2. **`packages/core/src/search.ts:53`** — kandidat jadi
   `n.kind === 'item' || n.kind === 'note'`. Perbarui komentar §baris 37.

3. **`apps/web/src/components/SearchView.tsx`** — bedakan hasil bertipe
   catatan secara visual (ikon/label berbeda) supaya tidak tertukar dengan
   task. Klik hasil catatan membuka Outline pada baris itu.

4. **Tes** `search.test.ts`: catatan ditemukan, dan hasilnya membawa penanda
   jenis yang benar.

**Selesai kalau:** tes penguncian hijau dan catatan bisa dicari.

---

## Blok D — Outline membuat `note`

Satu perubahan kecil dengan akibat besar: **inilah blok yang menghentikan
pencemaran Anytime.**

1. **`apps/web/src/store/outline-actions.ts:41`** — `blankNode()` memakai
   `kind: 'note'` dan `linkedTaskId: null`.
2. Perbarui komentar berkas di baris 1–6: Outline menulis `note`, bukan
   `item`, dan sebutkan spec ini.
3. **Tes** — `outline-actions` membuat node ber-`kind='note'`; `anytime()`
   atas hasilnya kosong.

**Selesai kalau:** mengetik di Outline tidak lagi menambah apa pun ke Anytime.

---

## Blok E — `#project` dan popup detail task

Blok terbesar. Dikerjakan dalam tiga langkah.

1. **Ekstrak bidang form yang dipakai bersama.**
   [`AddTaskFormReal.tsx`](../../../apps/web/src/components/AddTaskFormReal.tsx)
   sudah memegang judul, catatan, tanggal, prioritas, dan pemilih project
   dalam satu komponen 300-baris yang juga mengurus tata letak inline-nya.
   Pindahkan bidang-bidangnya ke `TaskFieldsFieldset.tsx` yang menerima nilai
   + `onChange` dan tidak tahu ia sedang di dalam form inline atau modal.
   `AddTaskFormReal` memakainya; popup baru memakainya juga. Tanpa ini,
   popup jadi salinan kedua yang akan langsung menyimpang.

2. **Autocomplete `#` di OutlineView.**
   - Di baris yang sedang disunting, `#` memicu daftar project
     (`allNodes.filter(n => n.kind === 'project' && !n.deletedAt)`), memakai
     `findSigilCandidates` dari [`parse.ts`](../../../packages/core/src/parse.ts)
     untuk menentukan span-nya — jangan tulis parser kedua.
   - Baris yang `linkedTaskId`-nya terisi **tidak** menawarkan daftar
     ([spec §4](spec.md)).

3. **`LinkTaskModal.tsx`** — popup, memakai `TaskFieldsFieldset`.
   - Terbuka seketika saat project dipilih.
   - Judul terisi dari teks baris dengan span `#NamaProject` dibuang;
     project terisi dari pilihan.
   - **Simpan:** buat node `kind='item'` sebagai anak project (pakai jalur
     yang sudah ada di `node-actions.ts` supaya rank, `sanitizeNode`, dan
     outbox konsisten), lalu `patchNode(row, { linkedTaskId: task.id })`.
     Dua tulisan, satu transaksi Dexie.
   - **Esc/Batal:** tidak menulis apa pun. Baris tetap utuh termasuk teks
     `#NamaProject`.

**Tes:** simpan membuat task di project yang benar dan mengisi
`linkedTaskId` · batal tidak menghasilkan node baru dan tidak menyentuh teks ·
baris bertaut tidak memunculkan autocomplete.

---

## Blok F — chip status live dan penghapusan independen

1. **Render** ([spec §5](spec.md)): baris tanpa `linkedTaskId` — tanpa kotak
   centang sama sekali. Baris bertaut — chip berisi kotak centang, due date,
   prioritas, dibaca live dari node task lewat `useAllNodes()`. Bentuknya
   mengikuti chip `@mention` di `OutlineView.css`.
2. **Centang dua arah:** centang chip memanggil `toggleTaskComplete(task)`
   yang sudah diimpor OutlineView. Arah sebaliknya gratis — chip membaca dari
   store yang sama.
3. **Teks independen:** pastikan penyimpanan teks baris tidak pernah menulis
   ke node task. Kunci dengan tes.
4. **Tautan menggantung** ([spec §5.3](spec.md)): task ber-`deletedAt` → chip
   jadi status mati dengan aksi membersihkan (`linkedTaskId = null`).
5. **Hapus baris outline** tidak menyentuh task-nya. Kunci dengan tes.

---

## Blok G — e2e dan verifikasi browser

1. **`e2e/outline-task-link.spec.ts`**, mengikuti bentuk
   `e2e/quick-add.spec.ts`, menjalankan rantai utuh [spec §10](spec.md):
   ketik baris di Outline → Anytime tidak berubah → tandai `#Project` → isi
   popup → simpan → task muncul di project → centang dari Outline → status
   berubah di Todo.
2. **Verifikasi di browser sungguhan** — syarat Done, bukan `npm run verify`
   ([2-workflow §2](../../policy/2-workflow.md)). Yang benar-benar diklik:
   Anytime bersih setelah mengetik catatan, popup terbuka dan batal tidak
   meninggalkan jejak, centang dari Outline berubah di Today.
3. **Perbarui spec lama** [2.backend/2.outline/spec.md](../2.backend/2.outline/spec.md)
   §4 dan §9: tandai keputusan "`#` tidak ditawarkan di outline" sebagai
   dibatalkan, dengan tautan ke spec ini.

---

## Prasyarat sekali jalan

```bash
docker compose -f docker-compose.test.yml up -d
```

```bash
DATABASE_URL=postgresql://postgres@127.0.0.1:55432/better_test npm run db:migrate -w @better/api
```

Ulangi `db:migrate` setiap kali blok A atau B mengubah skema.
