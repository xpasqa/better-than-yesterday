# Spec: Lampiran File — task + iDrive e2

**Tanggal:** 2026-08-05
**Status:** disetujui, siap dibuatkan rencana implementasi
**Policy:** tunduk pada [`docs/policy/1-engineering-policy.md`](../../policy/1-engineering-policy.md)
**Prasyarat:** [`../2.backend/notes.md`](../2.backend/notes.md) — fitur ini **diblokir** sampai
backend v1 (Hono + Postgres + auth + `POST /sync`) jalan. Tidak ada backend sendiri di sini.

---

## 1. Konteks

`StorageView.tsx` yang sekarang adalah peramban folder ala Dropbox dengan data mock:
`storageFolders` / `storageFiles` di `src/data/storageData.ts`, navigasi breadcrumb,
buat/rename/hapus folder. Semuanya hidup di state komponen dan hilang saat refresh.
`notes.backend` §3 sengaja membiarkannya apa adanya — "tetap mock, tetap bisa diklik".

Spec ini mencabut keputusan itu, tapi bukan dengan menyambung `StorageView` ke backend.
**Peramban foldernya dibuang.** Yang dibutuhkan bukan drive pribadi, melainkan dua hal
konkret:

1. Melampirkan file ke sebuah task.
2. Agent menulis file `.md` ke sebuah project/session.

Keduanya tidak butuh folder sama sekali. File terikat ke task, dan task sudah punya
tempatnya sendiri di pohon. Struktur folder kedua di atas pohon yang sudah ada hanya
menambah satu hierarki yang harus dijaga sinkron dengan hierarki yang sebenarnya dipakai.

Penyimpanannya **iDrive e2** — object storage S3-compatible. Bukan disk VPS: file di disk
VPS ikut mati bersama VPS-nya, tidak masuk `pg_dump`, dan membuat pindah server jadi
proyek tersendiri.

## 2. Ruang lingkup

### Masuk

- Lampirkan file ke node mana pun lewat `TaskDetailModal` (drag-drop + tombol)
- Daftar lampiran di detail task: nama, ukuran, tombol unduh, tombol hapus
- Unduh lewat presigned URL
- Agent (di server) menulis file ke sebuah node dengan jalur yang sama
- Lampiran ikut `POST /sync` supaya daftarnya sama di semua device
- Objek di e2 dibuang saat task-nya dihapus

### Tidak masuk

| | Alasan |
|---|---|
| Peramban folder / `StorageView` | Dibuang, bukan ditunda. Lihat §3. |
| Preview & thumbnail | Butuh render pipeline sendiri; unduh sudah cukup untuk dogfood. |
| Versioning file | Lampiran di sini sekali tulis. Kalau berubah, lampirkan lagi. |
| Share link publik | Single-user. Tidak ada orang kedua yang dikirimi link. |
| Multipart / resumable upload | Batas 100 MB muat dalam satu `PUT`. |
| Pencarian isi file | Butuh index teks; belum ada kasusnya. |
| Upload saat offline | Lihat §14 — ditolak sadar, bukan lupa. |

## 3. Keputusan inti: lampiran, bukan drive

**File tidak punya hierarkinya sendiri.** Satu file selalu milik tepat satu node.
Hierarki file = hierarki pohon, dan tidak ada cara memindahkan file selain memindahkan
node pemiliknya.

Konsekuensi yang membuat ini murah:

- Tidak ada rename folder, tidak ada breadcrumb, tidak ada `parentId` kedua.
- Kunci objek di e2 tidak pernah berubah seumur hidup file — tidak ada `copy`+`delete`
  di bucket hanya karena task dipindah ke project lain.
- `StorageView.tsx`, `StorageItem.tsx`, `storageData.ts`, dan tipe
  `StorageFolder`/`StorageFile` dihapus seluruhnya. Nav sidebar "Storage" ikut hilang.

### Kenapa tabel sendiri, bukan `kind='file'` di tabel `node`

`notes.backend` §4 menyatukan task/section/outline ke satu tabel `node` karena ketiganya
berbagi urutan, drag, dan indent. Lampiran **tidak** berbagi apa pun dari itu: tidak
di-drag, tidak di-indent, tidak punya anak, tidak punya `due_date`, dan tidak boleh muncul
sebagai baris di Outline maupun kartu di Board.

Menaruhnya di `node` berarti setiap view harus menulis `AND kind != 'file'` — satu filter
negatif di semua tempat, selamanya, dan satu baris yang lupa memfilternya langsung jadi
bug yang kelihatan. Tabel terpisah membuat kesalahan itu tidak bisa terjadi.

