# Spec: Backend Storage — Drive di iDrive e2

> Satu bucket S3-compatible di belakang empat area terpisah: lampiran task
> Todo, file Outline, artefak biner Agent, dan folder pribadi bebas. Upload
> langsung dari browser lewat presigned URL — byte tidak pernah lewat server.

**Status:** v1 · **Fase:** 4 · **Bergantung pada:**
[0.infrastructure](../0.infrastructure/spec.md) · [1.todo](../1.todo/spec.md) ·
[3.agent](../3.agent/spec.md) · [spec induk](../spec.md) — §3.1 (dua kelas
domain), §5 (multi-user) · [Engineering Policy](../../../policy/1-engineering-policy.md)

Referensi desain: [`bty/docs/specs/05-attachments.md`](../../../../../bty/docs/specs/05-attachments.md)
— presigned-upload S3-compatible, sudah cocok hampir utuh untuk iDrive e2.
Penyimpangan dari referensi itu didaftar di §12.

---

## 1. Objective

Storage bukan fitur berdiri sendiri — ia adalah **rumah file** untuk tiga
fase lain yang sudah janji butuh tempat menaruh berkas: lampiran task Todo
(fase 1 §14, ditunda ke sini), file yang disisipkan di catatan Outline
(fase 2), dan artefak biner yang dipegang Agent (fase 3 §2, dibatasi "hanya
markdown" justru karena storage belum ada). Ditambah satu kebutuhan yang
berdiri sendiri: folder pribadi bebas, tempat menaruh dokumen yang tidak
terikat task atau catatan apa pun.

Yang membuat fase ini bukan sekadar "CRUD folder + upload" adalah bahwa
keempat kebutuhan itu **berbagi satu mesin** (upload, kuota, sweep orphan)
tapi harus tetap **terlihat terpisah** bagi user — lampiran task tidak boleh
muncul bercampur dengan foto liburan di folder pribadi. Selesai berarti: satu
tabel `storage_file`, empat area yang tidak saling tumpang tindih di UI.

---

## 2. Scope

**In:** empat area (`todo-attachment`, `outline`, `agent`, `personal`) ·
folder bertingkat di dalam satu area · upload langsung ke iDrive e2 lewat
presigned URL (presign → PUT → confirm) · download lewat presigned GET ·
rename & pindah folder/file · hapus (file dan folder rekursif) · kuota per
user · validasi di titik presign (ukuran, MIME, nama tak tertebak) · sweep
orphan mingguan (in-process, bukan queue terpisah) · endpoint yang bisa
dipanggil tool Agent untuk lampiran non-markdown · isolasi antar user.

**Out (dengan alasan, §11):** thumbnail gambar · preview dalam-app selain
gambar · pencarian isi berkas · versi/riwayat berkas · share link publik ·
scan virus · resumable upload · folder berbagi antar user.

---

## 3. Empat Area, Satu Mesin

| Area | Dipakai oleh | `owner_kind` | `owner_id` menunjuk |
|---|---|---|---|
| `todo-attachment` | Lampiran pada satu task/subtask | `node` | `node.id` |
| `outline` | Berkas yang disisipkan di satu baris catatan | `node` | `node.id` |
| `agent` | Artefak biner milik satu project Agent | `agent_project` | `agent_project.id` |
| `personal` | Folder bebas milik user, di luar Todo/Outline/Agent | — | — (tidak ada owner) |

`todo-attachment` dan `outline` sama-sama menunjuk `node.id` karena
**keduanya memang tabel yang sama** — spec induk §2.1 sudah meleburkan
`Task` dan `OutlineNode` jadi satu `node` dengan kolom `kind`. Storage tidak
perlu (dan tidak boleh) menciptakan konsep "outline node" tersendiri yang
tidak ada di skema; ia hanya perlu tahu bahwa "task X punya lampiran" dan
"baris outline Y punya berkas tersisip" adalah operasi yang sama — presign
dengan `owner_kind='node'` — dibedakan hanya oleh `kind` di `storage_area`
supaya kedua daftar tidak bercampur di UI. Tabel di server tetap satu; batas
antar area adalah batas tampilan, bukan batas skema — dan itu justru
konsisten dengan alasan §2.1 melebur Task/OutlineNode: satu sumber
kebenaran, banyak cara memandangnya.

`agent` menunjuk `agent_project.id` (fase 3 §9) karena artefak biner terikat
ke *project* Agent, bukan ke satu sesi — sejalan dengan bagaimana artefak
markdown (`agent_file`) sudah terikat.

`personal` tidak punya owner sama sekali — ia adalah satu area tetap per
user, dibuat sekali saat akun dibuat (§4.2 infra, seperti root Inbox Todo),
tempat folder dan berkas bebas hidup.

Postgres **tidak bisa menegakkan FK polimorfik** ini — persis catatan yang
sama di referensi bty §6. Konsekuensinya diterima dan ditangani lewat sweep
mingguan (§8), bukan lewat trigger atau tabel per-owner terpisah: dua tabel
`todo_attachment` + `outline_attachment` dengan FK asli akan melipatgandakan
permukaan query dan endpoint untuk menyelesaikan masalah yang satu cron
sudah selesaikan.

---

## 4. Data Model

Semua tabel membawa `user_id TEXT NOT NULL REFERENCES app_user(id)` dan
difilter dari sesi di setiap query (infrastruktur §4.3) — **kecuali** bahwa
di sini `user_id` juga hidup langsung di `storage_folder` dan `storage_file`
(didenormalisasi dari `storage_area`) supaya query kuota dan isolasi tidak
perlu JOIN ke `storage_area` di jalur yang paling sering dipanggil.

### 4.1 `storage_area`

```sql
CREATE TABLE storage_area (
  id          TEXT PRIMARY KEY,                 -- UUIDv7, digenerate SERVER (§4.4)
  user_id     TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL
              CHECK (kind IN ('todo-attachment', 'outline', 'agent', 'personal')),
  owner_kind  TEXT CHECK (owner_kind IN ('node', 'agent_project')),
  owner_id    TEXT,                              -- polimorfik; lihat §3
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT storage_area_owner_shape CHECK (
    (kind IN ('todo-attachment', 'outline') AND owner_kind = 'node' AND owner_id IS NOT NULL) OR
    (kind = 'agent' AND owner_kind = 'agent_project' AND owner_id IS NOT NULL) OR
    (kind = 'personal' AND owner_kind IS NULL AND owner_id IS NULL)
  )
);
CREATE INDEX storage_area_user ON storage_area (user_id);
-- satu area per owner (task X hanya punya satu area lampiran, bukan berulang tiap upload)
CREATE UNIQUE INDEX storage_area_owner_unique
  ON storage_area (user_id, kind, owner_kind, owner_id) WHERE owner_id IS NOT NULL;
-- satu area personal per user
CREATE UNIQUE INDEX storage_area_personal_unique
  ON storage_area (user_id) WHERE kind = 'personal';
```

`storage_area_owner_shape` mengunci di database apa yang mudah bocor di
kode: area `agent` tidak boleh sengaja/tidak sengaja dibuat dengan
`owner_kind='node'`, dan `personal` tidak boleh punya owner nyasar.

Area `todo-attachment`/`outline` **dibuat malas** (upsert saat upload
pertama pada task/baris itu), bukan saat task dibuat — kebanyakan task
tidak pernah dapat lampiran, dan menaruh baris kosong untuk semuanya hanya
menambah baris yang tidak pernah dibaca. Area `agent` sama. Area `personal`
sebaliknya **dibuat sekali saat `user add`**, transaksional bersama baris
user — persis pola root Inbox di infra §4.2.

### 4.2 `storage_folder`

```sql
CREATE TABLE storage_folder (
  id          TEXT PRIMARY KEY,                 -- UUIDv7, digenerate SERVER
  user_id     TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  area_id     TEXT NOT NULL REFERENCES storage_area(id) ON DELETE CASCADE,
  parent_id   TEXT REFERENCES storage_folder(id) ON DELETE CASCADE,  -- NULL = akar area
  name        TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 255),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX storage_folder_area_parent ON storage_folder (area_id, parent_id);
CREATE INDEX storage_folder_user ON storage_folder (user_id);
```

Nested di semua area secara skema, tapi **hanya area `personal` yang
mengekspos CRUD folder penuh di UI v1** — task dan baris outline biasanya
punya segelintir lampiran datar, dan project Agent belum punya alasan
konkret untuk subfolder. Satu bentuk skema untuk keduanya lebih murah
daripada dua desain: kalau nanti task butuh subfolder lampiran, itu jadi
satu tombol UI baru, bukan migrasi.

`parent_id` mengizinkan siklus **tidak** ditolak database (self-referencing
FK biasa tidak bisa menegakkan itu) — ditolak di `core/storage-tree.ts`
sebelum tulisan dikirim, sama persis pola `core/tree.ts` di fase 1 §3.1
untuk siklus `parent_id` pada `node`.

**Hard delete, bukan `deleted_at`.** Ini beda sengaja dari `node`/`label`
fase 1 (§2.4 spec induk): `deleted_at` di sana ada karena baris itu perlu
disinkronkan ke klien offline lewat `/sync`, dan klien butuh tahu "baris ini
pernah ada lalu dihapus". Storage adalah domain **milik-server** (spec induk
§3.1) — tidak ada replika klien untuk direkonsiliasi, jadi tidak ada yang
perlu diberitahu lewat tombstone. Menghapus folder menghapus barisnya
(cascade ke subfolder dan file) di transaksi yang sama; objek S3-nya
dibersihkan oleh handler sebelum cascade (§6).

