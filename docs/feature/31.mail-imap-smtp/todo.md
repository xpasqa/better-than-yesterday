# Mail IMAP/SMTP — Todo

Checklist mengikuti blok di [`plan.md`](./plan.md). Centang saat **terverifikasi
jalan**, bukan saat selesai ditulis.

**Status: kode blok A–G sudah merged ke master (`6d798d6`, epic #111).**
Status PARKED yang lama sudah tidak berlaku — fiturnya dikerjakan lebih awal
dari rencana fase 5.

**Kotak di bawah sengaja dibiarkan kosong.** Kodenya ada dan seluruh suite
otomatis hijau (unit + e2e), tapi tidak ada yang pernah menelusuri checklist
ini butir demi butir — dan aturan di atas jelas: centang saat *terverifikasi
jalan*. Mencentangnya massal hanya karena commit-nya ada akan membuat dokumen
ini berbohong. Yang belum tersentuh sama sekali adalah verifikasi terhadap
server IMAP/SMTP sungguhan: `mail-account.test.ts` melewati 4 tes yang
membutuhkannya (`4 skipped`), jadi jalur jaringan Blok E–F belum pernah
dibuktikan end-to-end. Telusuri daftar ini sebelum kartu #111 boleh pindah
ke **Done**.

## Blok A — Fondasi
- [ ] Dependensi terpasang: `imapflow`, `nodemailer`, `mailparser`, `isomorphic-dompurify`
- [ ] `http/crypto.ts` jadi lokasi bersama; `modules/agent/crypto.ts` jadi re-export
- [ ] Tes crypto: round-trip, IV acak, payload rusak ditolak
- [ ] Tabel `mail_account` + migrasi Drizzle ter-generate dan diperiksa
- [ ] `mail_account` masuk daftar `truncate` di `test/helpers.ts`

## Blok B — Pemetaan peran folder (murni)
- [ ] `resolveFolderRoles()` di `packages/core`
- [ ] `specialUse` server menang atas pencocokan nama
- [ ] Layout cPanel `INBOX.Sent` / `INBOX.spam` terpetakan
- [ ] Peran yang tidak ditemukan dilaporkan lengkap, bukan gagal diam-diam
- [ ] Export `./mail-folders` di `packages/core/package.json`

## Blok C — Id komposit & threading (murni)
- [ ] `encodeMailId`/`decodeMailId`, id rusak ditolak (`inbox:abc`, `bogus:1`, `inbox:1:2`)
- [ ] `buildReplyHeaders`: `In-Reply-To` + rantai `References` benar
- [ ] Tidak menumpuk prefiks (`Re: Re:`), case-insensitive
- [ ] `Fwd:` untuk forward
- [ ] Sumber tanpa `Message-ID` → tanpa header threading, subject tetap berprefiks
- [ ] Export `./mail-id` dan `./mail-threading`

## Blok D — Sanitasi & blokir gambar
- [ ] `<script>` dan handler `on*` hilang
- [ ] `src`/`srcset`/`background`/`poster` pindah ke `data-blocked-*`
- [ ] `javascript:` href dinetralkan
- [ ] Format biasa dan tautan normal tetap utuh

## Blok E — Akun & Settings
- [ ] `withImap()` dengan `disableAutoIdle: true`, koneksi selalu ditutup
- [ ] `testConnection()`: IMAP login + SMTP verify + `list()` → peran folder
- [ ] Tiga kode error terpetakan: `MAIL_AUTH_FAILED` 401, `MAIL_UNAVAILABLE` 503, `MAIL_FOLDERS_UNRESOLVED` 422
- [ ] `GET /account` tanpa akun → 404 `MAIL_NOT_CONFIGURED`
- [ ] `PUT` gagal uji koneksi → **tidak ada baris tersimpan**
- [ ] `GET` tidak pernah mengembalikan password dalam bentuk apa pun
- [ ] `PUT` dengan password kosong mempertahankan password lama
- [ ] Router ter-mount di `app.ts` di belakang `requireAuth`
- [ ] **Isolasi:** user B dapat 404 atas akun user A, akun A tetap utuh

## Blok F — Baca & tulis pesan
- [ ] DTO cocok tipe frontend persis (`id`, `folder`, `isRead`, `receivedAt`, `attachments`)
- [ ] `listMessages` terpaginasi lewat `beforeUid`, batas maks 200
- [ ] `flagged` menggabungkan lintas kelima folder
- [ ] `getMessage` mengurai badan lewat `mailparser`, HTML tersanitasi
- [ ] `setFlags` memakai `{ uid: true }`
- [ ] `DELETE` memindahkan ke path Trash, bukan menghapus permanen
- [ ] Kirim: header threading benar + `APPEND` ke path Sent
- [ ] `APPEND` gagal tetap `200` dengan `appendedToSent: false`
- [ ] Tidak ada perintah IMAP di dalam loop `fetch()` — `fetchAll()` dipakai

## Blok G — Frontend
- [ ] `bodyHtml?: string` ditambahkan ke tipe frontend (satu-satunya penambahan)
- [ ] Klien `apps/web/src/api/mail.ts`
- [ ] Reading pane pakai `<iframe sandbox>` tanpa `allow-scripts`/`allow-same-origin`
- [ ] Tombol "Tampilkan gambar" mengembalikan `data-blocked-src` → `src`
- [ ] `MailView` mengambil dari API; `mockData.ts` dipertahankan sebagai fixture
- [ ] Tiga keadaan kegagalan punya UI, bukan daftar kosong
- [ ] Halaman Settings mail + tombol "Test connection"
- [ ] E2E `e2e/mail.spec.ts` hijau

## Gate selesai
- [ ] `npm run verify` hijau
- [ ] `npm run test:e2e` hijau
- [ ] **Verifikasi manual dijalankan:** baca email sungguhan, balas, cek muncul di Sent dan ter-thread benar di klien mail lain
- [ ] Merged ke `master`, semua issue tertutup, `verify` hijau di hasil merge
