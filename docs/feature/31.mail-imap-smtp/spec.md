# Spec: Mail — Client IMAP/SMTP Langsung

> `MailView` (docs/feature/1.mail-client) jadi nyata dengan cara paling
> sederhana yang benar: **proxy IMAP hidup**, model Roundcube. Tanpa cache,
> tanpa tabel pesan, tanpa sync engine. Satu tabel untuk kredensial akun,
> sisanya dibaca dan ditulis langsung ke `imap.hostinger.com` /
> `smtp.hostinger.com` setiap permintaan.

**Status:** v2 · **TERIMPLEMENTASI** — blok A–G merged ke master lewat
`6d798d6` (epic #111), mendahului urutan fase yang direncanakan di bawah.
Spec ini awalnya ditulis sebagai PARKED untuk fase 5 (setelah Todo, Outline,
Agent, dan Storage terbukti dipakai harian —
[`2.backend/spec.md`](../2.backend/spec.md) §1), lalu dikerjakan lebih awal.

Dokumen ini sendiri baru masuk git belakangan, setelah kodenya: spec dan plan
ditulis di lokal tapi tidak ikut ter-commit dari VPS. Checklist di
[`todo.md`](./todo.md) karena itu belum mencerminkan apa yang sudah jalan —
lihat catatan di sana sebelum memakainya sebagai ukuran kesiapan.

**Bergantung pada:** [0.infrastructure](../2.backend/0.infrastructure/spec.md) ·
[spec induk](../2.backend/spec.md) — §3.1 (dua kelas domain), §3.3 (envelope
error) · [3.agent](../2.backend/3.agent/spec.md) §3.1 (pola enkripsi
kredensial & Settings per user, dipakai ulang) ·
[Engineering Policy](../policy/1-engineering-policy.md)

**Terkait:** [1.mail-client/spec.md](../1.mail-client/spec.md) (UI mock, tetap
berlaku sebagai bentuk tampilan) · [1.mail-client/notes.md](../1.mail-client/notes.md)
(diskusi awal — spec ini mengadopsi §5-nya)

---

## 0. Perubahan Arah dari v1 Spec Ini

Versi pertama spec ini merancang **cache Postgres + sync engine dua arah**,
mengikuti [`2.backend/spec.md`](../2.backend/spec.md) §1 ("Mail
menyinkronkan IMAP ke cache Postgres, lalu frontend membaca cache — bukan
mem-proxy IMAP hidup").

**Keputusan itu dibatalkan.** `2.backend/spec.md` §1 harus diperbarui saat
fase ini dimulai; sampai itu terjadi, spec inilah yang berlaku untuk domain
Mail (spec induk sendiri menetapkan: "bila sebuah spec per-fase bertentangan
dengannya, spec per-fase yang menang untuk domainnya sendiri").

Alasannya, dari diskusi 2026-08-12:

- Cache adalah **sumber ~60% kerumitan** spec v1 — sync engine, cursor UID,
  `UIDVALIDITY`, rekonsiliasi flag, deteksi pesan lenyap, sapuan harian,
  tabel `mail_folder`. Semua itu ada untuk melayani cache, bukan untuk
  melayani email.
- Tanpa cache, **konsistensi dua arah tidak perlu dipecahkan sama sekali** —
  membaca langsung dari server berarti selalu mutakhir. Masalah terbesar v1
  lenyap bersama solusinya.
- Ini mengembalikan keputusan asli [`1.mail-client/notes.md`](../1.mail-client/notes.md)
  §5 ("IMAP sendiri sudah database-nya… tanpa tabel, tanpa migrasi, tanpa
  sync"), yang sudah benar sejak awal.
- Roundcube — acuan "webmail sederhana" — memang bekerja begini: frontend
  IMAP hidup, cache database opsional dan bukan inti desainnya.

**Harga yang dibayar sadar:** tiap membuka folder menunggu IMAP (~0,3–1,5
detik), dan tidak ada mode offline. Ini melanggar anggaran performa
[policy §5](../policy/1-engineering-policy.md) ("jaringan tidak pernah ada di
jalur render"), dan pelanggaran itu **diterima khusus untuk Mail**: anggaran
tersebut ditulis untuk pohon Todo/Outline yang disentuh ratusan kali sehari
dan wajib jalan offline. Email dibuka beberapa kali sehari dan setiap klien
mail arus utama pun menampilkan spinner saat memuat folder.

Jalur naiknya bila terbukti mengganggu: §11.

---

## 1. Objective

`MailView` hari ini murni mock — `mailMessages` dari `mockData.ts`, kirim
tidak mengirim ke mana pun. Fase ini menyambungkannya ke mailbox sungguhan
(`pasqa@publion.org` di Hostinger: IMAP `imap.hostinger.com:993`, SMTP
`smtp.hostinger.com:465`, password biasa, tanpa OAuth/bridge).

Selesai berarti: buka Mail → folder dan pesan sungguhan · buka satu pesan →
badan asli, aman dirender · kirim/balas/teruskan → benar-benar terkirim dan
muncul di Sent · Settings punya halaman untuk memasukkan kredensial.

## 2. Scope

**In:** satu akun per user · lima folder (Inbox, Sent, Drafts, Junk, Trash)
plus `Flagged` sebagai smart filter · baca daftar & isi pesan · kirim, balas,
teruskan · tandai baca/tidak, flag/unflag · hapus (pindah ke Trash) ·
pencarian lewat IMAP `SEARCH` · halaman Settings + uji koneksi · sanitasi
HTML + iframe sandbox + blokir remote image.

**Out (alasan di §11):** cache/offline · multi-account · OAuth
(Gmail/Outlook) · unduh isi attachment · push/`IDLE` real-time · thread view ·
address book · expunge permanen.

---

## 3. Bentuk: Proxy, Bukan Sinkronisasi

```
React (better)  →  apps/api (Hono)  →  imap.hostinger.com / smtp.hostinger.com
                    ↑
              satu-satunya state tersimpan:
              baris mail_account (kredensial + host)
```

Setiap permintaan HTTP membuka koneksi IMAP, menjalankan perintahnya, lalu
menutup. Tidak ada connection pool di v1 (§11) — Roundcube pun pada dasarnya
bekerja per-request.

Ini domain **milik-server** (spec induk §3.1): endpoint per-resource, bukan
`POST /sync`. Justifikasinya identik dengan Storage — mailbox IMAP tidak bisa
direplikasi penuh ke Dexie lalu di-merge LWW.

---

## 4. Data Model — Satu Tabel

```ts
export const mailAccount = pgTable('mail_account', {
  id: text('id').primaryKey(),               // UUIDv7, server-generated
  userId: text('user_id').notNull().references(() => appUser.id, { onDelete: 'cascade' }),
  emailAddress: text('email_address').notNull(),
  imapHost: text('imap_host').notNull(),
  imapPort: integer('imap_port').notNull().default(993),
  smtpHost: text('smtp_host').notNull(),
  smtpPort: integer('smtp_port').notNull().default(465),
  username: text('username').notNull(),      // biasanya = emailAddress
  passwordEnc: text('password_enc').notNull(), // AES-256-GCM, §8

  // Path IMAP nyata per peran, dipetakan sekali saat Test Connection (§9)
  inboxPath:  text('inbox_path').notNull().default('INBOX'),
  sentPath:   text('sent_path').notNull(),
  draftsPath: text('drafts_path').notNull(),
  junkPath:   text('junk_path').notNull(),
  trashPath:  text('trash_path').notNull(),
  // Bagaimana tiap peran ditemukan: { sent: 'extension' | 'name', ... }
  folderRoleSource: jsonb('folder_role_source').notNull().$type<Record<string, string>>(),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('mail_account_user').on(table.userId),   // satu akun per user di v1
])
```

**Tidak ada tabel pesan.** Itu inti perubahan v2.

Keempat path non-inbox wajib terisi (tanpa `default`) — hanya alur Test
Connection (§9) yang mengisinya. Akun tidak bisa disimpan sebelum keempatnya
terpetakan: mengirim tanpa tahu path Sent yang benar membuat `APPEND` (§7)
diam-diam gagal atau masuk folder salah.

`folderRoleSource` merekam apakah peran itu **diiklankan server**
(`specialUse` dari ekstensi IMAP) atau hanya **ditebak dari nama folder** —
`imapflow` membedakannya lewat `specialUseSource`. Tebakan-dari-nama adalah
kandidat utama bug "email terkirim masuk folder salah" di hosting cPanel;
kolom ini yang menjawabnya dalam sepuluh detik alih-alih satu sesi debug.

---

## 5. Identitas Pesan & Kontrak Tipe Frontend

Tanpa cache, tidak ada id lokal. Identitas sebuah pesan adalah
**`(folder, uid)`**, dan `uid` hanya bermakna dalam satu folder dengan satu
`uidValidity`.

[`CLAUDE.md`](../../CLAUDE.md) mewajibkan API dibentuk agar cocok dengan tipe
frontend, bukan sebaliknya. Pemetaannya di DTO:

| Tipe frontend (`types/index.ts`) | Diisi dari |
|---|---|
| `id: string` | `` `${folder}:${uid}` `` — stabil selama `uidValidity` folder tidak berubah |
| `folder: MailFolder` | peran folder (`inbox`/`sent`/…), dipetakan dari path IMAP lewat kolom peran §4 |
| `sender`, `senderEmail` | `envelope.from[0]` |
| `subject` | `envelope.subject` |
| `body: string` | bagian `text/plain` |
| `receivedAt: string` | `internalDate`, ISO |
| `isRead`, `isFlagged` | flag `\Seen`, `\Flagged` |
| `inReplyTo?: string` | header `In-Reply-To` |
| `attachments?: string[]` | nama bagian attachment dari `bodyStructure` (metadata saja, §11) |

Satu field **ditambahkan** ke tipe frontend: `bodyHtml?: string`. Ini
diizinkan justru oleh aturan yang sama — UI memang membutuhkannya (reading
pane merender HTML di iframe, §8), dan spec induk §3.3 mensyaratkan field
baru bersifat aditif dan opsional. `body` (teks) tetap ada sebagai fallback
untuk email tanpa bagian HTML.

`MailFolder` di tipe frontend tetap union literal (`'inbox' | 'sent' | …`) —
path IMAP nyata tidak pernah bocor ke frontend.

---

## 6. Endpoint HTTP

```
GET    /api/mail/account                     akun user (password tidak pernah dikembalikan)
PUT    /api/mail/account                     { emailAddress, imapHost, imapPort, smtpHost, smtpPort, username, password }
DELETE /api/mail/account
POST   /api/mail/account/test                uji koneksi tanpa menyimpan (§9)

GET    /api/mail/folders                     lima folder + jumlah total/unread (IMAP STATUS)
GET    /api/mail/messages?folder=&limit=&beforeUid=
GET    /api/mail/messages/:uid?folder=       isi penuh satu pesan
PATCH  /api/mail/messages/:uid?folder=       { isRead?, isFlagged? }
DELETE /api/mail/messages/:uid?folder=       MOVE ke Trash
POST   /api/mail/send                        { to, cc?, subject, bodyText, bodyHtml?, inReplyToId? }
```

- **`inReplyToId`** adalah id komposit `folder:uid` (§5) milik pesan yang
  dibalas — **bukan** header `Message-ID`. Server yang mengambil pesan itu
  dari IMAP lalu membaca `Message-ID`/`References` aslinya (§7 langkah 2);
  klien tidak pernah perlu tahu header mentahnya.
- **`folder=flagged`** bukan folder IMAP — ia menjalankan `SEARCH FLAGGED`
  pada kelima folder dalam satu koneksi lalu menggabungkan hasilnya, persis
  smart filter yang sudah didefinisikan `1.mail-client/spec.md`. Karena UID
  hanya bermakna dalam satu folder, `beforeUid` **tidak berlaku** di sini:
  `flagged` mengembalikan maksimum `limit` pesan terbaru per folder tanpa
  paginasi. Bila jumlah pesan ber-flag pernah tumbuh melewati batas itu,
  paginasinya butuh kursor lain (mis. tanggal) — dan itu bukan masalah pada
  satu mailbox pribadi.
- **Pencarian** memakai IMAP `SEARCH` di server, bukan filter di aplikasi
  kita. Ini keuntungan tak terduga dari model live: v1 spec sebelumnya harus
  menspesifikasikan `ILIKE` atas cache, sementara di sini pencarian
  server-side sudah tersedia gratis dan lebih baik.
- **Paginasi** lewat `beforeUid` (ambil `limit` pesan dengan UID lebih kecil),
  bukan offset — UID monoton naik, jadi ini kursor alami dan tidak bergeser
  saat email baru masuk. Batas default 50, maksimum 200; endpoint list selalu
  berbatas sejak hari pertama (spec induk §3.3).
- Semua endpoint memuat `WHERE user_id = :session` saat mengambil akun. Akun
  milik user lain → **404**, bukan 403 (spec induk §3.3).
- **`DELETE`** memindahkan ke Trash (`messageMove`), tidak menghapus permanen
  — perilaku yang sama dengan Apple Mail dan webmail biasa.

### 6.1 Kegagalan IMAP adalah keadaan kelas satu

Karena tidak ada cache, IMAP mati berarti Mail tidak bisa dipakai — dan itu
harus terlihat jujur, bukan jadi layar kosong. Pemetaannya:

| Kondisi | Respons |
|---|---|
| Login IMAP/SMTP ditolak | `401` kode `MAIL_AUTH_FAILED` — UI mengarahkan ke Settings |
| Host tidak terjangkau / timeout | `503` kode `MAIL_UNAVAILABLE` — UI menawarkan "coba lagi" |
| Akun belum dikonfigurasi | `404` kode `MAIL_NOT_CONFIGURED` — UI menampilkan CTA ke Settings |

---

## 7. Kirim — SMTP + APPEND ke Sent + Threading

Dua jebakan dari [`notes.md`](../1.mail-client/notes.md) §9, ditegakkan
sebagai langkah wajib:

```
POST /api/mail/send
  1. validasi input (Zod: to non-empty & valid, subject, body)
  2. bila inReplyToId ada: urai jadi folder+uid, ambil pesan sumber dari
     IMAP, baca Message-ID dan References-nya, lalu susun:
       In-Reply-To: <message-id sumber>
       References:  <references sumber> <message-id sumber>
       Subject:     prefiks 'Re: ' / 'Fwd: ' bila belum ada
  3. nodemailer.sendMail() → simpan raw MIME hasilnya
  4. IMAP APPEND raw MIME yang sama ke sentPath, flag ['\Seen']
  5. SMTP sukses tapi APPEND gagal → tetap 200 (email SUDAH terkirim,
     haram dilaporkan gagal), sertakan warning di respons agar UI bisa
     memberi tahu bahwa salinan Sent mungkin tidak tersimpan
```

Tanpa langkah 4, user mengirim email lalu membuka Sent dan menemukannya
kosong — SMTP hanya mengirim, tidak pernah menyimpan salinan.

Tanpa langkah 2, threading rusak di sisi penerima: `Subject: "Re: …"` saja
tidak cukup.

---

## 8. Keamanan

**Kredensial.** `passwordEnc` dienkripsi AES-256-GCM dengan
`APP_ENCRYPTION_KEY`, memakai ulang helper `modules/agent/crypto.ts`. Helper
itu **dipindah** ke lokasi bersama (mis. `apps/api/src/http/crypto.ts`) karena
kini dipakai dua modul — refactor murni, format enkripsi tidak berubah.
`GET /account` tidak pernah mengembalikan password dalam bentuk apa pun,
hanya field non-sensitif + `hasPassword: true`.

**Body HTML adalah permukaan serangan.** Tiga lapis, wajib sejak commit
pertama — menambahkannya belakangan berarti membongkar reading pane yang
sudah jadi:

1. **Sanitasi server** — DOMPurify atas `bodyHtml` sebelum dikirim ke klien.
2. **Blokir remote image** — pada langkah sanitasi yang sama, `src`,
   `srcset`, dan `background` pada elemen gambar dipindah ke
   `data-blocked-src`. Tombol "Tampilkan gambar" di klien mengembalikannya
   sebelum `srcdoc` iframe ditulis. Ini mencegah tracking pixel memberi tahu
   pengirim bahwa email dibuka — perilaku standar setiap klien mail arus
   utama. Proxy gambar ala Gmail ditolak: menambah endpoint, cache biner, dan
   permukaan SSRF untuk manfaat tipis pada satu mailbox pribadi.
3. **`<iframe sandbox>`** — tanpa `allow-scripts`, tanpa `allow-same-origin`.
   Lapis terakhir terhadap bypass sanitizer yang belum ditemukan, sekaligus
   mencegah CSS pengirim membajak layout aplikasi.

**TLS wajib.** Port 993/465 dengan TLS implisit. Tidak ada opsi STARTTLS
maupun plaintext di v1 — menyederhanakan config dan menutup downgrade attack.

**Isolasi antar user.** Setiap query `mail_account` menyertakan `user_id` dari
sesi; kasus barunya masuk `test/isolation.test.ts` (§10).

### 8.1 Aturan pemakaian `imapflow` (hasil riset, bukan ditemukan saat debug)

- **`disableAutoIdle: true` wajib.** Auto-IDLE menyala secara default; karena
  koneksi kita berumur pendek, IDLE hanya menambah dua round-trip yang harus
  dipatahkan perintah berikutnya.
- **Jangan jalankan perintah IMAP lain di dalam loop `fetch()`** — pustakanya
  memperingatkan ini bisa deadlock. Pakai `fetchAll()` yang mengembalikan
  array, lalu lakukan perintah lanjutan setelah loop selesai.
- **Serialisasi lewat `getMailboxLock(path)` / `lock.release()`** untuk semua
  pekerjaan per-mailbox.
- `append(path, content, flags, idate)` menerima flag sebagai **argumen
  posisional ketiga**, bukan objek opsi.
- Peran folder dibaca dari `list()`: `specialUse` (satu string, mis.
  `'\\Sent'`) dan `specialUseSource` (`'extension'` bila diiklankan server,
  `'name'` bila ditebak dari nama).

---

## 9. Settings — Halaman Akun Mail

Mengikuti pola yang sudah ada untuk Settings AI Agent (`3.agent` §3.1,
`settings-routes.ts`): satu form, `GET`/`PUT`, field password kosong berarti
"tidak diubah" saat update.

```
isi form → submit → PUT /api/mail/account
  → server menjalankan Test Connection dulu SEBELUM menulis baris:
      · IMAP login
      · SMTP verify
      · list() → petakan kelima peran folder + folderRoleSource
  → gagal → 422 dengan pesan spesifik ("IMAP login gagal: kredensial
    ditolak", bukan error generik); tidak ada baris tersimpan setengah jadi
  → sukses → baris ditulis
```

Tombol "Test connection" terpisah (`POST /account/test`) menjalankan alur yang
sama tanpa menyentuh database.

---

## 10. Testing

| Level | Cakupan |
|---|---|
| Unit | Penyusun header threading (`In-Reply-To`/`References` dari pesan sumber) · resolusi peran folder dari hasil `list()` — jalur `specialUse` maupun fallback nama · sanitasi: `<script>`, `onerror=`, `javascript:` href, dan **pemindahan `src` → `data-blocked-src`** · pembentuk & pengurai id `folder:uid` |
| Integrasi | Lawan mailbox test sungguhan (bukan mock IMAP — protokolnya terlalu mudah ditiru salah): daftar folder & pesan terbaca · kirim → `APPEND` → tampak di Sent · balas menghasilkan header threading benar · flag/read toggle tercermin di server · `DELETE` memindahkan ke Trash · IMAP mati → `503`, kredensial salah → `401` · isolasi: user B mendapat 404 atas akun user A |
| E2E | Buka Mail tanpa akun → CTA ke Settings · kredensial salah → pesan spesifik · kredensial benar → inbox terisi · buka pesan → gambar terblokir sampai tombol ditekan, tidak ada script berjalan · balas → terkirim → muncul di Sent |

---

## 11. Out of Scope (dengan alasan & jalur naiknya)

| Ditunda | Alasan & jalur naiknya |
|---|---|
| **Cache / offline** | Inti keputusan §0. Jalur naik bila latensi terbukti mengganggu setelah dipakai harian: mulai dari **connection pool berumur pendek** (koneksi IMAP per user, ditutup setelah ~2 menit idle) — ini menghapus biaya TLS+LOGIN per permintaan dan hampir pasti cukup. Cache pesan penuh baru dipertimbangkan sesudah itu, dan kalau sampai ke sana, spec v1 di riwayat git sudah memuat rancangan sync dua arahnya |
| **`IDLE` / push real-time** | Butuh koneksi persisten per akun; polling manual (tombol refresh) cukup untuk satu mailbox pribadi |
| Multi-account | Skema tidak menutup jalan (tinggal lepas unique index), tapi UI sidebar per-akun adalah desain baru yang belum diminta |
| OAuth (Gmail/Outlook) | Butuh flow OAuth tersendiri; provider yang dipakai tidak membutuhkannya |
| Unduh isi attachment | Nama dan keberadaannya sudah tampil dari `bodyStructure`; menyajikan byte-nya menyeret kuota dan validasi yang sudah punya rumah sendiri di [4.storage](../2.backend/4.storage/spec.md) |
| Thread/conversation view | Header threading sudah dikirim benar saat membalas; mengelompokkan tampilan jadi thread adalah keputusan desain terpisah |
| Address book | `to`/`from` tetap teks bebas di compose |
| Expunge permanen dari Trash | `DELETE` hanya memindahkan; pengosongan Trash butuh konfirmasi UI tersendiri |
| Draft tersimpan di server | Compose yang dibatalkan hilang, sama seperti UI mock sekarang; menyimpan ke folder Drafts lewat `APPEND` adalah tambahan kecil bila ternyata dibutuhkan |

---

## 12. Success Criteria

**Baca**
- [ ] Kelima folder tampil dengan jumlah pesan/unread benar
- [ ] Daftar pesan terpaginasi (`beforeUid`), tidak pernah menarik seluruh folder
- [ ] `Flagged` mengumpulkan pesan ber-flag lintas kelima folder
- [ ] Pencarian memakai IMAP `SEARCH`, bukan penyaringan di sisi aplikasi

**Kirim**
- [ ] Email terkirim muncul di Sent (`APPEND` berhasil)
- [ ] Balasan membawa `In-Reply-To`/`References` benar — diverifikasi threading-nya di klien mail lain
- [ ] SMTP sukses + `APPEND` gagal tetap dilaporkan sebagai terkirim

**Keamanan**
- [ ] `GET /account` tidak pernah membocorkan password
- [ ] `<script>`/`onerror=` tidak pernah tereksekusi
- [ ] Remote image tidak dimuat sampai user menekan "Tampilkan gambar"
- [ ] User B mendapat 404 atas akun user A

**Kegagalan**
- [ ] IMAP mati → `503` dengan UI "coba lagi", bukan layar kosong
- [ ] Kredensial salah → `401` yang mengarahkan ke Settings
- [ ] Belum dikonfigurasi → CTA ke Settings, bukan mail kosong yang membingungkan

**Settings**
- [ ] Kredensial salah ditolak dengan pesan spesifik sebelum baris tersimpan
- [ ] Kelima peran folder terpetakan untuk Hostinger tanpa hardcode nama