### 4.3 `storage_file`

```sql
CREATE TABLE storage_file (
  id          TEXT PRIMARY KEY,                 -- UUIDv7, digenerate SERVER
  user_id     TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  area_id     TEXT NOT NULL REFERENCES storage_area(id) ON DELETE CASCADE,
  folder_id   TEXT REFERENCES storage_folder(id) ON DELETE CASCADE,  -- NULL = akar area
  name        TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 255),
  s3_key      TEXT NOT NULL UNIQUE,              -- 'storage/{user_id}/{id}', lihat §5
  size_bytes  BIGINT NOT NULL CHECK (size_bytes > 0),
  mime_type   TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX storage_file_area_folder ON storage_file (area_id, folder_id);
CREATE INDEX storage_file_user_ready
  ON storage_file (user_id) WHERE status = 'ready';   -- jalur kuota, §7
CREATE INDEX storage_file_pending
  ON storage_file (created_at) WHERE status = 'pending';  -- jalur sweep, §8
```

`status` adalah jantung alur presign→confirm (§5): baris dibuat `pending`
saat presign diterbitkan, berubah `ready` hanya setelah klien mengonfirmasi
**dan** server memverifikasi objeknya benar-benar ada di bucket. File
`pending` tidak muncul di tree (§6), tidak dihitung ke kuota (§7), dan
menjadi target sweep bila dibiarkan (§8).