Ini **tidak** melanggar "satu jalur sync": `attachment` ikut endpoint, cursor, dan `seq`
yang sama persis dengan `node` (§6). Yang bertambah cuma satu array di payload.

## 4. Model data

```sql
attachment
  id          text        primary key      -- UUIDv7, dibuat di CLIENT
  node_id     text        not null references node(id)
  name        text        not null         -- nama tampilan, mis. "spec-v2.pdf"
  size        bigint      not null
  mime        text        not null
  state       text        not null         -- 'pending' | 'ready'
  created_at  timestamptz not null
  deleted_at  timestamptz                  -- soft delete, mengikuti node
  seq         bigint      not null         -- sequence yang sama dengan node
```

Index: `node_id` (partial, `WHERE deleted_at IS NULL`) dan `seq`.

**Lampiran itu immutable.** Setelah `state='ready'`, tidak ada kolom yang pernah berubah
lagi kecuali `deleted_at`. Tidak perlu `updated_at`, dan tidak perlu LWW — dua device
tidak bisa "mengedit" lampiran yang sama, hanya membuat atau menghapus. Ini menghapus
seluruh kelas konflik yang harus dipikirkan untuk `node`.

`state` ada karena baris dibuat sebelum byte-nya sampai di e2 (§7). Baris `pending` yang
lebih tua dari 24 jam berarti upload-nya gagal atau ditinggal; cron pembersih membuangnya.

## 5. Penyimpanan di iDrive e2

Satu bucket, private penuh, tanpa akses anonim.

**Kunci objek:** `nodes/<node_id>/<attachment_id>`

Tanpa nama file di dalam kunci. Nama tinggal di kolom `name`; saat unduh, nama aslinya
dipasang lewat `response-content-disposition` di presigned URL. Alasannya: nama file bisa
mengandung apa saja (spasi, unicode, `/`), dan menaruhnya di kunci berarti tiap operasi
harus memikirkan encoding. Kunci berbasis ID selalu aman dan panjangnya tetap.

**Konfigurasi** (env server, tidak pernah sampai ke client):

```
E2_ENDPOINT     https://<host dari console e2>
E2_REGION       <region dari console e2>
E2_BUCKET       better-files
E2_ACCESS_KEY   ...
E2_SECRET_KEY   ...
```

Dua hal yang wajib diverifikasi saat implementasi dan tidak boleh diasumsikan:

1. **CORS bucket.** Presigned `PUT` dijalankan dari browser, jadi bucket harus
   mengizinkan `PUT` dari origin app, dengan header `content-type` dan `content-length`.
   Tanpa ini upload gagal dengan error CORS yang menyesatkan, bukan error S3.
2. **`forcePathStyle`.** Provider S3-compatible sering butuh path-style addressing.
   Kalau `PUT` pertama gagal dengan DNS/host error, ini penyebabnya.

## 6. API

Tetap dua endpoint yang sudah direncanakan, plus satu:

```
POST /sync   { cursor, nodes: Node[], attachments: Attachment[] }
         →   { cursor, nodes: Node[], attachments: Attachment[] }

POST /files/sign   { attachmentId, nodeId, name, size, mime }
               →   { url }        -- presigned PUT, TTL 15 menit

GET  /files/:attachmentId/url
               →   { url }        -- presigned GET, TTL 5 menit
```

`POST /files/sign` menolak kalau `size > 100 MB`, dan menandatangani `content-length`
serta `content-type` sebagai bagian dari signature — jadi client tidak bisa mengunggah
sesuatu yang berbeda dari yang dideklarasikan. Ini satu-satunya validasi ukuran yang
tidak bisa dilewati.

Tidak ada endpoint upload, hapus, atau list. Upload langsung ke e2; hapus dan list adalah
operasi biasa di pohon yang lewat `POST /sync`.

## 7. Alur

### Upload

```
drop file di TaskDetailModal
  → baris attachment 'pending' muncul di UI + Dexie          ← 0 ms, tanpa jaringan
  → POST /files/sign → presigned PUT
  → browser PUT langsung ke e2                               ← byte tidak lewat VPS
  → state='ready' → masuk outbox → ikut sync berikutnya
```

Byte tidak pernah melewati VPS: hemat bandwidth, dan file 100 MB tidak menahan proses
Node. Server hanya menandatangani — itu operasi CPU murni tanpa I/O.

### Unduh

Klik lampiran → `GET /files/:id/url` → browser diarahkan ke URL itu. Bucket private, jadi
URL yang bocor pun mati dalam 5 menit.

### Agent

