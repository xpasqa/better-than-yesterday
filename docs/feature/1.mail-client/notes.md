# Catatan: Mail client jadi nyata (IMAP + SMTP)

**Tanggal:** 2026-08-05
**Status:** diskusi, belum disetujui, belum ada rencana implementasi
**Policy:** tunduk pada [`docs/policy/1-engineering-policy.md`](../../policy/1-engineering-policy.md)
**Terkait:** [`spec.md`](./spec.md) (UI mock) · [`../2.backend/notes.md`](../2.backend/notes.md)

---

## 1. Kenapa catatan ini ada

[`spec.md`](./spec.md) mendefinisikan Mail sebagai **UI mock murni** — tiruan Apple Mail
tiga kolom, data dari `mockData.ts`, compose/reply tidak mengirim ke mana pun. Itu masih
berlaku dan tidak dibatalkan.

Catatan ini merekam diskusi terpisah: **membuat Mail benar-benar membaca dan mengirim
email lewat IMAP/SMTP.** Ini pekerjaan yang berbeda, dengan konsekuensi arsitektur yang
belum pernah dibahas di dokumen mana pun.

## 2. Fakta yang mengubah keputusan sebelumnya

[`../2.backend/notes.md` §3](../2.backend/notes.md) mengeluarkan Email dari v1 dengan
alasan tertulis:

> Email penulis di Proton — tidak ada IMAP tanpa Proton Bridge. Proyek terpisah.

**Premis ini sudah tidak berlaku.** Penulis punya mailbox Hostinger/Niagahoster dengan
IMAP dan SMTP biasa, tanpa OAuth, tanpa bridge:

| Protokol | Host | Port | TLS |
|---|---|---|---|
| IMAP (masuk) | `imap.hostinger.com` | 993 | ya |
| SMTP (keluar) | `smtp.hostinger.com` | 465 | ya |
| Akun | `pasqa@publion.org` | — | password biasa |

POP3 (`pop.hostinger.com:995`) diabaikan — POP3 menarik lalu menghapus, tidak ada konsep
folder maupun state dibaca/belum dibaca.

CNAME `autodiscover`/`autoconfig` diabaikan — itu hanya supaya Outlook/Apple Mail bisa
mendeteksi setting otomatis. Hostname kita simpan sendiri di config.

**Ini tidak otomatis memasukkan Email ke v1.** Yang gugur hanya alasan teknisnya. Alasan
prioritas — v1 adalah membuktikan dogfood todo+outline — masih berdiri utuh.

## 3. Keputusan bentuk: webmail client, bukan mail server

Kita **tidak** menjalankan mail server. Hostinger yang mengurus MX record, filter spam,
penyimpanan mailbox, SPF/DKIM, dan reputasi IP. Kita hanya client, seperti Roundcube atau
Thunderbird.

```
React (better)  →  API kita  →  imap.hostinger.com / smtp.hostinger.com
```

Alternatif yang ditolak:

| Alternatif | Kenapa ditolak |
|---|---|
| Mail server sendiri (Haraka, `smtp-server`) | Spam, TLS, reverse DNS, reputasi IP. Tidak sepadan untuk satu mailbox. |
| Webhook inbound (Mailgun Routes, Postmark Inbound) | Hanya menerima email baru ke alamat khusus. Tidak bisa membaca inbox yang sudah ada, tidak bisa mengirim atas nama alamat sendiri. Cocok untuk "email → task", bukan untuk mail client. |
| Gmail API + Pub/Sub push | Butuh OAuth + Google Cloud Console. Hanya masuk akal kalau target mailbox-nya memang Gmail. |

## 4. Yang tidak bisa dihindari: backend

Browser tidak bisa bicara IMAP/SMTP — keduanya protokol TCP mentah, bukan HTTP. Dan
password mailbox tidak boleh ada di frontend. Jadi harus ada proses server.

Ini konsekuensi penting: **Mail yang nyata mustahil sebelum backend ada.** Sementara
backend belum ada, `spec.md` (UI mock) adalah satu-satunya jalur yang bisa jalan.

## 5. Tidak perlu database untuk versi pertama

IMAP sendiri sudah database-nya. Alur paling sederhana yang benar:

- buka inbox → ambil ~50 header terakhir dari IMAP
- klik satu email → baru ambil body-nya
- kirim → SMTP

Tanpa tabel, tanpa migrasi, tanpa sync. Konsekuensinya tiap pembukaan menunggu IMAP.

**Ini melanggar anggaran performa [policy §5](../../policy/1-engineering-policy.md)**
("jaringan tidak pernah ada di jalur render", "buka aplikasi → tampil < 300 ms"). Untuk
Mail, pelanggaran ini disadari dan diterima sementara: cache/offline baru dibangun kalau
Mail terbukti dipakai tiap hari. Membangun sync mail sebelum itu adalah menebak.

Catatan lanjutan: kalau nanti cache dibuat, **jangan** dipaksa masuk `POST /sync` milik
pohon node. Mail bukan pohon dan konfliknya bukan LWW — server IMAP adalah sumber
kebenarannya, kita hanya cermin baca.

## 6. Bentuk API — belum diputuskan, dan ini konflik nyata

Usulan awal dalam diskusi adalah Express + empat endpoint REST:

```
GET  /api/mail/messages          list header
GET  /api/mail/messages/:uid     isi satu email
POST /api/mail/send              kirim / reply
POST /api/mail/messages/:uid/read  tandai dibaca
```

**Usulan itu bertentangan dengan dua keputusan yang sudah berdiri:**