Nama tampilan asli (`name`) dan kunci objek (`s3_key`) sengaja dipisah —
lihat §5 untuk kenapa `s3_key` tidak pernah memuat nama asli.

Tanpa constraint unik pada `(folder_id, name)`: dua file bernama sama dalam
satu folder diizinkan, seperti Google Drive. Menegakkannya butuh dua indeks
parsial (folder `NULL` vs tidak) untuk manfaat yang kecil di aplikasi tiga
orang — kalau tabrakan nama benar-benar mengganggu di pemakaian nyata, itu
satu index tambahan, bukan desain ulang.

### 4.4 Kuota (ALTER pada `app_user`)

```sql
ALTER TABLE app_user
  ADD COLUMN storage_quota_bytes BIGINT NOT NULL DEFAULT 10737418240;  -- 10 GiB
```

**10 GiB per user**, bukan angka yang dipilih untuk biaya — biaya
penyimpanan di iDrive e2 untuk 30 GiB (tiga user) bahkan tidak terasa
dibanding ongkos VPS itu sendiri, dan tanpa fee egress berarti biaya baca
juga bukan pertimbangan. Angka ini dipilih untuk **disiplin**: cukup untuk
bertahun-tahun dokumen kerja, kontrak, tanda terima, dan lampiran task, plus
beberapa ratus foto resolusi wajar — tapi cukup kecil untuk memaksa orang
sadar sebelum menumpahkan seluruh galeri foto HP ke sini. Storage ini
dirancang sebagai laci dokumen, bukan pengganti Google Photos (§11).

Kolom hidup di `app_user` (bukan tabel `storage_quota` terpisah) karena satu
angka per user tidak butuh tabel sendiri — konsisten dengan pola
`timezone`/`digest_time` di fase 1 §3.7. CLI dapat menaikkannya per akun:

```bash
npm run user -- set-quota pasqa@example.com 20   # GB, transaksional, tidak menyentuh baris lain
```

### 4.5 Id digenerate server, bukan klien

Berbeda dari `node`/`label` (§2.2 spec induk, UUIDv7 klien untuk menghindari
menunggu jaringan saat membuat baris offline): **storage butuh jaringan
untuk apa pun yang ia lakukan** — presign adalah permintaan HTTP itu
sendiri, jadi tidak ada momen "dibuat offline" yang perlu dihindari
penundaannya. Server men-generate `id` folder/file/area saat permintaan
diterima; ini konsisten dengan alasan §2.2, bukan melanggarnya — alasan itu
berhenti berlaku begitu domainnya milik-server.

---

## 5. Upload: Presign → PUT → Confirm

```
Browser                          apps/api                         iDrive e2
   │──① POST /files/presign ───────▶│                                 │
   │   {area, owner?, folderId?,    │─ validasi (§5.1)                │
   │    name, sizeBytes, mimeType}  │─ cek kuota (§7)                 │
   │                                │─ INSERT storage_file(pending)   │
   │◀── {fileId, uploadUrl} ────────│                                 │
   │──② PUT file (langsung) ──────────────────────────────────────────▶│
   │──③ POST /files/:id/confirm ───▶│                                 │
   │                                │─ HEAD objek: ada? ukuran cocok? │
   │                                │─ UPDATE status='ready'          │
   │◀── {file} ─────────────────────│                                 │
```

