# Spec: Reminder & notifikasi web push

**Tanggal:** 2026-08-08
**Status:** **Ready.** Keputusan §6 sudah diambil (`node-cron` di proses API) — lihat [plan.md](plan.md) dan [todo.md](todo.md).
**Menutup:** `1.todo/todo.md` blok I (seluruhnya)

---

## 1. Konteks

Ini **lubang terbesar** yang tersisa. Ia disebut di judul spec induk sebagai
bagian dari sasaran, skemanya sudah dirancang lengkap dan sudah ada di
database — dan kodenya **nol baris**.

Yang sudah berdiri:

| Tabel | Isi |
|---|---|
| `reminder` | `kind` absolute/relative · `fireAt` · `deliveredAt` · index parsial `reminder_due` untuk yang belum terkirim · CHECK `reminder_shape` |
| `notification` | dibuat server, klien hanya menandai terbaca |
| `push_subscription` | milik perangkat, **tidak lewat `/sync`** |

Rancangannya sudah memikirkan hal yang benar. Komentar di `reminder.ts`:

> `fireAt` dihitung di sisi klien dari due_date/due_time/offset dalam timezone
> user, jadi penjadwal sisi server tidak perlu tahu apa arti timezone untuk
> baris ini.

Itu keputusan bagus dan tetap dipakai.

Yang **tidak** ada, dan semuanya baru:
- `web-push` dan penjadwal — tidak ada di `package.json` mana pun
- Service worker — `apps/web/public/` cuma berisi favicon, fonts, icons
- Manifest PWA — tidak ada
- Kunci VAPID — belum dibuat
- Route sync untuk `reminder` — `/api/sync` baru menangani `nodes`,
  `labels`, `completions`

---

## 2. Scope

**In:**
- Membuat/menghapus reminder dari `NodeDetailModal`
- `reminder` ikut `/api/sync` (klien yang menulis)
- Service worker + berlangganan push + kelola izin
- Penjadwal sisi server yang membaca `reminder_due` dan mengirim
- `notification` mengalir ke klien (server yang menulis, klien menandai terbaca)

**Out (dengan alasan):**
- **Digest harian & pengingat overdue** — `notification.kind` sudah
  menyediakan `'digest'` dan `'overdue'`, tapi keduanya butuh keputusan produk
  sendiri (jam berapa? apa isinya? bisa dimatikan?). Enum-nya dibiarkan;
  fiturnya menyusul.
- **Notifikasi email** — saluran lain, penyedia lain, keputusan lain.
- **Reminder di task berulang** — `fireAt` dihitung sekali, sementara task
  berulang memajukan `dueDate` tiap diselesaikan. Butuh perhitungan ulang
  yang menempel di `toggleTaskComplete`. Ia bergantung pada [#23](https://github.com/xpasqa/better-than-yesterday/issues/23)
  dan pantas jadi kartu tersendiri, bukan diselundupkan ke sini.

---

## 3. Yang menentukan kesulitannya

**Izin notifikasi cuma bisa diminta sekali dengan enak.** Kalau ditolak,
browser mengingatnya dan permintaan berikutnya tidak menampilkan apa pun.
Jadi memintanya saat aplikasi pertama dibuka adalah kesalahan — ia harus
diminta tepat saat orang membuat reminder pertamanya, di mana alasannya
jelas.

**Service worker mengubah cara deploy.** Ia harus disajikan dari root
(`/sw.js`), dengan cache header yang benar, dan punya siklus hidup update
sendiri. Deploy hari ini menyalin `dist/` ke `/var/www/` — cukup, tapi
service worker yang di-cache nginx bisa membuat perangkat menempel di versi
lama berhari-hari.

**Berlangganan bisa kedaluwarsa diam-diam.** Push ke endpoint mati
mengembalikan 410/404. `push_subscription.failedAt` sudah disediakan untuk
ini; penjadwal wajib benar-benar menandainya, bukan cuma menelan error.

**`fireAt` dihitung klien — jadi ia bisa basi.** Kalau `dueDate` atau
`dueTime` task berubah, `fireAt` reminder-nya **wajib** dihitung ulang oleh
klien yang mengubahnya. Kalau tidak, pengingat berbunyi di waktu yang lama.
Ini konsekuensi langsung dari keputusan §1 yang bagus itu, dan harus ditulis
di rencananya sebagai kewajiban, bukan catatan kaki.

---

## 4. Blok kerja (kasar)

| Blok | Isi |
|---|---|
| A | `reminder` masuk `/api/sync` + `reminder-actions` di store + hitung ulang `fireAt` |
| B | UI reminder di `NodeDetailModal` |
| C | Service worker + manifest + berlangganan + alur izin |
| D | Penjadwal server + `web-push` + VAPID + penanganan 410 |
| E | `notification` mengalir ke klien + tanda terbaca |

---

## 5. Success Criteria

- [ ] Menambah reminder dari task detail dan ia bertahan lintas perangkat
- [ ] Notifikasi benar-benar tiba saat aplikasi tertutup
- [ ] Izin diminta saat reminder pertama dibuat, bukan saat aplikasi dibuka
- [ ] Mengubah tanggal/jam task menghitung ulang `fireAt` reminder-nya
- [ ] Berlangganan yang mati ditandai `failedAt`, bukan dicoba selamanya
- [ ] Reminder terkirim ditandai `deliveredAt` dan tidak pernah dikirim dua kali
- [ ] Service worker yang diperbarui benar-benar sampai ke perangkat

---

## 6. Keputusan penjadwal (sudah diambil)

Satu keputusan yang menentukan bentuk blok D:

> **Di mana penjadwalnya jalan?**

| Pilihan | Untung | Rugi |
|---|---|---|
| Cron sistem memanggil skrip, seperti `backup-db.sh` jam 3 pagi | Pola yang **sudah terbukti di server ini** (`0 3 * * * .../backup-db.sh`). Tidak menambah dependensi. Mati satu kali tidak menjatuhkan API | Granularitas semenit; satu proses lagi di luar `docker compose` |
| **`node-cron` di dalam kontainer API** ← dipilih | Satu tempat, satu deploy, terlihat di `docker compose logs` | Ikut mati kalau API restart; dua replika berarti dua kali kirim |
| Antrean sungguhan (BullMQ + Redis) | Percobaan ulang, backoff | Menambah Redis ke stack demi satu pekerjaan periodik. Berlebihan — melanggar [policy 1](../../policy/1-engineering-policy.md) |

**Dipilih: `node-cron` di dalam proses API.** Rugi yang diterima secara
sadar: ikut mati kalau API restart (dampaknya kecil — cron berikutnya
menyusul dalam menit, `reminder_due` tetap konsisten), dan tidak boleh
menjalankan API lebih dari satu replika sampai ini diganti antrean
sungguhan (di luar skala proyek ini sekarang). Rincian tiap blok, termasuk
blok D dengan keputusan ini: [plan.md](plan.md).
