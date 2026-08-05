# Todo: Backend Todo — Paritas Todoist

Urutan eksekusi [spec.md](spec.md). Prasyarat: fase 0 selesai. Tiap blok
berakhir dengan verifikasi; `npm run verify` adalah gate di setiap commit.

Urutannya dipilih supaya **aplikasi bisa dipakai sedini mungkin**: blok A–E
sudah menghasilkan Todoist yang berfungsi penuh untuk satu hari kerja;
sisanya menambah lapisan.

> **Status (2026-08-06):** A, B (untuk `node`), C, dan E selesai dan
> terverifikasi manual di browser + otomatis. D selesai sebagian — hanya
> view Today yang benar-benar dikabelkan ke UI baru (`TodayReal.tsx`),
> bukan refactor `MainContent.tsx` yang sesungguhnya. F–J belum dimulai.
> Rincian di laporan akhir sesi.

## A. Core — aturan sebelum penyimpanan

- [x] `core/rank.ts` — `between(a, b)`, `rebalance(ranks)` + tes: rank
      duplikat, pertumbuhan panjang, sisipan berulang di posisi sama
- [x] `core/tree.ts` — `indent` `outdent` `move` (mencakup insert/reparent);
      tolak siklus + tes tiap operasi termasuk no-op. `complete` belum jadi
      fungsi core terpisah — sejauh ini ditulis langsung di
      `node-actions.ts` (`toggleTaskComplete`), bukan `core/tree.ts`
- [x] `core/date.ts` — resolusi tanggal lewat timezone eksplisit (bukan UTC,
      bukan jam device) — nama fungsi `localDate`/`todayInTimezone`, bukan
      persis seperti draf awal
- [x] **Verifikasi:** `npm test` hijau; tidak ada I/O di `core`

## B. Skema & sync multi-entitas

- [x] `db/schema/node.ts` — tabel `node` + index + CHECK (jam butuh tanggal,
      recurring butuh tanggal) + `is_inbox` (koreksi dari `ROOT_INBOX_ID`
      bersama — lihat spec §3.1a)
- [x] `db/schema/label.ts`, `saved_filter`, `reminder`, `notification`,
      `push_subscription`, `completion` — **skema ada, tapi belum ada route
      sync untuk kelimanya.** `modules/sync/routes.ts` saat ini hanya
      membawa entitas `nodes`; `labels`/`filters`/`reminders` di kontrak
      wire (`dto.ts`) belum ditambahkan
- [x] `ALTER app_user` — timezone, week_start, default_remind_time,
      digest_time, language
- [x] Satu sequence `seq` (`sync_seq`) dipakai semua tabel syncable
- [x] `modules/sync/routes.ts` — `POST /api/sync` untuk `nodes`: Zod, LWW
      baris (termasuk penjaga lintas-user pada `onConflictDoUpdate`), batch
      500, **selalu `WHERE user_id`**. Envelope multi-entitas penuh
      (labels/filters/reminders/notifications turun) **belum**
- [x] `scripts/user.ts add` — membuat root Inbox milik user baru,
      transaksional
- [x] **Verifikasi (integrasi, Postgres asli):** bootstrap cursor "0"; LWW dua
      arah; tombstone; cursor tertinggal; batch > 500 ditolak; **kasus
      isolasi baru di `test/isolation.test.ts`** — termasuk percobaan
      user B menimpa node user A lewat id yang sama, ditolak diam-diam dan
      diverifikasi manual lewat curl sebelum ditulis jadi tes

## C. Store klien & pemindahan data

- [x] `apps/web/src/store/` — Dexie (`db.ts`), outbox (koalesk per node id
      di `db.outbox`, keyed by `nodeId`), sync client (`sync-client.ts`:
      debounce 400 ms + polling 5 detik, banner offline, retry otomatis)
- [ ] `mockData.ts` dihapus; `projects`/`labels` dialirkan lewat store —
      **belum**: `mockData.ts` masih dipakai Sidebar/MainContent/dll untuk
      semua view selain Today