Byte tidak pernah singgah di `apps/api` — mengulang alasan bty §3: rute yang
menyalurkan file besar akan membufernya di memori proses dan memakai
bandwidth VPS dua kali (masuk dari klien, keluar ke iDrive).

### 5.1 Validasi terjadi di langkah ①, bukan ③

Fungsi murni di `core/storage-validate.ts` (tanpa I/O, wajib diuji
100% branch karena inilah satu-satunya pagar sebelum kunci ditandatangani):

```ts
validateUpload(
  input: { name: string; sizeBytes: number; mimeType: string },
  quota: { usedBytes: number; quotaBytes: number }
): { ok: true } | { ok: false; code: string; message: string }
```

| Aturan | Nilai |
|---|---|
| Ukuran maks per berkas | 50 MB |
| MIME diizinkan | PDF, gambar (jpeg/png/webp/gif/heic), Office & OpenDocument, teks/markdown/csv, zip |
| MIME diblokir | executable, script, **`.html`/`text/html`** |
| Nama | 1–255 karakter setelah `trim` |

`.html` diblokir walau bucket privat dan URL GET selalu presigned pendek —
kalau suatu saat objek pernah dilayani langsung (mis. lewat CDN di depan
iDrive), halaman HTML yang di-upload user jadi vektor stored-XSS di origin
aplikasi. Menolaknya sekarang gratis; menyesalinya nanti tidak.

URL presign yang dikembalikan **dibatasi satu kunci dan satu ukuran** lewat
kondisi `Content-Length` pada signature — klien tidak bisa memakai URL yang
sama untuk mengunggah berkas yang lebih besar dari yang divalidasi di ①.
Kedaluwarsa **5 menit**, cukup untuk memulai unggahan dan cukup pendek
sehingga URL yang bocor ke riwayat browser tidak berguna.

### 5.2 Kunci objek — tidak tertebak, tanpa nama asli

```
storage/{user_id}/{file_id}
```

**Tidak menyertakan nama asli** — beda sengaja dari pola bty
`attachments/{workspace}/{yyyy}/{mm}/{uuid}-{nama}` (dicatat di §12). Nama
asli disimpan di kolom `name` untuk ditampilkan dan dipakai sebagai
`Content-Disposition` saat download; kuncinya sendiri murni `user_id` +
`id` internal, sehingga menebak atau menyusun ulang kunci dari nama berkas
yang diketahui menjadi mustahil, dan prefix `storage/{user_id}/` yang
disyaratkan sejak awal (§5 spec induk konteks multi-user) tetap terpenuhi
untuk kebijakan siklus-hidup per user di sisi bucket nanti kalau perlu.

### 5.3 Confirm memverifikasi, tidak percaya begitu saja

Langkah ③ melakukan `HeadObject` ke iDrive sebelum menandai `ready`: objek
harus ada, dan ukurannya harus cocok dengan `size_bytes` yang tercatat.
Tanpa ini, klien yang gagal di tengah PUT (jaringan putus di 80%) bisa
memanggil confirm dan membuat baris `ready` yang menunjuk objek rusak atau
tidak lengkap. Confirm yang gagal verifikasi mengembalikan `409` dan baris
tetap `pending` — akan disapu sweep (§8) atau bisa dicoba ulang klien.

---

## 6. Endpoint HTTP

Milik-server, endpoint per-resource — **bukan `/sync`** — persis keputusan
spec induk §3.1: byte biner tidak bisa direplikasi penuh ke Dexie dan
di-merge LWW; memaksakannya berarti membangun ulang presigned-upload di atas
protokol yang salah bentuk.

```
GET    /api/storage/tree?area=<kind>&owner=<ownerId?>
POST   /api/storage/folders            { area, owner?, parentId?, name }
PATCH  /api/storage/folders/:id        { name?, parentId? }
DELETE /api/storage/folders/:id

POST   /api/storage/files/presign      { area, owner?, folderId?, name, sizeBytes, mimeType }
POST   /api/storage/files/:id/confirm
GET    /api/storage/files/:id/download
PATCH  /api/storage/files/:id          { name?, folderId? }
DELETE /api/storage/files/:id

GET    /api/storage/usage              → { usedBytes, quotaBytes }
```

- **`GET /tree`** mengembalikan folder+file satu area sebagai satu pohon.
  Untuk area ber-owner, ia **memastikan area ada** (upsert malas, §4.1)
  setelah memverifikasi `owner` benar-benar milik sesi: `SELECT 1 FROM node
  WHERE id = :owner AND user_id = :session AND deleted_at IS NULL` (atau
  `agent_project` untuk area `agent`). Owner yang tidak ditemukan atau
  bukan milik sesi → **404**, bukan 403 — mengikuti aturan envelope §3.3
  spec induk secara harfiah: tidak membocorkan keberadaan task/project user
  lain.