Agent jalan di server, jadi ia memakai S3 client langsung, bukan presigned URL: `PUT`
objek, insert baris `attachment` dengan `state='ready'` sekaligus. Menulis `.md` ke sebuah
session/project = satu baris dengan `node_id` = node project itu. Begitu tersimpan, file
muncul di detail node itu di semua device lewat sync biasa — tanpa kode UI tambahan.

Agent-nya sendiri di luar scope spec ini. Yang dijamin di sini: jalurnya sudah ada dan
tidak perlu dibangun ulang saat agent dikerjakan.

## 8. Siklus hidup & penghapusan

| Kejadian | Yang terjadi |
|---|---|
| Task dicentang selesai | **Tidak terjadi apa-apa pada lampiran.** Tetap utuh, ikut kalau task di-uncheck. |
| Lampiran dihapus manual | `deleted_at` diisi; baris hilang dari UI seketika. |
| Task dihapus | `deleted_at` node terisi; seluruh lampirannya ikut ditandai. |
| Cron harian | Menghapus objek e2 + baris untuk lampiran yang `deleted_at` > 30 hari, dan lampiran `state='pending'` yang > 24 jam. |

Penghapusan objek tidak pernah langsung karena penghapusan di app ini tidak pernah pakai
dialog konfirmasi. Jeda 30 hari itulah yang menggantikan dialog — salah klik masih bisa
dipulihkan lewat SQL selama sebulan, dan yang benar-benar dihapus tetap berhenti dibayar.

Cron-nya numpang di mesin yang sama dengan `pg_dump` yang sudah direncanakan di
`notes.backend` §6. Bukan worker terpisah — policy §2 melarangnya, dan ini memang cuma
satu query plus satu `DeleteObjects`.

## 9. Perubahan di UI

- **`TaskDetailModal.tsx`** — bagian lampiran: drop-zone, daftar file (ikon per tipe,
  nama, ukuran, tombol unduh, `⋯` hapus), baris progress saat `pending`. File berukuran
  besar menampilkan persentase dari event progress `PUT`-nya.
- **Sidebar** — nav "Storage" dihapus, `ViewType` kehilangan `'storage'`.
- **Dihapus** — `StorageView.tsx`, `StorageView.css`, `StorageItem.tsx`,
  `StorageItem.css`, `src/data/storageData.ts`, tipe `StorageFolder` dan `StorageFile`.
  Total ~16 KB kode mock yang tidak punya penerus.

Ikon tipe file (`FilePdfIcon`, `FileImageIcon`, dst.) dipertahankan dari `StorageItem`
— itu satu-satunya bagian yang dipakai ulang, dipindah ke `packages/core/file.ts`
sebagai pemetaan mime → nama ikon.

## 10. Berkas

| Berkas | Isi | Diuji |
|---|---|---|
| `packages/core/file.ts` | murni: `objectKey(nodeId, id)`, validasi ukuran/mime, `formatSize()`, mime → ikon | unit, wajib |
| `apps/api/storage/e2.ts` | **satu-satunya** file yang kenal SDK S3: `signPut()`, `signGet()`, `deleteObjects()` | integration |
| `apps/api/routes/files.ts` | dua endpoint, tipis — validasi lewat `core`, tanda tangan lewat `e2.ts` | integration |
| `apps/api/jobs/purge.ts` | cron harian §8 | integration |
| `apps/web/store/upload.ts` | urutan sign → PUT → tandai ready, progress | E2E |
| `apps/web/components/TaskDetailModal.tsx` | UI lampiran | E2E |

`e2.ts` sengaja jadi satu-satunya titik sentuh SDK — policy §6: library yang dipakai di
satu tempat dibungkus supaya bisa dicabut. Kalau e2 diganti provider lain nanti, yang
berubah satu file.

**Dependency baru:** `@aws-sdk/client-s3` dan `@aws-sdk/s3-request-presigner`. Keduanya
server-only dan tidak pernah di-import dari `apps/web`, jadi anggaran bundle 200 KB
(policy §5) tidak tersentuh sama sekali.

## 11. Penanganan kesalahan

| Kejadian | Perilaku |
|---|---|
| Offline saat melampirkan | Drop-zone nonaktif dengan pesan "butuh koneksi". Tidak ada antrean. |
| `PUT` ke e2 gagal | Baris tetap `pending` dengan tombol "Coba lagi". Tidak dihapus otomatis — biar terlihat bahwa filenya belum tersimpan. |
| Presigned URL kedaluwarsa saat upload panjang | `PUT` gagal, "Coba lagi" meminta tanda tangan baru. |
| File > 100 MB | Ditolak di client sebelum request, dengan angka batasnya disebut. Server menolak lagi kalau client dilewati. |
| Objek hilang di e2 tapi baris ada | Unduh mengembalikan 404; barisnya ditandai bermasalah, tidak dihapus diam-diam. |
| Node dihapus saat upload berjalan | `PUT` dibiarkan selesai; cron pembersih yang membuangnya. Tidak ada pembatalan setengah jalan. |

