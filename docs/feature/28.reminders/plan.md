# Plan: Reminder & notifikasi web push

Keputusan §6 spec sudah diambil: **penjadwal jalan sebagai `node-cron` di
dalam proses API** (bukan cron sistem, bukan antrean). Alasan yang dipilih:
paling sederhana untuk skala saat ini, satu deploy, terlihat di
`docker compose logs api`. Trade-off yang diterima secara sadar: ikut mati
kalau API restart (dampaknya kecil — cron berikutnya menyusul dalam menit,
`reminder_due` tetap konsisten), dan tidak boleh menjalankan API lebih dari
satu replika sampai ini diganti antrean sungguhan (di luar skala proyek ini
sekarang).

---

## Blok A — `reminder` masuk `/api/sync` + store + hitung ulang `fireAt`

**File:** `apps/api/src/modules/sync/dto.ts`, `routes.ts` (tambah `reminder`
ke `syncRequest`, `applyIncomingReminders` — LWW + ownership guard sama
persis dengan `applyIncomingCompletions`, pull juga ikut `reminder`).
`apps/web/src/store/reminder-actions.ts` (baru) — `createReminder`,
`deleteReminder`, `recalculateFireAt(nodeId)` dipanggil dari `updateNode`
tiap kali `dueDate`/`dueTime` node itu berubah (spec §3, kewajiban bukan
catatan kaki — kalau lupa, reminder berbunyi di waktu yang basi).

`fireAt` dihitung di client dari `dueDate` + `dueTime` + (`remindAt` mutlak
atau `offsetMin` sebelum waktu jatuh tempo) dalam timezone user — pola yang
sama dengan `todayInTimezone`.

## Blok B — UI reminder di `NodeDetailModal`

Field baru sejajar dengan Date/Priority/Tags yang sudah ada: "Remind me" —
tombol buka dropdown pilih relatif (saat jatuh tempo, 30 menit sebelum, 1 jam
sebelum, 1 hari sebelum) atau tanggal+jam mutlak. Daftar reminder aktif pada
task itu, masing-masing bisa dihapus.

## Blok C — Service worker + manifest + langganan + alur izin

`apps/web/public/sw.js` (baru), manifest PWA minimal. Izin notifikasi
**diminta tepat saat reminder pertama dibuat** (spec §3 — bukan saat app
dibuka; ditolak sekali berarti browser diam untuk permintaan berikutnya).
Berlangganan via `PushManager.subscribe`, kirim `endpoint`/`p256dh`/`auth` ke
`POST /api/push-subscriptions` (baru, di luar `/sync` — spec §1 milik
perangkat, bukan data).

Deploy: `sw.js` harus disajikan dari root dengan header cache yang benar
(bukan di-cache nginx berhari-hari) — sentuh
`/etc/nginx/conf.d/bty.xvntr.my.id.conf`, tambahkan `Cache-Control: no-cache`
khusus untuk `/sw.js`.

## Blok D — Penjadwal server (`node-cron`) + `web-push` + VAPID + 410

`apps/api/src/modules/reminders/scheduler.ts` (baru). `node-cron` tiap 1
menit: query `reminder_due` index (sudah ada, parsial `WHERE deliveredAt IS
NULL`), kirim lewat `web-push` ke tiap `push_subscription` milik user itu,
tandai `deliveredAt`. Endpoint yang me-return 410/404 → tandai
`push_subscription.failedAt`, jangan dicoba lagi (spec §3 — wajib ditandai,
bukan ditelan diam-diam).

VAPID: generate sepasang kunci (`web-push generate-vapid-keys`), simpan di
`.env` (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`), publik key
diekspos ke client lewat endpoint yang sudah ada polanya
(`GET /api/config` atau serupa — cek apakah sudah ada tempat config publik
sebelum bikin baru).

Registrasi cron: satu pemanggilan `cron.schedule(...)` di `apps/api/src/index.ts`
saat proses start, dijaga guard `NODE_ENV !== 'test'` supaya suite test tidak
ikut menjalankan penjadwal sungguhan.

## Blok E — `notification` mengalir ke klien + tanda terbaca

`notification` ikut `/api/sync` (pull-only dari sisi server — client tidak
pernah menulis baris `notification`, spec §1). UI: `Sidebar.tsx:247` sudah
merender tombol lonceng (`sidebar__bell`, `BellIcon`) tapi **tanpa
`onClick`** — dead button, kelas yang sama dengan Search/Add task yang
sudah diperbaiki sesi sebelumnya. Blok ini menyambungkannya: badge count
`readAt IS NULL`, klik membuka daftar, klik satu notifikasi → `PATCH`
tandai `readAt`.

---

## Urutan pengerjaan

A → C → D dulu (jalur inti: buat reminder → izin+langganan → benar-benar
terkirim, bisa diverifikasi end-to-end lebih awal). B menyusul (UI-nya
independen dari D). E paling akhir — E tidak memblokir apa pun sebelumnya.

## Kenapa belum diimplementasikan di sesi yang sama dengan menulis plan ini

Lima blok, tiga di antaranya infrastruktur yang riskan diburu-buru (service
worker dengan siklus hidup deploy sendiri, kunci VAPID, langganan push yang
verifikasinya butuh device/browser sungguhan menerima notifikasi saat app
tertutup — bukan sekadar diklik di Playwright headless). Sesi yang menulis
plan ini menghabiskan waktu membuktikan berkali-kali bahwa "kode ada" dan
"terverifikasi jalan" adalah dua klaim berbeda — menerapkan itu di sini
berarti tidak mengklaim blok D selesai sampai reminder sungguhan diterima di
perangkat sungguhan, bukan cuma baris `deliveredAt` terisi di database.

## Success Criteria

Sama seperti [spec.md](spec.md) §5 — tidak berubah.