- **`PATCH /folders/:id`** menolak `parentId` yang membentuk siklus
  (`core/storage-tree.ts`) dan menolak pemindahan **lintas area** — folder
  lampiran task tidak bisa dipindah ke folder personal; area sebuah folder
  tetap sejak dibuat.
- **`DELETE /folders/:id`** mengumpulkan seluruh `s3_key` di bawahnya
  (rekursif, sebelum eksekusi) memakai CTE:

  ```sql
  WITH RECURSIVE sub AS (
    SELECT id FROM storage_folder WHERE id = :id
    UNION ALL
    SELECT f.id FROM storage_folder f JOIN sub ON f.parent_id = sub.id
  )
  SELECT s3_key FROM storage_file WHERE folder_id IN (SELECT id FROM sub);
  ```

  lalu memanggil `DeleteObjects` ke iDrive, **baru kemudian** `DELETE FROM
  storage_folder WHERE id = :id` (cascade membereskan baris). Urutan ini
  penting: menghapus baris dulu lalu gagal menghapus objek meninggalkan
  sampah tak terlacak; sweep (§8) tetap jadi jaring pengaman kalau langkah
  S3 gagal di tengah.
- **`GET /files/:id/download`** menerbitkan presigned GET (**60 detik**,
  sama seperti bty §5) setelah memverifikasi kepemilikan. Untuk mime bukan
  gambar/PDF, `ResponseContentDisposition` diset `attachment; filename="…"`
  supaya browser mengunduh alih-alih mencoba merender.
- **`GET /usage`** menjumlahkan `SUM(size_bytes) WHERE user_id = :session
  AND status = 'ready'` — dipakai bar kuota di UI (§9 Migrasi Frontend).

---

## 7. Kuota — dicek di presign, bukan di confirm

```sql
SELECT COALESCE(SUM(size_bytes), 0) FROM storage_file
WHERE user_id = :userId AND status = 'ready';
```

Presign menolak (`422`, kode `QUOTA_EXCEEDED`) bila `used + sizeBytes >
quotaBytes`. Hanya baris `ready` yang dihitung — **bukan `pending`** —
karena banyak presign yang tidak pernah di-PUT (klien membatalkan, tab
ditutup) tidak boleh mengunci kuota selamanya.

Konsekuensi yang diterima sadar: dua presign paralel bisa bersama-sama
melampaui kuota sebelum salah satunya confirm, karena pengecekan hanya
melihat `ready` saat itu. Ini bukan celah keamanan — hanya potensi kuota
terlampaui beberapa MB pada tiga user yang saling percaya, persis semangat
"RLS ditunda, `WHERE` + tes isolasi sebagai pagar" di spec induk §5.
Mengunci baris kuota dengan transaksi serializable untuk kasus ini
melipatgandakan kerumitan untuk risiko yang, di skala tiga orang, tidak
pernah terwujud sebagai masalah nyata.

---

## 8. Sweep Orphan Mingguan

**In-process, bukan queue terpisah** — policy §2 melarang broker tanpa
bukti butuh, dan fase 1 §9 sudah menetapkan preseden: `node-cron` di dalam
proses `api` untuk scheduler reminder. Sweep storage memakai mesin yang
sama, jadwal berbeda:

```
modules/storage/sweep.ts — node-cron, Minggu 03:00

1. Baris pending kedaluwarsa:
   SELECT id, s3_key FROM storage_file
   WHERE status = 'pending' AND created_at < now() - interval '24 hours'
   → DeleteObjects (bila objeknya sempat ter-upload tanpa confirm)
   → DELETE FROM storage_file WHERE id IN (...)

2. Area beranak-yatim:
   Untuk owner_kind='node': area yang node-nya deleted_at lebih dari 24 jam
   yang lalu, atau tidak ditemukan sama sekali.
   Untuk owner_kind='agent_project': sama, terhadap agent_project.
   → kumpulkan s3_key seluruh file di bawah area itu (folder + akar)
   → DeleteObjects
   → DELETE FROM storage_area (cascade folder & file)

3. Log satu baris: n baris dihapus, n objek dihapus, total byte diperoleh
   kembali.
```

Jeda 24 jam pada kedua kelas sama alasannya dengan bty §6: unggahan yang
sedang berjalan atau task yang baru saja dihapus (dan mungkin di-undo lewat
`⌘Z` fase 1 §10) tidak boleh disapu dari bawah user. `deleted_at` pada
`node`/`agent_project` adalah tombstone, bukan penghapusan sungguhan — sweep
menunggu jendela itu lewat sebelum menganggapnya final.