1. [`../2.backend/notes.md`](../2.backend/notes.md) memilih **Hono**, bukan Express, dan
   struktur `apps/api`, bukan folder `server/` terpisah.
2. [Policy §2](../../policy/1-engineering-policy.md) melarang "REST CRUD lengkap" dengan
   alasan "satu endpoint sudah cukup — `POST /sync`".

Argumen tandingannya: aturan satu-endpoint itu tentang **sinkronisasi pohon node**, di
mana banyak endpoint berarti banyak jalur yang harus konsisten satu sama lain. Mail bukan
pohon dan tidak disinkronkan — ia proxy baca/tulis ke server orang lain. Memaksa
`fetchMessage` dan `sendMail` masuk satu amplop `POST /sync` menyamarkan dua operasi yang
memang berbeda.

**Belum diputuskan.** Kalau REST dipilih, [policy §9](../../policy/1-engineering-policy.md)
mewajibkan alasannya ditulis. Yang sudah pasti: framework-nya **Hono** dan tempatnya
**`apps/api`**, mengikuti keputusan yang ada. Tidak ada Express, tidak ada folder `server/`.

## 7. Config harus provider-agnostic sejak baris pertama

Modul IMAP/SMTP **menerima config sebagai parameter**, tidak membaca `process.env` di
dalamnya:

```ts
// bukan ini — terikat ke satu sumber
const client = new ImapFlow({ host: process.env.IMAP_HOST, ... })

// tapi ini — sumbernya bisa apa saja
function createImapClient(config: MailAccountConfig) { ... }
```

`.env` jadi salah satu sumber config, bukan satu-satunya. Halaman Settings nanti tinggal
jadi sumber kedua tanpa mengubah modul mail.

Ini **bukan** pelanggaran [policy §1](../../policy/1-engineering-policy.md) ("jangan bikin
config untuk kasus yang belum ada") — tidak ada flag, tidak ada opsi, tidak ada abstraksi
tambahan. Yang berbeda hanya dari mana satu objek config dibaca. Biayanya nol baris.

### Kompatibilitas provider

| Provider | Status |
|---|---|
| Hostinger / Niagahoster / Zoho / Fastmail / cPanel | password biasa — jalan |
| Gmail | butuh **App Password** (2FA harus aktif). Password akun ditolak. |
| Outlook / Microsoft 365 | basic auth dimatikan — **OAuth2 saja**. Tidak bisa lewat config. |
| Proton | tanpa IMAP publik, butuh Proton Bridge lokal (berbayar) |

Dukungan Outlook bukan soal config — itu butuh OAuth flow tersendiri. Di luar lingkup.

## 8. Keamanan

**Kredensial.** Untuk satu pengguna, `.env` di sisi API sudah cukup — masuk `.gitignore`,
tidak pernah menyentuh frontend, tidak pernah dikirim lewat chat. Enkripsi at-rest dan
login baru relevan kalau ada akun kedua.

**Body HTML email adalah permukaan serangan.** Isinya HTML dari pengirim yang tidak
dikenal. Wajib: sanitasi (DOMPurify) **dan** render di `<iframe sandbox>` supaya CSS
pengirim tidak membajak layout aplikasi.

Ini tidak boleh ditunda meski versi pertama, karena menambahkannya belakangan berarti
membongkar komponen reading pane yang sudah jadi.

## 9. Dua jebakan implementasi

**Email terkirim tidak otomatis masuk folder Sent.** SMTP hanya mengirim, tidak menyimpan.
Salinannya harus di-`APPEND` manual ke folder Sent lewat IMAP. Kalau terlewat: user
mengirim email, membuka Sent, kosong.

**Reply butuh header threading.** Subject `"Re: ..."` saja tidak cukup — tanpa
`In-Reply-To` dan `References` yang diisi dari `Message-ID` email asal, threading rusak di
sisi penerima. Artinya `Message-ID` wajib disimpan saat membaca, bukan dibuang.

## 10. Model data mock belum cocok dengan IMAP

`MailMessage` di [`spec.md`](./spec.md) dirancang untuk data mock dan belum membawa yang
dibutuhkan IMAP:

| Kebutuhan IMAP | Status di `MailMessage` |
|---|---|
| `uid` — nomor per folder, **berubah** kalau mailbox di-reset | tidak ada |
| `messageId` — ID global `<...@host>`, dasar threading | tidak ada; `inReplyTo` sekarang menunjuk `id` lokal |
| `folder` sebagai path IMAP asli (`INBOX`, `INBOX.Sent`) | ada, tapi berupa union literal buatan sendiri |
| body HTML terpisah dari teks | `body: string` tunggal |

Penyesuaian ini dilakukan **saat menyambung ke IMAP**, bukan sekarang. UI mock tidak perlu
menanggung bentuk data yang belum dipakai — itu justru pelanggaran
[policy §1](../../policy/1-engineering-policy.md).

## 11. Yang belum diputuskan

- Apakah Mail nyata masuk sebelum atau sesudah dogfood todo+outline terbukti
- Bentuk API: REST beberapa endpoint (butuh justifikasi tertulis) atau bentuk lain
- Kapan cache/offline dibangun, dan apakah pakai Dexie yang sama atau terpisah
- Folder mana saja yang dibaca di versi pertama (INBOX saja, atau semua)
- Kapan halaman Settings dibuat — ditunda sampai mail client terbukti jalan, karena bentuk
  UI-nya tidak bisa dirancang sebelum ada yang bisa disetting
