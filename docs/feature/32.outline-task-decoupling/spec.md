# Spec: Outline dilepas dari Todo

**Tanggal:** 2026-08-12
**Status:** disetujui, siap ditulis plan.md
**Asal:** brainstorm 2026-08-12 — riwayat keputusannya di [context.md](context.md)

Mengubah [2.backend/2.outline/spec.md](../2.backend/2.outline/spec.md) §4 dan
§9. Bagian lain spec itu tetap berlaku.

---

## 1. Masalah

Setiap baris yang diketik di Outline langsung muncul di Anytime, dan di Today
kalau punya tanggal. Menulis catatan berarti menambah pekerjaan.

Sebabnya: Outline dan Todo berbagi tabel `node`, baris outline dibuat dengan
`kind='item'`, dan `kind === 'item'` adalah satu-satunya syarat keanggotaan
seluruh view Todo. Akar masalah lengkapnya di [context.md §2](context.md).

Berbagi tabel tetap dipertahankan. Yang ditambahkan: **satu penanda yang
membedakan kalimat dari pekerjaan.**

## 2. Prinsip

Kalau ragu saat implementasi, kembali ke empat aturan ini.

1. **Baris outline adalah kalimat, bukan pekerjaan.** Ia tidak pernah muncul
   di view Todo mana pun sampai pemiliknya bilang begitu.
2. **Tidak ada promosi diam-diam.** Satu-satunya jalan sebuah baris outline
   melahirkan task adalah `#project` + popup yang disimpan. Posisi di pohon
   tidak pernah cukup — termasuk saat baris ditulis di dalam sebuah project.
3. **Catatan dan task adalah dua entitas.** Tertaut, tapi berdiri sendiri:
   teksnya independen, penghapusannya independen.
4. **Yang disinkronkan hanya status.** Chip di baris outline mencerminkan
   keadaan task secara live. Kalimatnya milik Anda.

## 3. Model data

### 3.1 `kind='note'`

`NodeKind` bertambah satu nilai:

```ts
export type NodeKind = 'area' | 'project' | 'section' | 'item' | 'note'
```

| | `item` | `note` |
|---|---|---|
| Today / Upcoming / Anytime / Someday / Inbox / Project / Logbook / Board | ya | **tidak** |
| Outline | ya | ya |
| Search | ya | **ya** (§6.3) |
| Dibuat oleh | quick add Todo, agent | setiap baris Outline |

`isActiveItem()` di [views.ts:11](../../../packages/core/src/views.ts) sudah
memfilter `kind === 'item'`, jadi seluruh view Todo bersih **tanpa satu baris
pun diubah di `views.ts`**. Itulah alasan `kind` dipilih ketimbang kolom
boleh-baru; alternatif yang ditolak ada di [context.md §3.2](context.md).

Preseden bentuk migrasinya: `0005_add_area_kind.sql`.

### 3.2 `linked_task_id`

Kolom baru di `node`, nullable, `references node(id)`, tanpa cascade:

```
linked_task_id text references node(id)
```

- Nol atau satu task per baris. Bukan array, bukan tabel join — satu baris
  catatan melahirkan satu pekerjaan.
- Hanya bermakna pada `kind='note'`. Node lain selalu `null`.
- Tanpa cascade karena penghapusan di app ini soft (`deleted_at`), dan
  penghapusan kedua sisi memang independen (§7).

Ikut ditambahkan ke DTO sync, tipe `Node` di `@better/core`, dan skema Dexie.

## 4. Alur `#project`

1. Di sebuah baris Outline, ketik `#`. Daftar project muncul sebagai
   autocomplete. Parser `#project` sudah ada di
   [`@better/core/parse`](../../../packages/core/src/parse.ts) dan dipakai apa
   adanya.
2. Pilih satu project → **popup detail task terbuka seketika**, dengan bidang
   yang sama persis dengan form add-task Todo: judul, catatan, tanggal,
   prioritas, project, tag.
   - **Judul terisi** dari teks baris, dengan token `#NamaProject` dibuang.
   - **Project terisi** dari yang barusan dipilih.
3. **Simpan** → sebuah node `kind='item'` dibuat sebagai anak project itu,
   dan `linked_task_id` baris outline menunjuk kepadanya.
4. **Esc / Batal** → tidak terjadi apa-apa. Baris tetap utuh apa adanya,
   termasuk teks `#NamaProject`. Tidak ada task, tidak ada tautan, dan **teks
   Anda tidak diedit** oleh sistem.

Baris yang sudah punya `linked_task_id` tidak menawarkan `#` lagi — satu baris,
satu task. Untuk menautkan ke tempat lain, putuskan tautannya dulu (§7).

Ini membatalkan [2.outline §4](../2.backend/2.outline/spec.md) yang melarang
`#` di outline. Alasan pembatalannya di [context.md §4](context.md).

## 5. Tampilan & sinkronisasi

### 5.1 Baris tanpa tautan

Tidak ada kotak centang sama sekali. Tidak ada tanggal, tidak ada prioritas.
Itu kalimat — memberinya kotak centang adalah undangan untuk salah paham.

### 5.2 Baris bertaut

Menampilkan chip status **live** dari task-nya: kotak centang, due date,
prioritas. Bentuknya mengikuti chip `@mention` [2.outline §3.3](../2.backend/2.outline/spec.md).

| Aksi | Akibat |
|---|---|
| Centang chip di Outline | Task ditandai selesai |
| Selesaikan task di Todo | Chip di Outline ikut tercentang |
| Edit kalimat di Outline | **Judul task tidak berubah** |
| Edit judul task di Todo | **Kalimat Outline tidak berubah** |

