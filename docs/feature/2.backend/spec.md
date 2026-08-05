# Spec Induk: Backend Node.js

> Depan **React**, belakang **Node.js**. Enam fase berurutan, masing-masing
> punya spec sendiri. Dokumen ini memuat yang berlaku lintas-fase: urutan,
> keputusan pokok, konvensi, dan batas.

**Status:** v3 · **Tanggal:** 2026-08-05 · **Mengikat:**
[Engineering Policy](../../policy/1-engineering-policy.md)

Dokumen ini **satu-satunya sumber kebenaran lintas-domain**. Bila sebuah spec
per-fase bertentangan dengannya, spec per-fase yang menang untuk domainnya
sendiri. Tidak ada dokumen ketiga: catatan desain lama sudah diserap ke sini
dan dihapus.

---

## 1. Peta Fase

| Fase | Domain | Spec | Selesai berarti |
|---|---|---|---|
| **0** | Infrastruktur & boilerplate | [0.infrastructure](0.infrastructure/spec.md) | API sehat: auth multi-user, error envelope, deploy jalan |
| **1** | Todo — paritas Todoist | [1.todo](1.todo/spec.md) | Dogfood: dua minggu tanpa membuka Todoist |
| **2** | Outline — Workflowy + `@task` | [2.outline](2.outline/spec.md) | Catatan harian pindah ke sini, dan barisnya bisa naik jadi task |
| **3** | Agent — AI via openagentic.id, kontrol penuh atas Todo | [3.agent](3.agent/spec.md) | Asisten membaca memorinya, menambah subtask, menyusun time-blocking, memberi rekomendasi |
| **4** | Storage — drive di iDrive e2 | *menyusul* | Lampiran task, file outline, dan file agent punya rumah |
| **5** | Mail — IMAP/SMTP | *menyusul* | `pasqa@publion.org` terbaca dan terkirim dari sini |

Tiap fase selesai dan **dipakai** sebelum fase berikutnya dimulai. Urutan ini
sendiri adalah mitigasi risiko terbesar proyek: satu alur harian yang lengkap
lebih berharga daripada lima alur yang setengah jalan.

### Arah yang membentuk fase 3–5 (detailnya menyusul di specnya masing-masing)

- **Storage** adalah infrastruktur file untuk seluruh aplikasi — lampiran
  Todo, file Outline, dan berkas `.md` Agent — masing-masing dipisah ke area
  sendiri, ditambah folder manual tempat user mengunggah dokumen. Objeknya di
  **iDrive e2** (S3-compatible), diunggah langsung dari browser lewat
  presigned URL sehingga byte tidak pernah lewat server aplikasi.