- [x] Id klien → `core/id.ts` (UUIDv7) — dipakai di `node-actions.ts`
- [ ] Hard delete → `deleted_at` — sudah benar di jalur BARU
      (`node-actions.ts`), tapi `App.tsx`'s `handleDeleteTask` (mock) masih
      hard-delete karena belum disentuh; `subTasks[]` belum di-flatten (tidak
      ada UI subtask baru di slice ini)
- [x] **Verifikasi:** matikan API → quick-add & toggle-complete tetap jalan +
      banner "Offline — changes saved locally"; nyalakan → konvergen otomatis
      dalam satu interval poll, dikonfirmasi langsung di Postgres

## D. View & refactor MainContent

- [x] `core/views.ts` — `today` (+blok overdue), `upcoming`, `inbox`,
      `project`, `completed`, plus `subtreeDepthFirst` (dipakai bersama
      Outline nanti) + tes tiap fungsi. **Belum ada:** `label`, `search`,
      grouping/sorting selain urutan today (tanggal/prioritas/project/
      section)
- [ ] **`MainContent.tsx` dipecah** — **belum dilakukan.** Pendekatan yang
      dipakai sesi ini: `TodayReal.tsx` baru dibangun di samping
      `MainContent.tsx` yang lama, alih-alih membedah komponen 572-baris itu.
      Ini pilihan sadar untuk memprioritaskan satu jalur nyata yang bekerja
      penuh — tapi berarti pekerjaan refactor yang sebenarnya masih di depan
- [ ] Badge sidebar dari store — **belum**; Sidebar masih membaca `tasks`
      mock untuk hitungannya
- [x] **Verifikasi (untuk Today saja):** task di kedalaman mana pun dengan
      `due_date` muncul; Upcoming (fungsi core, belum ada UI-nya) tidak
      memuat task tanpa tanggal; "hari ini" dihitung dari timezone user API,
      bukan UTC/jam device

## E. Quick add & tanggal natural

