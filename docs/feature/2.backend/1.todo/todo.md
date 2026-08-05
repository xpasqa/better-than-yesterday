# Todo: Backend Todo — Paritas Todoist

Urutan eksekusi [spec.md](spec.md). Prasyarat: fase 0 selesai. Tiap blok
berakhir dengan verifikasi; `npm run verify` adalah gate di setiap commit.

Urutannya dipilih supaya **aplikasi bisa dipakai sedini mungkin**: blok A–E
sudah menghasilkan Todoist yang berfungsi penuh untuk satu hari kerja;
sisanya menambah lapisan.

## A. Core — aturan sebelum penyimpanan

- [ ] `core/rank.ts` — `between(a, b)`, `rebalance(ranks)` + tes: rank
      duplikat, pertumbuhan panjang, sisipan berulang di posisi sama
- [ ] `core/tree.ts` — `insert` `move` `indent` `outdent` `complete`
      `reparent`; tolak siklus; depth cap 50 saat baca + tes tiap operasi
      termasuk no-op
- [ ] `core/date.ts` — resolusi tanggal di timezone user (bukan UTC, bukan
      jam device)
- [ ] **Verifikasi:** `npm test` hijau; tidak ada I/O di `core`

## B. Skema & sync multi-entitas

- [ ] `db/schema/node.ts` — tabel `node` + tiga index + dua CHECK (jam butuh
      tanggal, recurring butuh tanggal)
- [ ] `db/schema/label.ts`, `saved_filter`, `reminder`, `notification`,
      `push_subscription`, `completion`
- [ ] `ALTER app_user` — timezone, week_start, default_remind_time,
      digest_time, language
- [ ] Satu sequence `seq` dipakai semua tabel syncable
- [ ] `modules/sync/routes.ts` — `POST /api/sync`, envelope multi-entitas,
      Zod per entitas, LWW baris, batch 500, **selalu `WHERE user_id`**
- [ ] `scripts/user.ts add` diperluas: membuat root Inbox milik user baru
- [ ] **Verifikasi (integrasi, Postgres asli):** bootstrap cursor "0"; LWW dua
      arah; tombstone; cursor tertinggal; batch > 500; **kasus isolasi baru di
      `test/isolation.test.ts`** — user B mendapat 404 atas data user A

## C. Store klien & pemindahan data

- [ ] `apps/web/src/store/` — Dexie schema, outbox (koalesk per entitas),
      sync worker (backoff, banner offline, 401 → login dengan outbox utuh)
- [ ] `mockData.ts` dihapus; `projects`/`labels` dialirkan lewat store
- [ ] Id klien → `core/id.ts` (UUIDv7) di semua tempat
- [ ] Hard delete → `deleted_at`; `subTasks[]` di-flatten jadi node anak
- [ ] **Verifikasi:** matikan API → semua operasi jalan + banner; nyalakan →
      konvergen; refresh → pohon < 300 ms dari Dexie

## D. View & refactor MainContent

- [ ] `core/views.ts` — inbox, today (+blok overdue), upcoming, project,
      label, completed, search; grouping (tanggal/prioritas/project/label/
      section) dan sorting + tes tiap kombinasi yang dipakai UI
- [ ] **`MainContent.tsx` dipecah**: filter → `core/views.ts`, state → store,
      komponen tinggal render
- [ ] Badge sidebar dari store; empty state tiap view
- [ ] **Verifikasi:** task di kedalaman 5 muncul di Today; Upcoming tidak
      memuat task tanpa tanggal; "hari ini" berganti di tengah malam timezone
      user

## E. Quick add & tanggal natural

- [ ] `core/parse.ts` — tanggal, jam, durasi, `#project`, `@task`, `$label`,
      `!1–!4`, **`spans` untuk penyorotan**; kosakata ID+EN; aturan
      paling-kanan; batas kata
- [ ] Tes tabel input→output + kalimat jebakan (kata mirip token, dua
      tanggal, harga `$5`, seruan `bagus!`, `p1` yang bukan token) —
      **100% branch**
- [ ] UI: penyorotan di dalam input, chip hasil, `Esc` membatalkan token,
      autocomplete `#`/`@`/`$` + tawaran membuat yang belum ada
- [ ] `q` (global) dan `a` (di view) membuka quick add
- [ ] **Verifikasi:** kriteria "Parser & capture" di spec §13 tercentang
      — **di titik ini dogfood dimulai**

## F. Project, section, label, board

- [ ] CRUD project (nested, warna, favorit) & section; hapus section →
      re-parent anak
- [ ] Drag lintas section/project = `parent_id` + `rank`, satu baris per
      perpindahan
- [ ] Board: kolom section; grouping alternatif (prioritas/tanggal) dengan
      kolom baca-tulis kecuali kolom relatif (`Overdue`)
- [ ] Manajemen label: buat, rename (berlaku global tanpa menulis node),
      warna, favorit, hapus (task pemakainya tetap utuh)
- [ ] **Verifikasi:** kriteria "Struktur & view" + "Label" di spec §13

## G. Filter tersimpan & pencarian

- [ ] `core/filter.ts` — parser bahasa query §7 → predikat murni; error
      menunjuk posisi karakter + tes (termasuk query salah)
- [ ] CRUD saved filter, favorit ke sidebar
- [ ] Pencarian judul & catatan; `⌘K` command palette (task, project, label,
      filter)
- [ ] **Verifikasi:** `#Kerja* & -$nunggu` benar; query rusak memberi pesan
      berguna

## H. Recurring

- [ ] `core/recurrence.ts` — parse teks ID/EN → RRULE subset; `next(rrule,
      from)` + tes akhir bulan, tanggal 31, tahun kabisat, DST
- [ ] Menyelesaikan task recurring memajukan tanggal + menulis `completion` +
      menulis ulang `fire_at` reminder; `skip` memajukan tanpa `completion`
- [ ] View Completed menampilkan occurrence
- [ ] **Verifikasi:** kriteria "Recurring" di spec §13

## I. Reminder & notifikasi

- [ ] `modules/notify/scheduler.ts` — cron menit-an, transaksional +
      idempoten, lewati task selesai/terhapus
- [ ] Web Push: VAPID keys di env, `POST /api/push/subscribe` &
      `/unsubscribe`, `GET /api/push/vapid-key`, hapus subscription saat 410
- [ ] Service worker + alur izin di web; PWA manifest (agar iOS bisa push)
- [ ] UI reminder di detail task (absolut & relatif); feed lonceng dari tabel
      `notification`; `POST /api/notifications/:id/read`
- [ ] Digest harian opsional
- [ ] **Verifikasi:** notifikasi sampai di HP saat tab tertutup; restart
      container tidak mengirim dobel; hapus task membatalkan reminder

## J. Pelengkap

- [ ] Halaman Settings: timezone, awal minggu, jam reminder default, digest,
      bahasa parser
- [ ] Semua keyboard shortcut §10 + layar `?`
- [ ] `⌘Z` undo (selesai, hapus, reorder, reschedule)
- [ ] E2E Playwright: quick add → Today → centang; drag board; siklus label
- [ ] Cron backup `pg_dump` **diaktifkan** (sekarang ada data asli) + satu
      kali latihan restore ke database scratch
- [ ] **Verifikasi:** seluruh Success Criteria spec §13 tercentang

## Definisi selesai fase 1

Tiga user memakainya dari HP dan laptop, dan owner melewati **dua minggu
berturut-turut tanpa membuka Todoist**. Repo siap menerima fase 2 (Outline)
tanpa migrasi skema baru — pohonnya sudah ada.