Dua kelas orphan yang sama seperti bty §6 (baris tanpa owner nyata, objek
tanpa baris) diterima dengan alasan yang sama: FK polimorfik tidak bisa
ditegakkan Postgres, dan satu cron mingguan menyelesaikannya lebih murah
daripada trigger atau tabel per-owner.

---

## 9. Storage untuk Agent — dan Keputusan agent_file vs storage_file

**Keputusan: tetap terpisah. `agent_file` (fase 3 §9, baris Postgres berisi
teks markdown) tidak dipindah ke `storage_file`.** Alasannya bukan
kemalasan migrasi, tapi bentuk kebutuhannya benar-benar beda:

`edit_file` (fase 3 §7.1) melakukan pencarian-ganti string presisi pada
**konten penuh** berkas di setiap panggilan tool — operasi itu butuh baca
isi lengkap, hitung kecocokan, tulis kembali, dalam satu langkah yang model
tunggu hasilnya sebelum lanjut. Menaruh kontennya di objek S3 berarti setiap
`edit_file` menjadi baca-objek → ubah string → PUT ulang objek: dua
panggilan jaringan tambahan pada operasi yang sekarang satu `UPDATE`
Postgres, dan pada kuota 50 request/hari (fase 3 §3.2) — di mana **setiap
langkah tool adalah satu request ke openagentic**, bukan ke iDrive — biaya
laten tambahan ini murni kerugian tanpa manfaat, karena kontennya toh tetap
harus masuk penuh ke memori proses untuk operasi string. `agent_file` juga
menegakkan bentuknya (`.md`, tolak `..`) lewat CHECK **database** karena
model adalah pemanggil tak terpercaya — sesuatu yang natural untuk kolom
teks, aneh untuk metadata objek biner.

`storage_file` area `agent` sebaliknya untuk **artefak biner** yang memang
tidak masuk akal sebagai baris teks: laporan PDF yang diminta dibuatkan
asisten (lewat presign, ia tidak menulis biner langsung — lihat di bawah),
atau dokumen referensi yang user unggah ke project Agent supaya asisten tahu
ia *ada* (nama, ukuran, tanggal — lewat manifes tree) tanpa asisten pernah
membaca isinya, karena fase 3 §2 sudah membatasi tool baca ke markdown saja.

### 9.1 Endpoint yang dipanggil Agent — tanpa endpoint baru

Storage **tidak menambah endpoint baru** untuk Agent. Tool storage Agent
memanggil endpoint generik §6 yang sama, dengan `area=agent&owner=<projectId>`
disuntikkan handler dari sesi tool (sama seperti `user_id` disuntikkan ke
lima tool task fase 3 §7.2) — bukan dari argumen model:

| Tool Agent (rencana, fase 3 lanjutan) | Endpoint generik yang dipanggil |
|---|---|
| `list_attachments` | `GET /api/storage/tree?area=agent&owner=:projectId` |
| `presign_attachment_upload` | `POST /api/storage/files/presign` |
| `get_attachment_info` | Bagian dari respons `tree` — metadata saja, tanpa isi |
| `delete_attachment` | `DELETE /api/storage/files/:id` |

Ini menuntaskan "SELARAS dengan lima tool file agent, jangan duplikasi
konsep": lima tool berkas fase 3 tetap satu-satunya jalur **baca/tulis
konten markdown**; empat baris di atas hanya **daftar/unggah/lihat
metadata/hapus** biner — tidak pernah `read_file`/`edit_file` atas objek
S3. Tidak ada dua jalur tulis yang berbeda aturan untuk hal yang sama.

**Pendaftaran tool ini ke loop tool-calling Agent bukan bagian fase ini** —
policy §8 spec induk menandai "menambah atau mengubah tool agent" sebagai
hal yang wajib ditanyakan dulu, bukan diputuskan sepihak di spec Storage.
Fase ini hanya menyiapkan endpointnya (sudah ada, dipakai UI manusia lebih
dulu) supaya penambahan tool itu nanti tinggal satu definisi tool AI SDK
yang memanggil HTTP yang sudah ada — bukan satu fase implementasi baru.

---

## 10. Migrasi Frontend

`StorageView.tsx` sekarang murni folder+file di memori (`useState` diisi
`storageData.ts`), **tanpa upload sama sekali** — `id` dari
`Math.random().toString(36)`, tidak ada tombol unggah, tidak ada progress,
tidak ada area. Yang harus ditambah:

1. **Area sebagai konsep UI baru.** Sidebar/tab Storage terbagi jadi
   "Lampiran Todo", "File Outline", "File Agent", "Punyaku" (`personal`) —
   `currentFolderId` sekarang perlu dipasangkan dengan `areaId`/`kind`,
   bukan diasumsikan satu pohon tunggal seperti sekarang.