- **Agent** ditenagai [openagentic.id](https://openagentic.id/docs): base URL
  dan API key dimasukkan **per user di Settings**, model dipilih di sana juga.
  Ia bukan sekadar penulis dokumen — ia membaca dan menulis task: menambah
  subtask, menyusun jadwal time-blocking yang masuk akal, memberi rekomendasi.
  Kolom `due_time` dan `duration_min` sudah disiapkan sejak fase 1 untuk itu.
- **Mail** menyinkronkan IMAP ke cache Postgres, lalu frontend membaca cache —
  bukan mem-proxy IMAP hidup. Dua jebakan sudah tercatat di
  [1.mail-client/notes.md](../1.mail-client/notes.md) §10: SMTP tidak menaruh
  salinan di folder Sent (perlu IMAP `APPEND` manual), dan reply butuh header
  `In-Reply-To`/`References`. Non-negosiabel sejak render pertama: DOMPurify
  + `<iframe sandbox>`.

---

## 2. Keputusan Pokok

Enam keputusan yang membentuk semua yang lain. Mengubah salah satunya berarti
menulis ulang, bukan menambal.

### 2.1 Tidak ada entitas `Task` yang terpisah dari `OutlineNode`

Yang ada hanya **node**. Node yang punya `due_date` atau `priority` *adalah*
task; view Todo adalah filter atas pohon yang sama. Empat entitas frontend
(`Task`, `Project`, `Section`, `OutlineNode`) melebur jadi satu tabel, dengan
kolom `kind` yang membedakan `project` · `section` · `item`.

Alternatifnya — dua tabel yang saling merujuk — ditolak karena melahirkan dua
sistem urutan, dua jalur sync, dan dua tumpukan undo. Seret kartu di Board
akan jadi implementasi yang berbeda dari indent di Outline, dan "pindahkan
task dari kolom board ke sub-bagian outline" berubah dari operasi biasa
menjadi kasus khusus.

Section tetap kelas satu, tapi tinggal di tabel yang sama. Hadiah dari
keputusan ini: fitur "task terhubung outline" tidak perlu dibangun — ia sudah
ada secara struktural.

### 2.2 Id UUIDv7, digenerate klien

Node bisa dibuat saat offline tanpa rekonsiliasi id, dan karena time-ordered,
B-tree tetap sehat. Id dari server akan memaksa setiap pembuatan menunggu
jaringan — persis yang dilarang §3.

### 2.3 `rank` fractional index, bukan `order` integer

Memindahkan satu baris menulis **satu** baris. Integer `order` menulis ulang
seluruh sibling setiap perpindahan, yang di lingkungan multi-device berarti
konflik terus-menerus atas baris yang sebenarnya tidak disentuh siapa pun.

Risiko yang diterima: string `rank` memanjang bila banyak penyisipan di posisi
yang sama. Mitigasinya ditulis sejak awal di `core/rank.ts` — rebalance
per-induk di atas ambang panjang.

### 2.4 `deleted_at`, bukan `DELETE`

Baris yang lenyap tidak bisa disinkronkan — perangkat lain tidak punya cara
tahu ia pernah ada. Efek sampingnya menyenangkan: undo menjadi mungkin tanpa
membangun apa pun.

### 2.5 `seq` terpisah dari `updated_at`

`seq` adalah bilangan dari sequence Postgres yang di-bump server setiap
tulisan, dan itulah kursor sync. Timestamp tidak layak jadi kursor: ia bisa
tabrakan dan bisa mundur.

**Satu sequence untuk seluruh instalasi**, ditarik semua tabel yang
disinkronkan, sehingga satu kursor cukup untuk banyak entitas.

### 2.6 `updated_at` di-stamp klien — dasar LWW

Konflik diselesaikan **last-write-wins pada level baris**, memakai
`updated_at` dari klien. Kalau server yang men-stamp, suntingan offline yang
lebih lama bisa mengalahkan suntingan online yang lebih baru — persis
kebalikan dari yang diinginkan.

Risiko yang diterima: ini bergantung pada jam perangkat yang waras. Jalur
naiknya bila terbukti bermasalah: LWW per-field, lalu hybrid logical clock.
CRDT/Yjs ditolak — konfliknya hanya antar perangkat orang yang sama, dan LWW
sudah cukup untuk itu.

---

## 3. Pendekatan & Kontrak Lintas-Domain

### 3.1 Dua kelas domain, dua bentuk API

1. **Milik-lokal (Todo + Outline).** Sumber kebenaran di klien (Dexie); server
   adalah replika dan titik temu antar perangkat. Satu endpoint `POST /sync`,
   LWW, kursor `seq`. Tanpa REST CRUD.
2. **Milik-server (Storage, Agent, Mail).** Sumber kebenarannya tidak mungkin
   di klien: byte file ada di iDrive, percakapan di-stream dari provider,
   mailbox ada di server IMAP. Ketiganya memakai **endpoint HTTP
   per-resource**.

Policy §2 melarang REST CRUD tanpa justifikasi tertulis. **Ini
justifikasinya** (policy §9): `/sync` mensyaratkan data yang bisa direplikasi
penuh ke klien dan di-merge dengan LWW. Blob biner, stream SSE, dan mailbox
IMAP tidak memenuhi syarat itu; memaksakannya berarti membangun ulang
presigned-upload, streaming, dan IMAP di atas protokol yang salah bentuk.

### 3.2 Jaringan tidak pernah ada di jalur render

```
ketik → operasi pohon in-memory (UI berubah di sini, < 16 ms)
      → tulis ke Dexie
      → antre ke outbox
      → worker POST /sync kapan pun sempat
      → server simpan, bump seq, balas perubahan sejak kursor
      → merge (LWW), majukan kursor
```

Server mati = aplikasi tetap berfungsi penuh dengan banner "offline". Anggaran
performa (policy §5, angka bukan perasaan): tap → UI < 16 ms tanpa jaringan;
buka app → pohon tampil < 300 ms dari Dexie; bundle JS awal < 200 KB gzip.

### 3.3 Bentuk error, satu untuk semua

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": {} } }
```

400 input rusak · 401 tanpa sesi · **404 untuk milik orang lain maupun tidak
ada** (403 pada resource user lain membocorkan keberadaannya) · 409 konflik ·
422 validasi gagal · 429 rate limit · 500 tanpa detail internal.

Zod di setiap boundary; body bertipe `unknown` di-`safeParse` dulu. Respons
pihak ketiga (openagentic, IMAP, iDrive) juga data tak terpercaya. Field baru
selalu aditif dan opsional. Endpoint list selalu berbatas sejak hari pertama.

### 3.4 Penanganan kegagalan

| Kondisi | Perilaku |
|---|---|
| Offline / 5xx | Perubahan tetap di outbox, backoff eksponensial, banner; UI tidak pernah memblok |
| Sesi kedaluwarsa | Redirect login, **outbox dipertahankan**, di-flush setelah login ulang |
| Konflik | LWW diam-diam, tanpa dialog |
| Token tak dikenali di input | Tetap jadi teks judul — **tidak pernah dibuang diam-diam** |

Data tidak pernah meninggalkan outbox sebelum server mengonfirmasi.

### 3.5 Konvensi token — satu bahasa di seluruh aplikasi

Berlaku identik di quick add Todo, baris Outline, dan komposer Agent. Empat
sigil, tidak pernah berganti arti antar-permukaan:

| Sigil | Arti | Sifat | Contoh |
|---|---|---|---|
| `#` | **project** — tempat / lingkup | struktural: menentukan *di mana* | `#Travel` |
| `@` | **task / project** — sebutan | rujukan inline hidup | `@Bikin spec produk` |
| `$` | **label** | atribut baris | `$penting` |
| `!` | **prioritas** 1–4 | atribut baris | `!1` |

Ini menyelesaikan tabrakan sebelumnya, di mana `@` berarti label di Todo
tetapi task di Outline — satu simbol, dua arti, tergantung layar. Sekarang
`@` selalu berarti "sebut sesuatu" dan `#` selalu berarti "taruh di sini".

Konsekuensi: prioritas ditulis `!1`–`!4`, **bukan** `p1`–`p4` ala Todoist; dan
negasi di bahasa filter memakai `-`, bukan `!`, agar `!` bebas untuk prioritas.

### 3.6 Tanggal

Ditulis dengan **bahasa natural saat mengetik** — "besok jam 9" langsung
menjadi tanggal, dengan potongan yang dikenali disorot **sebelum** Enter dan
`Esc` untuk membatalkannya. Ini menggantikan rancangan lama yang mewajibkan
kurung siku `[besok]`; kurung dipilih dulu karena takut parser mencuri kata
dari judul, dan risiko itu kini ditebus oleh penyorotan plus pembatalan satu
tombol.

`DATE` untuk tanggal kalender, `TIMESTAMPTZ` untuk kejadian. Timezone hidup
di **user**, bukan perangkat — supaya HP, laptop, dan penjadwal reminder di
server sepakat soal apa arti "hari ini".

---

## 4. Arsitektur

Monorepo npm workspaces, tanpa Turborepo/Nx. Struktur lengkap dan urutan
middleware ada di [0.infrastructure](0.infrastructure/spec.md) §3.

**Inti murni, tepi tipis** — aturan struktural terpenting (policy §3).
`packages/core` tidak boleh punya I/O: tanpa `fetch`, tanpa `db`, tanpa
`localStorage`, tanpa `Date.now()` tersembunyi (waktu dioper sebagai argumen).
Seluruh logika menarik tinggal di sana: aturan pohon, urutan, filter view,
parser. Sebuah `if` yang mengungkapkan aturan bisnis di dalam komponen React
atau route handler berada di tempat yang salah.

**Uji strukturalnya satu kalimat:** kalau sebuah aturan tidak bisa dites tanpa
menyalakan browser atau database, ia ada di tempat yang salah.

| Lapisan | Pilihan |
|---|---|
| Runtime | Node.js 22 LTS |
| HTTP | Hono + `@hono/node-server` — bukan Express, bukan folder `server/` |
| DB | PostgreSQL 16 + Drizzle (SQL tetap terlihat) |
| Store lokal | Dexie (IndexedDB) |
| Validasi | Zod |
| Auth | argon2id + cookie HMAC (Better Auth saat user keempat) |
| S3 | `@aws-sdk/client-s3` + presigner → iDrive e2 |
| AI | Vercel AI SDK (`@ai-sdk/openai-compatible`) → openagentic.id |
| IMAP/SMTP | `imapflow` + `nodemailer` |
| Frontend | React 19 + TS + Vite + CSS polos — **tidak berubah** |
| Test | Vitest; integrasi lawan Postgres asli; Playwright seperlunya |
| Deploy | 1 VPS, docker compose (api + postgres + caddy) |

Frontend tidak dipindah ke Tailwind: itu akan membuang ekstraksi runtime
Todoist yang jadi alasan tampilannya terasa benar. Library yang dipakai di
satu tempat dibungkus satu file agar bisa dicabut (policy §6).

---

## 5. Multi-User

Tiga akun (owner, istri, teman), dibuat lewat CLI di server, **tanpa sign-up
publik**. Data terisolasi penuh — tidak ada yang melihat task, file, chat,
atau mail milik yang lain.

Setiap tabel domain membawa `user_id NOT NULL` + index sejak migrasi
pertamanya, dan setiap query difilter dari sesi — **tidak pernah dari body
request**. RLS Postgres ditunda: tiga user yang saling percaya, dengan `WHERE`
dan tes isolasi sebagai pagarnya. RLS menjadi satu migrasi pengerasan kapan
saja, karena kolomnya sudah ada dan terisi — bagian yang mahal sudah dibayar.

**Tes isolasi adalah tes terpenting repositori ini**, dan setiap fase wajib
menambahkan kasusnya sendiri ke sana.

Detail: [0.infrastructure](0.infrastructure/spec.md) §4.

---

## 6. Testing

Policy §7 — tes yang bisa salah, bukan pass-through; **tanpa mock database**.

| Level | Cakupan |
|---|---|
| Unit | Seluruh `packages/core`. Empat modul wajib **100% branch** karena bugnya diam: `rank`, `parse`, `recurrence`, `edit` (surgical editor, fase 4) |
| Integrasi | Lawan Postgres asli: sync (LWW, tombstone, kursor tertinggal, batch), penjadwal reminder, kontrak tool agent, isolasi antar user |
| E2E | Sedikit, hanya jalur yang benar-benar dipakai harian |

Komponen React tidak dites satuan. Tes yang gagal acak diperbaiki atau
dihapus hari itu juga — tes flaky lebih buruk daripada tidak ada tes.

---

## 7. Deploy & Backup

`docker compose`: `api` (image multi-stage, migrasi jalan sebelum listen),
`postgres:16` + volume bernama, `caddy` (menyajikan `apps/web/dist`, mem-proxy
`/api`, HTTPS otomatis).

Backup diaktifkan **bersama fase 1**, begitu ada data asli: cron host
`pg_dump --format=custom | gzip` ke bucket iDrive, 02:00, retensi 30 harian.
**Backup yang belum pernah di-restore bukan backup** — restore bulanan ke
database scratch dengan pembandingan jumlah baris adalah bagian dari
definisinya.

---

## 8. Batas

**Selalu:** `npm run verify` sebelum commit · Zod di setiap boundary ·
`user_id` ditulis dan **dibaca** di setiap query · index menyertai setiap FK
dan kolom yang difilter · spec di-update di commit yang sama dengan perubahan
perilaku · bug diperbaiki dengan tes yang gagal dulu.

**Tanya dulu:** dependency runtime baru · drop/rename kolom · menambah atau
mengubah tool agent · background job di luar yang sudah disebut spec ·
menarik pekerjaan fase depan ke fase berjalan.

**Tidak pernah:** commit `.env` atau kunci · rich-text editor atau
`contenteditable` · akses web, shell, atau eksekusi kode untuk agent
(permanen) · kunci API di respons, log, atau plaintext database · edit tangan
folder `drizzle/` · `any`/`@ts-ignore` tanpa komentar alasan · hapus atau
`.skip` tes yang gagal demi CI hijau.

---

## 9. Yang Ditolak, dan Alasannya

Dicatat supaya tidak diusulkan ulang tiap beberapa bulan:

| Ditolak | Alasan |
|---|---|
| Dua tabel `tasks` + `outline_nodes` | §2.1 — dua urutan, dua jalur sync, dua undo |
| Markdown sebagai sumber, task di-parse dari teks (gaya Obsidian Tasks) | Metadata task canggung di dalam teks, dan menyunting berubah jadi masalah parser |
| `Section` sebagai tabel sendiri | Menghidupkan lagi dua sistem urutan |
| `order` integer, id dari server | §2.2, §2.3 |
| CRDT / Yjs | §2.6 — konflik hanya antar perangkat sendiri |
| REST CRUD per-resource untuk Todo/Outline | §3.1 |
| Redux / Zustand / MobX | State-nya satu pohon; store sendiri di atas Dexie lebih kecil |
| Serverless | Tidak perlu sekarang, dan akan menutup jalan bagi mail sync yang butuh koneksi panjang |
| Next.js fullstack | Frontend React yang ada sudah berharga dan tidak ditulis ulang |
| `workspace_id` ala multi-tenant | §5 — `user_id` yang dibaca sungguhan lebih jujur daripada kolom yang ditulis tapi diabaikan |
| Sign-up publik, reset password lewat email | Tiga akun; CLI lebih murah dan tidak membuka pintu |

---

## 10. Risiko

- **LWW bergantung jam perangkat.** Diterima untuk sekarang; eskalasi di §2.6.
- **`rank` memanjang** di posisi yang sama — rebalance ditulis sejak awal.
- **Rate limit openagentic.id** pada tier gratis — 429 diperlakukan sebagai
  keadaan kelas satu di UI, bukan kegagalan generik.
- **Quirk folder IMAP Hostinger** — dipetakan lewat kolom peran, bukan
  di-hardcode.
- **Kegagalan dogfood adalah risiko utama proyek.** Mitigasinya adalah urutan
  fase itu sendiri: satu alur harian yang lengkap sebelum menyentuh yang lain.