Teks sengaja independen: baris outline adalah kalimat dalam sebuah catatan,
judul task adalah label pekerjaan. Memaksa keduanya identik berarti mengedit
catatan tidak lagi aman. Karena tautannya hidup di kolom, bukan di dalam teks,
mengedit kalimat tidak pernah memutus tautan.

### 5.3 Task yang sudah dihapus

`linked_task_id` menunjuk node yang `deleted_at`-nya terisi → chip berubah jadi
status mati ("task dihapus") dengan aksi membersihkan tautan. Baris outline
sendiri tidak disentuh.

## 6. Dampak ke turunan `kind`

`kind === 'item'` dipakai sebagai filter baca di tujuh modul. Perlakuannya:

### 6.1 Tetap `item` saja — `note` dikecualikan

- [`views.ts`](../../../packages/core/src/views.ts) — seluruh view Todo
- [`logbook.ts`](../../../packages/core/src/logbook.ts) — catatan tidak
  "diselesaikan"
- [`board.ts`](../../../packages/core/src/board.ts)
- `project-actions.ts` — hitungan progres project
- `NodeDetailModal.tsx` — hitungan subtask
- `agent/tool-executor.ts` — agent membuat dan membaca task, bukan catatan

Semuanya sudah benar apa adanya. Yang dibutuhkan: **tes yang mengunci
perilaku itu**, bukan perubahan kode.

### 6.2 Wajib menerima `note`

- `sync/dto.ts` — enum zod
- `db/schema/node.ts` — enum drizzle + CHECK `node_kind_check`
- `outline-actions.ts` `blankNode()` — `kind: 'note'`

### 6.3 Search ikut mencari catatan

[`search.ts:53`](../../../packages/core/src/search.ts) sekarang hanya
mengambil `kind === 'item'`. Diperluas jadi `'item' | 'note'`.

Alasannya: search adalah cara menemukan tulisan, bukan cara mendaftar
pekerjaan. Catatan yang tidak bisa dicari sama saja dengan hilang. Hasil
bertipe catatan dibedakan secara visual supaya tidak tertukar dengan task.

## 7. Penghapusan

Independen di kedua arah.

| Aksi | Akibat |
|---|---|
| Hapus task di Todo | Baris outline tetap. Chip jadi status mati (§5.3). |
| Hapus baris outline | Task tetap hidup di project-nya. Tidak ada konfirmasi, tidak ada penghapusan berantai. |

Tidak ada dialog "hapus juga task-nya?". Menghapus satu kalimat catatan tidak
boleh punya kekuatan menghapus pekerjaan di project.

## 8. Migrasi data lama

Satu migrasi sekali jalan menurunkan setiap `kind='item'` yang **rantai
leluhurnya tidak mencapai node ber-`kind` `project` atau `area`** menjadi
`kind='note'`.

Karena Inbox adalah `kind='project'` ([node.ts:26](../../../packages/core/src/node.ts)),
isinya otomatis selamat tanpa aturan tambahan.

```sql
WITH RECURSIVE anchored AS (
  SELECT id FROM node WHERE kind IN ('project', 'area')
  UNION ALL
  SELECT n.id FROM node n JOIN anchored a ON n.parent_id = a.id
)
UPDATE node
SET kind = 'note', updated_at = now(), seq = nextval('sync_seq')
WHERE kind = 'item' AND id NOT IN (SELECT id FROM anchored);
```

`updated_at` dan `seq` **wajib** ikut naik. Tanpa itu klien tidak pernah
menarik perubahannya dan Dexie tetap menyimpan `kind='item'` yang basi —
Anytime di browser tetap kotor meski database sudah bersih.

Efek yang diterima: task lepas yang sengaja ditaruh di akar ikut terdegradasi.
Node semacam itu tidak punya rumah di Todo, tetap ada di Outline, dan bisa
ditandai ulang dengan `#project`. Pertimbangan lengkapnya di
[context.md §3.4](context.md).

## 9. Di luar cakupan

Ditulis eksplisit supaya tidak merembes saat implementasi:

- **Menampilkan catatan di layar project Todo.** Catatan yang ditulis di dalam
  sebuah project tidak muncul di sana. Itu konsekuensi yang diterima (§2
  prinsip 2), bukan kekurangan yang ditambal.
- **Banyak task per baris.** Satu baris, nol atau satu task.
- **Menautkan ke task yang sudah ada.** `#project` selalu melahirkan task
  baru. Menunjuk task lama adalah `@mention`, fitur yang sudah punya spec
  sendiri.
- **Sinkronisasi teks dua arah.** Ditolak di §5.2, bukan ditunda.
- **Mengubah cara Outline menampilkan project dan task Todo** (§9 spec lama) —
  seluruh pohon tetap tampil.

## 10. Verifikasi

| Lapis | Yang dibuktikan |
|---|---|
| Unit — migrasi | Task di dalam project bertahan `item` · isi Inbox bertahan · task di bawah area bertahan · baris akar jadi `note` · `seq` naik |
| Unit — view | `views.*`, `logbook`, `board` mengabaikan `note`; `search` menemukannya |
| Unit — tautan | `#project` membuat task di project yang benar dan mengisi `linked_task_id` · batal tidak menulis apa pun · hapus salah satu sisi tidak menyentuh sisi lain |
| E2E | Ketik baris di Outline → Anytime **tidak berubah** → tandai `#Project` → isi popup → simpan → task muncul di project → centang dari Outline → status berubah di Todo |
| Browser sungguhan | Syarat Done, bukan `npm run verify` — [2-workflow §2](../../policy/2-workflow.md) |