- [x] `core/parse.ts` — tanggal (relatif ID/EN, hari bernama + "depan"/
      "next", eksplisit d/m, ISO, nama bulan), jam (jam/bare/am-pm), durasi,
      `#project`, `@mention` (diekstrak, lihat catatan di bawah), `$label`,
      `!1–!4`, `spans` untuk penyorotan; aturan paling-kanan-menang dengan
      penanganan nested match. **Belum:** frasa relatif majemuk ("minggu
      depan" tanpa nama hari, "N hari lagi", "bulan depan", "akhir bulan")
      dan `core/recurrence.ts` — field `recurrence` selalu `null` di versi
      ini, didokumentasikan sebagai batas cakupan di kepala file
- [x] Tes tabel input→output + kalimat jebakan (harga `$5`, seruan `bagus!`,
      `p1` yang bukan token, dua tanggal/jam sekaligus, nested "jam 9:00") —
      57 tes lulus, **belum diukur coverage persisnya (%) tapi setiap
      cabang bersyarat di modul disentuh minimal satu tes**
- [ ] UI: penyorotan `spans` di dalam input (data sudah ada dari parser,
      belum dirender sebagai highlight); autocomplete `#`/`@`/`$` +
      tawaran buat baru — **belum**, quick-add saat ini kirim teks polos
- [ ] `q` (global) dan `a` (di view) membuka quick add — **belum ada
      shortcut**; input quick-add selalu terlihat di atas Today
- [x] **Verifikasi:** quick-add "rapat tim hari ini jam 2 siang #Work
      $penting !2" diuji langsung di browser — parse benar, tersimpan ke
      Postgres, tampil di Today terurut oleh jam — **dogfood-nya memang
      sudah bisa dimulai untuk Today**, tapi fitur di atas (highlight,
      autocomplete, shortcut) menyusul

## F. Project, section, label, board

- [ ] CRUD project/section lewat UI — **belum**. Quick-add's `#project`
      resolusi hanya pencarian substring case-insensitive di
      `node-actions.ts`; tidak ada UI untuk membuat/mengelola project atau
      section secara eksplisit
- [ ] Drag lintas section/project — belum (Today belum punya drag; mock
      Board masih pakai drag lama tanpa rank)
- [ ] Board — belum disentuh, masih 100% mock
- [x] **Manajemen label — sekarang benar-benar berfungsi**, bukan cuma
      terlihat jalan: `db/schema/label.ts` dapat route sync sendiri
      (`modules/sync/routes.ts` mendukung entitas `labels` di envelope
      multi-entitas, satu cursor bersama `nodes`), Dexie punya tabel
      `labels`, dan `label-actions.ts` di klien meng-cocokkan `$name` dari
      parser ke label yang sudah ada (case-insensitive) atau membuat baru
      — dites lulus di 6 test backend (round-trip, LWW, isolasi
      antar-user, penolakan nama berspasi) **dan** diverifikasi manual di
      browser: dua task dengan `$rumah` menghasilkan **satu** baris label,
      dikonfirmasi langsung di Postgres. **Belum ada**: UI mengelola label
      (rename/warna/favorit/hapus) — hanya penciptaan implisit dari
      quick-add yang berjalan
- [ ] Warna/favorit/rename label lewat UI — belum ada halaman "Filters &
      Labels" yang nyata (masih mock)

Catatan tersendiri, ditemukan saat mengerjakan blok ini: migrasi skema
Dexie dari v1 ke v2 sempat gagal total (`UpgradeError: Not yet support
for changing primary key`) karena percobaan pertama mengubah primary key
tabel `outbox` langsung — Dexie tidak mendukung itu. Diperbaiki mengikuti
pola resmi Dexie (tabel baru `pending` di versi 2 sambil migrasi data dari
`outbox` lama, lalu ganti nama balik ke `outbox` di versi 3) — lihat
`apps/web/src/store/db.ts`. **Siapa pun yang menambah kolom baru ke
tipe `Node`/`Label` di kemudian hari harus lewat `.stores()` yang menambah
index, bukan mengubah key path store yang sudah ada.**

## G. Filter tersimpan & pencarian

- [ ] Belum dimulai — `core/filter.ts` tidak ada

## H. Recurring

- [ ] Belum dimulai — `core/recurrence.ts` tidak ada; field `recurrence`
      selalu `null`

## I. Reminder & notifikasi

- [ ] Belum dimulai — tabel `reminder`/`notification`/`push_subscription`
      ada di skema tapi tidak ada scheduler, tidak ada route push, tidak
      ada UI

## J. Pelengkap

- [ ] Halaman Settings — belum (timezone user memakai default `Asia/Jakarta`
      dari `app_user`, tidak ada UI untuk mengubahnya)
- [ ] Keyboard shortcut — belum, di luar submit form biasa (Enter)
- [ ] `⌘Z` undo — belum
- [ ] E2E Playwright — belum ada test runner Playwright terpasang; jalur
      "quick-add → Today → centang" sudah diverifikasi **manual** via
      browser tool, bukan sebagai E2E otomatis
- [ ] Cron backup `pg_dump` — belum diaktifkan; menunggu VPS sungguhan
      (lihat 0.infrastructure/todo.md blok G)

## Definisi selesai fase 1

Tiga user memakainya dari HP dan laptop, dan owner melewati **dua minggu
berturut-turut tanpa membuka Todoist**. Repo siap menerima fase 2 (Outline)
tanpa migrasi skema baru — pohonnya sudah ada. **Belum tercapai**: fase 1
punya satu jalur nyata (Today + quick-add) yang bekerja penuh dan
terverifikasi, tapi blok F–J — termasuk seluruh manajemen project/label,
Board, filter, recurring, notifikasi, dan migrasi total menjauh dari
`mockData.ts` — masih di depan sebelum kriteria ini bisa dicentang.