2. `storageData.ts` dihapus; `folders`/`files` diambil dari
   `GET /api/storage/tree` per area yang aktif.
3. **Tombol/drag-drop unggah** — belum ada sama sekali hari ini. Alur: pilih
   berkas → `POST /files/presign` → `PUT` langsung ke URL yang dikembalikan
   (progress dari `XMLHttpRequest.upload.onprogress`, `fetch` tidak
   mengekspos progress unggah) → `POST /files/:id/confirm` → file muncul di
   list.
4. `generateId()` lokal dihapus; id datang dari respons server.
5. `handleCommitRename`/`handleDeleteFolder`/`handleDeleteFile` yang
   sekarang murni `setState` lokal memanggil `PATCH`/`DELETE` sungguhan,
   lalu memperbarui state dari respons (bukan optimistic tanpa konfirmasi
   server, karena domain ini milik-server — beda dari Todo yang optimistic
   by design).
6. **Unduh** — belum ada. Klik file memanggil `GET /files/:id/download`,
   lalu membuka URL yang dikembalikan di tab baru/`<a download>`.
7. **Bar kuota** di header, dari `GET /usage` — pola yang sama seperti
   penampil sisa kuota harian di Settings AI (fase 3 §12).
8. **Widget lampiran di `TaskDetailModal.tsx`** (fase 1) dan di baris
   Outline (fase 2): daftar ringkas file ber-`area=todo-attachment`/
   `outline` dan `owner=<node.id>` milik baris itu, dengan tombol unggah
   dan unduh kecil — inilah yang membuat "lampiran task" dan "file outline"
   di §1 nyata dipakai, bukan hanya bisa dicapai lewat halaman Storage
   terpisah.
9. Status error yang belum ada UI-nya sekarang: `413`/`422` ukuran atau
   MIME ditolak saat presign, `422 QUOTA_EXCEEDED`, `409` confirm gagal
   verifikasi.

`StorageItem.tsx` dan CSS-nya tidak berubah bentuk — ia sudah menerima
`kind`/`name`/`meta` sebagai props generik; sumber datanya yang pindah dari
mock ke API.

---

## 11. Testing

| Level | Cakupan |
|---|---|
| Unit — wajib | `core/storage-validate.ts` **100% branch** (ukuran, MIME allowlist, MIME diblokir, nama kosong) · `core/storage-tree.ts` (deteksi siklus folder, sama pola `core/tree.ts` fase 1) · pembentuk kunci S3 (`storage/{user}/{id}`, tanpa nama asli) |
| Integrasi | Lawan Postgres asli + iDrive e2 sungguhan (bucket test terpisah): alur presign→PUT→confirm end-to-end · confirm ditolak bila ukuran objek tidak cocok · kuota ditolak tepat di batas · rename/move menolak siklus dan lintas-area · delete folder menghapus seluruh objek turunannya · sweep menghapus pending > 24 jam dan area beranak-yatim, **tidak** menghapus yang < 24 jam · **isolasi antar user**: user B mendapat 404 atas tree/download/rename/delete milik user A |
| E2E | Unggah berkas ke folder personal → muncul di list dengan ukuran benar → unduh → hash cocok · lampirkan berkas ke satu task lewat `TaskDetailModal` → muncul di area `todo-attachment` |

Kasus isolasi baru ditambahkan ke `test/isolation.test.ts` yang sama yang
dipakai fase 0–3 — **tes terpenting repositori ini** (spec induk §5) terus
tumbuh satu domain per fase, tidak pernah ditulis ulang.

---

## 12. Penyimpangan dari Referensi bty

| Di bty (`05-attachments.md`) | Di sini | Alasan |
|---|---|---|
| Kunci `attachments/{ws}/{yyyy}/{mm}/{uuid}-{nama}` | `storage/{user_id}/{id}`, tanpa nama asli | Keputusan eksplisit user: "key tidak tertebak (UUID, bukan nama asli)" — nama tetap tersimpan di kolom `name` untuk tampilan, hanya tidak bocor ke kunci objek |
| `Out: … folders` (attachment flat per task) | Folder bertingkat penuh di area `personal`, siap secara skema di semua area | Frontend (`StorageView.tsx`) sudah mengasumsikan navigasi folder sejak awal; "folder pribadi bebas" adalah kebutuhan baru yang tidak dipunyai bty (aplikasi task-attachment murni) |
| Tanpa kuota total per owner (hanya "maks 20 lampiran per owner") | Kuota **byte** total per user (§4.4, §7) | bty single-tenant SaaS tanpa batas biaya per akun; di sini tiga akun berbagi satu VPS/bucket, kuota per user adalah pagar biaya sekaligus disiplin pemakaian |
| R2 (Cloudflare), alasan utama zero-egress | iDrive e2 (keputusan sudah diambil di spec induk) | Provider berbeda, bentuk API S3-compatible identik — tidak mengubah desain presign/confirm/sweep |
| `owner_id` menunjuk `workspace_id` (multi-tenant) | `owner_id` menunjuk `node`/`agent_project`, dan `user_id` eksplisit di setiap baris | Spec induk §9 menolak `workspace_id`; `user_id` yang dibaca sungguhan di setiap query menggantikannya (infra §4.3) |