## 12. Test

Sesuai policy §7.

- **`packages/core/file.ts`** — unit, wajib. Batas ukuran tepat di 100 MB, mime tidak
  dikenal, nama file dengan unicode/slash, `formatSize()` di batas KB/MB/GB.
- **`e2.ts` + `routes/files.ts`** — integration ke **bucket e2 test yang nyata**, bukan
  mock SDK (policy §2 melarang menguji mock). Skenario: sign → PUT → GET → delete.
  Yang paling penting diuji adalah yang paling mungkin salah: apakah signature-nya
  benar-benar diterima e2, bukan apakah kode kita memanggil fungsi yang benar.
- **Cron purge** — integration dengan Postgres asli: lampiran 31 hari terhapus, 29 hari
  tidak, `pending` 25 jam terhapus.
- **E2E (Playwright)** — satu alur: buka task → drop file → baris muncul → jadi `ready`
  → unduh berhasil.

## 13. Definisi selesai

1. Lampirkan PDF ke sebuah task dari laptop; buka task yang sama di browser HP;
   lampirannya ada dan bisa diunduh.
2. Centang task, uncheck lagi — lampiran tetap utuh.
3. Hapus task; keesokan harinya baris masih ada di DB dengan `deleted_at`, objeknya
   masih ada di e2 (belum 30 hari).
4. Matikan koneksi, buka task berlampiran — daftarnya tetap tampil dari Dexie, tombol
   unduh nonaktif.

## 14. Alternatif yang ditolak

| Alternatif | Kenapa ditolak |
|---|---|
| Peramban folder (`StorageView` sekarang) disambung ke backend | Hierarki kedua di atas pohon yang sudah ada, harus dijaga sinkron selamanya, dan tidak menjawab satu pun dari dua kebutuhan nyata. |
| File sebagai `kind='file'` di tabel `node` | Setiap view pohon harus memfilternya keluar; satu yang lupa = bug yang kelihatan. Lampiran tidak berbagi rank/drag/indent dengan node. |
| Upload di-proxy lewat backend | Tiap byte lewat VPS; file besar menahan proses Node. Presigned lebih sedikit kode, bukan lebih banyak. |
| Blob ditahan di Dexie supaya bisa upload offline | Menambah store, worker retry, dan kuota IndexedDB untuk kasus yang jarang. Melampirkan file hampir selalu dilakukan saat online, dan gagalnya terlihat jelas. |
| Nama file di dalam kunci objek | Encoding unicode/spasi/slash jadi masalah di tiap operasi. Nama cukup di DB. |
| Hapus objek seketika saat task selesai | Uncheck jadi kehilangan data permanen tanpa peringatan, di app yang tidak punya dialog konfirmasi. |
| Simpan file di disk VPS | Tidak masuk `pg_dump`, ikut mati bersama VPS, dan membuat pindah server jadi proyek sendiri. |
| Bucket publik + URL permanen | URL yang bocor berlaku selamanya. Presigned 5 menit tidak lebih mahal. |

## 15. Risiko

| Risiko | Mitigasi |
|---|---|
| **CORS bucket e2 salah** — gejalanya error browser yang menyesatkan, bukan error S3. | Konfigurasi CORS dikerjakan dan diverifikasi lebih dulu, sebelum UI lampiran ditulis sama sekali. |
| **Perilaku presigned e2 berbeda dari S3** (path-style, header yang ditandatangani). | Integration test ke bucket nyata jadi langkah pertama implementasi, bukan terakhir. |
| **Kredensial e2 bocor lewat env yang salah tempat.** | `E2_*` hanya dibaca di `apps/api`. Aturannya ditegakkan dengan tidak pernah mengimpor `e2.ts` dari `apps/web` — pelanggarannya ketahuan saat build karena SDK-nya tidak ada di dependency web. |
| **Baris `pending` menumpuk** dari upload yang gagal diam-diam. | Cron 24 jam membuangnya, dan UI menampilkan `pending` sebagai keadaan bermasalah, bukan sebagai loading yang wajar. |
| **Biaya tak terkendali** karena tidak ada kuota. | Batas 100 MB per file. Skala single-user membuat total tetap kecil; kalau ternyata tidak, kuota ditambahkan saat itu — bukan sekarang. |