Tidak ada penyimpangan pada: alur presign→PUT→confirm, validasi di titik
presign bukan confirm, kedaluwarsa URL (5 menit unggah, 60 detik unduh),
MIME allowlist, larangan `.html`, dan filosofi sweep mingguan berbasis dua
kelas orphan — semuanya diambil apa adanya karena tidak ada alasan
mengubahnya.

---

## 13. Success Criteria

**Upload & validasi**
- [ ] Berkas 10 MB terunggah langsung ke iDrive e2; tidak ada body request
      muncul di log server
- [ ] Berkas 51 MB ditolak **saat presign**, sebelum satu byte terkirim
- [ ] `.exe` dan `.html` ditolak saat presign
- [ ] URL presign tidak bisa dipakai ulang untuk kunci lain atau ukuran
      lebih besar; kedaluwarsa setelah 5 menit
- [ ] Confirm dengan objek yang ukurannya tidak cocok (upload terputus) →
      `409`, baris tetap `pending`

**Kuota**
- [ ] Presign yang melampaui kuota ditolak `422 QUOTA_EXCEEDED` sebelum URL
      diterbitkan
- [ ] `GET /usage` mencerminkan hanya file `status='ready'`

**Folder & file**
- [ ] Folder bertingkat bisa dibuat, di-rename, dipindah di area `personal`
- [ ] Memindahkan folder ke bawah keturunannya sendiri ditolak
- [ ] Memindahkan folder/file lintas area ditolak
- [ ] Menghapus folder menghapus seluruh objek S3 di bawahnya, bukan hanya
      barisnya

**Sweep**
- [ ] Baris `pending` berumur > 24 jam tersapu; yang < 24 jam tidak
- [ ] Area milik task/node yang di-soft-delete > 24 jam tersapu beserta
      objeknya
- [ ] Log sweep menunjukkan jumlah baris dan byte yang diperoleh kembali

**Agent & integrasi lintas-fase**
- [ ] Lampiran task muncul dan bisa diunggah/diunduh dari
      `TaskDetailModal`
- [ ] File yang disisipkan di baris Outline muncul di area `outline` dengan
      `owner` = id baris itu
- [ ] Endpoint generik bisa dipanggil dengan `area=agent&owner=<projectId>`
      tanpa endpoint tambahan

**Sync & isolasi**
- [ ] Storage **tidak** muncul di payload `/api/sync` — endpointnya
      sepenuhnya per-resource
- [ ] **User B mendapat 404 (bukan 403) atas tree, download, rename, dan
      delete milik user A** — kasus baru di `test/isolation.test.ts`

---

## 14. Out of Scope (dengan alasan)

| Ditunda | Alasan & jalur naiknya |
|---|---|
| Thumbnail gambar | Browser sudah merender gambar penuh dari presigned GET; thumbnail butuh pipeline pemrosesan gambar (resize, cache) yang belum terbukti perlu pada volume tiga user |
| Preview dalam-app selain gambar | OS dan browser sudah menampilkan PDF/dokumen dengan baik lewat unduhan; membangun viewer sendiri untuk itu adalah pekerjaan besar untuk kenyamanan kecil |
| Pencarian isi berkas | Butuh ekstraksi teks (PDF, Office) dan indeks tersendiri — proyek sendiri, belum ada bukti dibutuhkan pada skala laci dokumen tiga orang |
| Versi/riwayat berkas | Sama alasannya dengan fase 3 §15 (undo sesi menutupi kesalahan nyata); menimpa berkas yang salah cukup diunggah ulang |
| Share link publik | Bucket privat by design; membuka akses publik adalah keputusan keamanan yang butuh spesifikasinya sendiri, bukan tambahan satu baris |
| Scan virus | Tiga akun tepercaya yang saling kenal; risiko yang scan virus mitigasi (unggahan dari orang asing) tidak ada di sini |
| Resumable upload | Berkas 50 MB di jaringan rumah/kantor jarang butuh resume; kompleksitas multipart-upload tidak sepadan pada batas ukuran sekecil ini |
| Folder berbagi antar user | Sama alasannya dengan `node_share` di fase 1 §14 — menyeret izin dan notifikasi kolaborasi yang belum dibangun di domain manapun |
